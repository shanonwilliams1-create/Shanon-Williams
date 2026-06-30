import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Briefcase } from 'lucide-react';
import { salesAPI } from '../api.js';

const BOT_BUBBLE  = 'max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-white text-gray-800 shadow-sm border border-gray-100';
const USER_BUBBLE = 'max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed bg-indigo-600 text-white ml-auto';

function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center px-4 py-3 bg-white rounded-2xl rounded-tl-sm w-fit shadow-sm border border-gray-100">
      {[0, 150, 300].map((d) => (
        <span key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

export default function SalesChatWidget({ open, onClose, plan }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [typing, setTyping]       = useState(false);
  const [done, setDone]           = useState(false);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  const addMsg = (role, text) =>
    setMessages((p) => [...p, { role, text, id: Date.now() + Math.random() }]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, done]);

  useEffect(() => {
    if (!open || sessionId) return;
    setLoading(true);
    setTyping(true);
    salesAPI.startSession(plan)
      .then(({ data }) => {
        setSessionId(data.session_id);
        setTimeout(() => { setTyping(false); addMsg('bot', data.message); setLoading(false); }, 600);
      })
      .catch(() => {
        setTyping(false);
        addMsg('bot', 'Something went wrong. Please try again later.');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || !sessionId || loading || done) return;
    setInput('');
    addMsg('user', text);
    setTyping(true);
    setLoading(true);
    try {
      const { data } = await salesAPI.sendMessage(sessionId, text);
      setTimeout(() => {
        setTyping(false);
        addMsg('bot', data.message);
        setLoading(false);
        if (data.done) setDone(true);
      }, 500);
    } catch {
      setTyping(false);
      addMsg('bot', 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const handleClose = () => {
    onClose();
    setMessages([]);
    setSessionId(null);
    setDone(false);
    setInput('');
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96
                    flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200 bg-white"
         style={{ maxHeight: '78vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-indigo-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <Briefcase size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">IntakeAI Sales</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-indigo-200">Let's get your firm set up</p>
            </div>
          </div>
        </div>
        <button onClick={handleClose}
                className="text-white/60 hover:text-white p-1 rounded-lg transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" style={{ minHeight: 220 }}>
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={m.role === 'bot' ? BOT_BUBBLE : USER_BUBBLE}
                 style={{ whiteSpace: 'pre-line' }}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && <div className="flex justify-start"><TypingDots /></div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {done ? (
        <div className="px-4 py-4 bg-white border-t border-gray-100 text-center">
          <p className="text-sm font-medium text-gray-700">
            ✅ We've got your info — our team will reach out shortly.
          </p>
        </div>
      ) : (
        <div className="flex items-end gap-2 px-3 py-3 bg-white border-t border-gray-100">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={loading || !sessionId}
            placeholder="Type your reply…"
            rows={1}
            className="flex-1 resize-none bg-gray-100 text-gray-900 text-sm placeholder-gray-400
                       rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       disabled:opacity-50"
            style={{ maxHeight: 100 }}
          />
          <button onClick={send}
                  disabled={!input.trim() || loading || !sessionId}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600
                             hover:bg-indigo-500 disabled:opacity-40 transition-colors flex-shrink-0">
            {loading
              ? <Loader2 size={16} className="text-white animate-spin" />
              : <Send size={15} className="text-white" />}
          </button>
        </div>
      )}
    </div>
  );
}
