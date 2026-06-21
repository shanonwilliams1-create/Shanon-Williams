/**
 * CalendarView — Appointment management calendar
 */
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { appointmentsAPI } from '../../services/api';

export default function CalendarView() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ lead_id: '', start_time: '', end_time: '', notes: '' });

  useEffect(() => {
    appointmentsAPI.list().then(({ data }) => setAppointments(data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    try {
      await appointmentsAPI.create(form);
      setShowForm(false);
      setForm({ lead_id: '', start_time: '', end_time: '', notes: '' });
      const { data } = await appointmentsAPI.list();
      setAppointments(data);
    } catch (err) { alert('Failed to create appointment'); }
  };

  const statusColors = {
    scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
    confirmed: 'bg-green-100 text-green-800 border-green-300',
    completed: 'bg-gray-100 text-gray-800 border-gray-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and manage site visits</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> New Appointment
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Appointment</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Lead ID" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} className="w-full px-4 py-2.5 text-sm border rounded-lg" />
              <input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-4 py-2.5 text-sm border rounded-lg" />
              <input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-4 py-2.5 text-sm border rounded-lg" />
              <textarea placeholder="Notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 text-sm border rounded-lg" />
              <button onClick={handleCreate} className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No appointments</p>
          <p className="text-sm">Schedule your first appointment to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div key={apt.id} className={`bg-white rounded-xl border-2 p-4 ${statusColors[apt.status]?.split(' ').pop() || 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[apt.status] || 'bg-gray-100 text-gray-800'}`}>
                      {apt.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(apt.start_time).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {new Date(apt.start_time).toLocaleTimeString()} — {new Date(apt.end_time).toLocaleTimeString()}</span>
                  </div>
                  {apt.notes && <p className="text-sm text-gray-500 mt-2">{apt.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}