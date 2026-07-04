import { readFileSync } from 'node:fs';
import { createTransport } from 'nodemailer';

function buildTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // SMTP not configured — email silently skipped

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;

  let pass = process.env.SMTP_PASS;
  if (!pass) {
    try { pass = readFileSync('/run/secrets/smtp_password', 'utf8').trim(); } catch {}
  }

  return createTransport({
    host,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

const transport = buildTransport();

/**
 * Send a plain-text / HTML email.
 * Returns { ok: true, messageId } or { ok: false, error }.
 * Never throws — SOAR actions must not crash on mail failure.
 */
export async function sendMail({ to, subject, text, html, from, attachments }) {
  if (!transport) {
    return { ok: false, error: 'SMTP not configured (set SMTP_HOST env var)' };
  }

  const fromAddr = from
    || process.env.SMTP_FROM
    || `CaspMail SOC <noreply@${process.env.MAIL_DOMAIN || 'secure.internal'}>`;

  try {
    const info = await transport.sendMail({ from: fromAddr, to, subject, text, html, attachments });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
