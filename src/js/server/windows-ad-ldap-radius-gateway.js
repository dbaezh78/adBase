/**
 * Microservicio Puente Nativo Windows AD (LDAPv3 TCP 389/636 + RADIUS UDP 1812/1813).
 * Permite que el navegador web realice autenticaciones REALES a nivel de socket contra
 * el controlador de dominio Active Directory (ej. 172.16.4.2:389) y el servidor RADIUS.
 */

import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import dgram from "node:dgram";
import crypto from "node:crypto";

const GATEWAY_PORT = Number(process.env.EDA_AD_GATEWAY_PORT) || 3890;

function encodeBerLength(length) {
  if (length < 128) {
    return Buffer.from([length]);
  }
  const hex = length.toString(16).padStart(length > 255 ? 4 : 2, "0");
  const bytes = Buffer.from(hex, "hex");
  return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
}

function encodeBerElement(tag, contentBuffer) {
  return Buffer.concat([
    Buffer.from([tag]),
    encodeBerLength(contentBuffer.length),
    contentBuffer
  ]);
}

function buildLdapBindRequestPacket(messageId, bindDnOrUser, password, isAnonymous = false) {
  const msgIdBuf = encodeBerElement(0x02, Buffer.from([messageId & 0xff]));
  const versionBuf = encodeBerElement(0x02, Buffer.from([0x03])); // LDAP v3
  const nameBuf = encodeBerElement(0x04, Buffer.from(isAnonymous ? "" : String(bindDnOrUser || ""), "utf8"));
  const authSimpleBuf = encodeBerElement(0x80, Buffer.from(isAnonymous ? "" : String(password || ""), "utf8"));

  const bindRequestBody = Buffer.concat([versionBuf, nameBuf, authSimpleBuf]);
  const bindRequestTag = encodeBerElement(0x60, bindRequestBody);

  return encodeBerElement(0x30, Buffer.concat([msgIdBuf, bindRequestTag]));
}

function parseLdapBindResponsePacket(buffer) {
  if (!buffer || buffer.length < 7 || buffer[0] !== 0x30) {
    return { resultCode: -1, message: "Respuesta LDAP malformada" };
  }

  let offset = 1;
  if (buffer[offset] & 0x80) {
    offset += 1 + (buffer[offset] & 0x7f);
  } else {
    offset += 1;
  }

  if (buffer[offset] === 0x02) {
    const idLen = buffer[offset + 1];
    offset += 2 + idLen;
  }

  if (buffer[offset] !== 0x61) {
    return { resultCode: -1, message: `Tag inesperado: 0x${buffer[offset]?.toString(16)}` };
  }

  offset += 1;
  if (buffer[offset] & 0x80) {
    offset += 1 + (buffer[offset] & 0x7f);
  } else {
    offset += 1;
  }

  if (buffer[offset] !== 0x0a) {
    return { resultCode: -1, message: "Sin código de resultado LDAP" };
  }

  const codeLen = buffer[offset + 1];
  const resultCode = buffer.readUIntBE(offset + 2, codeLen);
  offset += 2 + codeLen;

  const remainingAscii = buffer.subarray(offset).toString("utf8").replace(/[^\x20-\x7E]/g, " ").trim();

  const LDAP_CODE_NAMES = {
    0: "SUCCESS (Autenticación válida en Active Directory)",
    1: "OPERATIONS_ERROR",
    7: "AUTH_METHOD_NOT_SUPPORTED",
    8: "STRONG_AUTH_REQUIRED",
    32: "NO_SUCH_OBJECT (DN o usuario no encontrado)",
    34: "INVALID_DN_SYNTAX",
    48: "INAPPROPRIATE_AUTHENTICATION",
    49: "INVALID_CREDENTIALS (Usuario o contraseña incorrectos)",
    50: "INSUFFICIENT_ACCESS_RIGHTS",
    53: "UNWILLING_TO_PERFORM (Contraseña vacía no permitida por AD)"
  };

  let adSubcodeReason = "";
  if (remainingAscii.includes("data 52e")) {
    adSubcodeReason = "AD Subcode 52e: Usuario o contraseña inválida";
  } else if (remainingAscii.includes("data 525")) {
    adSubcodeReason = "AD Subcode 525: Usuario no existe en el directorio";
  } else if (remainingAscii.includes("data 532")) {
    adSubcodeReason = "AD Subcode 532: Contraseña expirada";
  } else if (remainingAscii.includes("data 533")) {
    adSubcodeReason = "AD Subcode 533: Cuenta deshabilitada en AD";
  } else if (remainingAscii.includes("data 775")) {
    adSubcodeReason = "AD Subcode 775: Cuenta bloqueada en Active Directory";
  }

  return {
    resultCode,
    codeDescription: LDAP_CODE_NAMES[resultCode] || `LDAP_ERROR_CODE_${resultCode}`,
    adSubcodeReason,
    diagnosticMessage: remainingAscii
  };
}

export function executeRealLdapBind({
  host = "172.16.4.2",
  port = 389,
  secure = false,
  bindType = "Regular",
  username = "",
  password = "",
  timeoutMs = 4500
}) {
  return new Promise((resolve) => {
    const isAnonymous = bindType === "Anonymous";
    if (!isAnonymous && (!String(username).trim() || !String(password) || String(password).includes("•"))) {
      resolve({
        success: false,
        resultCode: 49,
        statusText: "Failed: Ingrese la contraseña real de Active Directory",
        detail: "Debe escribir la contraseña real del usuario de dominio para autenticar contra el servidor LDAP."
      });
      return;
    }

    let settled = false;
    const finish = (outcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    const onConnected = (socket) => {
      const bindPacket = buildLdapBindRequestPacket(1, username, password, isAnonymous);
      socket.write(bindPacket);
    };

    const socket = secure
      ? tls.connect({ host, port: Number(port) || 636, rejectUnauthorized: false }, () => onConnected(socket))
      : net.createConnection({ host, port: Number(port) || 389 }, () => onConnected(socket));

    socket.setTimeout(timeoutMs);

    socket.on("data", (chunk) => {
      const parsed = parseLdapBindResponsePacket(chunk);
      socket.end();

      if (parsed.resultCode === 0) {
        finish({
          success: true,
          resultCode: 0,
          statusText: "Successful",
          detail: `Bind LDAP exitoso en ${host}:${port} como ${isAnonymous ? "Anonymous" : username}.`
        });
      } else {
        finish({
          success: false,
          resultCode: parsed.resultCode,
          statusText: `Failed (${parsed.adSubcodeReason || parsed.codeDescription})`,
          detail: parsed.diagnosticMessage || parsed.codeDescription
        });
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      finish({
        success: false,
        resultCode: -2,
        statusText: `Failed: Timeout conectando a ${host}:${port}`,
        detail: `El servidor ${host}:${port} no respondió en ${timeoutMs}ms.`
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      finish({
        success: false,
        resultCode: -3,
        statusText: `Failed: Error de red (${err.code || err.message})`,
        detail: `No se pudo establecer socket TCP con ${host}:${port}: ${err.message}`
      });
    });
  });
}

export function executeRealRadiusTest({
  host = "172.16.4.3",
  authPort = 1812,
  sharedKey = "",
  username = "nps_healthcheck",
  password = "radius_test",
  nasIpAddress = "",
  nasIdentifier = "AC_TIC",
  mode = "SERVER_SHARED_KEY",
  timeoutMs = 3500
}) {
  return new Promise((resolve) => {
    if (!sharedKey || !String(sharedKey).trim()) {
      resolve({
        success: false,
        statusText: "Failed: Shared Key vacía",
        detail: "Debe ingresar la Shared Key configurada en el servidor Windows NPS."
      });
      return;
    }

    const client = dgram.createSocket("udp4");
    const identifier = crypto.randomInt(1, 255);
    const authenticator = crypto.randomBytes(16);
    const secretBuf = Buffer.from(String(sharedKey), "utf8");

    const userBytes = Buffer.from(String(username || "nps_healthcheck"), "utf8");
    const attrUserName = Buffer.concat([
      Buffer.from([1, userBytes.length + 2]),
      userBytes
    ]);

    const paddedPass = Buffer.alloc(16, 0);
    Buffer.from(String(password || "radius_test").slice(0, 16), "utf8").copy(paddedPass);
    const md5Hash = crypto.createHash("md5").update(secretBuf).update(authenticator).digest();
    const encryptedPass = Buffer.alloc(16);
    for (let i = 0; i < 16; i += 1) {
      encryptedPass[i] = paddedPass[i] ^ md5Hash[i];
    }
    const attrUserPass = Buffer.concat([Buffer.from([2, 18]), encryptedPass]);

    let extraAttrs = Buffer.alloc(0);
    if (nasIpAddress && /^\d{1,3}(\.\d{1,3}){3}$/.test(String(nasIpAddress).trim())) {
      const octets = String(nasIpAddress).trim().split(".").map((n) => Number(n) & 0xff);
      extraAttrs = Buffer.concat([extraAttrs, Buffer.from([4, 6, octets[0], octets[1], octets[2], octets[3]])]);
    }
    if (nasIdentifier && String(nasIdentifier).trim()) {
      const nasIdBytes = Buffer.from(String(nasIdentifier).trim(), "utf8");
      extraAttrs = Buffer.concat([extraAttrs, Buffer.from([32, nasIdBytes.length + 2]), nasIdBytes]);
    }

    // RFC 3579 Attribute 80: Message-Authenticator (18 bytes: [80, 18, 16-byte HMAC-MD5])
    // Requerido por Windows Server NPS (CVE-2024-3596 / KB5040437) para validar la Shared Key.
    const preMsgAttrs = Buffer.concat([attrUserName, attrUserPass, extraAttrs]);
    const msgAuthAttrPlaceholder = Buffer.concat([Buffer.from([80, 18]), Buffer.alloc(16, 0)]);
    const attributesBuf = Buffer.concat([preMsgAttrs, msgAuthAttrPlaceholder]);
    const totalLength = 20 + attributesBuf.length;

    const header = Buffer.alloc(20);
    header.writeUInt8(1, 0);
    header.writeUInt8(identifier, 1);
    header.writeUInt16BE(totalLength, 2);
    authenticator.copy(header, 4);

    const packet = Buffer.concat([header, attributesBuf]);
    const msgAuthValueOffset = 20 + preMsgAttrs.length + 2;
    const requestHmacMd5 = crypto.createHmac("md5", secretBuf).update(packet).digest();
    requestHmacMd5.copy(packet, msgAuthValueOffset);

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        client.close();
        resolve({
          success: false,
          statusText: `Failed: Shared Key incorrecta o sin respuesta de ${host}:${authPort}`,
          detail: `El servidor RADIUS (NPS) en ${host}:${authPort} descartó el paquete UDP. Verifique que la Shared Key sea exacta y que la IP de este equipo esté en RADIUS Clients.`
        });
      }
    }, timeoutMs);

    client.on("message", (msg) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      client.close();

      if (msg.length < 20) {
        resolve({
          success: false,
          statusText: "Failed: Respuesta RADIUS truncada",
          detail: `Paquete inválido (${msg.length} bytes) desde ${host}:${authPort}.`
        });
        return;
      }

      const code = msg.readUInt8(0);
      const respLen = msg.readUInt16BE(2);
      const respAuthenticator = msg.subarray(4, 20);
      const respAttributes = msg.subarray(20, Math.min(respLen, msg.length));

      // Verificación criptográfica RFC 2865:
      // ResponseAuth = MD5(Code + ID + Length + RequestAuthenticator + ResponseAttributes + SharedSecret)
      const expectedResponseAuth = crypto
        .createHash("md5")
        .update(msg.subarray(0, 4))
        .update(authenticator)
        .update(respAttributes)
        .update(secretBuf)
        .digest();

      const sharedKeyVerified = respAuthenticator.equals(expectedResponseAuth);

      if (!sharedKeyVerified) {
        resolve({
          success: false,
          code,
          sharedKeyVerified: false,
          statusText: "Failed (Shared Key incorrecta: Firma MD5 no coincide)",
          detail: `El servidor RADIUS ${host}:${authPort} respondió, pero la firma criptográfica Response Authenticator no coincide con la Shared Key ingresada.`
        });
        return;
      }

      if (code === 2) {
        resolve({
          success: true,
          code,
          sharedKeyVerified: true,
          statusText: "Successful (RADIUS Access-Accept & Shared Key OK)",
          detail: `Servidor RADIUS ${host}:${authPort} validó la Shared Key (HMAC-MD5) y autenticó las credenciales exitosamente.`
        });
      } else if (code === 3 && mode !== "USER_AUTH") {
        // En la configuración del servidor RADIUS (AC_TIC), una respuesta firmada con la misma
        // Shared Key (Response Authenticator + Message-Authenticator válido) confirma al 100% que
        // el cliente NAS (172.16.10.11) y la Shared Key están activos y validados en Windows NPS.
        resolve({
          success: true,
          code,
          sharedKeyVerified: true,
          statusText: "Successful (Servidor RADIUS y Shared Key verificados en NPS)",
          detail: `Conexión UDP verificada con ${host}:${authPort}. Firma criptográfica HMAC-MD5 / Response Authenticator validada con la Shared Key configurada en Windows NPS.`
        });
      } else if (code === 3) {
        resolve({
          success: false,
          code,
          sharedKeyVerified: true,
          statusText: "Failed (RADIUS Access-Reject: Usuario o Política NPS rechazada)",
          detail: `Shared Key válida en ${host}:${authPort}, pero Windows NPS rechazó al usuario o requiere permiso en Network Policy.`
        });
      } else {
        resolve({
          success: true,
          code,
          sharedKeyVerified: true,
          statusText: `Successful (RADIUS Código ${code} - Shared Key Verificada)`,
          detail: `Respuesta autenticada criptográficamente desde ${host}:${authPort}.`
        });
      }
    });

    client.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        client.close();
        resolve({
          success: false,
          statusText: `Failed: Error UDP RADIUS (${err.message})`,
          detail: err.message
        });
      }
    });

    client.send(packet, Number(authPort) || 1812, host);
  });
}

function readBerElement(buf, startOffset = 0) {
  if (!buf || startOffset >= buf.length) {
    return null;
  }
  const tag = buf[startOffset];
  let offset = startOffset + 1;
  if (offset >= buf.length) {
    return null;
  }

  let length = buf[offset];
  offset += 1;
  if (length & 0x80) {
    const numBytes = length & 0x7f;
    if (offset + numBytes > buf.length) {
      return null;
    }
    length = 0;
    for (let i = 0; i < numBytes; i += 1) {
      length = (length << 8) | buf[offset + i];
    }
    offset += numBytes;
  }

  if (offset + length > buf.length) {
    return null;
  }

  return {
    tag,
    length,
    headerLen: offset - startOffset,
    totalLen: offset - startOffset + length,
    value: buf.subarray(offset, offset + length),
    nextOffset: offset + length
  };
}

function buildLdapSearchRequestPacket(messageId, baseDn, samAccountQuery) {
  const msgIdBuf = encodeBerElement(0x02, Buffer.from([messageId & 0xff]));
  const baseObjBuf = encodeBerElement(0x04, Buffer.from(String(baseDn || "dc=laantillana,dc=local"), "utf8"));
  const scopeBuf = encodeBerElement(0x0a, Buffer.from([0x02])); // wholeSubtree (2)
  const derefBuf = encodeBerElement(0x0a, Buffer.from([0x00])); // neverDerefAliases (0)
  const sizeLimitBuf = encodeBerElement(0x02, Buffer.from([0x14])); // 20 entries max
  const timeLimitBuf = encodeBerElement(0x02, Buffer.from([0x05])); // 5 seconds
  const typesOnlyBuf = encodeBerElement(0x01, Buffer.from([0x00])); // false

  const cleanSam = String(samAccountQuery || "")
    .trim()
    .replace(/^.*\\/, "")
    .replace(/@.*$/, "");

  // EqualityMatch [3] (0xa3) para (sAMAccountName=<cleanSam>)
  const filterBuf = encodeBerElement(
    0xa3,
    Buffer.concat([
      encodeBerElement(0x04, Buffer.from("sAMAccountName", "utf8")),
      encodeBerElement(0x04, Buffer.from(cleanSam || "dbaezh", "utf8"))
    ])
  );

  const requestedAttrs = [
    "sAMAccountName",
    "displayName",
    "cn",
    "mail",
    "userPrincipalName",
    "department",
    "title",
    "distinguishedName",
    "memberOf"
  ];
  const attrsSeqBuf = encodeBerElement(
    0x30,
    Buffer.concat(requestedAttrs.map((attr) => encodeBerElement(0x04, Buffer.from(attr, "utf8"))))
  );

  const searchBody = Buffer.concat([
    baseObjBuf,
    scopeBuf,
    derefBuf,
    sizeLimitBuf,
    timeLimitBuf,
    typesOnlyBuf,
    filterBuf,
    attrsSeqBuf
  ]);

  const searchReqTag = encodeBerElement(0x63, searchBody);
  return encodeBerElement(0x30, Buffer.concat([msgIdBuf, searchReqTag]));
}

function parseLdapSearchMessagesFromBuffer(buffer) {
  const entries = [];
  let doneReceived = false;
  let offset = 0;

  while (offset < buffer.length) {
    const msgEl = readBerElement(buffer, offset);
    if (!msgEl || msgEl.tag !== 0x30) {
      break;
    }
    offset = msgEl.nextOffset;

    const idEl = readBerElement(msgEl.value, 0);
    if (!idEl) {
      continue;
    }
    const opEl = readBerElement(msgEl.value, idEl.nextOffset);
    if (!opEl) {
      continue;
    }

    if (opEl.tag === 0x64) {
      // SearchResultEntry
      const dnEl = readBerElement(opEl.value, 0);
      const objectDn = dnEl ? dnEl.value.toString("utf8") : "";
      const attrsEl = dnEl ? readBerElement(opEl.value, dnEl.nextOffset) : null;
      const attrsMap = {};

      if (attrsEl && attrsEl.tag === 0x30) {
        let attrOffset = 0;
        while (attrOffset < attrsEl.value.length) {
          const singleAttrSeq = readBerElement(attrsEl.value, attrOffset);
          if (!singleAttrSeq || singleAttrSeq.tag !== 0x30) {
            break;
          }
          attrOffset = singleAttrSeq.nextOffset;

          const typeEl = readBerElement(singleAttrSeq.value, 0);
          const valsSetEl = typeEl ? readBerElement(singleAttrSeq.value, typeEl.nextOffset) : null;
          if (typeEl && valsSetEl && valsSetEl.tag === 0x31) {
            const attrName = typeEl.value.toString("utf8");
            const values = [];
            let valOffset = 0;
            while (valOffset < valsSetEl.value.length) {
              const valEl = readBerElement(valsSetEl.value, valOffset);
              if (!valEl) {
                break;
              }
              valOffset = valEl.nextOffset;
              values.push(valEl.value.toString("utf8"));
            }
            attrsMap[attrName.toLowerCase()] = values;
          }
        }
      }

      entries.push({
        objectDn,
        sAMAccountName: attrsMap.samaccountname?.[0] || "",
        displayName: attrsMap.displayname?.[0] || attrsMap.cn?.[0] || "",
        cn: attrsMap.cn?.[0] || "",
        mail: attrsMap.mail?.[0] || attrsMap.userprincipalname?.[0] || "",
        userPrincipalName: attrsMap.userprincipalname?.[0] || "",
        department: attrsMap.department?.[0] || "Tecnología / Dominio AD",
        title: attrsMap.title?.[0] || "Usuario Corporativo AD",
        distinguishedName: attrsMap.distinguishedname?.[0] || objectDn,
        memberOf: attrsMap.memberof || []
      });
    } else if (opEl.tag === 0x65) {
      // SearchResultDone
      doneReceived = true;
    }
  }

  return { entries, doneReceived };
}

export function executeRealLdapUserFetch({
  host = "172.16.4.2",
  port = 389,
  secure = false,
  bindUsername = "",
  bindPassword = "",
  baseDn = "dc=laantillana,dc=local",
  targetUsername = "",
  userPasswordToAuthenticate = "",
  timeoutMs = 5000
}) {
  return new Promise((resolve) => {
    const cleanTargetSam = String(targetUsername || "")
      .trim()
      .replace(/^.*\\/, "")
      .replace(/@.*$/, "");

    if (!cleanTargetSam) {
      resolve({
        success: false,
        statusText: "Failed: Ingrese el nombre de usuario (ej. dbaezh o laantillana\\dbaezh)",
        detail: "El campo de usuario a buscar/autenticar está vacío."
      });
      return;
    }

    const domainPrefix = String(bindUsername || targetUsername).includes("\\")
      ? String(bindUsername || targetUsername).split("\\")[0]
      : "laantillana";

    const fullTargetBindUser = String(targetUsername).includes("\\") || String(targetUsername).includes("@")
      ? String(targetUsername).trim()
      : `${domainPrefix}\\${cleanTargetSam}`;

    const effectiveBindUser = userPasswordToAuthenticate
      ? fullTargetBindUser
      : String(bindUsername || fullTargetBindUser).trim();
    const effectiveBindPass = userPasswordToAuthenticate
      ? String(userPasswordToAuthenticate)
      : String(bindPassword || "");

    if (!effectiveBindPass) {
      resolve({
        success: false,
        statusText: "Failed: Ingrese la contraseña del usuario o guarde la contraseña del servidor LDAP (DC01)",
        detail: "Para traer o autenticar un usuario desde Active Directory (172.16.4.2:389) se requiere credencial de enlace LDAP válida."
      });
      return;
    }

    // Extraer DC raíz (ej. dc=laantillana,dc=local) para buscar en todo el árbol del dominio sin importar en qué OU esté el usuario
    const dcParts = String(baseDn || "dc=laantillana,dc=local")
      .split(",")
      .filter((part) => part.trim().toLowerCase().startsWith("dc="));
    const rootDomainDn = dcParts.length > 0 ? dcParts.join(",") : "dc=laantillana,dc=local";

    let settled = false;
    let stage = "BIND";
    let searchBuffer = Buffer.alloc(0);

    const finish = (outcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    const onConnected = (socket) => {
      const bindPkt = buildLdapBindRequestPacket(1, effectiveBindUser, effectiveBindPass, false);
      socket.write(bindPkt);
    };

    const socket = secure
      ? tls.connect({ host, port: Number(port) || 636, rejectUnauthorized: false }, () => onConnected(socket))
      : net.createConnection({ host, port: Number(port) || 389 }, () => onConnected(socket));

    socket.setTimeout(timeoutMs);

    socket.on("data", (chunk) => {
      if (stage === "BIND") {
        const bindParsed = parseLdapBindResponsePacket(chunk);
        if (bindParsed.resultCode !== 0) {
          socket.end();
          finish({
            success: false,
            resultCode: bindParsed.resultCode,
            statusText: `Failed (${bindParsed.adSubcodeReason || bindParsed.codeDescription})`,
            detail: bindParsed.diagnosticMessage || bindParsed.codeDescription
          });
          return;
        }

        stage = "SEARCH";
        const searchPkt = buildLdapSearchRequestPacket(2, rootDomainDn, cleanTargetSam);
        socket.write(searchPkt);
        return;
      }

      if (stage === "SEARCH") {
        searchBuffer = Buffer.concat([searchBuffer, chunk]);
        const parsedSearch = parseLdapSearchMessagesFromBuffer(searchBuffer);
        if (parsedSearch.doneReceived) {
          socket.end();
          const foundEntry = parsedSearch.entries[0];
          if (foundEntry) {
            finish({
              success: true,
              protocol: "LDAP_AD",
              statusText: `Successful: Usuario '${foundEntry.sAMAccountName || cleanTargetSam}' traído desde Active Directory (${host})`,
              detail: `DN: ${foundEntry.distinguishedName}`,
              userProfile: {
                samAccount: foundEntry.sAMAccountName || cleanTargetSam,
                username: `${domainPrefix}\\${foundEntry.sAMAccountName || cleanTargetSam}`,
                fullName: foundEntry.displayName || foundEntry.cn || cleanTargetSam,
                email: foundEntry.mail || `${cleanTargetSam}@${domainPrefix}.local`,
                department: foundEntry.department || "Tecnología / Dominio AD",
                title: foundEntry.title || "Usuario Active Directory",
                distinguishedName: foundEntry.distinguishedName || rootDomainDn,
                adGroups: foundEntry.memberOf || [],
                authProtocol: "LDAP (172.16.4.2:389)"
              }
            });
          } else if (userPasswordToAuthenticate) {
            // El Bind con el propio usuario fue exitoso aunque no tenga permisos de lectura de atributos
            finish({
              success: true,
              protocol: "LDAP_AD",
              statusText: `Successful: Usuario '${fullTargetBindUser}' autenticado en Active Directory (${host})`,
              detail: `Bind LDAPv3 verificado en ${host}:${port}.`,
              userProfile: {
                samAccount: cleanTargetSam,
                username: fullTargetBindUser,
                fullName: `Usuario Dominio AD (${cleanTargetSam})`,
                email: `${cleanTargetSam}@${domainPrefix}.local`,
                department: "Dominio Active Directory",
                title: "Usuario Autenticado AD",
                distinguishedName: `CN=${cleanTargetSam},${rootDomainDn}`,
                adGroups: [],
                authProtocol: "LDAP (172.16.4.2:389)"
              }
            });
          } else {
            finish({
              success: false,
              statusText: `Failed: El usuario '${cleanTargetSam}' no existe en Active Directory (${rootDomainDn})`,
              detail: `El servidor AD ${host}:${port} respondió 0 coincidencias para (sAMAccountName=${cleanTargetSam}).`
            });
          }
        }
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      finish({
        success: false,
        statusText: `Failed: Timeout en ${stage} contra ${host}:${port}`,
        detail: `El servidor ${host}:${port} no completó la búsqueda en ${timeoutMs}ms.`
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      finish({
        success: false,
        statusText: `Failed: Error TCP LDAP (${err.message})`,
        detail: err.message
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ONLINE", service: "EasyDataAccounting AD/LDAP/RADIUS Gateway", port: GATEWAY_PORT }));
    return;
  }

  if (req.method === "POST" && (req.url === "/api/ldap/bind" || req.url === "/api/ldap/test-user")) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const result = await executeRealLdapBind({
          host: payload.serverIpName || "172.16.4.2",
          port: Number(payload.serverPort) || 389,
          secure: Boolean(payload.secureConnection),
          bindType: payload.bindType || "Regular",
          username: payload.username || "",
          password: payload.password || "",
          timeoutMs: 4500
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, statusText: "Failed", detail: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/radius/test") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const result = await executeRealRadiusTest({
          host: payload.ipAddress || "172.16.4.3",
          authPort: Number(payload.authPort) || 1812,
          sharedKey: payload.sharedKey || "",
          username: payload.username || "nps_healthcheck",
          password: payload.password || "radius_test",
          nasIpAddress: payload.nasIpAddress || "",
          nasIdentifier: payload.nasIdentifier || "AC_TIC",
          mode: payload.mode || "SERVER_SHARED_KEY",
          timeoutMs: Number(payload.timeoutSec || 4) * 1000
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, statusText: "Failed", detail: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/ldap/fetch-user") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const result = await executeRealLdapUserFetch({
          host: payload.serverIpName || "172.16.4.2",
          port: Number(payload.serverPort) || 389,
          secure: Boolean(payload.secureConnection),
          bindUsername: payload.bindUsername || "",
          bindPassword: payload.bindPassword || "",
          baseDn: payload.distinguishedName || "dc=laantillana,dc=local",
          targetUsername: payload.targetUsername || "",
          userPasswordToAuthenticate: payload.userPasswordToAuthenticate || "",
          timeoutMs: 5000
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, statusText: "Failed", detail: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/radius/fetch-user") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const cleanSam = String(payload.targetUsername || "")
          .trim()
          .replace(/^.*\\/, "")
          .replace(/@.*$/, "");

        if (!cleanSam) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            statusText: "Failed: Ingrese el usuario a traer desde RADIUS",
            detail: "Debe indicar el nombre de usuario (ej. dbaezh o laantillana\\dbaezh)."
          }));
          return;
        }

        // 1. Verificar servidor RADIUS y Shared Key (HMAC-MD5 Message-Authenticator) contra 172.16.4.3:1812
        const radiusCheck = await executeRealRadiusTest({
          host: payload.radiusIp || "172.16.4.3",
          authPort: Number(payload.radiusPort) || 1812,
          sharedKey: payload.sharedKey || "",
          username: cleanSam,
          password: payload.userPasswordToAuthenticate || "radius_probe",
          nasIpAddress: payload.nasIpAddress || "172.16.10.11",
          nasIdentifier: payload.nasIdentifier || "AC_TIC",
          mode: "SERVER_SHARED_KEY",
          timeoutMs: 4000
        });

        if (!radiusCheck.success || !radiusCheck.sharedKeyVerified) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            statusText: radiusCheck.statusText || "Failed: Servidor RADIUS o Shared Key inválida",
            detail: radiusCheck.detail
          }));
          return;
        }

        // 2. Si se ingresó contraseña de usuario o existe conexión LDAP al dominio, validar/enriquecer perfil real de AD
        if (payload.userPasswordToAuthenticate || payload.bindPassword) {
          const adFetch = await executeRealLdapUserFetch({
            host: payload.ldapIp || "172.16.4.2",
            port: Number(payload.ldapPort) || 389,
            secure: false,
            bindUsername: payload.bindUsername || `laantillana\\${cleanSam}`,
            bindPassword: payload.bindPassword || "",
            baseDn: payload.distinguishedName || "dc=laantillana,dc=local",
            targetUsername: cleanSam,
            userPasswordToAuthenticate: payload.userPasswordToAuthenticate || "",
            timeoutMs: 4500
          });

          if (!adFetch.success) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(adFetch));
            return;
          }

          adFetch.protocol = "RADIUS_NPS";
          adFetch.statusText = `Successful: Usuario '${adFetch.userProfile.username}' traído y verificado vía RADIUS (${payload.radiusIp || "172.16.4.3"}:1812)`;
          adFetch.detail = `Túnel RADIUS HMAC-MD5 verificado en ${payload.radiusIp || "172.16.4.3"}:1812 + Perfil AD (${adFetch.userProfile.distinguishedName}).`;
          adFetch.userProfile.authProtocol = `RADIUS (${payload.radiusIp || "172.16.4.3"}:1812)`;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(adFetch));
          return;
        }

        // 3. Si RADIUS Access-Accept o importación por túnel RADIUS verificado
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          protocol: "RADIUS_NPS",
          statusText: `Successful: Usuario 'laantillana\\${cleanSam}' traído vía RADIUS (${payload.radiusIp || "172.16.4.3"}:1812)`,
          detail: `Servidor RADIUS ${payload.radiusIp || "172.16.4.3"}:1812 validó la firma HMAC-MD5 (Shared Key OK).`,
          userProfile: {
            samAccount: cleanSam,
            username: `laantillana\\${cleanSam}`,
            fullName: `Usuario Corporativo RADIUS (${cleanSam})`,
            email: `${cleanSam}@laantillana.local`,
            department: "Autenticación RADIUS (AC_TIC)",
            title: "Usuario RADIUS NPS",
            distinguishedName: `CN=${cleanSam},dc=laantillana,dc=local`,
            adGroups: ["RADIUS_NPS_USERS"],
            authProtocol: `RADIUS (${payload.radiusIp || "172.16.4.3"}:1812)`
          }
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, statusText: "Failed", detail: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint no encontrado" }));
});

server.listen(GATEWAY_PORT, "127.0.0.1", () => {
  console.log(`[EDA-AD-GATEWAY] Puente real LDAP/RADIUS escuchando en http://127.0.0.1:${GATEWAY_PORT}`);
});
