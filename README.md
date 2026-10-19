# Una invitación

Aplicación Angular para enviar una solicitud personal de cita. El formulario consulta los días y horarios configurados en el servidor; una reserva se considera enviada solo cuando el backend acepta el correo. Enviar una solicitud no confirma la cita.

## Desarrollo

```bash
npm install
npm start
```

Para que disponibilidad y envío estén activos, ejecuta la aplicación con el servidor SSR de Express. Primero crea el build y después inicia el servidor:

```bash
npm run build
npm run serve:ssr:Solicitud_Citas
```

El servidor escucha en `http://localhost:4000` por defecto. El endpoint `GET /api/citas/disponibilidad` sirve el horario, y `POST /api/citas` valida y envía la invitación.

## Configuración del servidor

Define estas variables en el entorno del proceso Node. No las incluyas en Angular ni en el navegador:

| Variable | Uso |
| --- | --- |
| `SMTP_HOST` | Host del proveedor SMTP |
| `SMTP_PORT` | Puerto SMTP; por defecto `587` |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASSWORD` | Contraseña o clave de aplicación SMTP |
| `SMTP_SECURE` | `true` para TLS implícito; el puerto `465` también lo activa |
| `SMTP_FROM` | Remitente opcional; por defecto `SMTP_USER` |
| `CITA_DESTINATARIO` | Dirección que recibirá las solicitudes |
| `CITA_DIAS_DISPONIBLES` | Días ISO separados por coma (`1` lunes, `7` domingo); por defecto todos |
| `CITA_HORARIOS` | Horas `HH:mm` separadas por coma; por defecto `10:00,12:00,16:00,18:00,19:00` |
| `NG_ALLOWED_HOSTS` | Hosts autorizados para SSR, separados por coma; en local usa `localhost` y en producción agrega tu dominio |

La zona horaria es `America/Lima`. El servidor rechaza fechas pasadas, fechas a más de 180 días, días y horarios no configurados, horas ya transcurridas para hoy y solicitudes mal formadas. Limita a tres solicitudes por minuto por IP en cada instancia. El proveedor SMTP y las variables de entorno deben configurarse antes de que `POST /api/citas` pueda devolver éxito; si falta la configuración, responde `503`.

## Comprobaciones

```bash
npm test -- --watch=false
npm run build
```
