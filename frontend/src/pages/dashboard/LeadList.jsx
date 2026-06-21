/**
 * LeadList — Real-time lead pipeline with status management
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Filter, Search, MapPin, Phone, Mail,
  Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle,
} from 'lucide-react';
import { leadsAPI } from '../../services/api';

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  read: 'bg-gray-100 text-gray-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  booked: 'bg-purple-100 text-purple-800',
  lost: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function LeadList() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await leadsAPI.list(params);
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [page, statusFilter]);

  const filteredLeads = leads.filter((ul) =>
    !search || ul.lead?.project_title?.toLowerCase().includes(search.toLowerCase()) ||
    ul.lead?.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const updateStatus = async (leadId, newStatus) => {
    try {
      await leadsAPI.updateStatus(leadId, newStatus);
      fetchLeads();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your incoming project leads</p>
        </div>
        <button onClick={fetchLeads} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="booked">Booked</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Lead Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No leads yet</p>
          <p className="text-sm">New leads will appear here as they're discovered.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredLeads.map((ul) => (
            <div
              key={ul.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/dashboard/leads/${ul.lead_id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ul.status] || statusColors.new}`}>
                      {ul.status}
                    </span>
                    <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded">
                      {ul.lead?.source}
                    </span>
                    {ul.lead?.lead_score > 0 && (
                      <span className="text-xs text-green-600 font-medium">
                        Score: {ul.lead.lead_score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {ul.lead?.project_title || 'Untitled Project'}
                  </h3>
                  {ul.lead?.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ul.lead.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                    {ul.lead?.contact_name && (
                      <span className="flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium">
                          {ul.lead.contact_name.charAt(0)}
                        </span>
                        {ul.lead.contact_name}
                      </span>
                    )}
                    {ul.lead?.address_city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {ul.lead.address_city}, {ul.lead.address_state}
                      </span>
                    )}
                    {ul.lead?.budget_max && (
                      <span className="flex items-center gap-1">
                        Budget: ${ul.lead.budget_min?.toLocaleString() || '0'} - ${ul.lead.budget_max.toLocaleString()}
                      </span>
                    )}
                    {ul.lead?.project_timeline && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {ul.lead.project_timeline}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  {ul.status === 'new' && (
                    <button
                      onClick={() => updateStatus(ul.lead_id, 'contacted')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Mark Contacted
                    </button>
                  )}
                  {ul.status === 'contacted' && (
                    <button
                      onClick={() => updateStatus(ul.lead_id, 'booked')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Mark Booked
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(ul.lead_id, ul.status === 'lost' ? 'new' : 'lost')}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {ul.status === 'lost' ? 'Reopen' : 'Dismiss'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}