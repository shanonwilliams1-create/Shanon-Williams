import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import pg from 'pg';
const { Pool } = pg;
const scryptAsync = promisify(scrypt);

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || process.env.SALES_EMAIL || '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL   = process.env.FROM_EMAIL || 'no-reply@intakeai.app';

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio webhooks send form-encoded POST

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

// ── Auth Utilities ────────────────────────────────────────────────────────────
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID  || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN   || '';
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER  || '';

async function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const buf  = await scryptAsync(plain, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}
async function verifyPassword(plain, stored) {
  const [hashed, salt] = stored.split('.');
  const buf     = await scryptAsync(plain, salt, 64);
  const storedBuf = Buffer.from(hashed, 'hex');
  return timingSafeEqual(buf, storedBuf);
}
function generateToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}
function generate6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  }
  return out;
}
function setCookie(res, name, value, maxAgeSec, options = '') {
  res.setHeader('Set-Cookie',
    `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}${options}`
  );
}
function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`);
}

async function sendSMS(to, body) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !to) return false;
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    });
    return r.ok;
  } catch (e) {
    console.error('SMS error:', e.message);
    return false;
  }
}

async function sendHtmlEmail(to, subject, html, text, attachments = []) {
  if (!SENDGRID_KEY || !to) return;
  try {
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL },
      subject,
      content: [
        { type: 'text/plain', value: text || subject },
        { type: 'text/html',  value: html },
      ],
    };
    if (attachments.length) payload.attachments = attachments;
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('SendGrid HTML error:', e.message);
  }
}

function buildLeadAlertEmail({ lead, attorney, APP }) {
  const claimUrl  = `${APP}/claim/${lead.lead_token}/${attorney.attorney_token}`;
  const callUrl   = `tel:${(lead.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')}`;
  const smsUrl    = `sms:${(lead.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '+1$1')}`;
  const scoreColor = lead.score >= 8 ? '#dc2626' : lead.score >= 6 ? '#d97706' : '#16a34a';
  const urgentBadge = lead.score >= 8 ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;">🚨 URGENT</span>' : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px">
    <div style="color:white;font-size:13px;font-weight:600;letter-spacing:.5px;opacity:.8">⚖️ INTAKEAI</div>
    <h1 style="color:white;margin:8px 0 4px;font-size:22px">New ${lead.source === 'phone' ? 'Phone' : lead.source === 'appointment' ? 'Appointment Request' : 'Lead'} — ${lead.name || 'Unknown'}</h1>
    <div style="color:rgba(255,255,255,.8);font-size:14px">${new Date(lead.created_at || Date.now()).toLocaleString()}</div>
  </div>
  <div style="padding:32px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
      <span style="background:${scoreColor};color:white;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700">Score: ${lead.score}</span>
      ${urgentBadge}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${lead.case_type ? `<tr><td style="padding:8px 0;color:#6b7280;width:120px">Case Type</td><td style="padding:8px 0;color:#111827;font-weight:500">${lead.case_type}</td></tr>` : ''}
      ${lead.appt_slot ? `<tr><td style="padding:8px 0;color:#6b7280">📅 Booked Slot</td><td style="padding:8px 0;color:#7c3aed;font-weight:700">${lead.appt_day || new Date(lead.appt_slot).toLocaleString()}</td></tr>` : lead.appt_day ? `<tr><td style="padding:8px 0;color:#6b7280">Preferred Day</td><td style="padding:8px 0;color:#111827;font-weight:500">${lead.appt_day} ${lead.appt_time || ''}</td></tr>` : ''}
      ${lead.description ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Description</td><td style="padding:8px 0;color:#111827">${lead.description}</td></tr>` : ''}
      ${lead.urgency ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Urgency</td><td style="padding:8px 0;color:#111827">${lead.urgency}</td></tr>` : ''}
      ${lead.phone  ? `<tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0;color:#111827;font-weight:500">${lead.phone}</td></tr>` : ''}
      ${lead.email  ? `<tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0;color:#111827">${lead.email}</td></tr>` : ''}
      ${lead.preferred_attorney ? `<tr><td style="padding:8px 0;color:#6b7280">Requested</td><td style="padding:8px 0;color:#7c3aed;font-weight:500">Requested ${lead.preferred_attorney} specifically</td></tr>` : ''}
    </table>
    <div style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap">
      ${lead.phone ? `<a href="${callUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">📞 Call Client</a>` : ''}
      ${lead.phone ? `<a href="${smsUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">💬 Text Client</a>` : ''}
      <a href="${claimUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">✅ Claim This Lead</a>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#9ca3af">Claiming stops escalation — the lead is yours. <a href="${APP}/attorney/dashboard" style="color:#7c3aed">View dashboard →</a></p>
  </div>
</div>
</body></html>`;

  const text = `New IntakeAI ${lead.source} Lead — ${lead.name}\nScore: ${lead.score}\nCase: ${lead.case_type || lead.appt_matter || ''}\nPhone: ${lead.phone}\nEmail: ${lead.email}\nClaim: ${claimUrl}`;
  return { html, text };
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
  const urgencyText = (session.urgency     || '').toLowerCase();
  const descText    = (session.description || '').toLowerCase();
  const caseText    = (session.caseType    || '').toLowerCase();
  const combined    = urgencyText + ' ' + descText + ' ' + caseText;
  let score = 5;

  // Active / just-happened situations
  if (/just happened|tonight|last night|right now|this morning|just arrested|just got|minutes ago|hours ago/.test(combined)) score += 2;
  // High-stakes case types
  if (/arrest|criminal|dui|dwi|domestic|violence|custody|kidnap|deport|traffick/.test(combined)) score += 2;
  // Injury or accident
  if (/accident|crash|wreck|injur|hospital|hurt|emergency|assault|attack/.test(combined)) score += 2;
  // Hard deadlines
  if (/court|deadline|tomorrow|hearing|trial|arraignment|sentencing|due date/.test(combined)) score += 1;
  // Penalize very vague submissions
  if (!session.caseType   || session.caseType.length   < 3) score -= 1;
  if (!session.description || session.description.length < 8) score -= 1;

  return Math.min(10, Math.max(1, score));
}

function detectDistress(speech) {
  const lower = (speech || '').toLowerCase();
  const emergency = /911|ambulance|dying|unconscious|not breathing|bleeding badly|heart attack|stroke|on fire|need help now|someone is hurt/.test(lower);
  const crisis    = /accident|crash|wreck|just hit|arrested|jail|took my kids|he hit|she hit|domestic|been attacked|assault|i was just|scared|don't know what to do|please help|i need help/.test(lower);
  const emotional = /crying|sobbing|terrified|desperate|overwhelmed|shaking|lost|confused|i don't know|don't know where|can't stop/.test(lower);
  const fragmented = speech.trim().length < 12;
  return { emergency, crisis, emotional, distressed: crisis || emotional || fragmented };
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

// ── Widget CORS ───────────────────────────────────────────────────────────────
function widgetCors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}
app.options('/api/intake/chat/start',   widgetCors);
app.options('/api/intake/chat/message', widgetCors);

// ── Serve embeddable widget ───────────────────────────────────────────────────
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(join(__dirname, 'widget.js'));
});

app.post('/api/intake/chat/start', widgetCors, (req, res) => {
  const id = uid();
  const session = {
    step: 0,
    source: req.body?.source || 'chat',
    clientToken: (req.body?.client_token || '').trim() || null,
  };
  intakeSessions.set(id, session);
  res.json({ session_id: id, message: INTAKE_STEPS[0](session), done: false });
});

app.post('/api/intake/chat/message', widgetCors, async (req, res) => {
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
    const score  = scoreIntake(session);
    const urgent = score >= 8;
    const summary =
      `New IntakeAI Lead (score: ${score}/10${urgent ? ' — URGENT' : ''})\n` +
      `Name:        ${session.name}\n` +
      `Case Type:   ${session.caseType}\n` +
      `Description: ${session.description}\n` +
      `Urgency:     ${session.urgency}\n` +
      `Phone:       ${session.phone}\n` +
      `Email:       ${session.email}\n` +
      `Source:      ${session.source}\n` +
      `Time:        ${new Date().toLocaleString()}`;
    console.log('\n── INTAKE LEAD ─────────────────\n' + summary + '\n────────────────────────────────');

    if (session.clientToken && dbPool) {
      // Widget lead — save to DB and alert attorneys
      saveLead({
        client_token: session.clientToken,
        name: session.name,
        phone: session.phone,
        email: session.email,
        case_type: session.caseType,
        description: session.description,
        urgency: session.urgency,
        score,
        source: 'widget',
      }).catch(e => console.error('Widget saveLead error:', e.message));
    } else if (NOTIFY_EMAIL) {
      const subj = urgent
        ? `🚨 URGENT IntakeAI Lead — ${session.caseType} (score ${score}/10)`
        : `New IntakeAI Lead — ${session.caseType} (score ${score}/10)`;
      await sendNotification(NOTIFY_EMAIL, subj, summary);
    }
  }

  res.json({ message: reply, done, score: done ? scoreIntake(session) : undefined });
});

// ── Phone Intake (Twilio Voice) ───────────────────────────────────────────────
const phoneSessions = new Map();

// ── Holiday Greetings ─────────────────────────────────────────────────────────
function nthWeekday(year, month, weekday, n) {
  // n > 0: nth occurrence; n === -1: last occurrence. month is 0-indexed, weekday 0=Sun.
  if (n > 0) {
    const d = new Date(year, month, 1);
    let count = 0;
    while (d.getMonth() === month) {
      if (d.getDay() === weekday && ++count === n) return new Date(d);
      d.setDate(d.getDate() + 1);
    }
  } else {
    const d = new Date(year, month + 1, 0); // last day of month
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return new Date(d);
  }
  return null;
}

function getHolidayGreeting() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const y   = now.getFullYear();
  const WINDOW = 7; // say the greeting up to 7 days before the holiday

  const holidays = [
    { date: new Date(y, 0, 1),                   greeting: "Happy New Year"                   },
    { date: nthWeekday(y, 0, 1, 3),              greeting: "Happy Martin Luther King Jr. Day" },
    { date: nthWeekday(y, 1, 1, 3),              greeting: "Happy Presidents' Day"            },
    { date: nthWeekday(y, 4, 1, -1),             greeting: "Happy Memorial Day"               },
    { date: new Date(y, 5, 19),                  greeting: "Happy Juneteenth"                 },
    { date: new Date(y, 6, 4),                   greeting: "Happy Fourth of July"             },
    { date: nthWeekday(y, 8, 1, 1),              greeting: "Happy Labor Day"                  },
    { date: nthWeekday(y, 9, 1, 2),              greeting: "Happy Columbus Day"               },
    { date: new Date(y, 10, 11),                 greeting: "Happy Veterans Day"               },
    { date: nthWeekday(y, 10, 4, 4),             greeting: "Happy Thanksgiving"               },
    { date: new Date(y, 11, 25),                 greeting: "Merry Christmas"                  },
    { date: new Date(y, 11, 31),                 greeting: "Happy New Year"                   },
    { date: new Date(y + 1, 0, 1),               greeting: "Happy New Year"                   },
  ];

  let best = null, bestDiff = Infinity;
  for (const h of holidays) {
    if (!h.date) continue;
    const hd = new Date(h.date); hd.setHours(0, 0, 0, 0);
    const diff = (hd - now) / 86400000; // days until holiday (0 = today)
    if (diff >= 0 && diff <= WINDOW && diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best ? best.greeting : '';
}

function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}
const VOICE_FEMALE = 'Polly.Joanna';
const VOICE_MALE   = 'Polly.Matthew';

function say(text, voice = VOICE_FEMALE) {
  return `<Say voice="${voice}">${text}</Say>`;
}
function gather(action, text, voice = VOICE_FEMALE) {
  return (
    `<Gather input="speech" action="${action}" method="POST" speechTimeout="3" language="en-US">` +
    say(text, voice) +
    `</Gather>` +
    say("Sorry, I didn't catch that.", voice) +
    `<Redirect method="POST">${action}</Redirect>`
  );
}

const phoneIntroPrompt = (firmName) =>
  firmName
    ? `Thank you for calling ${firmName}. I'm the virtual intake assistant for ${firmName}. Can I start with your name?`
    : "Thank you for calling. I'm the virtual intake assistant. Can I start with your name?";

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-10);
}

const PHONE_ROUTING_PROMPT = (name) =>
  `Hi ${name || 'there'}! Are you hoping to speak with an attorney, schedule an in-person appointment, or would you like to leave a voicemail message?`;

// Path A — leave a message / intake for attorney follow-up
// Prompts are functions so they can acknowledge what the caller just said
const PHONE_INTAKE_STEPS = [
  {
    field: 'caseType',
    prompt: () => "I want to make sure you get the right help. Can you tell me what type of legal matter this is? For example — a car accident, a criminal charge, a divorce, or an immigration issue.",
  },
  {
    field: 'description',
    prompt: (session) => {
      const lower = (session.caseType || '').toLowerCase();
      if (/accident|crash|wreck|injur/.test(lower))
        return `I'm sorry you're dealing with this. Take your time — can you briefly tell me what happened and when it occurred?`;
      if (/arrest|criminal|dui|dwi/.test(lower))
        return `Understood. Can you tell me a little about the situation — what happened and when?`;
      if (/divorce|custody|family/.test(lower))
        return `I understand this is a difficult time. Can you briefly describe the situation and when things began?`;
      return `I understand. Can you briefly describe what happened and when?`;
    },
  },
  {
    field: 'urgency',
    prompt: (session) => {
      const lower = (session.description || '').toLowerCase();
      if (/tonight|today|just|right now|this morning/.test(lower))
        return `Thank you for sharing that. It sounds like this is very recent. Do you have a court date coming up, or is there any other deadline we should know about?`;
      return `Thank you. Is this time-sensitive? For example, do you have a court date, were you recently arrested, or is there a deadline we need to know about?`;
    },
  },
  {
    field: 'email',
    prompt: () => "Almost done — I just need one more thing. What email address should we send your case summary to so the attorney has everything when they reach out?",
  },
];

// Path B — schedule an in-person appointment
const PHONE_APPT_STEPS = [
  { field: 'apptDay',    prompt: () => "Of course. What day works best for you — for example, Monday, Wednesday, or Friday?" },
  { field: 'apptTime',   prompt: () => "And do you prefer morning or afternoon?" },
  { field: 'apptMatter', prompt: () => "Got it. In just a few words, what will this appointment be about — for example, a car accident, divorce, or a criminal matter?" },
  { field: 'email',      prompt: () => "Last thing — what email address should we send your appointment confirmation to?" },
];

function isBusinessHours(tz = 'America/Chicago', open = '09:00', close = '17:00') {
  const now     = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const day     = now.getDay(); // 0=Sun 6=Sat
  const hhmm    = now.toTimeString().slice(0, 5);
  return day >= 1 && day <= 5 && hhmm >= open && hhmm < close;
}

// ── Calendar Integration (iCal — universal: Google, Outlook, Apple, Yahoo, Calendly, Clio, etc.) ──

function parseIcalDate(str) {
  if (!str) return null;
  str = str.trim();
  // All-day: 20260701
  if (/^\d{8}$/.test(str)) {
    return new Date(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T00:00:00`);
  }
  // Datetime: 20260701T090000Z or 20260701T090000
  const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || ''}`;
  return new Date(iso);
}

function parseIcalEvents(ical) {
  const events = [];
  // Split on BEGIN:VEVENT, skip first chunk (header)
  const blocks = ical.split(/\r?\nBEGIN:VEVENT/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // Unfold long lines (RFC 5545: continuation lines start with space/tab)
    const unfolded = block.replace(/\r?\n[ \t]/g, '');
    const get = (key) => {
      const m = unfolded.match(new RegExp(`\\n${key}(?:;[^:]*)?:([^\\r\\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const summary  = get('SUMMARY');
    const startRaw = get('DTSTART');
    const endRaw   = get('DTEND') || get('DURATION'); // DURATION fallback is rare, skip for now
    const status   = get('STATUS'); // CONFIRMED, TENTATIVE, CANCELLED
    if (status === 'CANCELLED') continue;
    const start = parseIcalDate(startRaw);
    const end   = parseIcalDate(endRaw);
    if (start && end) events.push({ summary, start, end });
  }
  return events;
}

function inferStatusFromEvent(summary) {
  const s = summary.toLowerCase();
  if (/court|hearing|trial|arraignment|deposition|arbitration|mediation|docket|sentencing|plea/.test(s))
    return 'court';
  if (/vacation|out of office|ooo|pto|holiday|leave|sick|personal day|time off/.test(s))
    return 'out';
  if (/meeting|consult|client|conference|call|appointment|intake|interview/.test(s))
    return 'busy';
  // Any other calendar event during the day = with someone
  return 'busy';
}

async function fetchCalendarStatus(calendarUrl) {
  if (!calendarUrl) return null;
  try {
    const r = await fetch(calendarUrl, {
      headers: { 'User-Agent': 'IntakeAI-Calendar/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const ical = await r.text();
    const now  = new Date();
    const events = parseIcalEvents(ical);
    for (const ev of events) {
      if (ev.start <= now && now < ev.end) {
        const status = inferStatusFromEvent(ev.summary);
        console.log(`Calendar: active event "${ev.summary}" → status=${status}`);
        return { status, eventTitle: ev.summary };
      }
    }
    return null; // No active event right now
  } catch (e) {
    console.error('Calendar fetch error:', e.message);
    return null; // Fail open — fall back to manual status
  }
}

// ── Calendar Slot Finding ─────────────────────────────────────────────────────

// Convert "hour:min on dateStr in tz" to a UTC Date
function slotToUTC(dateStr, hourLocal, minLocal, tz) {
  const approx = new Date(`${dateStr}T${String(hourLocal).padStart(2,'0')}:${String(minLocal).padStart(2,'0')}:00Z`);
  const parts  = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(approx);
  const p      = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const errMs  = ((+p.hour - hourLocal) * 60 + (+p.minute - minLocal)) * 60000;
  return new Date(approx.getTime() - errMs);
}

async function findAvailableSlots({ calendarUrl, tz = 'America/Chicago', workOpen = '09:00', workClose = '17:00', slotMins = 60, maxSlots = 4 }) {
  let busy = [];
  if (calendarUrl) {
    try {
      const r = await fetch(calendarUrl, {
        headers: { 'User-Agent': 'IntakeAI-Calendar/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) busy = parseIcalEvents(await r.text());
    } catch (e) {
      console.error('Calendar slot fetch:', e.message);
    }
  }

  const [openH, openM]  = workOpen.split(':').map(Number);
  const [closeH, closeM] = workClose.split(':').map(Number);
  const closeTotal = closeH * 60 + closeM;
  const slotMs     = slotMins * 60_000;
  const slots      = [];
  const nowMs      = Date.now();

  for (let d = 1; d <= 14 && slots.length < maxSlots; d++) {
    const daySample = new Date(nowMs + d * 86400000);
    const dateStr   = daySample.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const dow = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(daySample);
    if (dow === 'Sat' || dow === 'Sun') continue;

    let slotMin = openH * 60 + openM;
    while (slotMin + slotMins <= closeTotal && slots.length < maxSlots) {
      const h = Math.floor(slotMin / 60);
      const m = slotMin % 60;
      const slotStart = slotToUTC(dateStr, h, m, tz);
      const slotEnd   = new Date(slotStart.getTime() + slotMs);

      if (slotStart.getTime() > nowMs + 2 * 3600_000) {
        const overlaps = busy.some(b => b.start < slotEnd && b.end > slotStart);
        if (!overlaps) {
          const label = slotStart.toLocaleString('en-US', {
            timeZone: tz, weekday: 'long', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
          });
          slots.push({ label, iso: slotStart.toISOString() });
        }
      }
      slotMin += slotMins;
    }
  }
  return slots;
}

function generateIcs({ title, startIso, durationMin = 60, description = '', organizerEmail = '', attendeeEmail = '' }) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const endIso = new Date(new Date(startIso).getTime() + durationMin * 60000).toISOString();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IntakeAI//Appointment//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${generateToken(16)}@intakeai`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(startIso)}`,
    `DTEND:${fmt(endIso)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    organizerEmail ? `ORGANIZER:mailto:${organizerEmail}` : null,
    attendeeEmail  ? `ATTENDEE;RSVP=TRUE:mailto:${attendeeEmail}` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

async function sendCalendarInvite({ clientName, clientEmail, apptSlot, apptMatter, attorneyName, organizerEmail }) {
  if (!clientEmail || !apptSlot) return null;
  const ics = generateIcs({
    title: `Appointment: ${apptMatter || 'Legal Consultation'}`,
    startIso: apptSlot,
    durationMin: 60,
    description: `Appointment with ${attorneyName || 'your attorney'}.\nClient: ${clientName}`,
    organizerEmail: organizerEmail || FROM_EMAIL,
    attendeeEmail: clientEmail,
  });
  const attachment = [{
    content: Buffer.from(ics).toString('base64'),
    type: 'text/calendar; method=REQUEST',
    filename: 'appointment.ics',
    disposition: 'attachment',
  }];
  const slotLabel = new Date(apptSlot).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px">
    <div style="color:rgba(255,255,255,.8);font-size:12px;font-weight:600;letter-spacing:.5px">⚖️ INTAKEAI</div>
    <h2 style="color:#fff;margin:8px 0 4px;font-size:20px">Appointment Confirmed!</h2>
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:14px">${slotLabel}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#111827">Hi ${clientName || 'there'},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6">Your appointment has been confirmed. A calendar invitation is attached — open it to add the appointment directly to your calendar.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:100px">Date &amp; Time</td><td style="padding:8px 0;font-weight:600;color:#111827">${slotLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Matter</td><td style="padding:8px 0;color:#111827">${apptMatter || 'Legal consultation'}</td></tr>
      ${attorneyName ? `<tr><td style="padding:8px 0;color:#6b7280">Attorney</td><td style="padding:8px 0;color:#111827">${attorneyName}</td></tr>` : ''}
    </table>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px">Need to reschedule? Call our office directly. Powered by IntakeAI.</p>
  </div>
</div>`;
  await sendHtmlEmail(
    clientEmail,
    `Appointment Confirmed — ${slotLabel}`,
    html,
    `Your appointment is confirmed for ${slotLabel}. A calendar invitation is attached to this email.`,
    attachment,
  );
  return attachment;
}

// ── Attorney Status Pages ─────────────────────────────────────────────────────
app.get('/status/:token', async (req, res) => {
  if (!dbPool) return res.status(503).send('Service unavailable');
  try {
    const { rows } = await dbPool.query(
      'SELECT * FROM intakeai_attorneys WHERE attorney_token = $1', [req.params.token]
    );
    if (!rows.length) return res.status(404).send('Attorney not found');
    const a = rows[0];
    const statuses = [
      { value: 'available', label: '✅ Available',        color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
      { value: 'busy',      label: '🔴 With a Client',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
      { value: 'court',     label: '⚖️ In Court',         color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
      { value: 'out',       label: '🚫 Out of Office',    color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
    ];
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>My Status — IntakeAI</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:white;border-radius:20px;padding:32px 24px;max-width:360px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
    .logo{font-size:13px;font-weight:600;color:#7c3aed;letter-spacing:.5px;margin-bottom:20px}
    h2{font-size:22px;font-weight:700;color:#111827;margin-bottom:4px}
    .sub{font-size:14px;color:#6b7280;margin-bottom:28px}
    .btn{display:block;width:100%;padding:18px 20px;border-radius:14px;border:2px solid transparent;
         font-size:17px;font-weight:600;cursor:pointer;margin-bottom:12px;transition:all .15s;text-align:center}
    .btn:active{transform:scale(.97)}
    .last{font-size:12px;color:#9ca3af;margin-top:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚖️ IntakeAI</div>
    <h2>${a.name || 'Attorney'}</h2>
    <p class="sub">Tap to update your status — callers are routed based on this</p>
    ${statuses.map(s => `
    <form method="POST" action="/api/attorney/status/${req.params.token}?_method=POST">
      <button type="submit" name="status" value="${s.value}" class="btn"
        style="background:${a.status === s.value ? s.bg : 'white'};
               color:${s.color};
               border-color:${a.status === s.value ? s.border : '#e5e7eb'}">
        ${s.label}${a.status === s.value ? ' ◀ current' : ''}
      </button>
    </form>`).join('')}
    <p class="last">Last updated: ${new Date(a.last_status_at).toLocaleString()}</p>
  </div>
</body>
</html>`;
    res.type('text/html').send(html);
  } catch (e) {
    res.status(500).send('Error loading status page');
  }
});

app.post('/api/attorney/status/:token', async (req, res) => {
  const status = req.body?.status;
  if (!['available', 'busy', 'court', 'out'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    await dbPool.query(
      'UPDATE intakeai_attorneys SET status=$1, last_status_at=NOW() WHERE attorney_token=$2',
      [status, req.params.token]
    );
    res.redirect(`/status/${req.params.token}`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/attorney/status/:token', async (req, res) => {
  if (!dbPool) return res.json({ status: 'available' });
  try {
    const { rows } = await dbPool.query(
      'SELECT status, name FROM intakeai_attorneys WHERE attorney_token=$1', [req.params.token]
    );
    res.json(rows[0] || { status: 'available' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Phone Intake ──────────────────────────────────────────────────────────────
app.post('/api/phone/inbound', async (req, res) => {
  const callSid  = req.body?.CallSid;
  const from     = req.body?.From || '';
  if (!callSid) return res.status(400).send('Missing CallSid');

  const clientToken = req.query.token   || '';
  const forwardTo   = req.query.forward || '';
  const tz          = req.query.tz      || 'America/Chicago';
  const open        = req.query.open    || '09:00';
  const close       = req.query.close   || '17:00';
  const mode        = req.query.mode    || 'afterhours';
  const duringHours = mode !== 'always' && isBusinessHours(tz, open, close);

  // VIP caller check — always connect directly regardless of attorney status
  if (clientToken && dbPool && from) {
    try {
      const { rows: allAttorneys } = await dbPool.query(
        `SELECT name, phone, vip_phones FROM intakeai_attorneys WHERE client_token=$1 AND phone IS NOT NULL AND phone != ''`,
        [clientToken]
      );
      const callerLast10 = normalizePhone(from);
      for (const atty of allAttorneys) {
        const vips = JSON.parse(atty.vip_phones || '[]');
        if (vips.some(v => normalizePhone(v.phone) === callerLast10)) {
          console.log(`Phone: VIP caller ${from} → ${atty.name} (${atty.phone})`);
          return res.type('text/xml').send(twiml(
            `<Dial timeout="30">${atty.phone}</Dial>`
          ));
        }
      }
    } catch (e) {
      console.error('VIP check error:', e.message);
    }
  }

  // Multi-attorney routing — check live availability status
  if (clientToken && dbPool) {
    try {
      const [{ rows: attorneys }, { rows: clientRows }] = await Promise.all([
        dbPool.query(`SELECT * FROM intakeai_attorneys WHERE client_token=$1 ORDER BY rotation_order ASC, id ASC`, [clientToken]),
        dbPool.query(`SELECT voice, firm_name FROM intakeai_clients WHERE client_token=$1`, [clientToken]),
      ]);
      const firmVoice = clientRows[0]?.voice || VOICE_FEMALE;
      const firmName  = clientRows[0]?.firm_name || '';

      if (attorneys.length > 0) {
        // Check each attorney's live calendar and override manual status if there's an active event
        for (const atty of attorneys) {
          if (atty.calendar_url) {
            const cal = await fetchCalendarStatus(atty.calendar_url);
            if (cal) atty.status = cal.status; // calendar beats the toggle
          }
        }

        // Only route live calls to intake-eligible roles (not partners/managing partners)
        const inRotation = attorneys.filter(a => INTAKE_ROLES.has(a.role || 'associate'));
        const available = inRotation.filter(a => a.status === 'available' && a.phone);
        const allUnavailable = inRotation.length === 0 || inRotation.every(a => a.status !== 'available');

        if (duringHours && available.length > 0) {
          // Route to first available attorney; store full list for sequential retry
          const atty = available[0];
          await dbPool.query(
            `UPDATE intakeai_attorneys SET rotation_order = rotation_order + 100 WHERE id=$1`, [atty.id]
          );
          phoneSessions.set(callSid, {
            phase: 'dialing', attemptIdx: 0, attorneys: available,
            phone: from, clientToken, firmTz: tz, firmOpen: open, firmClose: close, voice: firmVoice,
          });
          console.log(`Phone: routing ${from} → ${atty.name} (${atty.phone}) [${available.length} available]`);
          return res.type('text/xml').send(twiml(
            say('Please hold while we connect you.', firmVoice) +
            `<Dial timeout="10" action="/api/phone/dial-fallback?sid=${encodeURIComponent(callSid)}" method="POST">${atty.phone}</Dial>`
          ));
        }

        if (duringHours && allUnavailable) {
          // Determine best message based on statuses
          const inCourt = attorneys.some(a => a.status === 'court');
          const allOut  = attorneys.every(a => a.status === 'out');
          const situation = inCourt
            ? 'Our attorney is currently in court.'
            : allOut
              ? 'Our office is currently closed.'
              : 'All of our attorneys are currently with clients.';
          phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone', clientToken, firmName, attorneys, firmTz: tz, firmOpen: open, firmClose: close, voice: firmVoice });
          return res.type('text/xml').send(twiml(
            say(situation, firmVoice) +
            gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, phoneIntroPrompt(firmName), firmVoice)
          ));
        }

        // After hours or always-on mode
        phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone', clientToken, firmName, attorneys, firmTz: tz, firmOpen: open, firmClose: close, voice: firmVoice });
        return res.type('text/xml').send(twiml(gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, phoneIntroPrompt(firmName), firmVoice)));
      }
    } catch (e) {
      console.error('Multi-attorney routing error:', e.message);
    }
  }

  // Single-attorney / legacy routing
  if (duringHours && forwardTo) {
    console.log(`Phone: business hours, forwarding ${from} → ${forwardTo}`);
    return res.type('text/xml').send(twiml(
      say('Please hold while we connect your call.') +
      `<Dial timeout="10" action="/api/phone/dial-fallback?sid=${encodeURIComponent(callSid)}" method="POST">${forwardTo}</Dial>`
    ));
  }

  console.log(`Phone: AI intake (mode=${mode}) from ${from}`);
  phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone' });
  res.type('text/xml').send(twiml(gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, phoneIntroPrompt(''))));
});

// If an attorney doesn't answer, try the next available one, then fall back to AI intake
app.post('/api/phone/dial-fallback', (req, res) => {
  const callSid    = req.query.sid;
  const dialStatus = req.body?.DialCallStatus || '';
  const from       = req.body?.From || '';
  const gatherUrl  = `/api/phone/gather?sid=${encodeURIComponent(callSid)}`;

  if (dialStatus === 'completed') {
    phoneSessions.delete(callSid);
    return res.type('text/xml').send(twiml('<Hangup/>'));
  }

  const session = phoneSessions.get(callSid);

  // Sequential retry — try next attorney in the available list before going to AI
  if (session?.phase === 'dialing') {
    const nextIdx  = session.attemptIdx + 1;
    const nextAtty = session.attorneys?.[nextIdx];

    if (nextAtty?.phone) {
      session.attemptIdx = nextIdx;
      const prevName = session.attorneys[nextIdx - 1]?.name || 'the first line';
      console.log(`Phone: ${prevName} no answer (${dialStatus}), trying ${nextAtty.name}`);
      return res.type('text/xml').send(twiml(
        say('One moment, let me try another line.', session.voice || VOICE_FEMALE) +
        `<Dial timeout="10" action="/api/phone/dial-fallback?sid=${encodeURIComponent(callSid)}" method="POST">${nextAtty.phone}</Dial>`
      ));
    }

    // All attorneys exhausted — switch to AI intake
    const tried = session.attorneys?.length || 1;
    console.log(`Phone: all ${tried} attorney(s) unavailable (${dialStatus}), starting AI intake for ${from}`);
    const v = session.voice || VOICE_FEMALE;
    Object.assign(session, {
      phase: 'intro', step: 0, name: '', intent: '',
      caseType: '', description: '', urgency: '',
      apptDay: '', apptTime: '', apptMatter: '', email: '',
      source: 'phone-fallback',
    });
    return res.type('text/xml').send(twiml(gather(gatherUrl, phoneIntroPrompt(session.firmName || ''), v)));
  }

  // Legacy / no session (single-attorney or session expired)
  console.log(`Phone: no answer (${dialStatus}), starting AI intake for ${from}`);
  phoneSessions.set(callSid, {
    phase: 'intro', step: 0, phone: from, name: '', intent: '',
    caseType: '', description: '', urgency: '',
    apptDay: '', apptTime: '', apptMatter: '', email: '',
    source: 'phone-fallback',
  });
  res.type('text/xml').send(twiml(gather(gatherUrl, phoneIntroPrompt(''))));
});

// POST /api/phone/recording-complete — Twilio calls this after <Record> finishes
app.post('/api/phone/recording-complete', async (req, res) => {
  const recordingUrl = req.body?.RecordingUrl  || '';
  const recordingSid = req.body?.RecordingSid  || '';
  const duration     = parseInt(req.body?.RecordingDuration) || 0;
  const callerPhone  = req.query.phone || req.body?.From || '';
  const callerName   = req.query.name  || '';
  const clientToken  = req.query.token || '';
  const firmVoice    = req.query.voice || VOICE_FEMALE;

  console.log(`Voicemail: ${duration}s from ${callerPhone || 'unknown'} (${callerName || 'no name'})`);

  // Respond to Twilio immediately — thank the caller and hang up
  res.type('text/xml').send(twiml(
    say(`Thank you${callerName ? `, ${callerName}` : ''}. Your message has been received and an attorney will get back to you as soon as possible. Goodbye.`, firmVoice) +
    '<Hangup/>'
  ));

  // Save to DB and alert attorneys in the background
  if (!recordingUrl || !clientToken || !dbPool) return;

  try {
    const vmToken = generateToken(16);
    await dbPool.query(
      `INSERT INTO intakeai_voicemails
       (voicemail_token, client_token, caller_phone, caller_name, recording_url, recording_sid, duration_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [vmToken, clientToken, callerPhone, callerName, recordingUrl, recordingSid, duration]
    );

    const { rows: attorneys } = await dbPool.query(
      `SELECT * FROM intakeai_attorneys WHERE client_token=$1 ORDER BY rotation_order ASC`, [clientToken]
    );
    const APP      = process.env.APP_URL || 'https://www.myintakeai.com';
    const eligible = attorneys.filter(a => !SILENT_ROLES.has(a.role || 'associate'));

    for (const atty of eligible.slice(0, 3)) {
      if (!atty.email) continue;
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const html = `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px">
    <div style="color:rgba(255,255,255,.8);font-size:12px;font-weight:600;letter-spacing:.5px">⚖️ INTAKEAI</div>
    <h2 style="color:#fff;margin:8px 0 4px;font-size:20px">📞 New Voicemail</h2>
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:14px">From ${callerName || 'Unknown caller'} · ${callerPhone}</p>
  </div>
  <div style="padding:28px 32px">
    <table style="font-size:14px;border-collapse:collapse;width:100%">
      ${callerName ? `<tr><td style="padding:8px 0;color:#6b7280;width:120px">Caller</td><td style="padding:8px 0;color:#111827;font-weight:500">${callerName}</td></tr>` : ''}
      ${callerPhone ? `<tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0;color:#111827;font-weight:500">${callerPhone}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6b7280">Duration</td><td style="padding:8px 0;color:#111827">${durLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Received</td><td style="padding:8px 0;color:#111827">${new Date().toLocaleString()}</td></tr>
    </table>
    <div style="margin-top:24px">
      <a href="${APP}/attorney/dashboard" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">▶ Listen on Dashboard</a>
    </div>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af">Open the Voicemail tab in your attorney dashboard to listen to this message.</p>
  </div>
</div>`;
      await sendHtmlEmail(
        atty.email,
        `📞 New Voicemail — ${callerName || callerPhone} (${durLabel})`,
        html,
        `New voicemail from ${callerName || callerPhone} (${durLabel}). Listen at ${APP}/attorney/dashboard`
      );
      if (atty.phone) {
        await sendSMS(atty.phone, `📞 New voicemail from ${callerName || callerPhone} (${durLabel}). Listen: ${APP}/attorney/dashboard`);
      }
    }
  } catch (e) {
    console.error('recording-complete DB error:', e.message);
  }
});

app.post('/api/phone/gather', async (req, res) => {
  const callSid = req.query.sid;
  const speech  = (req.body?.SpeechResult || '').trim();
  const session = phoneSessions.get(callSid);

  if (!session) {
    return res.type('text/xml').send(
      twiml(say("I'm sorry, your session expired. Please call back to start a new intake.") + '<Hangup/>')
    );
  }

  const v = session.voice || VOICE_FEMALE; // firm's chosen voice
  const gatherUrl = `/api/phone/gather?sid=${encodeURIComponent(callSid)}`;

  // ── Emergency safety check — triggered any time alarming words are heard ──
  if (session.phase === 'emergency_check') {
    const lower = speech.toLowerCase();
    const needsHelp = /yes|yeah|please|help|do|need|call|911|ambulance|hurt|dying|injury/.test(lower);
    if (needsHelp) {
      phoneSessions.delete(callSid);
      return res.type('text/xml').send(twiml(
        say(`Please hang up right now and call 911. Your safety is the only thing that matters. Please stay safe. We will be here when you are ready.`, v) +
        '<Hangup/>'
      ));
    }
    // They are safe — continue warmly to routing
    session.phase = 'routing';
    const safeResponse = `I am glad you are safe. Take a breath. You called the right place and I am going to make sure you get the help you need. ${PHONE_ROUTING_PROMPT(session.name)}`;
    return res.type('text/xml').send(twiml(gather(gatherUrl, safeResponse, v)));
  }

  // ── Intro: collect caller's name ──────────────────────────────────────────
  if (session.phase === 'intro') {
    session.name = speech.split(' ')[0] || speech;

    // Check for emergency keywords even in the name response
    const distress = detectDistress(speech);
    if (distress.emergency) {
      session.phase = 'emergency_check';
      return res.type('text/xml').send(twiml(
        gather(gatherUrl, `Before anything else — are you or anyone with you in immediate danger right now? Do you need emergency services?`, v)
      ));
    }

    session.phase = 'routing';
    if (distress.distressed) {
      // Slow down and acknowledge before routing
      const warmOpening = `${session.name}, I am here and I am going to help you. Take a moment. There is no rush. ${PHONE_ROUTING_PROMPT(session.name)}`;
      return res.type('text/xml').send(twiml(gather(gatherUrl, warmOpening, v)));
    }
    return res.type('text/xml').send(twiml(gather(gatherUrl, PHONE_ROUTING_PROMPT(session.name), v)));
  }

  // ── Routing: speak with attorney, book appointment, or leave voicemail ───
  if (session.phase === 'routing') {
    session.intent = speech;
    const lower = speech.toLowerCase();

    // Emergency check at routing phase too
    const distress = detectDistress(speech);
    if (distress.emergency) {
      session.phase = 'emergency_check';
      return res.type('text/xml').send(twiml(
        gather(gatherUrl, `I want to make sure you are safe first. Do you or anyone with you need emergency services right now?`, v)
      ));
    }

    const wantsVoicemail = /voicemail|leave.*message|message.*attorney|just.*message|can.*leave|leave a|message for/.test(lower);
    const wantsAppt = /appoint|schedul|meet|come in|visit|in.?person|office|see/.test(lower);

    if (wantsVoicemail) {
      session.phase = 'voicemail';
      const actionUrl = `/api/phone/recording-complete?token=${encodeURIComponent(session.clientToken || '')}&phone=${encodeURIComponent(session.phone || '')}&name=${encodeURIComponent(session.name || '')}&voice=${encodeURIComponent(v)}`;
      const prompt = `Of course, ${session.name || 'there'}. Please leave your message after the tone. Take as much time as you need. Press pound when finished, or simply hang up.`;
      phoneSessions.delete(callSid);
      return res.type('text/xml').send(twiml(
        say(prompt, v) +
        `<Record action="${actionUrl}" maxLength="180" finishOnKey="#" playBeep="true" timeout="5" />`
      ));
    }

    if (wantsAppt) {
      session.phase = 'appointment';
      session.step  = 0;
      const primaryCal = session.attorneys?.find(a => a.calendar_url)?.calendar_url || null;
      const slots = await findAvailableSlots({
        calendarUrl: primaryCal,
        tz:        session.firmTz    || 'America/Chicago',
        workOpen:  session.firmOpen  || '09:00',
        workClose: session.firmClose || '17:00',
      });
      session.availableSlots = slots;
      if (slots.length > 0) {
        const opts = slots.map((s, i) => `Option ${i + 1}: ${s.label}`).join('. ');
        const slotPrompt = `I have ${slots.length} open times available for you: ${opts}. Which works best — just say option 1, 2, ${slots.length > 2 ? '3,' : ''} or another choice?`;
        return res.type('text/xml').send(twiml(gather(gatherUrl, slotPrompt, v)));
      }
      return res.type('text/xml').send(twiml(gather(gatherUrl, PHONE_APPT_STEPS[0].prompt(), v)));
    } else {
      session.phase = 'intake';
      session.step  = 0;
      // If they described a crisis while answering the routing question, capture it
      if (distress.crisis || distress.emotional) {
        session.distressed = true;
      }
      return res.type('text/xml').send(twiml(gather(gatherUrl, PHONE_INTAKE_STEPS[0].prompt(session), v)));
    }
  }

  // ── Intake: message + details for attorney follow-up ─────────────────────
  if (session.phase === 'intake') {
    const steps = PHONE_INTAKE_STEPS;
    session[steps[session.step].field] = speech;

    // Check for emergency at any point during intake
    const distress = detectDistress(speech);
    if (distress.emergency) {
      session.phase = 'emergency_check';
      return res.type('text/xml').send(twiml(
        gather(gatherUrl, `I want to stop for a moment — do you or anyone with you need emergency services right now?`, v)
      ));
    }

    session.step += 1;

    if (session.step >= steps.length) {
      const score  = scoreIntake(session);
      const urgent = score >= 8;
      const summary =
        `New IntakeAI Phone Lead (score: ${score}/10${urgent ? ' — URGENT' : ''})\n` +
        `Name:        ${session.name}\n` +
        `Case Type:   ${session.caseType}\n` +
        `Description: ${session.description}\n` +
        `Urgency:     ${session.urgency}\n` +
        `Phone:       ${session.phone}\n` +
        `Email:       ${session.email}\n` +
        `Source:      ${session.source || 'phone'}\n` +
        `Time:        ${new Date().toLocaleString()}`;
      console.log('\n── PHONE LEAD ──────────────────\n' + summary + '\n────────────────────────────────');
      await saveLead({
        client_token: session.clientToken, name: session.name, phone: session.phone,
        email: session.email, case_type: session.caseType, description: session.description,
        urgency: session.urgency, score, source: session.source || 'phone',
        preferred_attorney: session.preferredAttorney || null, attorneys: session.attorneys || [],
      });
      phoneSessions.delete(callSid);
      const holiday = getHolidayGreeting();
      const holidaySuffix = holiday ? ` ${holiday}!` : '';
      const closing = urgent
        ? `Thank you, ${session.name}. I have flagged your case as urgent. An attorney will reach out to you as soon as possible — please keep your phone nearby. You did the right thing by calling.${holidaySuffix} Take care.`
        : `Thank you, ${session.name}. Everything has been sent to the attorneys and someone will follow up with you within one business day. You are in good hands.${holidaySuffix} Take care.`;
      return res.type('text/xml').send(twiml(say(closing, v) + '<Hangup/>'));
    }

    return res.type('text/xml').send(twiml(gather(gatherUrl, steps[session.step].prompt(session), v)));
  }

  // ── Appointment: schedule in-person visit ─────────────────────────────────
  if (session.phase === 'appointment') {
    const hasSlots = !!(session.availableSlots?.length);
    let done = false;

    if (hasSlots) {
      // Calendar-aware flow: slot was offered in routing, caller picks one
      if (session.step === 0) {
        const lower = speech.toLowerCase();
        const idx = /\b(2|two|second)\b/.test(lower) ? 1
                  : /\b(3|three|third)\b/.test(lower) ? 2
                  : /\b(4|four|fourth)\b/.test(lower) ? 3 : 0;
        const chosen = session.availableSlots[Math.min(idx, session.availableSlots.length - 1)];
        session.apptSlot = chosen.iso;
        session.apptDay  = chosen.label;
        session.step = 1;
        return res.type('text/xml').send(twiml(gather(gatherUrl,
          `Perfect! I have you down for ${chosen.label}. In a few words, what will this appointment be about — for example, a car accident, injury case, or divorce?`,
          v
        )));
      }
      if (session.step === 1) {
        session.apptMatter = speech;
        session.step = 2;
        return res.type('text/xml').send(twiml(gather(gatherUrl,
          "Almost done. What email address should we send your calendar invitation to?",
          v
        )));
      }
      if (session.step === 2) {
        session.email = speech;
        done = true;
      }
    } else {
      // Free-form fallback (no calendar connected or fully booked)
      const steps = PHONE_APPT_STEPS;
      session[steps[session.step].field] = speech;
      session.step += 1;
      if (session.step < steps.length) {
        return res.type('text/xml').send(twiml(gather(gatherUrl, steps[session.step].prompt(), v)));
      }
      done = true;
    }

    if (done) {
      console.log(`\n── APPOINTMENT ${session.apptSlot ? 'BOOKED' : 'REQUEST'} ──\nName: ${session.name} | Slot: ${session.apptDay} | Matter: ${session.apptMatter}\n`);
      await saveLead({
        client_token: session.clientToken, name: session.name, phone: session.phone,
        email: session.email, appt_day: session.apptDay, appt_time: session.apptTime,
        appt_matter: session.apptMatter, appt_slot: session.apptSlot || null,
        score: 6, source: 'appointment',
        preferred_attorney: session.preferredAttorney || null, attorneys: session.attorneys || [],
      });
      phoneSessions.delete(callSid);
      const holiday = getHolidayGreeting();
      const holidaySuffix = holiday ? ` ${holiday}!` : '';
      const slotConfirm = session.apptSlot
        ? `Your appointment is confirmed for ${session.apptDay}. A calendar invitation will be sent to ${session.email}.`
        : `Your appointment request for ${session.apptDay || 'the time you requested'} has been submitted. Someone will confirm with you at ${session.email} shortly.`;
      return res.type('text/xml').send(twiml(
        say(`Thank you, ${session.name}. ${slotConfirm} We look forward to meeting you.${holidaySuffix} Take care.`, v) + '<Hangup/>'
      ));
    }
  }

  return res.type('text/xml').send(twiml(say("I'm sorry, something went wrong. Please call back.", v) + '<Hangup/>'));
});

// ── Save Lead & Alert Attorneys ───────────────────────────────────────────────
async function saveLead(leadData) {
  const APP = process.env.APP_URL || 'https://www.myintakeai.com';
  const leadToken = generateToken(16);
  const lead = { lead_token: leadToken, created_at: new Date().toISOString(), ...leadData };

  if (dbPool) {
    try {
      await dbPool.query(
        `INSERT INTO intakeai_leads
         (lead_token, client_token, name, phone, email, case_type, description,
          urgency, appt_day, appt_time, appt_matter, appt_slot, score, source, preferred_attorney)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [leadToken, leadData.client_token||null, leadData.name||null, leadData.phone||null,
         leadData.email||null, leadData.case_type||null, leadData.description||null,
         leadData.urgency||null, leadData.appt_day||null, leadData.appt_time||null,
         leadData.appt_matter||null, leadData.appt_slot||null,
         leadData.score||50, leadData.source||'phone',
         leadData.preferred_attorney||null]
      );
    } catch (e) {
      console.error('saveLead DB error:', e.message);
    }
  }

  // Send calendar invite to client if a real slot was booked
  let icsAttachment = null;
  if (leadData.appt_slot && leadData.email) {
    const primaryAtty = (leadData.attorneys || [])[0];
    icsAttachment = await sendCalendarInvite({
      clientName:     leadData.name,
      clientEmail:    leadData.email,
      apptSlot:       leadData.appt_slot,
      apptMatter:     leadData.appt_matter,
      attorneyName:   primaryAtty?.name,
      organizerEmail: primaryAtty?.email || FROM_EMAIL,
    });
  }

  // Alert attorneys with HTML email buttons — respecting firm hierarchy
  const attorneys = leadData.attorneys || [];
  if (attorneys.length > 0 && dbPool) {
    const urgent = (lead.score || 50) >= 80;
    // Filter by role: in-rotation always get alerts; partners only on urgent; managing partners never
    const eligible = attorneys.filter(a => {
      const role = a.role || 'associate';
      if (SILENT_ROLES.has(role)) return false;           // managing partner — dashboard only
      if (URGENT_ROLES.has(role) && !urgent) return false; // partner — urgent leads only
      return true;
    });
    // If caller requested a specific attorney, only alert that one (regardless of role)
    const targets = leadData.preferred_attorney
      ? attorneys.filter(a => a.name?.toLowerCase().includes(leadData.preferred_attorney.toLowerCase()))
      : eligible;
    const alertList = targets.length > 0 ? targets : eligible.slice(0, 1);

    for (const [i, atty] of alertList.entries()) {
      if (!atty.email) continue;
      const { html, text } = buildLeadAlertEmail({ lead, attorney: atty, APP });
      const urgent = (lead.score || 50) >= 80;
      const subj = leadData.appt_slot
        ? `📅 Appointment Booked — ${lead.name} (${lead.appt_day || ''})`
        : urgent
          ? `🚨 URGENT — ${lead.name} needs help now (${lead.case_type || lead.appt_matter || 'appointment'})`
          : `New ${lead.source === 'appointment' ? 'Appointment Request' : 'Lead'} — ${lead.name}`;
      // Attach .ics to attorney email too so they can add it to their calendar
      await sendHtmlEmail(atty.email, subj, html, text, icsAttachment || []);

      // Track for escalation
      if (dbPool) {
        await dbPool.query(
          `INSERT INTO intakeai_lead_alerts (lead_token, attorney_token, escalation_step) VALUES ($1,$2,$3)`,
          [leadToken, atty.attorney_token, i]
        ).catch(() => {});
      }

      // SMS alert too (brief)
      if (atty.phone) {
        const smsText = urgent
          ? `🚨 URGENT IntakeAI lead — ${lead.name} (${lead.case_type}). Claim: ${APP}/claim/${leadToken}/${atty.attorney_token}`
          : `New lead — ${lead.name}. Call: ${lead.phone || 'no phone'}. Claim: ${APP}/claim/${leadToken}/${atty.attorney_token}`;
        await sendSMS(atty.phone, smsText);
      }
    }
  } else if (NOTIFY_EMAIL) {
    // Fallback: no attorney list, notify owner
    const fallbackAtty = { attorney_token: 'owner', name: 'Owner', email: NOTIFY_EMAIL };
    const { html, text } = buildLeadAlertEmail({ lead, attorney: fallbackAtty, APP });
    await sendHtmlEmail(NOTIFY_EMAIL, `New IntakeAI Lead — ${lead.name}`, html, text);
  }

  return leadToken;
}

// ── Lead Escalation Timer ──────────────────────────────────────────────────────
// Runs every 60 seconds — escalates unclaimed leads to the next attorney in rotation
setInterval(async () => {
  if (!dbPool) return;
  try {
    // Find firms with unclaimed leads older than their escalation_minutes setting
    const { rows: staleleads } = await dbPool.query(`
      SELECT l.*, c.escalation_minutes
      FROM intakeai_leads l
      JOIN intakeai_clients c ON c.client_token = l.client_token
      WHERE l.status = 'new'
        AND l.created_at < NOW() - (c.escalation_minutes * interval '1 minute')
        AND l.client_token IS NOT NULL
    `);

    for (const lead of staleleads) {
      // Find all attorneys for this firm in order
      const { rows: attorneys } = await dbPool.query(
        `SELECT * FROM intakeai_attorneys WHERE client_token=$1 ORDER BY rotation_order ASC, id ASC`,
        [lead.client_token]
      );
      // Find who's already been alerted
      const { rows: alerted } = await dbPool.query(
        `SELECT attorney_token FROM intakeai_lead_alerts WHERE lead_token=$1`,
        [lead.lead_token]
      );
      const alertedTokens = new Set(alerted.map(a => a.attorney_token));
      // Escalate only to intake-eligible roles first; fall back to partners if all exhausted
      const inRotation = attorneys.filter(a => INTAKE_ROLES.has(a.role || 'associate'));
      const unalertedinRotation = inRotation.filter(a => !alertedTokens.has(a.attorney_token));
      const unalertedPartners   = attorneys.filter(a => URGENT_ROLES.has(a.role || '') && !alertedTokens.has(a.attorney_token));
      const next = unalertedinRotation[0] || unalertedPartners[0] || null;
      if (!next) continue; // All eligible attorneys already alerted

      const APP = process.env.APP_URL || 'https://www.myintakeai.com';
      const { html, text } = buildLeadAlertEmail({ lead, attorney: next, APP });
      const subj = `⏰ Unclaimed Lead — ${lead.name} (${lead.case_type || 'appointment'}) — escalated`;
      await sendHtmlEmail(next.email, subj, html, text);
      if (next.phone) await sendSMS(next.phone, `Unclaimed lead — ${lead.name}. Claim: ${APP}/claim/${lead.lead_token}/${next.attorney_token}`);
      await dbPool.query(
        `INSERT INTO intakeai_lead_alerts (lead_token, attorney_token, escalation_step) VALUES ($1,$2,$3)`,
        [lead.lead_token, next.attorney_token, alertedTokens.size]
      );
      console.log(`Escalation: lead ${lead.lead_token} → ${next.name}`);
    }
  } catch (e) {
    console.error('Escalation timer error:', e.message);
  }
}, 60_000);

// ── Onboarding ───────────────────────────────────────────────────────────────
// Roles that receive all lead notifications (full intake rotation)
const INTAKE_ROLES  = new Set(['associate', 'senior_associate', 'of_counsel', 'paralegal']);
// Roles notified only for urgent leads (score >= 80)
const URGENT_ROLES  = new Set(['partner']);
// Roles that get dashboard access only — no lead alerts, not in call rotation
const SILENT_ROLES  = new Set(['managing_partner']);

app.post('/api/onboarding/save', async (req, res) => {
  const {
    plan, firmName, website, practiceAreas, attorneyCount,
    forwardNumber, timezone, businessOpen, businessClose, callMode, voice,
    // Legacy single-attorney fields (kept for backward compat)
    attorneyName, attorneyEmail, attorneyPhone, calendarUrl,
    // New multi-attorney array
    attorneys: attorneysInput,
  } = req.body || {};

  // Normalize to an array — support both old single-attorney and new multi-attorney format
  const attorneys = Array.isArray(attorneysInput) && attorneysInput.length > 0
    ? attorneysInput
    : [{ name: attorneyName || firmName, email: attorneyEmail, phone: attorneyPhone || '', role: 'associate', calendarUrl: calendarUrl || '' }];

  const APP = process.env.APP_URL || 'https://www.myintakeai.com';
  const token = generateToken(16);
  const primaryAtty = attorneys[0];
  const primaryToken = generateToken(16);
  const statusPageUrl = `${APP}/status/${primaryToken}`;

  if (dbPool) {
    try {
      await dbPool.query(
        `INSERT INTO intakeai_clients
         (client_token, plan, firm_name, website, practice_areas,
          forward_number, timezone, business_open, business_close, call_mode, voice,
          attorney_name, attorney_email, attorney_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [token, plan, firmName, website, Array.isArray(practiceAreas) ? practiceAreas.join(', ') : practiceAreas,
         forwardNumber, timezone, businessOpen, businessClose, callMode,
         voice || VOICE_FEMALE,
         primaryAtty.name, primaryAtty.email, primaryAtty.phone]
      );

      // Create attorney records for each person
      for (const [i, atty] of attorneys.entries()) {
        if (!atty.email && !atty.name) continue;
        const attyToken = i === 0 ? primaryToken : generateToken(16);
        const role = atty.role || 'associate';
        await dbPool.query(
          `INSERT INTO intakeai_attorneys (attorney_token, client_token, name, phone, email, role, rotation_order, calendar_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [attyToken, token, atty.name || firmName, atty.phone || '', atty.email || '', role, i * 10, atty.calendarUrl || null]
        );
        // Create dashboard login account
        const resetToken   = generateToken();
        const resetExpires = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        await dbPool.query(
          `INSERT INTO intakeai_attorney_accounts (attorney_token, reset_token, reset_expires) VALUES ($1,$2,$3)
           ON CONFLICT (attorney_token) DO UPDATE SET reset_token=$2, reset_expires=$3`,
          [attyToken, resetToken, resetExpires]
        );
        // Send welcome email with password setup link to each attorney who has an email
        if (SENDGRID_KEY && atty.email) {
          const roleLabel = {
            managing_partner: 'Managing Partner', partner: 'Partner',
            senior_associate: 'Senior Associate', associate: 'Associate',
            of_counsel: 'Of Counsel', paralegal: 'Paralegal',
          }[role] || 'Attorney';
          const welcomeHtml = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px">
    <div style="color:rgba(255,255,255,.8);font-size:12px;font-weight:600">⚖️ INTAKEAI</div>
    <h2 style="color:#fff;margin:8px 0 4px;font-size:20px">Welcome to IntakeAI, ${atty.name || 'there'}!</h2>
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:14px">${firmName} · ${roleLabel}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#111827">You've been added to your firm's IntakeAI account.</p>
    <p style="color:#374151;font-size:14px;line-height:1.6">Click below to set your password and access your attorney dashboard, where you'll see client leads and manage your availability.</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${APP}/attorney/set-password?token=${resetToken}" style="display:inline-block;background:#7c3aed;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Set My Password →</a>
    </div>
    <p style="font-size:12px;color:#9ca3af">This link expires in 48 hours. If it expires, contact your firm administrator.</p>
    ${i === 0 ? `<hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0">
    <p style="font-size:13px;font-weight:600;color:#374151">Your Status Page</p>
    <p style="font-size:13px;color:#6b7280">Bookmark this on your phone — tap it to set yourself Available, In Court, or Out of Office:</p>
    <p style="font-size:13px"><a href="${APP}/status/${attyToken}" style="color:#7c3aed">${APP}/status/${attyToken}</a></p>` : ''}
  </div>
</div>`;
          await sendHtmlEmail(
            atty.email,
            `Welcome to IntakeAI — Set your password`,
            welcomeHtml,
            `Welcome to IntakeAI! Set your password here: ${APP}/attorney/set-password?token=${resetToken}`,
          );
        }
      }
    } catch (e) {
      console.error('Onboarding save error:', e.message);
    }
  }

  const webhookUrl = `${APP}/api/phone/inbound?forward=${encodeURIComponent(forwardNumber || '')}&tz=${encodeURIComponent(timezone || 'America/Chicago')}&open=${businessOpen || '09:00'}&close=${businessClose || '17:00'}&mode=${callMode || 'afterhours'}&token=${token}`;

  // Send firm admin a setup summary (Twilio webhook URL etc.)
  if (SENDGRID_KEY && primaryAtty.email) {
    const isManaged = plan === 'managed' || plan === 'firm';
    const largeFirm = parseInt(attorneyCount) >= 5;
    const body = `IntakeAI setup complete for ${firmName}!

PLAN: ${plan}
ATTORNEYS: ${attorneys.length} (individual welcome emails sent to each)
TWILIO PHONE WEBHOOK URL:
${webhookUrl}

HOW TO ACTIVATE PHONE INTAKE:
1. Sign up at twilio.com and get a phone number
2. Go to Phone Numbers > Manage > Active Numbers
3. Click your number > Voice Configuration > set webhook to the URL above (POST method)
4. Test by calling your Twilio number

${isManaged ? 'Our team will reach out within 1 business day.' : 'Reply to this email with any questions.'}

The IntakeAI Team`;
    await sendNotification(primaryAtty.email, `IntakeAI Setup Complete — ${firmName}`, body);
  }

  if (NOTIFY_EMAIL) {
    const largeFirm = parseInt(attorneyCount) >= 5;
    const flagged = largeFirm && plan !== 'firm' ? ' ⚠️ FIRM UPGRADE OPPORTUNITY' : '';
    const summary = `New IntakeAI Client${flagged}\nPlan: ${plan}\nFirm: ${firmName}\nAttorneys: ${attorneys.length}\nPrimary: ${primaryAtty.email}`;
    await sendNotification(NOTIFY_EMAIL, `New IntakeAI Client — ${firmName || 'Unknown'}${flagged}`, summary);
  }

  console.log(`Onboarding complete: ${firmName} (${plan}) — ${attorneys.length} attorney(s)`);
  res.json({ ok: true, token, attorneyToken: primaryToken, statusPageUrl });
});

// ── Attorney Auth Middleware & Helpers ────────────────────────────────────────
async function auditLog(attorneyToken, action, resource, ip, detail) {
  if (!dbPool) return;
  try {
    await dbPool.query(
      `INSERT INTO intakeai_audit_log (attorney_token, action, resource, ip_address, detail) VALUES ($1,$2,$3,$4,$5)`,
      [attorneyToken, action, resource || null, ip || null, detail || null]
    );
  } catch {}
}

async function requireAttorneyAuth(req, res, next) {
  const cookies = parseCookies(req);
  const token   = cookies['atty_session'];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows } = await dbPool.query(
      `SELECT s.attorney_token, a.name, a.email, a.phone, a.client_token, a.role
       FROM intakeai_sessions s
       JOIN intakeai_attorneys a ON a.attorney_token = s.attorney_token
       WHERE s.session_token=$1 AND s.expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Session expired' });
    req.attorney = rows[0];
    await auditLog(rows[0].attorney_token, 'access', req.path, req.ip);
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Attorney Auth Routes ──────────────────────────────────────────────────────

// POST /api/attorney/login — step 1: email + password
app.post('/api/attorney/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows: attyRows } = await dbPool.query(
      `SELECT * FROM intakeai_attorneys WHERE LOWER(email)=LOWER($1)`, [email]
    );
    if (!attyRows.length) return res.status(401).json({ error: 'Invalid email or password' });
    const atty = attyRows[0];

    const { rows: accRows } = await dbPool.query(
      `SELECT * FROM intakeai_attorney_accounts WHERE attorney_token=$1`, [atty.attorney_token]
    );
    if (!accRows.length || !accRows[0].password_hash)
      return res.status(401).json({ error: 'Account not set up — check your welcome email for a setup link' });
    const acc = accRows[0];

    // Check lockout
    if (acc.locked_until && new Date(acc.locked_until) > new Date())
      return res.status(429).json({ error: 'Account locked — too many failed attempts. Try again in 15 minutes.' });

    const ok = await verifyPassword(password, acc.password_hash);
    if (!ok) {
      const attempts = (acc.failed_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await dbPool.query(
        `UPDATE intakeai_attorney_accounts SET failed_attempts=$1, locked_until=$2 WHERE attorney_token=$3`,
        [attempts, lockUntil, atty.attorney_token]
      );
      await auditLog(atty.attorney_token, 'login_failed', null, req.ip, `attempt ${attempts}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset failed attempts
    await dbPool.query(
      `UPDATE intakeai_attorney_accounts SET failed_attempts=0, locked_until=NULL WHERE attorney_token=$1`,
      [atty.attorney_token]
    );

    // Check trusted device
    const cookies = parseCookies(req);
    const deviceToken = cookies['atty_device'];
    if (deviceToken) {
      const { rows: devRows } = await dbPool.query(
        `SELECT * FROM intakeai_trusted_devices WHERE device_token=$1 AND attorney_token=$2 AND expires_at > NOW()`,
        [deviceToken, atty.attorney_token]
      );
      if (devRows.length) {
        // Trusted browser — skip 2FA, issue session
        await dbPool.query(`UPDATE intakeai_trusted_devices SET last_used_at=NOW() WHERE device_token=$1`, [deviceToken]);
        const sessionToken = generateToken();
        const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
        await dbPool.query(
          `INSERT INTO intakeai_sessions (session_token, attorney_token, expires_at, ip_address) VALUES ($1,$2,$3,$4)`,
          [sessionToken, atty.attorney_token, expires, req.ip]
        );
        await dbPool.query(`UPDATE intakeai_attorney_accounts SET last_login_at=NOW() WHERE attorney_token=$1`, [atty.attorney_token]);
        setCookie(res, 'atty_session', sessionToken, 8 * 3600);
        await auditLog(atty.attorney_token, 'login_trusted_device', null, req.ip);
        return res.json({ ok: true, skip2fa: true, attorney: { name: atty.name, email: atty.email } });
      }
    }

    // Send 2FA code
    const code       = generate6();
    const tempToken  = generateToken();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await dbPool.query(
      `INSERT INTO intakeai_2fa_codes (temp_token, attorney_token, code, expires_at) VALUES ($1,$2,$3,$4)`,
      [tempToken, atty.attorney_token, code, codeExpiry]
    );

    const smsSent = await sendSMS(atty.phone, `IntakeAI verification code: ${code}. Expires in 10 minutes.`);
    if (!smsSent && SENDGRID_KEY) {
      // Fallback: send code by email
      await sendNotification(atty.email, 'IntakeAI — Your Login Code',
        `Your IntakeAI login code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`
      );
    }

    await auditLog(atty.attorney_token, 'login_2fa_sent', null, req.ip, smsSent ? 'sms' : 'email');
    res.json({ requires2fa: true, tempToken, via: smsSent ? 'sms' : 'email', phone: atty.phone?.slice(-4) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attorney/verify-2fa — step 2: submit code
app.post('/api/attorney/verify-2fa', async (req, res) => {
  const { tempToken, code, rememberDevice, deviceLabel } = req.body || {};
  if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code required' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows } = await dbPool.query(
      `SELECT * FROM intakeai_2fa_codes WHERE temp_token=$1 AND used=FALSE AND expires_at > NOW()`,
      [tempToken]
    );
    if (!rows.length) return res.status(401).json({ error: 'Code expired or already used' });
    const rec = rows[0];
    if (rec.code !== String(code).trim())
      return res.status(401).json({ error: 'Incorrect code' });

    await dbPool.query(`UPDATE intakeai_2fa_codes SET used=TRUE WHERE temp_token=$1`, [tempToken]);

    // Create session
    const sessionToken = generateToken();
    const expires      = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
    await dbPool.query(
      `INSERT INTO intakeai_sessions (session_token, attorney_token, expires_at, ip_address) VALUES ($1,$2,$3,$4)`,
      [sessionToken, rec.attorney_token, expires, req.ip]
    );
    await dbPool.query(`UPDATE intakeai_attorney_accounts SET last_login_at=NOW() WHERE attorney_token=$1`, [rec.attorney_token]);
    setCookie(res, 'atty_session', sessionToken, 8 * 3600);

    // Optionally trust this browser for 30 days
    if (rememberDevice) {
      const deviceToken = generateToken();
      const devExpires  = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const ua = req.headers['user-agent'] || '';
      const label = deviceLabel || (ua.includes('iPhone') ? 'iPhone' : ua.includes('Android') ? 'Android' : ua.includes('Mac') ? 'Mac' : 'Browser');
      await dbPool.query(
        `INSERT INTO intakeai_trusted_devices (device_token, attorney_token, label, expires_at) VALUES ($1,$2,$3,$4)`,
        [deviceToken, rec.attorney_token, label, devExpires]
      );
      setCookie(res, 'atty_device', deviceToken, 30 * 24 * 3600);
    }

    const { rows: attyRows } = await dbPool.query(
      `SELECT name, email FROM intakeai_attorneys WHERE attorney_token=$1`, [rec.attorney_token]
    );
    await auditLog(rec.attorney_token, 'login_success', null, req.ip, rememberDevice ? 'device_trusted' : null);
    res.json({ ok: true, attorney: attyRows[0] || {} });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attorney/logout
app.post('/api/attorney/logout', async (req, res) => {
  const cookies = parseCookies(req);
  const token   = cookies['atty_session'];
  if (token && dbPool) {
    await dbPool.query(`DELETE FROM intakeai_sessions WHERE session_token=$1`, [token]).catch(() => {});
  }
  clearCookie(res, 'atty_session');
  res.json({ ok: true });
});

// GET /api/attorney/me
app.get('/api/attorney/me', requireAttorneyAuth, async (req, res) => {
  let firmName = '';
  if (dbPool && req.attorney.client_token) {
    const { rows } = await dbPool.query(
      `SELECT firm_name FROM intakeai_clients WHERE client_token=$1`, [req.attorney.client_token]
    ).catch(() => ({ rows: [] }));
    firmName = rows[0]?.firm_name || '';
  }
  res.json({ ...req.attorney, firmName });
});

// POST /api/attorney/set-password — use reset token from welcome email
app.post('/api/attorney/set-password', async (req, res) => {
  const { resetToken, password } = req.body || {};
  if (!resetToken || !password) return res.status(400).json({ error: 'resetToken and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows } = await dbPool.query(
      `SELECT * FROM intakeai_attorney_accounts WHERE reset_token=$1 AND reset_expires > NOW()`, [resetToken]
    );
    if (!rows.length) return res.status(401).json({ error: 'Reset link expired — contact support' });
    const hash = await hashPassword(password);
    await dbPool.query(
      `UPDATE intakeai_attorney_accounts SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE attorney_token=$2`,
      [hash, rows[0].attorney_token]
    );
    await auditLog(rows[0].attorney_token, 'password_set', null, req.ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attorney/trusted-devices
app.get('/api/attorney/trusted-devices', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.json({ devices: [] });
  const { rows } = await dbPool.query(
    `SELECT id, label, last_used_at, expires_at FROM intakeai_trusted_devices WHERE attorney_token=$1 AND expires_at > NOW() ORDER BY last_used_at DESC`,
    [req.attorney.attorney_token]
  );
  res.json({ devices: rows });
});

// DELETE /api/attorney/trusted-devices/:id
app.delete('/api/attorney/trusted-devices/:id', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.json({ ok: true });
  await dbPool.query(
    `DELETE FROM intakeai_trusted_devices WHERE id=$1 AND attorney_token=$2`,
    [req.params.id, req.attorney.attorney_token]
  );
  await auditLog(req.attorney.attorney_token, 'device_revoked', req.params.id, req.ip);
  res.json({ ok: true });
});

// ── Attorney Leads Routes ─────────────────────────────────────────────────────

// GET /api/attorney/leads — unclaimed leads + my claimed leads for this firm
app.get('/api/attorney/leads', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.json({ available: [], mine: [] });
  try {
    const { rows } = await dbPool.query(
      `SELECT * FROM intakeai_leads
       WHERE client_token=$1 AND (status='new' OR claimed_by=$2)
       ORDER BY score DESC, created_at DESC`,
      [req.attorney.client_token, req.attorney.attorney_token]
    );
    const available = rows.filter(r => r.status === 'new');
    const mine      = rows.filter(r => r.claimed_by === req.attorney.attorney_token);
    await auditLog(req.attorney.attorney_token, 'leads_viewed', null, req.ip, `${rows.length} leads`);
    res.json({ available, mine });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attorney/leads/:token/claim
app.post('/api/attorney/leads/:token/claim', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows } = await dbPool.query(
      `UPDATE intakeai_leads SET status='claimed', claimed_by=$1, claimed_at=NOW()
       WHERE lead_token=$2 AND client_token=$3 AND status='new'
       RETURNING *`,
      [req.attorney.attorney_token, req.params.token, req.attorney.client_token]
    );
    if (!rows.length) return res.status(409).json({ error: 'Lead already claimed or not found' });
    await auditLog(req.attorney.attorney_token, 'lead_claimed', req.params.token, req.ip);
    res.json({ ok: true, lead: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /claim/:leadToken/:attorneyToken — one-click claim from email button
app.get('/claim/:leadToken/:attorneyToken', async (req, res) => {
  if (!dbPool) return res.status(503).send('Service unavailable');
  try {
    const { rows: attyRows } = await dbPool.query(
      `SELECT name FROM intakeai_attorneys WHERE attorney_token=$1`, [req.params.attorneyToken]
    );
    const attyName = attyRows[0]?.name || 'Attorney';

    const { rows } = await dbPool.query(
      `UPDATE intakeai_leads SET status='claimed', claimed_by=$1, claimed_at=NOW()
       WHERE lead_token=$2 AND status='new'
       RETURNING name, case_type, phone, score`,
      [req.params.attorneyToken, req.params.leadToken]
    );

    const APP = process.env.APP_URL || 'https://www.myintakeai.com';
    if (!rows.length) {
      // Already claimed
      const { rows: existing } = await dbPool.query(
        `SELECT l.name, a.name as claimed_by_name FROM intakeai_leads l
         LEFT JOIN intakeai_attorneys a ON a.attorney_token=l.claimed_by
         WHERE l.lead_token=$1`, [req.params.leadToken]
      );
      const e = existing[0] || {};
      return res.type('text/html').send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Lead Already Claimed</title>
        <style>body{font-family:-apple-system,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:white;border-radius:20px;padding:40px;max-width:400px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
        .icon{font-size:48px;margin-bottom:16px}</style></head>
        <body><div class="card"><div class="icon">⚠️</div>
        <h2 style="color:#111827">Already Claimed</h2>
        <p style="color:#6b7280">The lead for <strong>${e.name || 'this client'}</strong> was already claimed${e.claimed_by_name ? ` by ${e.claimed_by_name}` : ''}.</p>
        <a href="${APP}/attorney/dashboard" style="display:inline-block;margin-top:20px;background:#7c3aed;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">View Dashboard</a>
        </div></body></html>`);
    }

    await auditLog(req.params.attorneyToken, 'lead_claimed_email', req.params.leadToken, req.ip);
    const lead = rows[0];
    res.type('text/html').send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Lead Claimed</title>
      <style>body{font-family:-apple-system,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .card{background:white;border-radius:20px;padding:40px;max-width:400px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
      .icon{font-size:56px;margin-bottom:16px}</style></head>
      <body><div class="card"><div class="icon">✅</div>
      <h2 style="color:#16a34a">Lead Claimed!</h2>
      <p style="color:#374151"><strong>${lead.name}</strong> — ${lead.case_type || 'appointment request'}</p>
      <p style="color:#6b7280;font-size:14px">You've claimed this lead, ${attyName}. Other team members will no longer see it in their queue.</p>
      ${lead.phone ? `<a href="tel:${lead.phone}" style="display:inline-block;margin-top:16px;background:#16a34a;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">📞 Call ${lead.name} Now</a><br>` : ''}
      <a href="${APP}/attorney/dashboard" style="display:inline-block;margin-top:12px;background:#7c3aed;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">View Dashboard</a>
      </div></body></html>`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// ── Voicemail Routes ──────────────────────────────────────────────────────────

// GET /api/attorney/voicemails — list all voicemails for this firm
app.get('/api/attorney/voicemails', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.json({ voicemails: [] });
  try {
    const { rows } = await dbPool.query(
      `SELECT id, voicemail_token, caller_phone, caller_name, duration_seconds, heard, heard_by, heard_at, created_at
       FROM intakeai_voicemails WHERE client_token=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.attorney.client_token]
    );
    res.json({ voicemails: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/attorney/voicemails/:id/read — mark as heard
app.patch('/api/attorney/voicemails/:id/read', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.json({ ok: true });
  try {
    await dbPool.query(
      `UPDATE intakeai_voicemails SET heard=TRUE, heard_by=$1, heard_at=NOW()
       WHERE id=$2 AND client_token=$3 AND heard=FALSE`,
      [req.attorney.attorney_token, req.params.id, req.attorney.client_token]
    );
    await auditLog(req.attorney.attorney_token, 'voicemail_heard', req.params.id, req.ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attorney/voicemails/:id/audio — proxy Twilio recording (keeps credentials server-side)
app.get('/api/attorney/voicemails/:id/audio', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows } = await dbPool.query(
      `SELECT recording_url FROM intakeai_voicemails WHERE id=$1 AND client_token=$2`,
      [req.params.id, req.attorney.client_token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!rows[0].recording_url) return res.status(404).json({ error: 'No recording URL' });

    const audioUrl = rows[0].recording_url + '.mp3';
    const auth     = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const r = await fetch(audioUrl, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Recording unavailable from Twilio' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── VIP Contacts ─────────────────────────────────────────────────────────────
// VIP numbers always ring through directly, bypassing attorney status and intake flow.

app.get('/api/attorney/vip-contacts', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    const { rows } = await dbPool.query(
      `SELECT vip_phones FROM intakeai_attorneys WHERE attorney_token=$1`,
      [req.attorney.attorney_token]
    );
    res.json({ vips: JSON.parse(rows[0]?.vip_phones || '[]') });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/attorney/vip-contacts', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  const { label, phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  try {
    const { rows } = await dbPool.query(
      `SELECT vip_phones FROM intakeai_attorneys WHERE attorney_token=$1`,
      [req.attorney.attorney_token]
    );
    const vips = JSON.parse(rows[0]?.vip_phones || '[]');
    vips.push({ label: (label || 'VIP').trim(), phone: phone.trim() });
    await dbPool.query(
      `UPDATE intakeai_attorneys SET vip_phones=$1 WHERE attorney_token=$2`,
      [JSON.stringify(vips), req.attorney.attorney_token]
    );
    await auditLog(req.attorney.attorney_token, 'vip_added', null, req.ip, label);
    res.json({ vips });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/attorney/vip-contacts/:index', requireAttorneyAuth, async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  const idx = parseInt(req.params.index);
  try {
    const { rows } = await dbPool.query(
      `SELECT vip_phones FROM intakeai_attorneys WHERE attorney_token=$1`,
      [req.attorney.attorney_token]
    );
    const vips = JSON.parse(rows[0]?.vip_phones || '[]');
    if (isNaN(idx) || idx < 0 || idx >= vips.length) return res.status(400).json({ error: 'Invalid index' });
    vips.splice(idx, 1);
    await dbPool.query(
      `UPDATE intakeai_attorneys SET vip_phones=$1 WHERE attorney_token=$2`,
      [JSON.stringify(vips), req.attorney.attorney_token]
    );
    res.json({ vips });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe Checkout ───────────────────────────────────────────────────────────
const STRIPE_SECRET          = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_SELFSERVE = process.env.STRIPE_PRICE_SELFSERVE || '';
const STRIPE_PRICE_MANAGED   = process.env.STRIPE_PRICE_MANAGED || '';
const STRIPE_PRICE_SETUP     = process.env.STRIPE_PRICE_MANAGED_SETUP || '';
const STRIPE_PRICE_FIRM      = process.env.STRIPE_PRICE_FIRM || '';
const STRIPE_PRICE_FIRM_SETUP = process.env.STRIPE_PRICE_FIRM_SETUP || '';
const APP_URL = process.env.APP_URL || 'https://www.myintakeai.com';

app.post('/api/stripe/checkout', async (req, res) => {
  const { plan } = req.body || {};
  if (!STRIPE_SECRET) {
    return res.status(503).json({ error: 'not_configured' });
  }

  try {
    const params = {
      mode: 'subscription',
      success_url: `${APP_URL}/onboarding?plan=${plan}`,
      cancel_url: `${APP_URL}/#pricing`,
      allow_promotion_codes: 'true',
      'billing_address_collection': 'required',
    };

    if (plan === 'selfserve') {
      if (!STRIPE_PRICE_SELFSERVE) return res.status(503).json({ error: 'price_not_configured' });
      params['line_items[0][price]']    = STRIPE_PRICE_SELFSERVE;
      params['line_items[0][quantity]'] = '1';
    } else if (plan === 'managed') {
      if (!STRIPE_PRICE_MANAGED) return res.status(503).json({ error: 'price_not_configured' });
      params['line_items[0][price]']    = STRIPE_PRICE_MANAGED;
      params['line_items[0][quantity]'] = '1';
      if (STRIPE_PRICE_SETUP) {
        params['subscription_data[add_invoice_items][0][price]']    = STRIPE_PRICE_SETUP;
        params['subscription_data[add_invoice_items][0][quantity]'] = '1';
      }
    } else if (plan === 'firm') {
      if (!STRIPE_PRICE_FIRM) return res.status(503).json({ error: 'price_not_configured' });
      params['line_items[0][price]']    = STRIPE_PRICE_FIRM;
      params['line_items[0][quantity]'] = '1';
      if (STRIPE_PRICE_FIRM_SETUP) {
        params['subscription_data[add_invoice_items][0][price]']    = STRIPE_PRICE_FIRM_SETUP;
        params['subscription_data[add_invoice_items][0][quantity]'] = '1';
      }
    } else {
      return res.status(400).json({ error: 'Plan must be "selfserve", "managed", or "firm"' });
    }

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Stripe error');
    console.log(`Stripe session created: ${plan} → ${data.url}`);
    res.json({ url: data.url });
  } catch (e) {
    console.error('Stripe checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Outbound Email Sender ─────────────────────────────────────────────────────
const FROM_NAME = process.env.FROM_NAME || 'Shanon Williams';

app.post('/api/send-email', async (req, res) => {
  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required' });
  }
  if (!SENDGRID_KEY) {
    return res.status(503).json({
      error: 'not_configured',
      hint: 'Add SENDGRID_API_KEY and FROM_EMAIL to your Railway environment variables to enable auto-send.',
    });
  }
  try {
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: 'text/plain', value: body }],
    };
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`SendGrid ${r.status}: ${txt}`);
    }
    console.log(`Email sent → ${to} | "${subject}"`);
    res.json({ ok: true });
  } catch (e) {
    console.error('send-email error:', e.message);
    res.status(500).json({ error: e.message });
  }
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

// ── Worldwide Outreach Engine ─────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || '';
const dbPool = DB_URL
  ? new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_clients (
        id              SERIAL PRIMARY KEY,
        client_token    TEXT UNIQUE NOT NULL,
        plan            TEXT,
        firm_name       TEXT,
        practice_areas  TEXT,
        website         TEXT,
        forward_number  TEXT,
        timezone        TEXT DEFAULT 'America/Chicago',
        business_open   TEXT DEFAULT '09:00',
        business_close  TEXT DEFAULT '17:00',
        call_mode       TEXT DEFAULT 'afterhours',
        voice           TEXT DEFAULT 'Polly.Joanna',
        attorney_name   TEXT,
        attorney_email  TEXT,
        attorney_phone  TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_attorneys (
        id              SERIAL PRIMARY KEY,
        attorney_token  TEXT UNIQUE NOT NULL,
        client_token    TEXT NOT NULL,
        name            TEXT,
        phone           TEXT,
        email           TEXT,
        role            TEXT DEFAULT 'associate',
        status          TEXT DEFAULT 'available',
        rotation_order  INTEGER DEFAULT 0,
        last_status_at  TIMESTAMPTZ DEFAULT NOW(),
        calendar_url    TEXT
      )
    `);
    await dbPool.query(`ALTER TABLE intakeai_attorneys ADD COLUMN IF NOT EXISTS calendar_url TEXT`);
    await dbPool.query(`ALTER TABLE intakeai_attorneys ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'associate'`);
    await dbPool.query(`ALTER TABLE intakeai_attorneys ADD COLUMN IF NOT EXISTS vip_phones TEXT DEFAULT '[]'`);
    await dbPool.query(`ALTER TABLE intakeai_clients   ADD COLUMN IF NOT EXISTS voice TEXT DEFAULT 'Polly.Joanna'`);
    await dbPool.query(`ALTER TABLE intakeai_clients   ADD COLUMN IF NOT EXISTS escalation_minutes INTEGER DEFAULT 5`);
    await dbPool.query(`ALTER TABLE intakeai_leads     ADD COLUMN IF NOT EXISTS appt_slot TIMESTAMPTZ`);

    // ── Attorney auth tables ──────────────────────────────────────────────────
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_attorney_accounts (
        id                    SERIAL PRIMARY KEY,
        attorney_token        TEXT UNIQUE NOT NULL,
        password_hash         TEXT,
        reset_token           TEXT,
        reset_expires         TIMESTAMPTZ,
        failed_attempts       INTEGER DEFAULT 0,
        locked_until          TIMESTAMPTZ,
        last_login_at         TIMESTAMPTZ,
        created_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_sessions (
        id              SERIAL PRIMARY KEY,
        session_token   TEXT UNIQUE NOT NULL,
        attorney_token  TEXT NOT NULL,
        expires_at      TIMESTAMPTZ NOT NULL,
        ip_address      TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_2fa_codes (
        id              SERIAL PRIMARY KEY,
        temp_token      TEXT UNIQUE NOT NULL,
        attorney_token  TEXT NOT NULL,
        code            TEXT NOT NULL,
        expires_at      TIMESTAMPTZ NOT NULL,
        used            BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_trusted_devices (
        id              SERIAL PRIMARY KEY,
        device_token    TEXT UNIQUE NOT NULL,
        attorney_token  TEXT NOT NULL,
        label           TEXT,
        expires_at      TIMESTAMPTZ NOT NULL,
        last_used_at    TIMESTAMPTZ DEFAULT NOW(),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_audit_log (
        id              SERIAL PRIMARY KEY,
        attorney_token  TEXT NOT NULL,
        action          TEXT NOT NULL,
        resource        TEXT,
        ip_address      TEXT,
        detail          TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Leads & escalation tables ─────────────────────────────────────────────
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_leads (
        id                 SERIAL PRIMARY KEY,
        lead_token         TEXT UNIQUE NOT NULL,
        client_token       TEXT,
        name               TEXT,
        phone              TEXT,
        email              TEXT,
        case_type          TEXT,
        description        TEXT,
        urgency            TEXT,
        appt_day           TEXT,
        appt_time          TEXT,
        appt_matter        TEXT,
        appt_slot          TIMESTAMPTZ,
        score              INTEGER DEFAULT 50,
        source             TEXT,
        preferred_attorney TEXT,
        status             TEXT DEFAULT 'new',
        claimed_by         TEXT,
        claimed_at         TIMESTAMPTZ,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_lead_alerts (
        id              SERIAL PRIMARY KEY,
        lead_token      TEXT NOT NULL,
        attorney_token  TEXT NOT NULL,
        alerted_at      TIMESTAMPTZ DEFAULT NOW(),
        escalation_step INTEGER DEFAULT 0
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_voicemails (
        id               SERIAL PRIMARY KEY,
        voicemail_token  TEXT UNIQUE NOT NULL,
        client_token     TEXT NOT NULL,
        caller_phone     TEXT,
        caller_name      TEXT,
        recording_url    TEXT,
        recording_sid    TEXT,
        duration_seconds INTEGER DEFAULT 0,
        heard            BOOLEAN DEFAULT FALSE,
        heard_by         TEXT,
        heard_at         TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('DB: all IntakeAI tables ready');
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_firms (
        id           SERIAL PRIMARY KEY,
        email        TEXT UNIQUE NOT NULL,
        firm_name    TEXT,
        website      TEXT,
        city         TEXT,
        country      TEXT,
        practice     TEXT,
        discovered   TIMESTAMPTZ DEFAULT NOW(),
        sent_at      TIMESTAMPTZ,
        unsubscribed BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('DB: intakeai_firms table ready');
  } catch (e) {
    console.error('DB init error:', e.message);
  }
}

const WORLDWIDE_TARGETS = [
  { city: 'Houston',       country: 'US' },
  { city: 'Dallas',        country: 'US' },
  { city: 'Austin',        country: 'US' },
  { city: 'Phoenix',       country: 'US' },
  { city: 'Philadelphia',  country: 'US' },
  { city: 'San Antonio',   country: 'US' },
  { city: 'San Diego',     country: 'US' },
  { city: 'Jacksonville',  country: 'US' },
  { city: 'Columbus',      country: 'US' },
  { city: 'Charlotte',     country: 'US' },
  { city: 'Indianapolis',  country: 'US' },
  { city: 'Denver',        country: 'US' },
  { city: 'Nashville',     country: 'US' },
  { city: 'Atlanta',       country: 'US' },
  { city: 'Las Vegas',     country: 'US' },
  { city: 'Memphis',       country: 'US' },
  { city: 'Louisville',    country: 'US' },
  { city: 'Baltimore',     country: 'US' },
  { city: 'Milwaukee',     country: 'US' },
  { city: 'Albuquerque',   country: 'US' },
  { city: 'London',        country: 'UK' },
  { city: 'Manchester',    country: 'UK' },
  { city: 'Birmingham',    country: 'UK' },
  { city: 'Leeds',         country: 'UK' },
  { city: 'Glasgow',       country: 'UK' },
  { city: 'Toronto',       country: 'Canada' },
  { city: 'Vancouver',     country: 'Canada' },
  { city: 'Calgary',       country: 'Canada' },
  { city: 'Edmonton',      country: 'Canada' },
  { city: 'Ottawa',        country: 'Canada' },
  { city: 'Sydney',        country: 'Australia' },
  { city: 'Melbourne',     country: 'Australia' },
  { city: 'Brisbane',      country: 'Australia' },
  { city: 'Perth',         country: 'Australia' },
  { city: 'Adelaide',      country: 'Australia' },
  { city: 'Auckland',      country: 'New Zealand' },
  { city: 'Wellington',    country: 'New Zealand' },
  { city: 'Dublin',        country: 'Ireland' },
  { city: 'Cork',          country: 'Ireland' },
  { city: 'Singapore',     country: 'Singapore' },
  { city: 'Johannesburg',  country: 'South Africa' },
  { city: 'Cape Town',     country: 'South Africa' },
];

const PRACTICES = [
  'personal injury', 'criminal defense', 'family law', 'immigration',
  'real estate', 'employment law', 'bankruptcy', 'estate planning',
  'business law', 'civil litigation', 'workers compensation', 'DUI defense',
];

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const html = await fetchHtml(url);
    const links = [...html.matchAll(/href="(https?:\/\/[^"&]+)"/gi)]
      .map(m => { try { return new URL(m[1]).origin; } catch { return null; } })
      .filter(Boolean);
    const seen = new Set();
    return links.filter(l => {
      if (seen.has(l)) return false;
      if (/duckduckgo|bing\.com|google\.|facebook\.|yelp\.|avvo\.|findlaw\.|lawyers\.com|justia\.|martindale\.|yellowpages|thumbtack|bark\.com/.test(l)) return false;
      seen.add(l);
      return true;
    }).slice(0, 8);
  } catch (e) {
    console.error(`DDG search failed for "${query}":`, e.message);
    return [];
  }
}

async function discoverFirms({ limit = 20 } = {}) {
  if (!dbPool) return { discovered: 0, error: 'No database configured' };
  let discovered = 0;
  const targets   = [...WORLDWIDE_TARGETS].sort(() => Math.random() - 0.5).slice(0, 5);
  const practices = [...PRACTICES].sort(() => Math.random() - 0.5).slice(0, 3);

  for (const { city, country } of targets) {
    for (const practice of practices) {
      if (discovered >= limit) break;
      const query = `${practice} law firm ${city} ${country} contact email`;
      console.log(`Discovering: ${query}`);
      const urls = await searchDuckDuckGo(query);
      for (const url of urls) {
        if (discovered >= limit) break;
        try {
          const scraped = await scrapeUrl(url);
          if (!scraped.emails.length) continue;
          for (const email of scraped.emails.slice(0, 2)) {
            try {
              const result = await dbPool.query(
                `INSERT INTO intakeai_firms (email, firm_name, website, city, country, practice)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (email) DO NOTHING
                 RETURNING id`,
                [email, scraped.firmName || url, url, city, country, practice]
              );
              if (result.rowCount > 0) discovered++;
            } catch { /* duplicate */ }
          }
        } catch { /* skip bad url */ }
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`Discovery complete: +${discovered} new firms`);
  return { discovered };
}

function buildOutreachEmail(firm) {
  const firstName = firm.firm_name
    ? firm.firm_name.split(/[\s,&]/)[0]
    : 'there';
  return {
    subject: `${firm.firm_name || 'Your firm'} is losing clients after hours — here's the fix`,
    body: `Hi ${firstName},

Here's a number that might surprise you: studies show that 42% of calls to law firms go unanswered — and 85% of those callers never call back. They move on to the next firm.

That means nearly half of your potential clients are slipping away while you're in court, with another client, or simply after hours.

IntakeAI fixes this. It's a 24/7 AI-powered intake system built specifically for law firms:

• Answers every inquiry the moment it comes in — nights, weekends, holidays
• Qualifies each potential client and scores urgency automatically (arrests, accidents, court deadlines)
• Sends you a full case summary by text and email the instant a hot lead finishes intake
• Works for any practice area — personal injury, criminal defense, family law, immigration, and more

The average firm that adds IntakeAI stops losing after-hours leads within the first week.

We offer a 14-day free trial with no setup fee required, and most firms are live within one business day.

Would you have 10 minutes this week to see how it would work for ${firm.firm_name || 'your firm'}?

Best,
Shanon Williams
IntakeAI
https://www.myintakeai.com

---
You're receiving this because your firm appeared in a public directory.
To unsubscribe, reply with "unsubscribe" in the subject line.
IntakeAI · 1234 Main St · Houston, TX 77001`,
  };
}

async function sendDailyBatch({ limit = 100 } = {}) {
  if (!dbPool) return { sent: 0, error: 'No database configured' };
  if (!SENDGRID_KEY) return { sent: 0, error: 'No SendGrid key' };

  const { rows: firms } = await dbPool.query(
    `SELECT * FROM intakeai_firms
     WHERE sent_at IS NULL AND unsubscribed = FALSE
     ORDER BY discovered ASC
     LIMIT $1`,
    [limit]
  );

  let sent = 0;
  for (const firm of firms) {
    const { subject, body } = buildOutreachEmail(firm);
    try {
      const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: firm.email }] }],
          from: { email: FROM_EMAIL, name: FROM_NAME },
          reply_to: { email: FROM_EMAIL, name: FROM_NAME },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      if (r.ok || r.status === 202) {
        await dbPool.query(`UPDATE intakeai_firms SET sent_at = NOW() WHERE id = $1`, [firm.id]);
        sent++;
        console.log(`Outreach → ${firm.email} (${firm.city}, ${firm.country})`);
      } else {
        const err = await r.text();
        console.error(`SendGrid ${r.status} for ${firm.email}: ${err}`);
      }
    } catch (e) {
      console.error(`Failed → ${firm.email}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`Batch complete: ${sent}/${firms.length} sent`);
  return { sent, total: firms.length };
}

function startScheduler() {
  if (!dbPool) {
    console.log('Scheduler: DATABASE_URL not set — worldwide outreach disabled');
    return;
  }

  // Discover new firms every 6 hours
  setInterval(() => { discoverFirms({ limit: 50 }).catch(console.error); }, 6 * 60 * 60 * 1000);

  // Send daily batch at 9 AM UTC
  function scheduleDaily() {
    const now  = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next - now;
    console.log(`Scheduler: next email batch in ${Math.round(delay / 60000)} min`);
    setTimeout(async () => {
      await sendDailyBatch({ limit: 100 }).catch(console.error);
      scheduleDaily();
    }, delay);
  }
  scheduleDaily();

  // Initial discovery 30 s after startup
  setTimeout(() => { discoverFirms({ limit: 30 }).catch(console.error); }, 30_000);
  console.log('Scheduler: worldwide outreach engine started');
}

// Outreach API endpoints
app.get('/api/outreach/stats', async (_req, res) => {
  if (!dbPool) return res.json({ total: 0, sent: 0, pending: 0, note: 'DATABASE_URL not configured' });
  try {
    const { rows } = await dbPool.query(`
      SELECT
        COUNT(*)                                               AS total,
        COUNT(sent_at)                                         AS sent,
        COUNT(*) FILTER (WHERE sent_at IS NULL
                           AND NOT unsubscribed)               AS pending,
        COUNT(*) FILTER (WHERE unsubscribed)                   AS unsubscribed
      FROM intakeai_firms
    `);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/outreach/discover', (req, res) => {
  const limit = Math.min(parseInt(req.body?.limit) || 20, 100);
  res.json({ ok: true, message: `Discovery started (limit ${limit})` });
  discoverFirms({ limit }).catch(console.error);
});

app.post('/api/outreach/send-batch', (req, res) => {
  const limit = Math.min(parseInt(req.body?.limit) || 100, 100);
  res.json({ ok: true, message: `Batch send started (limit ${limit})` });
  sendDailyBatch({ limit }).catch(console.error);
});

app.post('/api/outreach/unsubscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  await dbPool.query(`UPDATE intakeai_firms SET unsubscribed = TRUE WHERE email = $1`, [email.toLowerCase().trim()]);
  res.json({ ok: true });
});

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`IntakeAI on port ${PORT} | notify → ${NOTIFY_EMAIL || '(no email set)'}`);
  await initDb();
  startScheduler();
});
