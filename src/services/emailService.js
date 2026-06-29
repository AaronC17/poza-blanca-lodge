const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const config = require('../config/env');
const { getDb } = require('../config/database');
const { fmtTime } = require('./passService');

let transporter = null;

function isConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

function logEmail(passId, to, subject, status, error) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO email_logs (pass_id, to_address, subject, status, error) VALUES (?, ?, ?, ?, ?)'
    ).run(passId || null, to, subject || null, status, error || null);
  } catch (e) {
    console.error('[email] No se pudo registrar log de correo:', e.message);
  }
}

function formatCRC(amount) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLogoAttachments() {
  const logoPath = path.resolve(__dirname, '..', 'public', 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    return [{
      filename: 'poza-blanca-logo.png',
      path: logoPath,
      cid: 'poza-logo',
    }];
  }
  return [];
}

function buildPassEmail(pass) {
  const fecha = new Date(pass.fecha + 'T00:00:00').toLocaleDateString('es-CR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const horaEntrada = fmtTime(pass.hora_entrada) || '—';
  const horaSalida = fmtTime(pass.hora_salida) || '—';
  const estadoLabel = pass.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente';
  const estadoColor = pass.estado_pago === 'pagado' ? '#41a61f' : '#d4a843';
  const estadoBg = pass.estado_pago === 'pagado' ? '#f1f8ed' : '#fdf8ec';

  return {
    subject: `Confirmación de pase de día · Poza Blanca Lodge — ${fecha}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f6f7f5;font-family:'Inter',Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f5;min-height:100vh;">
          <tr><td align="center" style="padding:32px 16px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(29,64,26,0.08);">

              <!-- Header con branding -->
              <tr>
                <td style="background:linear-gradient(135deg,#152e13 0%,#1d401a 60%,#266417 100%);padding:28px 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <img src="cid:poza-logo" alt="Poza Blanca Lodge" width="44" height="44" style="border-radius:10px;background:#ffffff;padding:6px;display:inline-block;vertical-align:middle;" />
                      </td>
                      <td style="vertical-align:middle;padding-left:14px;">
                        <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">Poza Blanca Lodge</p>
                        <p style="margin:2px 0 0;color:#9bd977;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Hotel Boutique · San Mateo, Alajuela</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Línea decorativa -->
              <tr><td style="height:4px;background:linear-gradient(90deg,#41a61f,#d4a843);"></td></tr>

              <!-- Contenido -->
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 6px;color:#41a61f;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Confirmación de pase de día</p>
                  <h1 style="margin:0 0 16px;color:#152e13;font-size:24px;font-weight:700;">Hola, ${escapeHtml(pass.nombre)}</h1>
                  <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                    Hemos registrado tu pase de día para disfrutar del camping en Poza Blanca Lodge. Aquí tienes los detalles de tu visita:
                  </p>

                  <!-- Tarjeta de detalles -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f8ed;border:1px solid #dcedd0;border-radius:14px;margin-bottom:20px;">
                    <tr><td style="padding:20px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                        <tr>
                          <td style="padding:8px 0;color:#64748b;width:45%;font-weight:500;">Fecha</td>
                          <td style="padding:8px 0;color:#152e13;font-weight:600;text-transform:capitalize;">${fecha}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#64748b;border-top:1px solid #dcedd0;">Cédula</td>
                          <td style="padding:8px 0;color:#152e13;font-weight:600;border-top:1px solid #dcedd0;">${escapeHtml(pass.cedula)}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#64748b;border-top:1px solid #dcedd0;">Cantidad de personas</td>
                          <td style="padding:8px 0;color:#152e13;font-weight:600;border-top:1px solid #dcedd0;">${pass.cantidad_personas}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#64748b;border-top:1px solid #dcedd0;">Vehículo (placa)</td>
                          <td style="padding:8px 0;color:#152e13;font-weight:600;border-top:1px solid #dcedd0;text-transform:uppercase;">${escapeHtml(pass.placa_vehiculo || '—')}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#64748b;border-top:1px solid #dcedd0;">Hora de entrada</td>
                          <td style="padding:8px 0;color:#152e13;font-weight:600;border-top:1px solid #dcedd0;">${horaEntrada}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#64748b;border-top:1px solid #dcedd0;">Hora de salida</td>
                          <td style="padding:8px 0;color:#152e13;font-weight:600;border-top:1px solid #dcedd0;">${horaSalida}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;color:#64748b;border-top:1px solid #dcedd0;font-weight:500;">Monto</td>
                          <td style="padding:10px 0;color:#1d401a;font-weight:700;font-size:18px;border-top:1px solid #dcedd0;">${formatCRC(pass.monto)}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;color:#64748b;border-top:1px solid #dcedd0;">Estado del pago</td>
                          <td style="padding:8px 0;border-top:1px solid #dcedd0;">
                            <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${estadoBg};color:${estadoColor};font-weight:600;font-size:13px;border:1px solid ${estadoColor}33;">${estadoLabel}</span>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>

                  ${pass.observaciones ? `<p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.5;background:#faf8f4;border-left:3px solid #d4a843;padding:12px 16px;border-radius:0 8px 8px 0;"><strong style="color:#152e13;">Observaciones:</strong> ${escapeHtml(pass.observaciones)}</p>` : ''}

                  <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                    Si tienes alguna duda sobre tu reserva, comunícate con recepción al <strong style="color:#152e13;">+506 6372 0087</strong> o escríbenos a <strong style="color:#152e13;">lapazpozablanca@outlook.es</strong>.
                  </p>
                  <p style="margin:12px 0 0;color:#41a61f;font-size:14px;font-weight:600;">¡Te esperamos en Poza Blanca Lodge!</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#152e13;padding:22px 32px;text-align:center;">
                  <p style="margin:0;color:#9bd977;font-size:12px;font-weight:500;">Poza Blanca Lodge · Hotel Boutique</p>
                  <p style="margin:4px 0 0;color:#6b8f5a;font-size:11px;">San Mateo, Alajuela, Costa Rica · <a href="https://www.pozablancalodge.com" style="color:#9bd977;text-decoration:none;">www.pozablancalodge.com</a></p>
                  <p style="margin:8px 0 0;color:#4a6b3f;font-size:10px;">© ${new Date().getFullYear()} Poza Blanca Lodge. Todos los derechos reservados.</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  };
}

async function sendPassConfirmation(pass) {
  if (!pass.correo) {
    logEmail(pass.id, '(sin correo)', null, 'skipped', 'El pase no tiene correo.');
    return { status: 'skipped', reason: 'Sin correo destinatario.' };
  }

  if (!isConfigured()) {
    console.warn('[email] SMTP no configurado. Se omite el envío real. Revisa el .env.');
    logEmail(pass.id, pass.correo, null, 'skipped', 'SMTP no configurado.');
    return { status: 'skipped', reason: 'SMTP no configurado.' };
  }

  const { subject, html } = buildPassEmail(pass);
  const attachments = getLogoAttachments();

  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromAddress}>`,
      to: pass.correo,
      subject,
      html,
      attachments,
    });
    logEmail(pass.id, pass.correo, subject, 'sent', null);
    return { status: 'sent', messageId: info.messageId };
  } catch (err) {
    console.error('[email] Error enviando correo:', err.message);
    logEmail(pass.id, pass.correo, subject, 'error', err.message);
    return { status: 'error', error: err.message };
  }
}

module.exports = { sendPassConfirmation, isConfigured };
