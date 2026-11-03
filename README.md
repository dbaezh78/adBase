# EasyDataAccounting Enterprise ERP

Sistema de Contabilidad y ERP Empresarial ultra-rápido y 100% modular, diseñado para superar la eficiencia operativa de SAP mediante una arquitectura de **Micro-Kernel Desacoplado**, **Búsqueda Inteligente con Poblado y Estadísticas en Tiempo Real**, **Núcleo de Seguridad Zero-Trust**, integración nativa con **Servidores Windows (Active Directory / LDAPS / Kerberos)** y base de datos en **Firebase (`easy-data-accounting`)** con adaptador agnóstico para migrar a otros motores (SQL Server, PostgreSQL).

---

## Estructura de Directorios

```text
/ (Raíz)
├── index.html                        # Shell principal de aplicación (Cero CSS en HTML)
├── package.json                      # Dependencias (firebase SDK oficial)
└── /src                              # Código fuente modularizado
    ├── /css                          # Estilos 100% separados por responsabilidad
    │   ├── /core                     # Variables de diseño, tokens y reset de alta velocidad
    │   ├── /layout                   # Grid empresarial, cabecera T-Code, barra lateral
    │   ├── /components               # Omnibox de búsqueda, tarjetas de estadísticas, tablas, formularios
    │   └── /modules                  # Estilos específicos de POS, Active Directory y estados financieros
    ├── /html                         # Plantillas semánticas de módulos (Cero CSS en línea)
    │   ├── /layout                   # Plantilla de búsqueda e inteligencia estadística
    │   └── /modules                  # Vistas independientes de los 12 módulos
    ├── /img                          # Activos vectoriales organizados
    │   ├── /logos                    # Logotipo corporativo EasyDataAccounting
    │   └── /icons                    # Iconografía de Seguridad, Windows Server AD y Firebase
    └── /js                           # Lógica distribuida por tipos de funciones y módulos independientes
        ├── /config                   # Configuración Firebase (easy-data-accounting) y constantes
        ├── /database                 # Inicializador Firebase SDK, datos semilla NIIF y adaptador multi-DB
        ├── /security                 # Núcleo Gatekeeper, evaluador RBAC, bitácora SHA-256 y conector Windows AD
        ├── /core                     # Bus de eventos Pub/Sub, registro de módulos y orquestador de arranque
        ├── /formatters               # Formateadores puros de moneda, porcentajes, fechas y clases CSS
        ├── /validators               # Validador matemático de partida doble y sanitizador XSS/NoSQL
        ├── /search                   # Motor universal de indexación y poblador de contenido + estadísticas
        ├── /statistics               # Calculadores en tiempo real de KPIs y ratios financieros NIIF
        └── /modules                  # 12 Módulos 100% independientes
            ├── /security             # Módulo de Seguridad y Gobierno (SEC01)
            ├── /users-windows        # Módulo de Usuarios y Servidores Windows AD (USR01)
            ├── /chart-of-accounts    # Módulo de Catálogo de Cuentas (COA01)
            ├── /journal-entries      # Módulo de Registro de Asientos (FB50)
            ├── /official-books       # Módulo de Libros Oficiales (LIB01)
            ├── /bank-reconciliation  # Módulo de Conciliación Bancaria (BNK01)
            ├── /period-closing       # Módulo de Cierre de Periodos (PER01)
            ├── /financial-statements # Módulo de Estados Financieros (FIN01)
            ├── /point-of-sale        # Módulo de Punto de Venta Independiente (POS01)
            ├── /payroll              # Módulo de Nómina Independiente (NOM01)
            ├── /module-integration   # Módulo de Integración con Otros Módulos y DB (INT01)
            └── /reports              # Módulo de Muestra de Reportes y BI (REP01)
```
