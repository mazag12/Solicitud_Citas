import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import nodemailer from 'nodemailer';
import { join } from 'node:path';

interface CitaRequest {
  nombre?: unknown;
  correo?: unknown;
  tipoCita?: unknown;
  fecha?: unknown;
  hora?: unknown;
  lugar?: unknown;
  mensaje?: unknown;
}

const allowedPlans = [
  'Café y conversación', 'Una cena especial', 'Un paseo juntos',
  'Una película', 'Una sorpresa', 'Otro plan',
];
const configuredDays = (process.env['CITA_DIAS_DISPONIBLES'] ?? '1,2,3,4,5,6,7')
  .split(',').map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
const configuredSlots = (process.env['CITA_HORARIOS'] ?? '10:00,12:00,16:00,18:00,19:00')
  .split(',').map((slot) => slot.trim()).filter((slot) => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot));
const requestsByIp = new Map<string, { count: number; resetAt: number }>();

function limaParts(date = new Date()): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isDateAvailable(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const today = limaParts();
  const todayIso = `${today['year']}-${today['month']}-${today['day']}`;
  const latest = new Date(`${todayIso}T12:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + 180);
  const weekday = parsed.getUTCDay() || 7;
  return date >= todayIso && date <= latest.toISOString().slice(0, 10) && configuredDays.includes(weekday);
}

function isTimeAvailable(date: string, time: string): boolean {
  if (!configuredSlots.includes(time)) return false;
  const now = limaParts();
  const today = `${now['year']}-${now['month']}-${now['day']}`;
  return date !== today || time > `${now['hour']}:${now['minute']}`;
}

function limitInvitations(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const now = Date.now();
  for (const [ip, entry] of requestsByIp) {
    if (entry.resetAt <= now) requestsByIp.delete(ip);
  }
  const ip = req.ip ?? 'unknown';
  const current = requestsByIp.get(ip);
  if (current && current.resetAt > now && current.count >= 3) {
    res.status(429).json({ message: 'Has enviado varias invitaciones. Espera un momento y vuelve a intentarlo.' });
    return;
  }
  requestsByIp.set(ip, current && current.resetAt > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, resetAt: now + 60_000 });
  next();
}

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '10kb' }));

app.get('/api/citas/disponibilidad', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ timezone: 'America/Lima', days: configuredDays, slots: configuredSlots });
});

app.post('/api/citas', limitInvitations, async (req, res) => {
  const body = req.body as CitaRequest;
  const nombre = cleanText(body?.nombre, 80);
  const correo = cleanText(body?.correo, 254);
  const tipoCita = cleanText(body?.tipoCita, 80);
  const fecha = cleanText(body?.fecha, 10);
  const hora = cleanText(body?.hora, 5);
  const lugar = cleanText(body?.lugar, 160);
  const mensaje = cleanText(body?.mensaje, 1000);

  if (!nombre || !allowedPlans.includes(tipoCita) || !isDateAvailable(fecha) || !isTimeAvailable(fecha, hora)) {
    res.status(400).json({ message: 'Revisa los datos y elige un horario que siga disponible.' });
    return;
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    res.status(400).json({ message: 'El correo electrónico no tiene un formato válido.' });
    return;
  }

  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, CITA_DESTINATARIO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !CITA_DESTINATARIO) {
    res.status(503).json({ message: 'El servicio de invitaciones no está configurado.' });
    return;
  }

  const receivedAt = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date());
  const safe = {
    nombre: escapeHtml(nombre), correo: escapeHtml(correo || 'No indicado'),
    tipoCita: escapeHtml(tipoCita), fecha: escapeHtml(fecha), hora: escapeHtml(hora),
    lugar: escapeHtml(lugar || 'Por decidir juntos'),
    mensaje: escapeHtml(mensaje || 'Sin mensaje adicional').replace(/\r?\n/g, '<br>'),
    receivedAt: escapeHtml(receivedAt),
  };

  try {
    const port = Number(process.env['SMTP_PORT'] ?? 587);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: process.env['SMTP_SECURE'] === 'true' || port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env['SMTP_FROM'] ?? SMTP_USER,
      to: CITA_DESTINATARIO,
      replyTo: correo || undefined,
      subject: '💌 ¡Tienes una nueva invitación para una cita!',
      text: `Nueva invitación de ${nombre}\nPlan: ${tipoCita}\nFecha: ${fecha} ${hora} (America/Lima)\nLugar: ${lugar || 'Por decidir juntos'}\nMensaje: ${mensaje || 'Sin mensaje adicional'}\nRecibida: ${receivedAt}`,
      html: `<!doctype html><html lang="es"><body style="margin:0;background:#fff5f7;font-family:Arial,sans-serif;color:#29232a;padding:28px 12px"><table role="presentation" style="max-width:600px;width:100%;margin:auto;background:#fff;border-collapse:collapse"><tr><td style="padding:34px 32px 12px;text-align:center;color:#8e3a59;font-size:12px;letter-spacing:3px">UNA INVITACIÓN ESPECIAL</td></tr><tr><td style="padding:0 32px 20px;text-align:center"><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;color:#8e3a59">¡Tienes una nueva cita por imaginar! 💌</h1></td></tr><tr><td style="padding:0 32px 30px"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><th align="left" style="padding:12px 0;border-bottom:1px solid #f0dfe3;color:#8e3a59">De</th><td style="padding:12px 0;border-bottom:1px solid #f0dfe3">${safe.nombre}</td></tr><tr><th align="left" style="padding:12px 0;border-bottom:1px solid #f0dfe3;color:#8e3a59">Plan</th><td style="padding:12px 0;border-bottom:1px solid #f0dfe3">${safe.tipoCita}</td></tr><tr><th align="left" style="padding:12px 0;border-bottom:1px solid #f0dfe3;color:#8e3a59">Fecha y hora</th><td style="padding:12px 0;border-bottom:1px solid #f0dfe3">${safe.fecha} · ${safe.hora} (Lima)</td></tr><tr><th align="left" style="padding:12px 0;border-bottom:1px solid #f0dfe3;color:#8e3a59">Lugar</th><td style="padding:12px 0;border-bottom:1px solid #f0dfe3">${safe.lugar}</td></tr><tr><th align="left" style="padding:12px 0;border-bottom:1px solid #f0dfe3;color:#8e3a59">Correo</th><td style="padding:12px 0;border-bottom:1px solid #f0dfe3">${safe.correo}</td></tr><tr><th align="left" style="padding:12px 0;color:#8e3a59">Mensaje</th><td style="padding:12px 0">${safe.mensaje}</td></tr></table><p style="margin:26px 0 0;color:#74666c;font-size:12px">Solicitud recibida el ${safe.receivedAt}.</p></td></tr><tr><td style="padding:17px;text-align:center;background:#f8ece9;color:#8e3a59;font-family:Georgia,serif;font-style:italic">Una solicitud no es una cita confirmada todavía.</td></tr></table></body></html>`,
    });
    res.status(201).json({ received: true });
  } catch {
    console.error('No se pudo enviar el correo de invitación.');
    res.status(502).json({ message: 'No se pudo entregar la invitación por correo.' });
  }
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
