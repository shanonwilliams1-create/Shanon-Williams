/**
 * IntakeLeads — Attorney dashboard for reviewing and acting on intake leads
 *
 * Shows all leads from chat widget and phone calls.
 * Color-coded by urgency / hot status. Includes full transcript view.
 */
import { useState, useEffect } from 'react';
import {
  AlertTriangle, Flame, Phone, Mail, Clock,
  RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle,
  MessageSquare, PhoneCall, User,
} from 'lucide-react';
import { intakeAPI } from '../../services/api';

const CASE_LABELS = {
  personal_injury: 'Personal Injury',
  criminal:        'Criminal Defense',
  family:          'Family Law',
  estate:          'Estate Planning',
  real_estate:     'Real Estate',
  employment:      'Employment',
  immigration:     'Immigration',
  other:           'Other / Unknown',
};

const STATUS_COLORS = {
  chatting:  'bg-blue-100 text-blue-800',
  complete:  'bg-purple-100 text-purple-800',
  contacted: 'bg-green-100 text-green-800',
  rejected:  'bg-gray-100 text-gray-500',
};

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 75 ? 'bg-red-500' : pct >= 55 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8 text-right">{pct}%</span>
    </div>
  );
}

function LeadCard({ lead, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail]     = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isUrgent = lead.is_urgent;
  const isHot    = lead.is_hot && !isUrgent;

  const borderColor = isUrgent
    ? 'border-l-red-500'
    : isHot
    ? 'border-l-amber-500'
    : 'border-l-gray-300';

  const toggleExpand = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const { data } = await intakeAPI.getLead(lead.id);
        setDetail(data);
      } catch {
        // fall through — we still expand with what we have
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((v) => !v);
  };

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      await intakeAPI.updateStatus(lead.id, status);
      onStatusChange(lead.id, status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">

          {/* Left: flags + info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {isUrgent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                                 text-xs font-bold bg-red-100 text-red-700">
                  <AlertTriangle size={11} /> URGENT
                </span>
              )}
              {isHot && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                                 text-xs font-bold bg-amber-100 text-amber-700">
                  <Flame size={11} /> HOT
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                {lead.status}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                {lead.intake_source === 'phone'
                  ? <><PhoneCall size={11} /> Phone</>
                  : <><MessageSquare size={11} /> Chat</>
                }
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <User size={14} className="text-gray-400 flex-shrink-0" />
              <p className="font-semibold text-gray-900">
                {lead.client_name || 'Unknown Client'}
              </p>
            </div>

            <p className="text-sm text-indigo-700 font-medium mb-2">
              {CASE_LABELS[lead.case_type] || 'Unknown Case Type'}
            </p>

            {lead.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{lead.description}</p>
            )}

            {lead.urgency_note && (
              <p className="text-sm text-red-600 font-medium mb-3">
                ⚠️ {lead.urgency_note}
              </p>
            )}

            <ScoreBar score={lead.lead_score} />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
              {lead.client_phone && (
                <a href={`tel:${lead.client_phone}`}
                   className="flex items-center gap-1 text-indigo-600 hover:underline">
                  <Phone size={11} /> {lead.client_phone}
                </a>
              )}
              {lead.client_email && (
                <a href={`mailto:${lead.client_email}`}
                   className="flex items-center gap-1 text-indigo-600 hover:underline">
                  <Mail size={11} /> {lead.client_email}
                </a>
              )}
              {lead.created_at && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(lead.created_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            {lead.status !== 'contacted' && (
              <button
                onClick={() => updateStatus('contacted')}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                           text-white bg-green-600 hover:bg-green-700 rounded-lg
                           disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={13} /> Contacted
              </button>
            )}
            {lead.status !== 'rejected' && (
              <button
                onClick={() => updateStatus('rejected')}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                           text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg
                           disabled:opacity-50 transition-colors"
              >
                <XCircle size={13} /> Reject
              </button>
            )}
            <button
              onClick={toggleExpand}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium
                         text-indigo-600 border border-indigo-200 hover:bg-indigo-50
                         rounded-lg transition-colors"
            >
              {loadingDetail
                ? <RefreshCw size={12} className="animate-spin" />
                : expanded
                ? <><ChevronUp size={13} /> Hide</>
                : <><ChevronDown size={13} /> Transcript</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Transcript */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Chat / Call Transcript
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(detail?.chat_history || lead.chat_history || []).map((msg, i) => (
              <div key={i}
                   className={`flex ${msg.role === 'user' || msg.role === 'caller' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'user' || msg.role === 'caller'
                    ? 'bg-indigo-600 text-white'
                    : msg.role === 'transcript'
                    ? 'bg-amber-100 text-amber-900 italic'
                    : 'bg-white border border-gray-200 text-gray-700'
                }`}>
                  {msg.role === 'transcript' && (
                    <span className="font-semibold block mb-1">Full Transcript:</span>
                  )}
                  {msg.role === 'recording'
                    ? <a href={msg.url} target="_blank" rel="noopener noreferrer"
                         className="underline">🎙 Listen to Recording</a>
                    : msg.content
                  }
                </div>
              </div>
            ))}
            {(!detail?.chat_history?.length && !lead.chat_history?.length) && (
              <p className="text-xs text-gray-400 italic">No transcript available yet.</p>
            )}
          </div>

          {(lead.urgency_indicators || []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-red-600 mb-1">Urgency Keywords Detected:</p>
              <div className="flex flex-wrap gap-1.5">
                {lead.urgency_indicators.map((kw) => (
                  <span key={kw}
                        className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IntakeLeads() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');  // all | urgent | hot | new
  const [search, setSearch]   = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'urgent') params.urgent_only = true;
      if (filter === 'hot')    params.hot_only    = true;
      if (filter === 'new')    params.status      = 'complete';
      const { data } = await intakeAPI.listLeads(params);
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load intake leads', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [filter]);

  const handleStatusChange = (leadId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l)
    );
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.client_name || '').toLowerCase().includes(q) ||
      (l.client_phone || '').includes(q) ||
      (l.description || '').toLowerCase().includes(q)
    );
  });

  const urgentCount = leads.filter((l) => l.is_urgent).length;
  const hotCount    = leads.filter((l) => l.is_hot && !l.is_urgent).length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Intake Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Clients from chat widget and phone calls
          </p>
        </div>
        <button onClick={fetchLeads}
                className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 text-sm
                           font-medium text-gray-700 bg-white border border-gray-300
                           rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats chips */}
      {(urgentCount > 0 || hotCount > 0) && (
        <div className="flex gap-3 mb-5">
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={14} className="text-red-600" />
              <span className="text-sm font-semibold text-red-700">
                {urgentCount} urgent
              </span>
            </div>
          )}
          {hotCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Flame size={14} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">
                {hotCount} hot
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or description…"
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl
                     focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <div className="flex gap-2">
          {['all', 'urgent', 'hot', 'new'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-colors capitalize ${
                filter === f
                  ? f === 'urgent'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : f === 'hot'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">No intake leads yet</p>
          <p className="text-sm">
            Leads appear here when clients use the chat widget or call in.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
