import { useState, useEffect } from 'react';
import {
  Plus, Search, Download, Trash2, ChevronDown, ChevronUp,
  Globe, Mail, Phone, Building2, StickyNote, X, Send, Eye, Radar, Upload,
} from 'lucide-react';

const STATUSES = ['New', 'Contacted', 'Replied', 'Interested', 'Signed Up', 'Not Interested'];

const STATUS_COLORS = {
  'New':            'bg-gray-100 text-gray-700',
  'Contacted':      'bg-blue-100 text-blue-700',
  'Replied':        'bg-yellow-100 text-yellow-800',
  'Interested':     'bg-violet-100 text-violet-700',
  'Signed Up':      'bg-green-100 text-green-700',
  'Not Interested': 'bg-red-100 text-red-700',
};

const PRACTICE_AREAS = [
  'Personal Injury', 'Criminal Defense', 'DUI / DWI', 'Family Law',
  'Divorce & Custody', 'Immigration', "Workers' Compensation",
  'Bankruptcy', 'Employment Law', 'Medical Malpractice',
  'Estate Planning', 'Real Estate', 'Civil Litigation', 'Other',
];

const STORAGE_KEY = 'intakeai_prospects';
const PASSWORD    = 'intakeai2024';

function loadProspects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveProspects(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function blankForm() {
  return {
    firmName: '', attorney: '', email: '', phone: '',
    website: '', practiceArea: '', city: '', state: '',
    status: 'New', notes: '',
  };
}
function ts() {
  return new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  if (isNaN(then)) return null;
  const diffMs = Date.now() - then.getTime();
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  if (weeks < 5)  return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function staleBadge(dateStr, status) {
  if (!dateStr || status === 'Signed Up' || status === 'Not Interested') return null;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days >= 14) return { label: `${days}d — follow up!`, color: 'text-red-500' };
  if (days >= 7)  return { label: `${days}d — check in?`,  color: 'text-orange-500' };
  return null;
}

function toCSV(prospects) {
  const cols = ['Firm Name','Attorney','Email','Phone','Website',
                 'Practice Area','City','State','Status','Last Contacted','Contact History','Notes','Added'];
  const rows = prospects.map((p) => [
    p.firmName, p.attorney, p.email, p.phone, p.website,
    p.practiceArea, p.city, p.state, p.status, p.lastContacted || '',
    (p.contactHistory || []).join(' | '),
    (p.notes || '').replace(/\n/g,' '), p.addedAt,
  ].map((v) => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
  return [cols.join(','), ...rows].join('\n');
}

function buildEmailTemplate(prospect) {
  const name = prospect.attorney
    ? `Hi ${prospect.attorney.split(' ')[0]}`
    : `Hi there`;
  const firm = prospect.firmName ? ` at ${prospect.firmName}` : '';
  return {
    subject: `Automate your client intake${firm} — IntakeAI`,
    body: `${name},

I wanted to reach out because I think IntakeAI could be a great fit for your practice.

IntakeAI is a 24/7 AI-powered intake system designed specifically for law firms. Here's what it does for you:

• Captures potential clients on your website around the clock — nights, weekends, holidays
• Qualifies each lead automatically and scores urgency (arrests, accidents, deadlines)
• Texts and emails you the full case summary the moment a hot lead completes intake
• Works for any practice area — personal injury, criminal defense, family law, and more

Most firms go live within one business day, and our clients typically see their intake volume double within the first 30 days.

We offer a 14-day free trial with no credit card required.

Would you be open to a quick call to see if it's a fit for ${prospect.firmName || 'your firm'}?

Best,
Shanon Williams
IntakeAI
https://leadforge-production-3ee8.up.railway.app`,
  };
}

// ── Login ────────────────────────────────────────────────────────────────────
function Login({ onSuccess }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (pw === PASSWORD) { onSuccess(); }
    else { setErr(true); setPw(''); }
  };
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mx-auto mb-4">
          <Building2 size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">IntakeAI Admin</h1>
        <p className="text-sm text-gray-500 mb-8">Prospect Tracker</p>
        <form onSubmit={submit} className="space-y-4">
          <input type="password" value={pw}
                 onChange={(e) => { setPw(e.target.value); setErr(false); }}
                 placeholder="Password"
                 className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${err ? 'border-red-400' : 'border-gray-300'}`} />
          {err && <p className="text-xs text-red-500">Incorrect password</p>}
          <button type="submit"
                  className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors">
            Sign In
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4">Default password: intakeai2024</p>
      </div>
    </div>
  );
}

// ── Email Compose Modal ──────────────────────────────────────────────────────
function EmailModal({ prospect, onClose, onSent }) {
  const tpl = buildEmailTemplate(prospect);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody]       = useState(tpl.body);

  const openMailClient = () => {
    const mailto = `mailto:${prospect.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    onSent();
    onClose();
  };

  const openInbox = () => {
    // Opens their default email app to inbox filtered to this address
    window.open(`mailto:${prospect.email}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Compose Email</h2>
            <p className="text-xs text-gray-500 mt-0.5">To: {prospect.attorney || prospect.firmName} — {prospect.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y font-mono" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            Clicking "Open in Email App" will launch your email app (Gmail, Apple Mail, Outlook) with this message pre-filled. Just hit Send there. The prospect will be marked Contacted automatically.
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={openInbox}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-200
                             text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Eye size={14} /> View Replies from {prospect.email}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
                    className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={openMailClient}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                               bg-violet-600 text-white hover:bg-violet-700 transition-colors">
              <Send size={14} /> Open in Email App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit modal ─────────────────────────────────────────────────────────
function ProspectModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || blankForm());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.firmName.trim() || form.attorney.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{initial?.id ? 'Edit Prospect' : 'Add Prospect'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Firm Name *</label>
              <input value={form.firmName} onChange={set('firmName')} placeholder="Smith & Associates"
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Attorney Name</label>
              <input value={form.attorney} onChange={set('attorney')} placeholder="Jane Smith"
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input value={form.email} onChange={set('email')} type="email" placeholder="jane@smithlaw.com"
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000"
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
            <input value={form.website} onChange={set('website')} placeholder="https://smithlaw.com"
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Practice Area</label>
              <select value={form.practiceArea} onChange={set('practiceArea')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                <option value="">Select…</option>
                {PRACTICE_AREAS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input value={form.city} onChange={set('city')} placeholder="Miami"
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input value={form.state} onChange={set('state')} placeholder="FL" maxLength={2}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s} type="button"
                        onClick={() => setForm((f) => ({ ...f, status: s }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                    ${form.status === s
                                      ? 'border-violet-600 bg-violet-600 text-white'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-violet-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3}
                      placeholder="What did you send? What did they say?"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
                  className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => valid && onSave(form)} disabled={!valid}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 text-white
                             hover:bg-violet-700 disabled:opacity-40 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field.trim());
  return fields;
}

const TX_CITIES = new Set([
  'houston','dallas','austin','san antonio','fort worth','el paso',
  'lubbock','mcallen','arlington','corpus christi','plano','laredo',
  'irving','garland','frisco','amarillo','pasadena','killeen','mckinney',
  'mesquite','waco','carrollton','denton','midland','abilene','beaumont',
  'round rock','odessa','tyler','college station','pearland','richardson',
  'allen','sugar land','edinburg','new braunfels',
]);

function inferState(city) {
  return TX_CITIES.has((city || '').toLowerCase()) ? 'TX' : '';
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const raw = parseCSVLine(lines[0]);
  const headers = raw.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const idx = (terms) => headers.findIndex(h => terms.some(t => h.includes(t)));
  const firmIdx  = idx(['firm','name']);
  const attyIdx  = idx(['attorney','atty','lawyer','contact']);
  const emailIdx = idx(['email','mail']);
  const phoneIdx = idx(['phone','tel','number']);
  const webIdx   = idx(['website','web','url','site']);
  const areaIdx  = idx(['practice','area','specialty','type']);
  const cityIdx  = idx(['city','town','location']);
  const stateIdx = idx(['state','st']);
  const notesIdx = idx(['note','comment']);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = parseCSVLine(line);
    const get = (ix) => (ix >= 0 ? (f[ix] || '') : '').trim();

    const firmName = get(firmIdx);
    if (!firmName || firmName === '#') continue;

    const city  = get(cityIdx);
    const state = get(stateIdx) || inferState(city);

    rows.push({
      firmName, attorney: get(attyIdx),
      email: get(emailIdx), phone: get(phoneIdx),
      website: get(webIdx), practiceArea: get(areaIdx),
      city, state, notes: get(notesIdx), status: 'New',
    });
  }
  return rows;
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onAddAll }) {
  const [text, setText]       = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError]     = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result);
    reader.readAsText(file);
  };

  const runParse = () => {
    try {
      const rows = parseCSV(text);
      if (!rows.length) {
        setError('No rows found. Make sure the CSV has a header row with at least a "Firm Name" column.');
        return;
      }
      setPreview(rows);
      setError('');
    } catch (e) {
      setError('Could not parse CSV: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Import from CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload a file or paste CSV text</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {!preview ? (
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Upload CSV file</label>
              <input type="file" accept=".csv,.txt" onChange={handleFile}
                     className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                                file:font-medium file:bg-violet-50 file:text-violet-700
                                hover:file:bg-violet-100 cursor-pointer" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" /> or paste below <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"#,Firm Name,City\n1,\"Smith & Associates\",Dallas\n2,Jones Law Firm,Houston"}
                rows={10}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Recognized columns: Firm Name, Attorney, Email, Phone, Website, Practice Area, City, State, Notes
              </p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose}
                      className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={runParse} disabled={!text.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                                 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
                <Upload size={14} /> Preview Import
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-violet-700">{preview.length} prospects</span> ready to import
                {preview.some(r => !r.email) && (
                  <span className="text-gray-400 ml-2 text-xs">· use "Find from Website" after to fill in emails</span>
                )}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              {preview.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{r.firmName}</span>
                    {(r.city || r.state) && (
                      <span className="text-gray-400 text-xs ml-2">
                        {[r.city, r.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  {r.email
                    ? <span className="text-xs text-violet-600">{r.email}</span>
                    : <span className="text-xs text-gray-300">no email yet</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setPreview(null)}
                      className="px-4 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                Back
              </button>
              <button onClick={() => { onAddAll(preview); onClose(); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                                 bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                <Plus size={14} /> Import {preview.length} Prospects
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scrape Modal ─────────────────────────────────────────────────────────────
function ScrapeModal({ onClose, onAddAll }) {
  const [step, setStep]       = useState('input');
  const [urlText, setUrlText] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const scrape = async () => {
    const urls = urlText.split('\n').map(u => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setLoading(true);
    setStep('loading');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      const list = data.results || [];
      setResults(list);
      setSelected(new Set(
        list.map((_, i) => i).filter(i => list[i].emails.length || list[i].phones.length)
      ));
      setStep('results');
    } catch (e) {
      alert('Scraping failed: ' + e.message);
      setStep('input');
    } finally { setLoading(false); }
  };

  const toggle = (i) => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const addSelected = () => {
    const toAdd = results
      .filter((_, i) => selected.has(i))
      .map(r => {
        let hostname = r.url;
        try { hostname = new URL(r.url.startsWith('http') ? r.url : 'https://' + r.url).hostname.replace('www.', ''); } catch {}
        return {
          firmName: r.firmName || hostname,
          attorney: '',
          email: r.emails[0] || '',
          phone: r.phones[0] || '',
          website: r.url,
          practiceArea: '',
          city: '',
          state: '',
          status: 'New',
          notes: [
            r.emails.length > 1 ? `Other emails: ${r.emails.slice(1).join(', ')}` : '',
            r.phones.length > 1 ? `Other phones: ${r.phones.slice(1).join(', ')}` : '',
          ].filter(Boolean).join('\n'),
        };
      });
    onAddAll(toAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Find Contact Info from Websites</h2>
            <p className="text-xs text-gray-500 mt-0.5">Paste URLs to automatically pull emails & phone numbers</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {step === 'input' && (
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Website URLs — one per line
              </label>
              <textarea
                value={urlText}
                onChange={e => setUrlText(e.target.value)}
                placeholder={"smithlaw.com\njonesfamilylaw.com\nbrownlitigation.com"}
                rows={12}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Up to 50 URLs. No need to include https://. Larger lists take about 30–60 seconds.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose}
                      className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={scrape} disabled={!urlText.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                                 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
                <Radar size={14} /> Scrape Websites
              </button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="px-6 py-20 text-center flex-1">
            <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Scraping websites…</p>
            <p className="text-xs text-gray-400 mt-1">Checking each site for contact info. Hang tight.</p>
          </div>
        )}

        {step === 'results' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <p className="text-sm text-gray-600">
                {results.length} site{results.length !== 1 ? 's' : ''} scanned
                · <span className="font-semibold text-violet-700">{selected.size} selected</span> to add
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-4">
              {results.map((r, i) => {
                const hasData = r.emails.length > 0 || r.phones.length > 0;
                let hostname = r.url;
                try { hostname = new URL(r.url.startsWith('http') ? r.url : 'https://' + r.url).hostname.replace('www.', ''); } catch {}
                return (
                  <div
                    key={i}
                    onClick={() => hasData && toggle(i)}
                    className={`flex gap-3 p-3 rounded-xl border transition-all
                      ${!hasData ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' :
                        selected.has(i)
                          ? 'border-violet-300 bg-violet-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 cursor-pointer'}`}
                  >
                    <input type="checkbox" checked={selected.has(i)} disabled={!hasData}
                           onChange={() => {}} className="mt-0.5 accent-violet-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.firmName || hostname}</p>
                      <p className="text-xs text-gray-400">{hostname}</p>
                      {r.error && <p className="text-xs text-red-400 mt-0.5">{r.error}</p>}
                      {r.emails.length > 0 && (
                        <p className="text-xs text-violet-700 mt-0.5">📧 {r.emails.join(' · ')}</p>
                      )}
                      {r.phones.length > 0 && (
                        <p className="text-xs text-green-700 mt-0.5">📞 {r.phones.join(' · ')}</p>
                      )}
                      {!hasData && !r.error && (
                        <p className="text-xs text-gray-400 mt-0.5">No contact info found</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setStep('input')}
                      className="px-4 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                Back
              </button>
              <button onClick={addSelected} disabled={selected.size === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                                 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
                <Plus size={14} /> Add {selected.size} to Tracker
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main tracker ─────────────────────────────────────────────────────────────
export default function ProspectTracker() {
  const [authed, setAuthed]       = useState(() => sessionStorage.getItem('intakeai_auth') === '1');
  const [prospects, setProspects] = useState(loadProspects);
  const [modal, setModal]         = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [showScrape, setShowScrape]   = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('All');
  const [sortKey, setSortKey]     = useState('addedAt');
  const [sortAsc, setSortAsc]     = useState(false);
  const [expandedId, setExpanded] = useState(null);

  useEffect(() => { saveProspects(prospects); }, [prospects]);

  const handleAuth = () => { sessionStorage.setItem('intakeai_auth', '1'); setAuthed(true); };

  const save = (form) => {
    if (modal?.id) {
      setProspects((p) => p.map((x) => x.id === modal.id ? { ...x, ...form } : x));
    } else {
      setProspects((p) => [
        { ...form, id: Date.now(), addedAt: ts(), contactHistory: [] },
        ...p,
      ]);
    }
    setModal(null);
  };

  const addAll = (forms) => {
    const now = ts();
    setProspects((p) => [
      ...forms.map((f) => ({ ...f, id: Date.now() + Math.random(), addedAt: now, contactHistory: [] })),
      ...p,
    ]);
  };

  const markContacted = (id, method = 'Email') => {
    const now = ts();
    const label = method === 'Phone Call' ? `📞 Phone call ${now}` : `📧 Email sent ${now}`;
    setProspects((p) => p.map((x) =>
      x.id === id
        ? {
            ...x,
            status: x.status === 'New' ? 'Contacted' : x.status,
            lastContacted: now,
            contactHistory: [...(x.contactHistory || []), label],
          }
        : x
    ));
  };

  const remove = (id) => {
    if (window.confirm('Delete this prospect?')) setProspects((p) => p.filter((x) => x.id !== id));
  };

  const exportCSV = () => {
    const blob = new Blob([toCSV(prospects)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `intakeai-prospects-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const visible = prospects
    .filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || [p.firmName, p.attorney, p.email, p.city, p.state, p.practiceArea]
        .some((v) => (v||'').toLowerCase().includes(q));
      const matchStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const av = (a[sortKey]||'').toString().toLowerCase();
      const bv = (b[sortKey]||'').toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = prospects.filter((p) => p.status === s).length;
    return acc;
  }, {});

  if (!authed) return <Login onSuccess={handleAuth} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Prospect Tracker</h1>
            <p className="text-xs text-gray-500 mt-0.5">{prospects.length} total · {visible.length} shown</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportCSV}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200
                               text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={14} /> Export CSV
            </button>
            <button onClick={() => setShowImport(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200
                               text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Upload size={14} /> Import CSV
            </button>
            <button onClick={() => setShowScrape(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-violet-200
                               bg-violet-50 text-sm text-violet-700 font-medium hover:bg-violet-100 transition-colors">
              <Radar size={14} /> Find from Website
            </button>
            <button onClick={() => setModal('add')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white
                               text-sm font-semibold hover:bg-violet-700 transition-colors">
              <Plus size={15} /> Add Prospect
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('All')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                              ${filterStatus === 'All' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            All ({prospects.length})
          </button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                ${filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
              {s} ({counts[s]||0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search by firm, attorney, city, practice area…"
                 className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                            bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No prospects yet</p>
            <p className="text-sm mt-1">Click "Add Prospect" to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[2fr_1.2fr_1.5fr_0.9fr_1fr_auto] gap-4 px-5 py-3
                            text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">
              {[['firmName','Firm / Attorney'],['practiceArea','Practice Area'],
                ['email','Email'],['city','Location'],['status','Status']].map(([k, label]) => (
                <button key={k} onClick={() => toggleSort(k)}
                        className="flex items-center gap-1 hover:text-gray-800 text-left">
                  {label}
                  {sortKey === k
                    ? (sortAsc ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)
                    : <ChevronDown size={12} className="opacity-30"/>}
                </button>
              ))}
              <span />
            </div>

            {visible.map((p) => (
              <div key={p.id}>
                <div
                  className="grid grid-cols-[2fr_1.2fr_1.5fr_0.9fr_1fr_auto] gap-4 items-center
                             px-5 py-4 border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer"
                  onClick={() => setExpanded(expandedId === p.id ? null : p.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{p.firmName||'—'}</p>
                    {p.attorney && <p className="text-xs text-gray-500 truncate">{p.attorney}</p>}
                    {p.lastContacted && (
                      <p className="text-xs text-blue-500">
                        Contacted {timeAgo(p.lastContacted)}
                        {staleBadge(p.lastContacted, p.status) && (
                          <span className={`ml-2 font-semibold ${staleBadge(p.lastContacted, p.status).color}`}>
                            · {staleBadge(p.lastContacted, p.status).label}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{p.practiceArea||'—'}</p>
                  <div className="min-w-0">
                    {p.email
                      ? <span className="text-sm text-violet-600 truncate block">{p.email}</span>
                      : <span className="text-sm text-gray-400">—</span>}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {[p.city, p.state].filter(Boolean).join(', ')||'—'}
                  </p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium w-fit ${STATUS_COLORS[p.status]||'bg-gray-100 text-gray-600'}`}>
                    {p.status}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {p.email && (
                      <button
                        onClick={() => setEmailModal(p)}
                        title="Compose email"
                        className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                        <Mail size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => markContacted(p.id, 'Phone Call')}
                      title="Log phone call"
                      className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors">
                      <Phone size={14} />
                    </button>
                    <button onClick={() => setModal(p)}
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                      <StickyNote size={14} />
                    </button>
                    <button onClick={() => remove(p.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail row */}
                {expandedId === p.id && (
                  <div className="px-5 py-4 bg-violet-50/40 border-b border-gray-100 space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      {p.phone && (
                        <a href={`tel:${p.phone}`}
                           className="flex items-center gap-1.5 text-gray-700 hover:text-violet-700">
                          <Phone size={13} className="text-gray-400" />{p.phone}
                        </a>
                      )}
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1.5 text-gray-700 hover:text-violet-700">
                          <Globe size={13} className="text-gray-400" />{p.website}
                        </a>
                      )}
                      {p.email && (
                        <button
                          onClick={() => setEmailModal(p)}
                          className="flex items-center gap-1.5 text-violet-600 hover:text-violet-800 font-medium">
                          <Mail size={13} /> Compose / View Email
                        </button>
                      )}
                    </div>
                    {p.notes && (
                      <div className="text-gray-600 bg-white rounded-lg px-4 py-3 border border-gray-100 whitespace-pre-line leading-relaxed text-sm">
                        {p.notes}
                      </div>
                    )}
                    {p.contactHistory?.length > 0 && (
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-gray-500 mb-1">Contact history</p>
                        {p.contactHistory.map((entry, i) => (
                          <p key={i} className="text-gray-400">• {entry}</p>
                        ))}
                      </div>
                    )}
                    {p.addedAt && <p className="text-xs text-gray-400">Added {p.addedAt}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ProspectModal
          initial={modal === 'add' ? null : modal}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}

      {emailModal && (
        <EmailModal
          prospect={emailModal}
          onClose={() => setEmailModal(null)}
          onSent={() => markContacted(emailModal.id, 'Email')}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onAddAll={addAll}
        />
      )}

      {showScrape && (
        <ScrapeModal
          onClose={() => setShowScrape(false)}
          onAddAll={addAll}
        />
      )}
    </div>
  );
}
