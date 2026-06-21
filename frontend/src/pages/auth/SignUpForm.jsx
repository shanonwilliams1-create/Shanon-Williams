/**
 * SignUpForm — User registration
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function SignUpForm() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', trade: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.signup(form);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center font-bold text-white text-lg mx-auto mb-4">LF</div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-gray-400 mt-1">Start finding leads today</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Trade</label>
            <select value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white" >
              <option value="" className="text-gray-500">Select your trade</option>
              <option value="electrician" className="text-gray-900">Electrician</option>
              <option value="plumber" className="text-gray-900">Plumber</option>
              <option value="carpenter" className="text-gray-900">Carpenter</option>
              <option value="roofer" className="text-gray-900">Roofer</option>
              <option value="landscaper" className="text-gray-900">Landscaper</option>
              <option value="painter" className="text-gray-900">Painter</option>
              <option value="general" className="text-gray-900">General Contractor</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} className="w-full px-4 py-2.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <UserPlus size={16} />}
            Create Account
          </button>
          <div className="text-center text-sm text-gray-400">
            Already have an account? <Link to="/auth/login" className="text-indigo-400 hover:underline">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}