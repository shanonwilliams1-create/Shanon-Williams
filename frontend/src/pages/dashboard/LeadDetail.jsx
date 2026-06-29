/**
 * LeadDetail — Full lead details with outreach and appointment actions
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, DollarSign, Clock,
  Calendar, Send, MessageSquare,
} from 'lucide-react';
import { leadsAPI, outreachAPI, appointmentsAPI } from '../../services/api';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('email');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await leadsAPI.get(id);
        setLead(data);
      } catch (err) {
        console.error('Failed to fetch lead:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleContact = async () => {
    setSending(true);
    try {
      await leadsAPI.contact(id, { channel, message });
      alert('Message queued for delivery!');
      setMessage('');
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>;
  if (!lead) return <div className="text-center py-20 text-gray-500">Lead not found</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/dashboard/leads')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Back to Leads
      </button>

      {/* Lead Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{lead.project_title || 'Untitled Project'}</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">{lead.source}</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{lead.trade_category}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {lead.contact_name && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                {lead.contact_name.charAt(0)}
              </span>
              <div>
                <p className="font-medium text-gray-900">{lead.contact_name}</p>
                <p className="text-xs text-gray-500">Contact</p>
              </div>
            </div>
          )}
          {lead.contact_email && (
            <div className="flex items-center gap-2 text-gray-600">
              <Mail size={16} className="text-gray-400" />
              <a href={`mailto:${lead.contact_email}`} className="text-indigo-600 hover:underline">{lead.contact_email}</a>
            </div>
          )}
          {lead.contact_phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={16} className="text-gray-400" />
              <a href={`tel:${lead.contact_phone}`} className="text-indigo-600 hover:underline">{lead.contact_phone}</a>
            </div>
          )}
          {lead.address_city && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={16} className="text-indigo-500" />
              <a href={`https://www.google.com/maps?q=${lead.address_city}+${lead.address_state || ''}+${lead.address_zip || ''}`}
                 target="_blank" rel="noopener noreferrer"
                 className="text-indigo-600 hover:underline flex items-center gap-1">
                {lead.address_city}, {lead.address_state}
                <span className="text-xs text-indigo-400">(Directions)</span>
              </a>
            </div>
          )}
          {lead.budget_max && (
            <div className="flex items-center gap-2 text-gray-600">
              <DollarSign size={16} className="text-gray-400" />
              ${lead.budget_min?.toLocaleString() || '0'} — ${lead.budget_max.toLocaleString()}
            </div>
          )}
          {lead.project_timeline && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} className="text-gray-400" />
              {lead.project_timeline}
            </div>
          )}
        </div>

        {lead.description && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
            <p className="font-medium text-gray-900 mb-1">Description</p>
            <p>{lead.description}</p>
          </div>
        )}
      </div>

      {/* Outreach */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Send size={18} className="text-indigo-500" /> Send Message
        </h2>
        <div className="space-y-3">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleContact}
            disabled={sending || !message}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending...' : `Send ${channel === 'email' ? 'Email' : 'SMS'}`}
          </button>
        </div>
      </div>
    </div>
  );
}