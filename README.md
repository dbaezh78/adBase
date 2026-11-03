# Contabilidad dBase — Accounting dBase
### Base de datos para Contabilidad

Sistema ERP y Plataforma Contable Empresarial de Alto Rendimiento, ultra-rápida y 100% modular. Diseñada con arquitectura de **Micro-Kernel Desacoplado**, **Búsqueda Inteligente Universal**, **Control de Acceso Web / Login Gate**, **Integración Nativa con Servidores Windows (Active Directory LDAP y RADIUS NPS)** ejecutada como servicio autónomo de Windows, y **Contraseñas Locales de Respaldo** para garantizar el acceso web ininterrumpido ante contingencias de red.

---

## Características Principales

1. **Control de Acceso Web y Pantalla de Login Gate (`#erp-login-auth-gate`)**:
   - Bloqueo preventivo de la aplicación para despliegue web público y seguro.
   - Selección de empresa corporativa con vista previa de su logotipo.
   - Autenticación híbrida: Dominio Windows Active Directory (LDAP), Servidor RADIUS NPS, Códigos OAuth de 16 caracteres y Contraseña Local de Respaldo por empresa.
   - Botón de cierre de sesión seguro (*Salir*) en la cabecera del sistema.

2. **Servicio Windows Autónomo de Autenticación (Gateway AD/LDAP/RADIUS)**:
   - Ya no depende de procesos manuales ni de terminales abiertas.
   - Se instala y gestiona fácilmente como servicio o tarea programada / inicio automático de Windows:
     - `npm run service:install` (o doble clic a `install-windows-service.bat`)
     - `npm run service:status`
     - `npm run service:start`
     - `npm run service:stop`
     - `npm run service:uninstall`
   - Monitoreable y testeable en tiempo real desde la plataforma en **Sistema dBase → Opciones del sistema**.

3. **Credenciales Locales de Respaldo para Acceso Web**:
   - Los usuarios importados de Active Directory o RADIUS quedan registrados y persistidos en el sistema vinculados a un correo electrónico y a una contraseña local de respaldo.
   - Si el servidor de dominio se encuentra fuera de línea, apagado o inaccesible desde la web, los usuarios pueden ingresar con su contraseña local asignada sin interrupción operativa.

4. **Permisos Modulares y Grupos por Departamentos**:
   - Asignación modular y granular de permisos sobre los 13 módulos del sistema.
   - Creación de Grupos de Permisos personalizados (ej. Administrador, Contabilidad, Auditoría, Tesorería, POS/Caja, etc.).
   - Estructuración de Departamentos y asignación ágil de grupos de permisos por usuario.

5. **Navegación Lateral Estilo Microsoft 365**:
   - Barra lateral colapsable con animación suave a la izquierda mostrando únicamente la barra de iconos.
   - Iconografía SVG nativa y moderna inspirada en Microsoft 365 Admin Center.
   - Opción de auto-ocultación configurable en **Sistema dBase → Opciones del sistema**.

6. **Selector Corporativo de Empresas Estilo SAP Logon 800**:
   - Segmentación de conexiones de dominio (LDAP y RADIUS) por empresa específica.
   - Carga y personalización de logotipos por empresa (carga de archivo o URL).
   - Generación y aplicación de perfiles de colores y temas corporativos.

7. **Arquitectura Zero-CSS en HTML**:
   - Cumplimiento estricto del estándar: 0 etiquetas `<style>` y 0 atributos `style=""` en todos los archivos HTML.
   - Todos los estilos residen organizados en `/src/css/`.

---

## Estructura del Proyecto

```text
/ (Raíz)
├── index.html                        # Shell principal del ERP con Login Gate
├── package.json                      # Configuración y scripts npm de servicio
├── ContabilidadDbaseGatewaySilent.vbs # Lanzador silencioso en segundo plano
├── install-windows-service.bat / ps1 # Instalador automático del servicio Windows
├── uninstall-windows-service.bat/ps1 # Desinstalador del servicio Windows
├── start-gateway-daemon.bat          # Lanzador directo del gateway
└── /src                              # Código fuente modular
    ├── /css                          # Estilos 100% desacoplados
    │   ├── /core                     # Tokens de diseño, reset y temas
    │   ├── /layout                   # Shell grid y barra lateral M365
    │   ├── /components               # Omnibox, KPIs, tablas y formularios
    │   └── /modules                  # Estilos de login gate, LDAP/RADIUS y POS
    ├── /html                         # Vistas y plantillas semánticas
    ├── /img                          # Iconos y logos de Contabilidad dBase
    └── /js                           # Lógica desacoplada
        ├── /config                   # Constantes del sistema
        ├── /core                     # Bootstrap, Login Gate y navegación M365
        ├── /database                 # Semillas NIIF y adaptador de base de datos
        ├── /modules                  # 13 módulos independientes (CFG01, FB50, etc.)
        ├── /security                 # Autenticación, permisos, roles y auditoría
        └── /server                   # Gateway Windows AD/LDAP/RADIUS y Service Manager
```

---

## Puesta en Marcha

### 1. Iniciar la Plataforma Web
```bash
npm start
```
Abre tu navegador en `http://localhost:3000` (o el puerto configurado).

### 2. Instalar el Servicio Windows Autónomo
Ejecuta como administrador o con tu usuario de Windows:
```bash
npm run service:install
```
O simplemente haz doble clic en `install-windows-service.bat`.

Para verificar el estado del servicio en cualquier momento:
```bash
npm run service:status
```
