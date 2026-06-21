/**
 * ReviewManagement — Request and track Google reviews
 */
import React, { useState, useEffect } from 'react';
import { Star, ExternalLink, RefreshCw } from 'lucide-react';
import { reviewsAPI } from '../../services/api';

export default function ReviewManagement() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadId, setLeadId] = useState('');

  const fetch = () => reviewsAPI.list().then(({ data }) => setReviews(data)).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { fetch(); }, []);

  const requestReview = async () => {
    if (!leadId) return;
    try {
      await reviewsAPI.request(leadId);
      setLeadId('');
      fetch();
    } catch (err) { alert('Failed to request review'); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reviews</h1>
      <p className="text-sm text-gray-500 mb-6">Request Google reviews from completed jobs</p>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3">
        <input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="Lead ID to request review..." className="flex-1 px-4 py-2.5 text-sm border rounded-lg" />
        <button onClick={requestReview} disabled={!leadId} className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
          <Star size={16} /> Request Review
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Star size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No reviews yet</p>
          <p className="text-sm">Request reviews from satisfied customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((rv) => (
            <div key={rv.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rv.status === 'published' ? 'bg-green-100 text-green-800' : rv.status === 'declined' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>{rv.status}</span>
                  {rv.rating && <div className="flex items-center gap-1 mt-2">{Array.from({ length: rv.rating }, (_, i) => <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />)}</div>}
                  {rv.review_url && <a href={rv.review_url} target="_blank" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline mt-2"><ExternalLink size={14} /> View Review</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}