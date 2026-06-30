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
  (s) => `Hi! I'm here to help you get your law firm set up with IntakeAI. To start, what's your name and your firm's name?`,

  // step 1 — plan interest (after name/firm)
  (s) => `Great to meet you, ${s.name || 'there'}! Are you interested in the **Self-Serve** plan ($250/mo, DIY setup) or the **Managed** plan where our team installs everything for you ($200/mo + $500 setup retainer)?`,

  // step 2 — email (after plan)
  (s) => `${s.plan ? `The ${s.plan} plan is a great choice. ` : ''}What email address should we use to reach you?`,

  // step 3 — phone (after email)
  (s) => `Last thing — what's a good phone number in case our team needs to reach you quickly?`,

  // step 4 — done
  (s) => `You're all set, ${s.name || 'there'}! Our team will reach out to **${s.email}** within 1 business day to get your firm going. Welcome to IntakeAI!`,
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
  (s) => `Hi! I'm here to help connect you with our legal team. What's your name?`,

  (s) => `Hi ${s.name}! What type of legal matter do you need help with? (E.g. car accident, criminal charge, divorce, employment issue, etc.)`,

  (s) => `I understand. Can you briefly describe what happened and when it occurred?`,

  (s) => `Thank you for sharing that. Is this an urgent situation — do you have an upcoming court date, were you recently arrested, or are you in immediate need of legal help?`,

  (s) => `Understood. What's the best phone number to reach you?`,

  (s) => `Almost done — what email address should we send your case summary to?`,

  (s) => {
    const urgent = /yes|urgent|arrested|court|accident|hospital|emergency/i.test(s.urgency || '');
    return urgent
      ? `Thank you, ${s.name}. Given the urgency of your situation, our team will prioritize your case and reach out to **${s.phone || s.email}** as soon as possible — typically within the hour during business hours. You'll also receive a confirmation at ${s.email}.`
      : `Thank you, ${s.name}! I've created your intake summary and our team will review your case and reach out to you at **${s.email}** within 1 business day.`;
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

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () =>
  console.log(`IntakeAI on port ${PORT} | notify → ${NOTIFY_EMAIL || '(no email set)'}`)
);
