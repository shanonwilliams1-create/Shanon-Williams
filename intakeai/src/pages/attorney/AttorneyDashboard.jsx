import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, LogOut, Phone, Mail, Globe, Clock, User,
  AlertCircle, ChevronDown, RefreshCw, Shield, Trash2, Mic, Star, Plus
} from 'lucide-react';

const URGENCY_COLOR = {
  high:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', label: 'High' },
  medium: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', label: 'Medium' },
  low:    { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', label: 'Low' },
};

const SOURCE_LABEL = {
  phone: 'Phone Call',
  web:   'Web Form',
  sms:   'Text Message',
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(secs) {
  const s = secs || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export default function AttorneyDashboard() {
  const nav = useNavigate();
  const [attorney, setAttorney]         = useState(null);
  const [leads, setLeads]               = useState([]);
  const [myLeads, setMyLeads]           = useState([]);
  const [voicemails, setVoicemails]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [claiming, setClaiming]         = useState(null);
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState('new');
  const [devices, setDevices]           = useState([]);
  const [showDevices, setShowDevices]   = useState(false);
  const [expanded, setExpanded]         = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(Date.now());
  const [vips, setVips]                 = useState([]);
  const [vipLabel, setVipLabel]         = useState('');
  const [vipPhone, setVipPhone]         = useState('');
  const [vipSaving, setVipSaving]       = useState(false);
  const [vipError, setVipError]         = useState('');

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/attorney/me', { credentials: 'include' });
      if (res.status === 401) { nav('/attorney/login'); return; }
      const data = await res.json();
      setAttorney(data);
    } catch {
      nav('/attorney/login');
    }
  }, [nav]);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/attorney/leads', { credentials: 'include' });
      if (res.status === 401) { nav('/attorney/login'); return; }
      const data = await res.json();
      setLeads(data.available  || []);
      setMyLeads(data.mine     || []);
      setLastRefresh(Date.now());
    } catch {
      setError('Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [nav]);

  const fetchVoicemails = useCallback(async () => {
    try {
      const res = await fetch('/api/attorney/voicemails', { credentials: 'include' });
      if (res.ok) setVoicemails((await res.json()).voicemails || []);
    } catch {}
  }, []);

  const fetchDevices = useCallback(async () => {
    const res = await fetch('/api/attorney/trusted-devices', { credentials: 'include' });
    if (res.ok) setDevices((await res.json()).devices || []);
  }, []);

  const fetchVips = useCallback(async () => {
    const res = await fetch('/api/attorney/vip-contacts', { credentials: 'include' });
    if (res.ok) setVips((await res.json()).vips || []);
  }, []);

  const addVip = async (e) => {
    e.preventDefault();
    setVipError('');
    if (!vipPhone.trim()) { setVipError('Phone number is required.'); return; }
    setVipSaving(true);
    try {
      const res = await fetch('/api/attorney/vip-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: vipLabel || 'VIP', phone: vipPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setVipError(data.error || 'Could not save.'); return; }
      setVips(data.vips);
      setVipLabel('');
      setVipPhone('');
    } catch {
      setVipError('Network error — please try again.');
    } finally {
      setVipSaving(false);
    }
  };

  const removeVip = async (idx) => {
    const res = await fetch(`/api/attorney/vip-contacts/${idx}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok) setVips((await res.json()).vips || []);
  };

  useEffect(() => {
    fetchMe();
    fetchLeads();
    fetchVoicemails();
    fetchVips();
  }, [fetchMe, fetchLeads, fetchVoicemails, fetchVips]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => { fetchLeads(); fetchVoicemails(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchLeads, fetchVoicemails]);

  const claim = async (token) => {
    setClaiming(token);
    setError('');
    try {
      const res = await fetch(`/api/attorney/leads/${token}/claim`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not claim lead'); return; }
      await fetchLeads();
      setTab('mine');
      setExpanded(token);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setClaiming(null);
    }
  };

  const markHeard = async (id) => {
    try {
      await fetch(`/api/attorney/voicemails/${id}/read`, { method: 'PATCH', credentials: 'include' });
      setVoicemails(prev => prev.map(v => v.id === id ? { ...v, heard: true } : v));
    } catch {}
  };

  const revokeDevice = async (id) => {
    await fetch(`/api/attorney/trusted-devices/${id}`, {
      method: 'DELETE', credentials: 'include',
    });
    fetchDevices();
  };

  const logout = async () => {
    await fetch('/api/attorney/logout', { method: 'POST', credentials: 'include' });
    nav('/attorney/login');
  };

  const displayLeads  = tab === 'new' ? leads : myLeads;
  const unheardCount  = voicemails.filter(v => !v.heard).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
              <Scale size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">IntakeAI</span>
            <span className="text-xs text-gray-400 ml-1">Attorney Portal</span>
          </div>

          <div className="flex items-center gap-3">
            {attorney && (
              <span className="text-sm text-gray-600 hidden sm:block">
                {attorney.name}
              </span>
            )}
            <button
              onClick={() => { setShowDevices(d => !d); if (!showDevices) fetchDevices(); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Trusted browsers"
            >
              <Shield size={16} />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Trusted devices panel */}
      {showDevices && (
        <div className="bg-violet-50 border-b border-violet-200">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <p className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1.5">
              <Shield size={12} /> Trusted browsers (skip 2FA for 30 days)
            </p>
            {devices.length === 0 ? (
              <p className="text-xs text-violet-500">No trusted browsers yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {devices.map(d => (
                  <div key={d.id} className="flex items-center gap-2 bg-white border border-violet-200 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-gray-700">{d.label || 'Browser'}</span>
                    <span className="text-gray-400">· expires {new Date(d.expires_at).toLocaleDateString()}</span>
                    <button onClick={() => revokeDevice(d.id)} className="text-red-400 hover:text-red-600 ml-1">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats row */}
        {attorney && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'New leads',    value: leads.length,         color: 'text-violet-600' },
              { label: 'My leads',     value: myLeads.length,       color: 'text-blue-600' },
              { label: 'Firm',         value: attorney.firmName,    color: 'text-gray-700', small: true },
              { label: 'Your role',    value: attorney.role || 'Attorney', color: 'text-gray-700', small: true },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`font-bold ${s.small ? 'text-sm' : 'text-2xl'} ${s.color} truncate`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs + refresh */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'new',       label: `New (${leads.length})` },
              { id: 'mine',      label: `My Leads (${myLeads.length})` },
              { id: 'voicemail', label: 'Voicemail', badge: unheardCount },
              { id: 'vip',       label: 'VIP' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => { fetchLeads(); fetchVoicemails(); }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={12} />
            {timeAgo(lastRefresh)}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Voicemail tab */}
        {tab === 'voicemail' && (
          voicemails.length === 0 ? (
            <div className="text-center py-16">
              <Mic size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No voicemails yet. When callers leave a message it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {voicemails.map(vm => (
                <div key={vm.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    vm.heard ? 'border-gray-200' : 'border-violet-300 bg-violet-50/30'
                  }`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          vm.heard ? 'bg-gray-100' : 'bg-violet-100'
                        }`}>
                          <Mic size={16} className={vm.heard ? 'text-gray-400' : 'text-violet-600'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{vm.caller_name || 'Unknown caller'}</p>
                            {!vm.heard && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-violet-100 text-violet-700">New</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{vm.caller_phone || 'No number'}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(vm.created_at)}</span>
                            <span>{formatDuration(vm.duration_seconds)}</span>
                          </div>
                        </div>
                      </div>
                      {vm.caller_phone && (
                        <a href={`tel:${vm.caller_phone}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors flex-shrink-0">
                          <Phone size={13} />
                          Call back
                        </a>
                      )}
                    </div>

                    {/* Audio player */}
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Voicemail recording</p>
                      <audio
                        controls
                        preload="none"
                        className="w-full h-10"
                        onPlay={() => { if (!vm.heard) markHeard(vm.id); }}
                        src={`/api/attorney/voicemails/${vm.id}/audio`}
                      />
                    </div>

                    {vm.heard && vm.heard_at && (
                      <p className="text-xs text-gray-400 mt-2">Heard {timeAgo(vm.heard_at)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* VIP contacts tab */}
        {tab === 'vip' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Star size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Always-connect numbers</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    When someone on this list calls your IntakeAI number, the call rings through to you
                    immediately — no AI intake, no status check. If you are marked as unavailable or in court,
                    the call still comes through.
                  </p>
                </div>
              </div>
            </div>

            {/* Add VIP form */}
            <form onSubmit={addVip} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Add a VIP number</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                  <input
                    type="text"
                    value={vipLabel}
                    onChange={e => setVipLabel(e.target.value)}
                    placeholder="e.g. Wife, Mom, Doctor"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone number</label>
                  <input
                    type="tel"
                    value={vipPhone}
                    onChange={e => setVipPhone(e.target.value)}
                    placeholder="+1 555 000 0000"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
              {vipError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} /> {vipError}
                </p>
              )}
              <button
                type="submit"
                disabled={vipSaving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                {vipSaving ? 'Saving…' : 'Add VIP number'}
              </button>
            </form>

            {/* VIP list */}
            {vips.length === 0 ? (
              <div className="text-center py-10">
                <Star size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">No VIP numbers yet. Add one above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vips.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Star size={14} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{v.label}</p>
                        <p className="text-xs text-gray-500">{v.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`tel:${v.phone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-medium rounded-lg transition-colors">
                        <Phone size={12} />
                        Call
                      </a>
                      <button onClick={() => removeVip(i)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lead list */}
        {tab !== 'voicemail' && tab !== 'vip' && (loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading leads…</div>
        ) : displayLeads.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">
              {tab === 'new' ? 'No new leads right now. Check back shortly.' : 'You haven\'t claimed any leads yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayLeads.map(lead => {
              const urgency = URGENCY_COLOR[lead.urgency] || URGENCY_COLOR.medium;
              const isOpen  = expanded === lead.lead_token;
              const isMine  = tab === 'mine';

              return (
                <div key={lead.lead_token}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all">
                  {/* Lead card header */}
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={16} className="text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{lead.name || 'Unknown'}</p>
                          {lead.urgency && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: urgency.bg, color: urgency.text, border: `1px solid ${urgency.border}` }}>
                              {urgency.label} urgency
                            </span>
                          )}
                          {lead.source && (
                            <span className="text-xs text-gray-400">
                              via {SOURCE_LABEL[lead.source] || lead.source}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{lead.case_type || 'Case type not specified'}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Clock size={11} />
                          {timeAgo(lead.created_at || Date.now())}
                          {isMine && lead.claimed_at && (
                            <span className="ml-2 text-violet-500 font-medium">· Claimed by you</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isMine && (
                        <button
                          onClick={() => claim(lead.lead_token)}
                          disabled={claiming === lead.lead_token}
                          className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                          {claiming === lead.lead_token ? 'Claiming…' : 'Claim'}
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(isOpen ? null : lead.lead_token)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                      {/* Contact buttons */}
                      <div className="flex flex-wrap gap-2">
                        {lead.phone && (
                          <>
                            <a href={`tel:${lead.phone}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors">
                              <Phone size={13} />
                              Call {lead.phone}
                            </a>
                            <a href={`sms:${lead.phone}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg transition-colors">
                              <Phone size={13} />
                              Text {lead.phone}
                            </a>
                          </>
                        )}
                        {lead.email && (
                          <a href={`mailto:${lead.email}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                            <Mail size={13} />
                            {lead.email}
                          </a>
                        )}
                      </div>

                      {/* Details grid */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        {lead.description && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-gray-500 mb-1">What they described</p>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{lead.description}</p>
                          </div>
                        )}
                        {lead.appt_slot ? (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-violet-600 mb-1">Confirmed Appointment</p>
                            <p className="text-sm font-semibold text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                              {lead.appt_day || new Date(lead.appt_slot).toLocaleString('en-US', {
                                weekday: 'long', month: 'long', day: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true,
                              })}
                              <span className="ml-2 text-xs font-normal text-violet-500">· Calendar invite sent</span>
                            </p>
                          </div>
                        ) : lead.appt_day ? (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Preferred appointment</p>
                            <p className="text-sm text-gray-700">{lead.appt_day}{lead.appt_time ? ` · ${lead.appt_time}` : ''}</p>
                          </div>
                        ) : null}
                        {lead.appt_matter && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Appointment topic</p>
                            <p className="text-sm text-gray-700">{lead.appt_matter}</p>
                          </div>
                        )}
                        {lead.preferred_attorney && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Requested attorney</p>
                            <p className="text-sm text-gray-700">{lead.preferred_attorney}</p>
                          </div>
                        )}
                        {lead.score != null && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Lead score</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${Math.min(lead.score, 100)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-600">{lead.score}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Web inquiry link */}
                      {lead.source === 'web' && lead.client_token && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">Web inquiry</p>
                          <a
                            href={`/intake/${lead.client_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700">
                            <Globe size={13} />
                            View intake form
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </main>
    </div>
  );
}
