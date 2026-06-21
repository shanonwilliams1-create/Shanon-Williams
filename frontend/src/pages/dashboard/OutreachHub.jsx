/**
 * OutreachHub — Manage sent/scheduled messages to leads
 */
import React, { useState, useEffect } from 'react';
import { Send, Mail, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { outreachAPI } from '../../services/api';

const channelIcons = { email: Mail, sms: MessageSquare };
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  opened: 'bg-purple-100 text-purple-800',
  replied: 'bg-indigo-100 text-indigo-800',
};

export default function OutreachHub() {
  const [outreach, setOutreach] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    outreachAPI.list().then(({ data }) => setOutreach(data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Outreach</h1>
      <p className="text-sm text-gray-500 mb-6">Track messages sent to leads</p>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : outreach.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Send size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No outreach yet</p>
          <p className="text-sm">Messages you send to leads will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {outreach.map((msg) => {
            const Icon = channelIcons[msg.channel] || Send;
            return (
              <div key={msg.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 capitalize">{msg.channel}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[msg.status] || statusColors.pending}`}>
                        {msg.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{msg.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {msg.scheduled_at && <span className="flex items-center gap-1"><Clock size={12} /> Scheduled: {new Date(msg.scheduled_at).toLocaleString()}</span>}
                      {msg.sent_at && <span className="flex items-center gap-1"><CheckCircle size={12} /> Sent: {new Date(msg.sent_at).toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}