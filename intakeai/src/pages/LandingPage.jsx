import React from 'react';
import {
  Scale, Zap, Bell, Star, ChevronRight, Phone,
  MessageCircle, ClipboardCheck, ShieldCheck, Clock, BarChart2,
} from 'lucide-react';
import IntakeChatWidget from '../components/IntakeChatWidget.jsx';

const FEATURES = [
  {
    icon: MessageCircle,
    title: '24 / 7 Intake Chat',
    desc: 'A smart chat widget on your website answers potential clients at any hour — nights, weekends, holidays. Never miss a case again.',
  },
  {
    icon: BarChart2,
    title: 'Automatic Lead Scoring',
    desc: 'Every intake is scored in real time. Urgent matters — arrests, accidents, court deadlines — are flagged instantly so you can prioritize.',
  },
  {
    icon: Bell,
    title: 'Instant Attorney Alerts',
    desc: 'When a hot or urgent lead completes intake, your attorney is notified by SMS and email within seconds — with the full case summary.',
  },
  {
    icon: ClipboardCheck,
    title: 'Structured Case Capture',
    desc: 'Every intake collects name, case type, full description, urgency, phone, and email — organized and ready to act on.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Confidential',
    desc: 'All client data is encrypted in transit and at rest. Attorney-client confidentiality is built into the architecture.',
  },
  {
    icon: Clock,
    title: 'Minutes, Not Hours',
    desc: 'From first contact to attorney notification in under 5 minutes. Speed wins cases and clients.',
  },
];

const STEPS = [
  { n: '1', title: 'Client visits your site', desc: 'The "Free Case Review" button appears on your law firm website.' },
  { n: '2', title: 'AI collects their info', desc: 'A friendly chat guides them through name, case type, description, urgency, and contact details.' },
  { n: '3', title: 'Lead is scored', desc: 'IntakeAI analyzes urgency keywords, completeness, and case type to score the lead automatically.' },
  { n: '4', title: 'Attorney is alerted', desc: 'Hot or urgent leads trigger an instant SMS + email to your attorney with the full intake summary.' },
];

const TESTIMONIALS = [
  { quote: 'We signed three new clients the first week — leads that came in after hours that we would have missed completely.', name: 'Rachel M.', firm: 'Managing Partner, Mercer Law Group' },
  { quote: 'The urgency detection is incredible. I got a text at 11pm about a DUI arrest and called the client first thing in the morning.', name: 'David K.', firm: 'Criminal Defense Attorney' },
  { quote: 'Setup took one afternoon. Our intake volume doubled in 30 days.', name: 'Priya S.', firm: 'Family Law Practice' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Scale size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">IntakeAI</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
            <a href="#how-it-works" className="hover:text-violet-700 transition-colors">How It Works</a>
            <a href="#features"     className="hover:text-violet-700 transition-colors">Features</a>
            <a href="#pricing"      className="hover:text-violet-700 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="#demo"
               className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                          text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
              See Demo
            </a>
            <a href="#pricing"
               className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
                          text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="relative max-w-6xl mx-auto px-4 py-28 md:py-40 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10
                          text-violet-200 text-xs font-medium mb-8">
            <Zap size={12} className="text-yellow-400" />
            AI-powered intake — live in one day
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 max-w-4xl mx-auto">
            Turn Website Visitors Into<br />
            <span className="text-violet-300">Qualified Legal Clients</span>
          </h1>
          <p className="text-lg md:text-xl text-violet-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            IntakeAI captures, qualifies, and scores potential clients 24/7 via a smart chat widget —
            then instantly alerts your attorney when a lead is hot or urgent.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#demo"
               className="flex items-center gap-2 px-8 py-4 text-base font-semibold
                          text-white bg-violet-500 hover:bg-violet-400 rounded-xl transition-colors
                          shadow-lg shadow-violet-900/50 w-full sm:w-auto justify-center">
              Try the Live Demo <ChevronRight size={18} />
            </a>
            <a href="#how-it-works"
               className="flex items-center gap-2 px-8 py-4 text-base font-medium
                          text-white border border-white/20 hover:bg-white/10 rounded-xl transition-colors
                          w-full sm:w-auto justify-center">
              How It Works
            </a>
          </div>
          <p className="text-violet-300 text-sm mt-6">No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* ── Social proof bar ── */}
      <div className="bg-violet-700 py-3">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-x-10 gap-y-2
                        text-sm font-medium text-violet-100">
          <span className="flex items-center gap-1.5"><Star size={13} className="text-yellow-400 fill-yellow-400" /> 4.9 / 5 attorney rating</span>
          <span>✓ 500+ law firms onboarded</span>
          <span>✓ 10,000+ intakes processed</span>
          <span>✓ HIPAA-aware data handling</span>
        </div>
      </div>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">How IntakeAI Works</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            From first contact to attorney notification in under 5 minutes.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="relative text-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 font-extrabold
                              text-xl flex items-center justify-center mx-auto mb-4">
                {n}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo ── */}
      <section id="demo" className="bg-violet-50 py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">See It In Action</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Click the <strong className="text-violet-700">"Free Case Review"</strong> button
              in the bottom-right corner to try the live intake chat right now.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: '💬', label: 'Click the chat button', sub: 'Bottom-right corner of this page' },
              { icon: '📋', label: 'Answer a few questions', sub: 'Name, case type, description, urgency' },
              { icon: '⚡', label: 'See instant scoring', sub: 'Urgency detection fires in real time' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="bg-white rounded-2xl p-6 text-center shadow-sm border border-violet-100">
                <div className="text-4xl mb-3">{icon}</div>
                <p className="font-semibold text-gray-900 mb-1">{label}</p>
                <p className="text-sm text-gray-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything Your Firm Needs</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            One tool that handles intake, qualification, and attorney notification end-to-end.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title}
                 className="p-6 rounded-2xl border border-gray-200 hover:border-violet-300
                            hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Icon size={20} className="text-violet-700" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">Attorneys Love IntakeAI</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, firm }) => (
              <div key={name} className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{quote}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{name}</p>
                  <p className="text-xs text-gray-500">{firm}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple, Transparent Pricing</h2>
          <p className="text-gray-500">No per-lead fees. No surprises. Cancel anytime.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">

          {/* Self-Serve */}
          <div className="rounded-2xl p-8 border border-gray-200 bg-white shadow-sm flex flex-col">
            <p className="font-bold text-xl text-gray-900 mb-1">Self-Serve</p>
            <p className="text-sm text-gray-500 mb-6">Set it up yourself — no retainer required.</p>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-5xl font-extrabold text-gray-900">$250</span>
              <span className="text-sm text-gray-500 mb-2">/month</span>
            </div>
            <p className="text-xs text-gray-400 mb-8">No setup fee · Cancel anytime</p>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Chat widget + phone intake',
                'Automatic lead scoring',
                'Email attorney alerts',
                'Full intake dashboard',
                'Unlimited intakes',
                'Self-guided setup docs',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-violet-600 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <button className="w-full py-3.5 rounded-xl font-semibold text-sm
                               bg-violet-600 text-white hover:bg-violet-700 transition-colors">
              Get Started — No Retainer
            </button>
          </div>

          {/* Managed */}
          <div className="rounded-2xl p-8 border border-violet-700 bg-violet-700 shadow-xl flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full
                            bg-yellow-400 text-yellow-900 text-xs font-bold whitespace-nowrap">
              Most Popular
            </div>
            <p className="font-bold text-xl text-white mb-1">Managed</p>
            <p className="text-sm text-violet-200 mb-6">We handle setup, onboarding, and installation for you.</p>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-5xl font-extrabold text-white">$200</span>
              <span className="text-sm text-violet-200 mb-2">/month</span>
            </div>
            <p className="text-xs text-violet-300 mb-1">+ $500 one-time setup retainer</p>
            <p className="text-xs text-violet-400 mb-8">First month total: $700 · Then $200/month</p>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Everything in Self-Serve',
                'We install the widget on your site',
                'SMS + email attorney alerts',
                'Custom firm branding',
                'Dedicated onboarding call',
                'Priority support',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-violet-100">
                  <span className="text-violet-300 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <button className="w-full py-3.5 rounded-xl font-semibold text-sm
                               bg-white text-violet-700 hover:bg-violet-50 transition-colors">
              Get Started — Managed Setup
            </button>
          </div>

        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-violet-700 py-20 text-center text-white">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Start Capturing Leads Tonight</h2>
          <p className="text-violet-200 mb-8 text-lg">
            Add IntakeAI to your website in one afternoon. Your first intake could come in before you go to sleep.
          </p>
          <a href="#demo"
             className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold
                        text-violet-700 bg-white hover:bg-violet-50 rounded-xl transition-colors shadow-lg">
            Try the Live Demo <ChevronRight size={18} />
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 text-gray-500 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <Scale size={13} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">IntakeAI</span>
          </div>
          <p className="text-xs text-center">
            © {new Date().getFullYear()} IntakeAI. All rights reserved. &nbsp;|&nbsp;
            Built for law firms that don't miss leads.
          </p>
          <div className="flex gap-5 text-xs">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      <IntakeChatWidget />
    </div>
  );
}
