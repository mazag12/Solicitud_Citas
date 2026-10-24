# Una invitación

Aplicación Angular para enviar una solicitud personal de cita. El formulario consulta los días y horarios configurados en el servidor; una reserva se considera enviada solo cuando el backend acepta el correo. Enviar una solicitud no confirma la cita.

## Desarrollo

```bash
npm install
npm start
```

`npm start` levanta Angular con SSR en `http://localhost:4200` y carga las variables de `.env`. Si todavía no tienes el archivo, créalo a partir del ejemplo y completa tus credenciales de EmailJS y el correo destinatario. `.env` está excluido de Git:

```powershell
Copy-Item .env.example .env
```

En producción, genera el build y arranca el servidor SSR:

```bash
npm run build
npm run serve:ssr:Solicitud_Citas
```

El servidor de producción escucha en `http://localhost:4000` por defecto. En ambos modos, `GET /api/citas/disponibilidad` sirve el horario y `POST /api/citas` valida y envía la invitación.

## Configuración del servidor

El comando del servidor carga automáticamente las variables del archivo `.env` si existe. También puedes configurarlas directamente en el entorno del proceso Node. No incluyas las credenciales en Angular ni en el navegador:

| Variable | Uso |
| --- | --- |
| `EMAILJS_SERVICE_ID` | ID del servicio de correo de EmailJS |
| `EMAILJS_TEMPLATE_ID` | ID de la plantilla de EmailJS |
| `EMAILJS_PUBLIC_KEY` | Clave pública de EmailJS; se guarda en el servidor junto con las demás variables |
| `EMAILJS_PRIVATE_KEY` | Clave privada opcional de EmailJS |
| `CITA_DESTINATARIO` | Dirección que recibirá las solicitudes |
| `CITA_DIAS_DISPONIBLES` | Días ISO separados por coma (`1` lunes, `7` domingo); por defecto todos |
| `CITA_HORARIOS` | Horas `HH:mm` separadas por coma; por defecto `10:00,12:00,16:00,18:00,19:00` |
| `NG_ALLOWED_HOSTS` | Hosts autorizados para SSR, separados por coma; en local usa `localhost` y en producción agrega tu dominio |

La zona horaria es `America/Lima`. El servidor rechaza fechas pasadas, fechas a más de 180 días, días y horarios no configurados, horas ya transcurridas para hoy y solicitudes mal formadas. Limita a tres solicitudes por minuto por IP en cada instancia. EmailJS y las variables de entorno deben configurarse antes de que `POST /api/citas` pueda devolver éxito; si falta la configuración, responde `503`.

### Plantilla de EmailJS

Configura en EmailJS el servicio y la plantilla, y define las variables de entorno del archivo `.env.example` en el proceso Node. `EMAILJS_PRIVATE_KEY` es opcional; si se usa, se mantiene únicamente en el servidor. Configura en la plantilla el destinatario como `{{to_email}}` y, si quieres responder directamente al usuario, el campo Reply-To como `{{reply_to}}`.

El endpoint envía estos parámetros a la plantilla: `asunto`, `nombre`, `correo`, `tipoCita`, `fecha`, `hora`, `zona_horaria`, `lugar`, `mensaje`, `fecha_recepcion`, `to_email` y `reply_to`. Puedes poner `{{asunto}}` en el campo Subject de la plantilla y usar los demás en el cuerpo, por ejemplo: `{{nombre}} eligió {{tipoCita}} para el {{fecha}} a las {{hora}}`. Los campos opcionales vacíos se envían como “No indicado” o “Sin mensaje adicional”.

## Comprobaciones

```bash
npm test -- --watch=false
npm run build
```
