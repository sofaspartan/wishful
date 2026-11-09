import { escapeHtml } from '../util';
import { isLocalDev } from '../storage';
import { BRAND_NAME } from '../brand';

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain paragraphs; HTML-escaped automatically. */
  paragraphs: string[];
  action?: { label: string; url: string };
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

function render(msg: EmailMessage): { html: string; text: string } {
  const body = msg.paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.55">${escapeHtml(p)}</p>`).join('');
  const button = msg.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(msg.action.url)}" style="background:#1d1b18;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(msg.action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1b18">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<div style="font-family:Georgia,serif;font-size:22px;margin-bottom:24px">${escapeHtml(BRAND_NAME)}</div>
<div style="background:#fff;border:1px solid #e6e2db;border-radius:12px;padding:28px">${body}${button}</div>
<p style="font-size:12px;color:#77726a;margin-top:24px">You received this email because of activity on your ${escapeHtml(BRAND_NAME)} account.</p>
</div></body></html>`;
  const text = [...msg.paragraphs, msg.action ? `${msg.action.label}: ${msg.action.url}` : ''].filter(Boolean).join('\n\n');
  return { html, text };
}

/**
 * Send a transactional email through Resend. Failures are logged, never
 * thrown — email is best-effort and must not break the user's request.
 * Returns true when the message was handed to the provider.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const { html, text } = render(msg);
  if (!emailConfigured()) {
    if (isLocalDev() && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      console.info(`\n[email:dev] To: ${msg.to}\nSubject: ${msg.subject}\n\n${text}\n`);
    } else if (!isLocalDev()) {
      console.warn('[email] RESEND_API_KEY/EMAIL_FROM not configured — email not sent:', msg.subject);
    }
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html, text }),
    });
    if (!res.ok) {
      console.error('[email] provider error', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed', err);
    return false;
  }
}
