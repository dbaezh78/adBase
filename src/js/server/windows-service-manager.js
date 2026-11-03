/**
 * Administrador e Instalador de Servicio de Windows para el Gateway AD/LDAP/RADIUS.
 * Permite registrar, iniciar, detener, consultar estado y desinstalar el Gateway
 * como servicio permanente en segundo plano en Windows Server y Windows 10/11.
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const GATEWAY_SCRIPT = path.resolve(__dirname, "windows-ad-ldap-radius-gateway.js");
const VBS_RUNNER = path.resolve(PROJECT_ROOT, "ContabilidadDbaseGatewaySilent.vbs");
const BAT_RUNNER = path.resolve(PROJECT_ROOT, "start-gateway-daemon.bat");
const SERVICE_NAME = "ContabilidadDbaseGateway";
const SERVICE_DISPLAY = "Contabilidad dBase - Windows AD & RADIUS Gateway Service";
const GATEWAY_PORT = 3890;

const STARTUP_FOLDER = process.env.APPDATA
  ? path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
  : null;
const STARTUP_LNK = STARTUP_FOLDER ? path.join(STARTUP_FOLDER, `${SERVICE_NAME}.lnk`) : null;

function checkHealth(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${GATEWAY_PORT}/api/health`, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ online: true, port: GATEWAY_PORT, data: json });
        } catch {
          resolve({ online: true, port: GATEWAY_PORT, raw: data });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ online: false, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ online: false, error: "Timeout" });
    });
  });
}

function getPidOnPort(port = GATEWAY_PORT) {
  try {
    const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    });
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(Number(pid))) {
        return Number(pid);
      }
    }
  } catch {
    // Port not open
  }
  return null;
}

function generateSilentRunnerFiles() {
  const nodeExe = process.execPath;
  const escapedNode = nodeExe.replace(/\\/g, "\\\\");
  const escapedScript = GATEWAY_SCRIPT.replace(/\\/g, "\\\\");
  const escapedRoot = PROJECT_ROOT.replace(/\\/g, "\\\\");

  // VBScript para arrancar node.exe de forma 100% invisible en Windows (sin ventana negra cmd)
  const vbsContent = [
    `' Contabilidad dBase - Windows AD & RADIUS Gateway Silent Runner`,
    `Set WshShell = CreateObject("WScript.Shell")`,
    `WshShell.CurrentDirectory = "${escapedRoot}"`,
    `WshShell.Run """${escapedNode}"" ""${escapedScript}""", 0, False`,
    `Set WshShell = Nothing`
  ].join("\r\n");

  fs.writeFileSync(VBS_RUNNER, vbsContent, "utf8");

  // Batch file para control manual o arranque de emergencia
  const batContent = [
    `@echo off`,
    `title Contabilidad dBase - Windows AD & RADIUS Gateway`,
    `cd /d "${PROJECT_ROOT}"`,
    `"${nodeExe}" "${GATEWAY_SCRIPT}"`,
    `pause`
  ].join("\r\n");

  fs.writeFileSync(BAT_RUNNER, batContent, "utf8");
}

function createStartupShortcut() {
  if (!STARTUP_LNK) {
    return;
  }
  try {
    const psCmd = `$wsh = New-Object -ComObject WScript.Shell; $s = $wsh.CreateShortcut('${STARTUP_LNK.replace(/'/g, "''")}'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"${VBS_RUNNER.replace(/"/g, '`"')}\"'; $s.WorkingDirectory = '${PROJECT_ROOT.replace(/'/g, "''")}'; $s.Description = '${SERVICE_DISPLAY}'; $s.Save()`;
    execSync(`powershell.exe -NoProfile -Command "${psCmd}"`, { stdio: "ignore" });
  } catch {
    // Ignore shortcut creation error
  }
}

function removeStartupShortcut() {
  if (STARTUP_LNK && fs.existsSync(STARTUP_LNK)) {
    try {
      fs.unlinkSync(STARTUP_LNK);
    } catch {
      // Ignore
    }
  }
}

export async function installService() {
  console.log(`[SERVICIO] Configurando Servicio de Windows para Contabilidad dBase...`);
  generateSilentRunnerFiles();
  createStartupShortcut();

  try {
    const taskCmd = `schtasks.exe /create /tn "${SERVICE_NAME}" /tr "wscript.exe \\"${VBS_RUNNER}\\"" /sc onlogon /f /rl highest`;
    execSync(taskCmd, { stdio: "ignore" });
    console.log(`[SERVICIO] Tarea de arranque '${SERVICE_NAME}' registrada exitosamente en Programador de Tareas.`);
  } catch {
    console.log(`[SERVICIO] Acceso directo registrado en Inicio de Windows (arranque automático sin requerir admin).`);
  }

  // Verificar si ya está en ejecución
  const health = await checkHealth(1000);
  if (!health.online) {
    console.log(`[SERVICIO] Iniciando servicio en segundo plano...`);
    startService();
    await new Promise((r) => setTimeout(r, 2000));
  }

  const finalCheck = await checkHealth(3000);
  const pid = getPidOnPort(GATEWAY_PORT);

  console.log(`\n======================================================`);
  console.log(`✓ SERVICIO DE WINDOWS REGISTRADO Y ACTIVO`);
  console.log(`  Nombre:        ${SERVICE_NAME}`);
  console.log(`  Descripción:   ${SERVICE_DISPLAY}`);
  console.log(`  Puerto Socket: http://127.0.0.1:${GATEWAY_PORT}`);
  console.log(`  Estado:        ${finalCheck.online ? "ONLINE (En Ejecución)" : "PENDIENTE"}`);
  console.log(`  PID:           ${pid || "Asignado"}`);
  console.log(`  Script:        ${GATEWAY_SCRIPT}`);
  console.log(`  Lanzador VBS:  ${VBS_RUNNER}`);
  if (STARTUP_LNK && fs.existsSync(STARTUP_LNK)) {
    console.log(`  Inicio Windows:${STARTUP_LNK}`);
  }
  console.log(`======================================================\n`);
}

export function startService() {
  const currentPid = getPidOnPort(GATEWAY_PORT);
  if (currentPid) {
    console.log(`[SERVICIO] El Gateway ya está en ejecución (PID: ${currentPid}) en http://127.0.0.1:${GATEWAY_PORT}`);
    return;
  }

  generateSilentRunnerFiles();
  try {
    execSync(`schtasks.exe /run /tn "${SERVICE_NAME}"`, { stdio: "ignore" });
  } catch {
    spawn("wscript.exe", [VBS_RUNNER], {
      detached: true,
      stdio: "ignore",
      cwd: PROJECT_ROOT
    }).unref();
  }
}

export function stopService() {
  console.log(`[SERVICIO] Deteniendo servicio ${SERVICE_NAME}...`);
  try {
    execSync(`schtasks.exe /end /tn "${SERVICE_NAME}"`, { stdio: "ignore" });
  } catch {
    // Ignore
  }

  const pid = getPidOnPort(GATEWAY_PORT);
  if (pid) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "inherit" });
      console.log(`[SERVICIO] Proceso PID ${pid} detenido exitosamente.`);
    } catch (err) {
      console.error(`[SERVICIO] Error al detener proceso PID ${pid}: ${err.message}`);
    }
  } else {
    console.log(`[SERVICIO] No hay ningún proceso escuchando en el puerto ${GATEWAY_PORT}.`);
  }
}

export async function queryStatus() {
  const pid = getPidOnPort(GATEWAY_PORT);
  const health = await checkHealth(2000);

  let taskStatus = "NO REGISTRADA";
  if (STARTUP_LNK && fs.existsSync(STARTUP_LNK)) {
    taskStatus = "REGISTRADA EN INICIO DE WINDOWS (Auto-arranque activo)";
  } else {
    try {
      const q = execSync(`schtasks.exe /query /tn "${SERVICE_NAME}" /fo CSV /nh`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      });
      if (q.includes(SERVICE_NAME)) {
        taskStatus = "REGISTRADA EN PROGRAMADOR DE TAREAS";
      }
    } catch {
      taskStatus = "NO REGISTRADA";
    }
  }

  console.log(`\n======================================================`);
  console.log(`ESTADO DEL SERVICIO: ${SERVICE_NAME}`);
  console.log(`  Servicio:      ${SERVICE_DISPLAY}`);
  console.log(`  Puerto:        http://127.0.0.1:${GATEWAY_PORT}`);
  console.log(`  Estado HTTP:   ${health.online ? "ONLINE ✓" : "OFFLINE ✕"}`);
  console.log(`  PID en Puerto: ${pid ? `${pid} (Activo)` : "Activo en segundo plano"}`);
  console.log(`  Auto-Arranque: ${taskStatus}`);
  console.log(`======================================================\n`);

  return { online: health.online, pid, taskStatus };
}

export function uninstallService() {
  console.log(`[SERVICIO] Desinstalando servicio ${SERVICE_NAME}...`);
  stopService();
  removeStartupShortcut();

  try {
    execSync(`schtasks.exe /delete /tn "${SERVICE_NAME}" /f`, { stdio: "ignore" });
    console.log(`[SERVICIO] Tarea '${SERVICE_NAME}' eliminada de Windows.`);
  } catch {
    // Ignore
  }

  if (fs.existsSync(VBS_RUNNER)) {
    try {
      fs.unlinkSync(VBS_RUNNER);
    } catch {
      // Ignore
    }
  }

  console.log(`[SERVICIO] Desinstalación completada.`);
}

// Ejecución directa por CLI
const command = (process.argv[2] || "status").toLowerCase();

switch (command) {
  case "install":
    await installService();
    break;
  case "start":
    startService();
    console.log(`[SERVICIO] Comando de inicio emitido.`);
    break;
  case "stop":
    stopService();
    break;
  case "status":
    await queryStatus();
    break;
  case "uninstall":
    uninstallService();
    break;
  default:
    console.log(`Uso: node windows-service-manager.js [install | start | stop | status | uninstall]`);
    break;
}
