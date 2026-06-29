/**
 * LeadList — Zip-code-filtered lead pipeline, mobile-responsive
 * Shows upgrade modal for trial users who've exhausted their free lead.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, MapPin, ChevronDown, AlertCircle, DollarSign, Clock, X, Crown } from 'lucide-react';
import { leadsAPI, usersAPI, trialAPI } from '../../services/api';

const statusColors = {
  new: 'bg-blue-100 text-blue-800', contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800', booked: 'bg-purple-100 text-purple-800',
  lost: 'bg-red-100 text-red-800',
};

export default function LeadList() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userZips, setUserZips] = useState([]);
  const [zipFilter, setZipFilter] = useState('');
  const [trialStatus, setTrialStatus] = useState(null); // { trial_leads_used, trial_limit, is_blocked, is_trial_active }
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();

  // Fetch trial status and user info
  useEffect(() => {
    usersAPI.getMe().then(({ data }) => setUserZips(data.service_zip_codes || [])).catch(() => {});
    trialAPI.status().then(({ data }) => {
      setTrialStatus(data);
      if (data.is_blocked) setShowUpgradeModal(true);
    }).catch(() => {});
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await leadsAPI.list(params);
      setLeads(Array.isArray(data) ? data : data.leads || []);
    } catch (err) {
      // If 402 trial exhausted, show the modal
      if (err.response?.status === 402) {
        setShowUpgradeModal(true);
        setLeads([]);
      } else {
        console.error(err);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchLeads(); }, [page, statusFilter]);

  // Client-side filtering for zip + search
  const filtered = leads.filter((l) => {
    if (zipFilter && !(l.zip_code || '').startsWith(zipFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.title || '').toLowerCase().includes(q) || (l.contact_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-2 relative">

      {/* ── Trial Badge ──────────────────────────────────────────────── */}
      {trialStatus && trialStatus.is_trial_active && (
        <div className="flex items-center justify-between mb-4 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
          <span className="text-indigo-700 font-medium flex items-center gap-2">
            <Crown size={16} className="text-indigo-500" />
            Free trial: {trialStatus.trial_leads_used}/{trialStatus.trial_limit} lead{trialStatus.trial_limit > 1 ? 's' : ''} used
          </span>
          <a href="/subscription" className="text-indigo-600 hover:text-indigo-800 text-xs font-medium underline">
            Upgrade to continue
          </a>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Projects in your service areas</p>
        </div>
        <button onClick={fetchLeads}
                className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Filters — stacked on mobile, row on desktop */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search leads..."
                 className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="booked">Booked</option>
        </select>
        {/* Zip filter — text input so you can type any zip */}
        <input value={zipFilter} onChange={(e) => setZipFilter(e.target.value)}
               placeholder="Filter by zip code..."
               maxLength={5}
               className="w-full sm:w-40 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* Lead cards — mobile-friendly card layout */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No leads found</p>
          <p className="text-sm">Try adjusting your filters or add zip codes in Settings.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filtered.map((l) => (
            <div key={l.id} onClick={() => navigate(`/dashboard/leads/${l.id}`)}
                 className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-md active:shadow-sm transition-shadow cursor-pointer">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Left: main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[l.status] || 'bg-gray-100 text-gray-800'}`}>
                      {l.status || 'new'}
                    </span>
                    <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded">{l.source}</span>
                    {l.lead_score > 0 && <span className="text-xs text-green-600 font-medium">Score: {l.lead_score.toFixed(1)}</span>}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 truncate">{l.title || 'Untitled'}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    {l.contact_name && <span className="flex items-center gap-1">{l.contact_name}</span>}
                    {l.zip_code && (
                      <a href={`https://www.google.com/maps?q=${l.city ? `${l.city}+${l.state}+` : ''}${l.zip_code}`}
                         target="_blank" rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()}
                         className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline">
                        <MapPin size={12} /> {l.zip_code}
                      </a>
                    )}
                    {l.city && <span>{l.city}, {l.state}</span>}
                    {l.budget_max && <span className="flex items-center gap-1"><DollarSign size={12} /> ${l.budget_max.toLocaleString()}</span>}
                    {l.project_timeline && <span className="flex items-center gap-1"><Clock size={12} /> {l.project_timeline}</span>}
                  </div>
                </div>
                {/* Right: quick action — big tap target on mobile */}
                {l.status === 'new' && (
                  <button onClick={(e) => { e.stopPropagation(); /* mark contacted */ }}
                          className="w-full sm:w-auto mt-2 sm:mt-0 px-5 py-2.5 sm:py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-xl sm:rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors text-center">
                    Mark Contacted
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="px-5 py-2.5 sm:py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50">
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button onClick={() => setPage(page + 1)}
                  className="px-5 py-2.5 sm:py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">
            Next
          </button>
        </div>
      )}

      {/* ── Upgrade Modal (402 overlay) ──────────────────────────────── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative">
            <button onClick={() => setShowUpgradeModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Crown size={32} className="text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You've used your free lead!</h2>
              <p className="text-sm text-gray-500">
                Get unlimited leads and all the tools to grow your business.
                Pick a plan that fits your needs.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { tier: 'starter', name: 'Starter', price: '$29/mo', desc: '1 zip code, basic scanning' },
                { tier: 'pro', name: 'Pro', price: '$79/mo', desc: '5 zips, automated outreach' },
                { tier: 'elite', name: 'Elite', price: '$199/mo', desc: 'Unlimited everything' },
              ].map((p) => (
                <button key={p.tier} onClick={() => navigate('/subscription')}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.desc}</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600">{p.price}</span>
                </button>
              ))}
            </div>

            <a href="/subscription"
               className="block w-full py-3 text-center text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors">
              View All Plans
            </a>
          </div>
        </div>
      )}
    </div>
  );
}