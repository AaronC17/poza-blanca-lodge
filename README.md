# Poza Blanca Lodge — Sistema de Pases de Día

Sistema de **pases de día para camping** de Poza Blanca Lodge (Hotel Boutique, San Mateo, Alajuela, Costa Rica). Automatiza el registro de visitantes que ingresa recepción manualmente: datos del visitante, fecha y hora del pase, cantidad de personas, vehículo, monto (en colones) y envío de confirmación por correo con la imagen de marca del lodge.

Panel administrativo con identidad visual de Poza Blanca Lodge (colores oficiales verde bosque, logo, fotos del lodge), dashboard de ingresos, listado de pases, filtros y reportes por rango de fechas.

## Stack

- **Backend:** Express + Node.js
- **Base de datos:** SQLite (better-sqlite3, sin servidor externo)
- **Vistas:** EJS + Tailwind CSS + Chart.js + Alpine.js
- **Correo:** Nodemailer (SMTP real)
- **Seguridad:** Helmet, sesiones firmadas (bcrypt + express-session), rate limit en login

## Requisitos

- Node.js 18+ (probado en Node 20/22/24)

## Instalación

```bash
npm install
cp .env.example .env   # en Windows: copy .env.example .env
```

Edita el archivo `.env` con tus credenciales (ver sección siguiente).

## Configuración (.env)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default `3000`) |
| `SESSION_SECRET` | Clave secreta para sesiones (cámbiala en producción) |
| `ADMIN_USERNAME` | Usuario admin inicial (seed) |
| `ADMIN_PASSWORD` | Contraseña admin inicial (seed) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Host y puerto SMTP. Gmail: `smtp.gmail.com`, `465`, `true` |
| `SMTP_USER` / `SMTP_PASS` | Usuario SMTP y contraseña (usar *contraseña de aplicación* en Gmail) |
| `SMTP_FROM_NAME` / `SMTP_FROM_ADDRESS` | Remitente visible en los correos |
| `APP_URL` | URL pública del sistema |

> Si el SMTP no está configurado, los pases se registran igual y el correo se omite (queda registrado en logs).

## Uso

```bash
npm start          # producción
npm run dev        # desarrollo con recarga automática (node --watch)
npm run init-db    # inicializar base de datos y crear admin
npm run backup     # crea un backup en data/backups/
npm run restore    # restaura (requiere ruta: npm run restore -- data/backups/xxx.db)
npm test           # tests Jest + Supertest
```

Abre `http://localhost:3000` e ingresa con el usuario admin definido en `.env` (por defecto `admin` / `admin123`).

## Funcionalidades

- **Panel principal:** tarjetas con pases de hoy, ingresos del día y del mes, pendiente por cobrar, gráfico de últimos 7 días y pases recientes.
- **Pases de día:** registro, edición y eliminación. Campos: cédula, nombre, teléfono, correo, cantidad de personas, placa de vehículo, fecha, hora entrada/salida, monto (₡), estado de pago y observaciones.
- **Búsqueda y filtros:** por texto (nombre, cédula, correo, placa), fecha y estado de pago.
- **Correo automático:** al registrar un pase se envía confirmación al visitante. Se puede reenviar desde la lista.
- **Reportes:** por rango de fechas, con totales, resumen por día y detalle imprimible.
- **Auditoría de correos:** cada intento de envío queda registrado en `email_logs`.

## Estructura

```
src/
├── config/        # env + conexión SQLite
├── db/            # schema, init y seed
├── middleware/    # auth, flash, errores
├── routes/        # auth, dashboard, pases, reportes
├── services/      # authService, emailService, passService
├── views/         # EJS (layout, login, dashboard, pases, reportes, error)
└── server.js      # arranque
```

La base de datos se crea automáticamente en `data/camping.db` al primer inicio.

## Notas de seguridad

- Cambia `SESSION_SECRET` y `ADMIN_PASSWORD` antes de usarlo en producción.
- Para Gmail con verificación en 2 pasos, genera una *contraseña de aplicación* y úsala en `SMTP_PASS`.
- **CSRF:** todos los formularios POST incluyen un token (cookie double-submit). Login y logout están exentos.
- **Rate limit global** (300 req/15 min por IP) + límite estricto en `/login` (20 intentos/15 min).
- **Sesiones:** se regenera el ID de sesión tras un login correcto (mitiga session fixation).
- **Zona horaria:** las fechas "hoy" se calculan en `America/Costa_Rica` (configurable vía `APP_TIMEZONE`).
- Los datos se guardan localmente en SQLite; respalda la carpeta `data/` o usa `npm run backup`.

## Pruebas

Tests unitarios (validación, zona horaria) e integración (login, CSRF, creación de pases) con Jest + Supertest:

```bash
npm test
```
