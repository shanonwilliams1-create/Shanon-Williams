import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || process.env.SALES_EMAIL || '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL   = process.env.FROM_EMAIL || 'no-reply@intakeai.app';

app.use(express.json());

// ── In-memory session stores ──────────────────────────────────────────────────
const salesSessions  = new Map();
const intakeSessions = new Map();

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Optional SendGrid notification ───────────────────────────────────────────
async function sendNotification(to, subject, text) {
  if (!SENDGRID_KEY || !to) return;
  try {
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL },
      subject,
      content: [{ type: 'text/plain', value: text }],
    };
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('SendGrid error:', e.message);
  }
}

// ── SALES BOT ─────────────────────────────────────────────────────────────────
// Collects: name, firm, plan interest, email, phone

const SALES_STEPS = [
  // step 0 — greeting
  (s) => `Hey there! Thanks for your interest in IntakeAI. I just need a couple of quick details to get your firm set up. What's your name, and what firm are you with?`,

  // step 1 — plan interest (after name/firm)
  (s) => `Nice to meet you, ${s.name || 'there'}! We have two options:\n\nSelf-Serve – $250/month. You set it up yourself using our step-by-step guide.\n\nManaged – $200/month + a one-time $500 setup fee. Our team handles everything — installation, configuration, and onboarding.\n\nWhich sounds like a better fit for your firm?`,

  // step 2 — email (after plan)
  (s) => `${s.plan ? `${s.plan} is a popular choice. ` : ''}What's the best email address to reach you at?`,

  // step 3 — phone (after email)
  (s) => `Got it. And a phone number? Our team may give you a quick call to get things moving.`,

  // step 4 — done
  (s) => `You're all set, ${s.name || 'there'}! Someone from our team will be in touch at ${s.email} within one business day. We're looking forward to working with ${s.firm || 'your firm'}!`,
];

function parseSalesInput(step, input, session) {
  const txt = input.trim();
  if (step === 0) {
    // Try to split "John Smith, Smith & Associates"
    const comma = txt.indexOf(',');
    if (comma > 0) {
      session.name = txt.slice(0, comma).trim().split(' ')[0];
      session.firm = txt.slice(comma + 1).trim();
    } else {
      const words = txt.split(' ');
      session.name = words[0];
      session.firm = words.slice(1).join(' ') || txt;
    }
  } else if (step === 1) {
    const lower = txt.toLowerCase();
    session.plan = lower.includes('managed') ? 'Managed' : lower.includes('self') ? 'Self-Serve' : txt;
  } else if (step === 2) {
    session.email = txt;
  } else if (step === 3) {
    session.phone = txt;
  }
}

app.post('/api/intake/sales/start', (req, res) => {
  const id = uid();
  const plan = req.body?.plan || null;
  const session = { step: 0, plan, name: '', firm: '', email: '', phone: '' };
  salesSessions.set(id, session);
  res.json({ session_id: id, message: SALES_STEPS[0](session), done: false });
});

app.post('/api/intake/sales/message', async (req, res) => {
  const { session_id, message } = req.body || {};
  const session = salesSessions.get(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.done) return res.json({ message: 'Thanks again! Our team will be in touch.', done: true });

  parseSalesInput(session.step, message || '', session);
  session.step += 1;

  const done = session.step >= SALES_STEPS.length - 1;
  const reply = SALES_STEPS[Math.min(session.step, SALES_STEPS.length - 1)](session);

  if (done) {
    session.done = true;
    const summary =
      `New IntakeAI Sales Lead\n` +
      `Name:  ${session.name}\n` +
      `Firm:  ${session.firm}\n` +
      `Plan:  ${session.plan}\n` +
      `Email: ${session.email}\n` +
      `Phone: ${session.phone}\n` +
      `Time:  ${new Date().toLocaleString()}`;
    console.log('\n── SALES LEAD ──────────────────\n' + summary + '\n────────────────────────────────');
    if (NOTIFY_EMAIL) {
      await sendNotification(NOTIFY_EMAIL, `IntakeAI Sales Lead — ${session.firm}`, summary);
    }
  }

  res.json({ message: reply, done });
});

// ── INTAKE BOT ────────────────────────────────────────────────────────────────
// For the "Free Case Review" widget on law firm sites (or our demo)

const INTAKE_STEPS = [
  (s) => `Hi! Thanks for reaching out. I'll grab a few quick details so the right attorney can review your case. What's your name?`,

  (s) => `Hi ${s.name}! What kind of legal issue are you dealing with? For example — car accident, criminal charge, divorce, workers' comp, immigration. Whatever fits your situation.`,

  (s) => `Got it. Can you give me a brief description of what happened and when?`,

  (s) => `Thanks for sharing that. Is this time-sensitive? For instance — do you have a court date coming up, were you recently arrested, or do you need help right away?`,

  (s) => `Understood. What's the best phone number to reach you at?`,

  (s) => `Almost done — what email should we send your case summary to?`,

  (s) => {
    const urgent = /yes|urgent|arrested|court|accident|hospital|emergency/i.test(s.urgency || '');
    return urgent
      ? `Thank you, ${s.name}. Your case has been flagged as urgent. Our team will reach out to you at ${s.phone || s.email} as soon as possible. You'll also get a confirmation at ${s.email}.`
      : `Thank you, ${s.name}! Your intake has been submitted. One of our attorneys will review your case and follow up at ${s.email} within one business day.`;
  },
];

function scoreIntake(session) {
  let score = 50;
  const urgencyText = (session.urgency || '').toLowerCase();
  const descText    = (session.description || '').toLowerCase();
  const combined    = urgencyText + ' ' + descText;
  if (/yes|urgent/i.test(urgencyText)) score += 20;
  if (/arrest|dui|criminal|accident|injury|hospital/i.test(combined)) score += 15;
  if (/court|deadline|tomorrow|today|tonight/i.test(combined)) score += 15;
  if (session.phone) score += 5;
  return Math.min(score, 100);
}

function parseIntakeInput(step, input, session) {
  const txt = input.trim();
  if (step === 0) session.name = txt.split(' ')[0];
  else if (step === 1) session.caseType = txt;
  else if (step === 2) session.description = txt;
  else if (step === 3) session.urgency = txt;
  else if (step === 4) session.phone = txt;
  else if (step === 5) session.email = txt;
}

app.post('/api/intake/chat/start', (req, res) => {
  const id = uid();
  const session = { step: 0, source: req.body?.source || 'chat' };
  intakeSessions.set(id, session);
  res.json({ session_id: id, message: INTAKE_STEPS[0](session), done: false });
});

app.post('/api/intake/chat/message', async (req, res) => {
  const { session_id, message } = req.body || {};
  const session = intakeSessions.get(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.done) return res.json({ message: 'Our team will be in touch soon. Thank you!', done: true });

  parseIntakeInput(session.step, message || '', session);
  session.step += 1;

  const done = session.step >= INTAKE_STEPS.length - 1;
  const reply = INTAKE_STEPS[Math.min(session.step, INTAKE_STEPS.length - 1)](session);

  if (done) {
    session.done = true;
    const score   = scoreIntake(session);
    const urgent  = score >= 80;
    const summary =
      `New IntakeAI Lead (score: ${score}${urgent ? ' — URGENT' : ''})\n` +
      `Name:        ${session.name}\n` +
      `Case Type:   ${session.caseType}\n` +
      `Description: ${session.description}\n` +
      `Urgency:     ${session.urgency}\n` +
      `Phone:       ${session.phone}\n` +
      `Email:       ${session.email}\n` +
      `Source:      ${session.source}\n` +
      `Time:        ${new Date().toLocaleString()}`;
    console.log('\n── INTAKE LEAD ─────────────────\n' + summary + '\n────────────────────────────────');
    if (NOTIFY_EMAIL) {
      const subj = urgent
        ? `🚨 URGENT IntakeAI Lead — ${session.caseType} (score ${score})`
        : `New IntakeAI Lead — ${session.caseType} (score ${score})`;
      await sendNotification(NOTIFY_EMAIL, subj, summary);
    }
  }

  res.json({ message: reply, done, score: done ? scoreIntake(session) : undefined });
});

// ── Web Scraper ───────────────────────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,6}\b/g;
const PHONE_RE = /(?:\+?1[\s.\-]?)?(?:\(?([2-9]\d{2})\)?[\s.\-]?)([2-9]\d{2})[\s.\-]?(\d{4})/g;

const JUNK_EMAIL_DOMAINS = ['sentry.io','wixpress.com','squarespace.com','godaddy.com',
  'wordpress.com','example.com','domain.com','yourdomain.com','email.com'];
const JUNK_EMAIL_LOCALS  = /^(noreply|no-reply|donotreply|postmaster|webmaster|support|admin|info@example)/i;
const JUNK_EMAIL_EXTS    = /\.(png|jpg|gif|svg|webp|pdf|css|js|woff|ttf)$/i;

function extractEmails(html) {
  EMAIL_RE.lastIndex = 0;
  const found = new Set();
  let m;
  while ((m = EMAIL_RE.exec(html)) !== null) {
    const e = m[0].toLowerCase();
    const [local, domain] = e.split('@');
    if (!domain) continue;
    if (JUNK_EMAIL_EXTS.test(e)) continue;
    if (JUNK_EMAIL_LOCALS.test(local)) continue;
    if (JUNK_EMAIL_DOMAINS.some(d => domain.endsWith(d))) continue;
    if (local.length > 50) continue;
    found.add(e);
  }
  return [...found];
}

function extractPhones(text) {
  PHONE_RE.lastIndex = 0;
  const found = new Set();
  let m;
  const plain = text.replace(/<[^>]+>/g, ' ');
  while ((m = PHONE_RE.exec(plain)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length === 10 || (digits.length === 11 && digits[0] === '1')) {
      found.add(m[0].trim());
    }
  }
  return [...found];
}

function extractFirmName(html) {
  let m = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]{2,80})"/i)
           || html.match(/<meta[^>]+content="([^"]{2,80})"[^>]+property="og:site_name"/i);
  if (m) return m[1].trim();
  m = html.match(/<title[^>]*>([^<]{2,120})<\/title>/i);
  if (m) return m[1].split(/[|\-–—]/)[0].trim().slice(0, 80);
  return '';
}

function findSubpageLinks(html, origin) {
  const hrefs = [...html.matchAll(/href=["']([^"'#?]+)["']/gi)].map(x => x[1]);
  return hrefs
    .filter(h => /contact|about|team|staff|attorney|lawyer|people/i.test(h))
    .slice(0, 3)
    .map(h => { try { return h.startsWith('http') ? h : new URL(h, origin).href; } catch { return null; } })
    .filter(Boolean);
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('html') && !ct.includes('text')) throw new Error('Not HTML');
  return r.text();
}

async function scrapeUrl(rawUrl) {
  if (!rawUrl.match(/^https?:\/\//i)) rawUrl = 'https://' + rawUrl;
  let origin;
  try { origin = new URL(rawUrl).origin; } catch { throw new Error('Invalid URL'); }

  const result = { url: rawUrl, firmName: '', emails: [], phones: [] };

  let mainHtml = '';
  try {
    mainHtml = await fetchHtml(rawUrl);
    result.firmName = extractFirmName(mainHtml);
    result.emails.push(...extractEmails(mainHtml));
    result.phones.push(...extractPhones(mainHtml));
  } catch (e) {
    result.error = e.message;
    return result;
  }

  // Try contact / about / team sub-pages
  for (const link of findSubpageLinks(mainHtml, origin)) {
    try {
      const sub = await fetchHtml(link);
      result.emails.push(...extractEmails(sub));
      result.phones.push(...extractPhones(sub));
    } catch { /* skip */ }
  }

  result.emails = [...new Set(result.emails)];
  result.phones = [...new Set(result.phones)];
  return result;
}

app.post('/api/scrape', async (req, res) => {
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || !urls.length) {
    return res.status(400).json({ error: 'urls array required' });
  }
  const list = urls.slice(0, 50).map(u => u.trim()).filter(Boolean);
  const results = [];
  const BATCH = 5;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const done = await Promise.all(batch.map(url =>
      scrapeUrl(url).catch(e => ({ url, error: e.message, firmName: '', emails: [], phones: [] }))
    ));
    results.push(...done);
    if (i + BATCH < list.length) await new Promise(r => setTimeout(r, 400));
  }
  console.log(`Scrape: ${results.length} URLs, ${results.filter(r => r.emails.length).length} with emails`);
  res.json({ results });
});

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () =>
  console.log(`IntakeAI on port ${PORT} | notify → ${NOTIFY_EMAIL || '(no email set)'}`)
);
