import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Scale, ChevronRight, ChevronLeft, Copy, Check } from 'lucide-react';

const PRACTICES = [
  'Personal Injury', 'Criminal Defense', 'DUI / DWI', 'Family Law',
  'Immigration', "Workers' Compensation", 'Bankruptcy', 'Employment Law',
  'Medical Malpractice', 'Estate Planning', 'Real Estate Law', 'Civil Litigation',
];

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HST)' },
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', required }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900
                 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
    />
  );
}

function CopyBox({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
      <code className="flex-1 text-green-400 text-xs break-all font-mono">{value}</code>
      <button onClick={copy}
        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600
                   text-white text-xs rounded-md transition-colors">
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </div>
  );
}

function StepFirmInfo({ data, update, togglePractice }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Tell us about your firm</h2>
        <p className="text-sm text-gray-500 mt-1">This helps us personalize your intake experience.</p>
      </div>

      <Field label="Firm Name" hint="As it should appear to clients">
        <Input value={data.firmName} onChange={v => update('firmName', v)} placeholder="Smith & Associates Law" required />
      </Field>

      <Field label="Firm Website" hint="Optional — so we can reference it in your setup">
        <Input value={data.website} onChange={v => update('website', v)} placeholder="https://smithlaw.com" />
      </Field>

      <Field label="How many attorneys are at your firm?">
        <Input type="number" value={data.attorneyCount} onChange={v => update('attorneyCount', v)} placeholder="e.g. 2" />
      </Field>

      {parseInt(data.attorneyCount) >= 5 && plan !== 'firm' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">You qualify for the Firm plan</p>
            <p className="text-sm text-amber-700 mt-0.5">
              With {data.attorneyCount}+ attorneys, the Firm plan ($750/mo) includes round-robin lead distribution,
              individual attorney profiles, and a dedicated account manager. Our team will reach out to discuss upgrading.
            </p>
          </div>
        </div>
      )}

      <Field label="Practice Areas" hint="Select all that apply">
        <div className="grid grid-cols-2 gap-2 mt-1">
          {PRACTICES.map(p => (
            <label key={p}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors
                ${data.practiceAreas.includes(p)
                  ? 'border-violet-400 bg-violet-50 text-violet-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              <input type="checkbox" className="sr-only"
                checked={data.practiceAreas.includes(p)}
                onChange={() => togglePractice(p)} />
              {data.practiceAreas.includes(p) ? <Check size={13} className="text-violet-600 flex-shrink-0" /> : <span className="w-3.5" />}
              {p}
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StepAlerts({ data, update }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Who receives lead alerts?</h2>
        <p className="text-sm text-gray-500 mt-1">When a client completes intake, we'll text and email this person instantly.</p>
      </div>

      <Field label="Attorney Name">
        <Input value={data.attorneyName} onChange={v => update('attorneyName', v)} placeholder="Jane Smith" />
      </Field>

      <Field label="Alert Email" hint="Required — receive full case summaries here">
        <Input type="email" value={data.attorneyEmail} onChange={v => update('attorneyEmail', v)}
          placeholder="jane@smithlaw.com" required />
      </Field>

      <Field label="Alert Phone (SMS)" hint="Optional — get a text the moment an urgent lead finishes intake">
        <Input type="tel" value={data.attorneyPhone} onChange={v => update('attorneyPhone', v)}
          placeholder="+1 555 000 0000" />
      </Field>
    </div>
  );
}

function StepPhone({ data, update }) {
  const phoneEnabled = data.forwardNumber !== '' || data.callMode === 'always';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Phone intake setup</h2>
        <p className="text-sm text-gray-500 mt-1">
          Give IntakeAI a phone number to answer. Clients call one number — AI handles it 24/7 or just after hours.
        </p>
      </div>

      <Field label="Your Office / Forward-To Number" hint="Calls during business hours go here (leave blank for AI-only)">
        <Input type="tel" value={data.forwardNumber} onChange={v => update('forwardNumber', v)}
          placeholder="+1 555 000 0000" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Business Hours Open">
          <input type="time" value={data.businessOpen}
            onChange={e => update('businessOpen', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </Field>
        <Field label="Business Hours Close">
          <input type="time" value={data.businessClose}
            onChange={e => update('businessClose', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </Field>
      </div>

      <Field label="Timezone">
        <select value={data.timezone} onChange={e => update('timezone', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900
                     focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Call Answering Mode">
        <div className="space-y-2">
          {[
            { value: 'afterhours', label: 'After hours only', desc: 'AI answers when your office is closed. Calls during hours ring your number.' },
            { value: 'always',    label: 'Always on (full receptionist)', desc: 'AI answers every call 24/7 — replaces your receptionist completely.' },
          ].map(opt => (
            <label key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                ${data.callMode === opt.value
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="callMode" value={opt.value}
                checked={data.callMode === opt.value}
                onChange={() => update('callMode', opt.value)}
                className="mt-0.5" />
              <div>
                <p className={`text-sm font-semibold ${data.callMode === opt.value ? 'text-violet-700' : 'text-gray-800'}`}>{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

function DoneScreen({ plan, data, webhookUrl, statusPageUrl }) {
  const isManaged = plan === 'Managed' || plan === 'Firm';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Scale size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900">IntakeAI</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You're all set, {data.firmName || 'there'}!</h1>
          <p className="text-gray-500 mt-2">Your IntakeAI account is active. Here's what to do next.</p>
        </div>

        <div className="space-y-6">
          {/* Email confirmation */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Confirmation sent</h3>
            <p className="text-sm text-gray-500">
              We've emailed your full setup details to <strong>{data.attorneyEmail}</strong>.
              Check that inbox — it includes everything you need.
            </p>
          </div>

          {/* Attorney status page */}
          {statusPageUrl && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Your Attorney Status Page</h3>
              <p className="text-sm text-gray-500 mb-3">
                Bookmark this link on your phone. Tap it any time to set yourself as Available,
                With a Client, or Out of Office — IntakeAI routes callers based on your live status.
              </p>
              <CopyBox value={statusPageUrl} />
              <p className="text-xs text-gray-400 mt-2">
                Open on your phone → tap "Add to Home Screen" for instant one-tap access.
              </p>
            </div>
          )}

          {/* Phone webhook */}
          {webhookUrl && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Your Twilio Webhook URL</h3>
              <p className="text-sm text-gray-500 mb-3">
                In Twilio, go to your phone number → Voice settings → set the webhook URL below (POST method).
              </p>
              <CopyBox value={webhookUrl} />
              <p className="text-xs text-gray-400 mt-2">
                Mode: <strong>{data.callMode === 'always' ? 'Always-on AI' : 'After hours AI'}</strong>
                {data.forwardNumber && <> · Forwards to: <strong>{data.forwardNumber}</strong></>}
                {' · '}{TIMEZONES.find(t => t.value === data.timezone)?.label}
                {' · '}{data.businessOpen}–{data.businessClose}
              </p>
            </div>
          )}

          {/* Next steps */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Next steps</h3>
            {isManaged ? (
              <div className="space-y-2 text-sm text-gray-600">
                <p>✓ Our team will reach out to <strong>{data.attorneyEmail}</strong> within 1 business day.</p>
                <p>✓ We'll install the chat widget on your website for you.</p>
                <p>✓ We'll configure your Twilio number and test everything end-to-end.</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-gray-600">
                <p>1. Set up your Twilio number and paste the webhook URL above.</p>
                <p>2. Add the IntakeAI chat widget to your website — instructions are in your confirmation email.</p>
                <p>3. Test it by calling your Twilio number or submitting a chat on your site.</p>
              </div>
            )}
          </div>

          <div className="text-center">
            <a href="/" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
              ← Back to IntakeAI home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [params] = useSearchParams();
  const plan = params.get('plan') || 'selfserve';
  const planLabel = plan === 'firm' ? 'Firm' : plan === 'managed' ? 'Managed' : 'Self-Serve';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [statusPageUrl, setStatusPageUrl] = useState('');
  const [data, setData] = useState({
    firmName: '',
    website: '',
    attorneyCount: '',
    practiceAreas: [],
    attorneyName: '',
    attorneyEmail: '',
    attorneyPhone: '',
    forwardNumber: '',
    timezone: 'America/Chicago',
    businessOpen: '09:00',
    businessClose: '17:00',
    callMode: 'afterhours',
  });

  const update = (field, value) => setData(d => ({ ...d, [field]: value }));
  const togglePractice = (p) => setData(d => ({
    ...d,
    practiceAreas: d.practiceAreas.includes(p)
      ? d.practiceAreas.filter(x => x !== p)
      : [...d.practiceAreas, p],
  }));

  const webhookUrl = token
    ? `${window.location.origin}/api/phone/inbound?forward=${encodeURIComponent(data.forwardNumber)}&tz=${encodeURIComponent(data.timezone)}&open=${data.businessOpen}&close=${data.businessClose}&mode=${data.callMode}&token=${token}`
    : '';

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, ...data }),
      });
      const json = await res.json();
      setToken(json.token || 'ok');
      if (json.statusPageUrl) setStatusPageUrl(json.statusPageUrl);
      setStep(4);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canContinue = step === 1 ? data.firmName.trim().length > 0 : true;
  const canSubmit = data.attorneyEmail.trim().length > 0;

  if (step === 4) {
    return <DoneScreen plan={planLabel} data={data} webhookUrl={webhookUrl} statusPageUrl={statusPageUrl} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Scale size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900">IntakeAI</span>
          <span className="ml-auto text-sm text-gray-500">{planLabel} Plan — Setup</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Progress bar */}
        <div className="flex items-center mb-10">
          {[
            { n: 1, label: 'Firm Info' },
            { n: 2, label: 'Alerts' },
            { n: 3, label: 'Phone' },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${step > n ? 'bg-violet-600 text-white' : step === n ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > n ? <Check size={14} /> : n}
                </div>
                <span className={`text-xs font-medium ${step >= n ? 'text-violet-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${step > n ? 'bg-violet-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {step === 1 && <StepFirmInfo data={data} update={update} togglePractice={togglePractice} />}
          {step === 2 && <StepAlerts data={data} update={update} />}
          {step === 3 && <StepPhone data={data} update={update} />}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1
              ? <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
                  <ChevronLeft size={16} /> Back
                </button>
              : <div />
            }
            {step < 3
              ? <button onClick={() => setStep(s => s + 1)} disabled={!canContinue}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-violet-600 hover:bg-violet-700
                             text-white text-sm font-semibold rounded-lg transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  Continue <ChevronRight size={16} />
                </button>
              : <button onClick={handleSubmit} disabled={loading || !canSubmit}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-violet-600 hover:bg-violet-700
                             text-white text-sm font-semibold rounded-lg transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? 'Setting up…' : 'Complete Setup'} <ChevronRight size={16} />
                </button>
            }
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Questions? Email us at <a href="mailto:support@myintakeai.com" className="text-violet-500">support@myintakeai.com</a>
        </p>
      </div>
    </div>
  );
}
