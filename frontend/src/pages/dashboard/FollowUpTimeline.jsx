/**
 * FollowUpTimeline — Automated post-job follow-ups
 */
import React, { useState, useEffect } from 'react';
import { Clock, Send, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { followupsAPI } from '../../services/api';

export default function FollowUpTimeline() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => followupsAPI.list().then(({ data }) => setFollowups(data)).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { fetch(); }, []);

  const trigger = async (id) => {
    try {
      await followupsAPI.trigger(id);
      fetch();
    } catch (err) { alert('Failed to trigger follow-up'); }
  };

  const statusIcons = { pending: Clock, sent: CheckCircle, completed: CheckCircle, skipped: XCircle };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Follow-ups</h1>
      <p className="text-sm text-gray-500 mb-6">Automated follow-ups for completed jobs</p>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : followups.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Clock size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No follow-ups scheduled</p>
          <p className="text-sm">Follow-ups are auto-created when jobs are booked.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {followups.map((fu) => {
              const Icon = statusIcons[fu.status] || Clock;
              return (
                <div key={fu.id} className="relative flex items-start gap-4 pl-12">
                  <div className={`absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    fu.status === 'sent' || fu.status === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : fu.status === 'skipped' ? 'bg-gray-200 border-gray-300'
                      : 'bg-white border-gray-300'
                  }`}>
                    <Icon size={12} />
                  </div>
                  <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {fu.type}
                        </span>
                        <p className="text-sm text-gray-600 mt-2">{fu.content_template || 'No template'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {fu.scheduled_for ? `Scheduled: ${new Date(fu.scheduled_for).toLocaleDateString()}` : 'No schedule'}
                        </p>
                      </div>
                      {fu.status === 'pending' && (
                        <button onClick={() => trigger(fu.id)} className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">
                          <Send size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}