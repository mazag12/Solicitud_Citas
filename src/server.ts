import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import {
  createNodeRequestHandler,
  createWebRequestFromNodeRequest,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { getContext } from '@netlify/angular-runtime/app-engine.js';
import { createServer } from 'node:http';

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

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  for (const [ip, entry] of requestsByIp) {
    if (entry.resetAt <= now) requestsByIp.delete(ip);
  }
  const current = requestsByIp.get(clientIp);
  if (current && current.resetAt > now && current.count >= 3) return true;
  requestsByIp.set(clientIp, current && current.resetAt > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, resetAt: now + 60_000 });
  return false;
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

const angularAppEngine = new AngularAppEngine();

async function handleApiRequest(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/citas/disponibilidad' && request.method === 'GET') {
    return jsonResponse(
      { timezone: 'America/Lima', days: configuredDays, slots: configuredSlots },
      200,
      { 'Cache-Control': 'no-store' },
    );
  }
  if (pathname !== '/api/citas' || request.method !== 'POST') return null;

  const clientIp = request.headers.get('x-nf-client-connection-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return jsonResponse(
      { message: 'Has enviado varias invitaciones. Espera un momento y vuelve a intentarlo.' },
      429,
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 10 * 1024) {
    return jsonResponse({ message: 'La solicitud es demasiado grande.' }, 413);
  }

  let body: CitaRequest;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 10 * 1024) {
      return jsonResponse({ message: 'La solicitud es demasiado grande.' }, 413);
    }
    body = JSON.parse(rawBody) as CitaRequest;
  } catch {
    return jsonResponse({ message: 'La solicitud no contiene JSON válido.' }, 400);
  }

  const nombre = cleanText(body?.nombre, 80);
  const correo = cleanText(body?.correo, 254);
  const tipoCita = cleanText(body?.tipoCita, 80);
  const fecha = cleanText(body?.fecha, 10);
  const hora = cleanText(body?.hora, 5);
  const lugar = cleanText(body?.lugar, 160);
  const mensaje = cleanText(body?.mensaje, 1000);

  if (!nombre || !allowedPlans.includes(tipoCita) || !isDateAvailable(fecha) || !isTimeAvailable(fecha, hora)) {
    return jsonResponse({ message: 'Revisa los datos y elige un horario que siga disponible.' }, 400);
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return jsonResponse({ message: 'El correo electrónico no tiene un formato válido.' }, 400);
  }

  const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, CITA_DESTINATARIO } = process.env;
  const EMAILJS_PRIVATE_KEY = process.env['EMAILJS_PRIVATE_KEY'];
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !CITA_DESTINATARIO) {
    return jsonResponse({ message: 'El servicio de invitaciones no está configurado.' }, 503);
  }

  const receivedAt = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date());

  try {
    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        ...(EMAILJS_PRIVATE_KEY ? { accessToken: EMAILJS_PRIVATE_KEY } : {}),
        template_params: {
          asunto: `Solicitud de cita ${new Date().getFullYear()} - ${nombre}`,
          nombre,
          correo: correo || 'No indicado',
          tipoCita,
          fecha,
          hora,
          zona_horaria: 'America/Lima',
          lugar: lugar || 'No indicado',
          mensaje: mensaje || 'Sin mensaje adicional',
          fecha_recepcion: receivedAt,
          to_email: CITA_DESTINATARIO,
          reply_to: correo,
        },
      }),
    });
    if (!emailResponse.ok) {
      const details = (await emailResponse.text()).replace(/\s+/g, ' ').slice(0, 500);
      console.error(`EmailJS rechazó la invitación (HTTP ${emailResponse.status}): ${details}`);
      return jsonResponse({ message: 'No se pudo entregar la invitación por correo.' }, 502);
    }
    return jsonResponse({ received: true }, 201);
  } catch (error) {
    console.error('No se pudo conectar con EmailJS:', error);
    return jsonResponse({ message: 'No se pudo entregar la invitación por correo.' }, 502);
  }
}

export async function netlifyAppEngineHandler(request: Request): Promise<Response> {
  const apiResponse = await handleApiRequest(request);
  if (apiResponse) return apiResponse;

  const result = await angularAppEngine.handle(request, getContext());
  return result ?? new Response('Not found', { status: 404 });
}

export const reqHandler = createRequestHandler(netlifyAppEngineHandler);

const nodeRequestHandler = createNodeRequestHandler(async (req, res, next) => {
  try {
    const request = createWebRequestFromNodeRequest(req);
    const headers = new Headers(request.headers);
    headers.set('x-nf-client-connection-ip', req.socket.remoteAddress ?? 'unknown');
    const response = await netlifyAppEngineHandler(new Request(request, { headers }));
    await writeResponseToNodeResponse(response, res);
  } catch (error) {
    next(error);
  }
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  createServer((req, res) => {
    nodeRequestHandler(req, res, (error) => {
      if (error) {
        console.error('No se pudo procesar la solicitud:', error);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      }
    });
  }).listen(port, () => {
    console.log(`Node server listening on http://localhost:${port}`);
  });
}

export default nodeRequestHandler;
