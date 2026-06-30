import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Scale, ChevronRight } from 'lucide-react';
import { intakeAPI } from '../api.js';

const BOT_BUBBLE  = 'max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-white text-gray-800 shadow-sm border border-gray-100';
const USER_BUBBLE = 'max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed bg-violet-600 text-white ml-auto';

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

export default function IntakeChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [typing, setTyping]     = useState(false);
  const [done, setDone]         = useState(false);
  const [started, setStarted]   = useState(false);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);
  useEffect(() => { if (open && !done) inputRef.current?.focus(); }, [open, done]);

  const addMsg = (role, text) =>
    setMessages((p) => [...p, { role, text, id: Date.now() + Math.random() }]);

  const startChat = async () => {
    if (started) return;
    setStarted(true);
    setLoading(true);
    try {
      const { data } = await intakeAPI.startSession();
      setSessionId(data.session_id);
      setTimeout(() => { setTyping(false); addMsg('bot', data.message); setLoading(false); }, 700);
      setTyping(true);
    } catch {
      addMsg('bot', 'Something went wrong. Please try again later.');
      setLoading(false);
    }
  };

  const handleOpen = () => { setOpen(true); if (!started) startChat(); };

  const send = async () => {
    const text = input.trim();
    if (!text || !sessionId || loading || done) return;
    setInput('');
    addMsg('user', text);
    setTyping(true);
    setLoading(true);
    try {
      const { data } = await intakeAPI.sendMessage(sessionId, text);
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

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96
                        flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200 bg-white"
             style={{ maxHeight: '78vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-violet-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Scale size={17} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">Legal Intake</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-xs text-violet-200">Online — typically replies instantly</p>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
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
                ✅ We received your information — an attorney will be in touch shortly.
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
                           rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500
                           disabled:opacity-50"
                style={{ maxHeight: 100 }}
              />
              <button onClick={send}
                      disabled={!input.trim() || loading || !sessionId}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-600
                                 hover:bg-violet-500 disabled:opacity-40 transition-colors flex-shrink-0">
                {loading
                  ? <Loader2 size={16} className="text-white animate-spin" />
                  : <Send size={15} className="text-white" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="fixed bottom-5 right-5 sm:right-7 z-50 flex items-center gap-2.5
                   px-5 py-3.5 rounded-full bg-violet-600 hover:bg-violet-500
                   shadow-lg hover:shadow-violet-300 transition-all"
        aria-label="Chat with us"
      >
        {open
          ? <X size={20} className="text-white" />
          : <>
              <MessageCircle size={20} className="text-white" />
              <span className="text-sm font-semibold text-white">Free Case Review</span>
              {!started && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
              )}
            </>
        }
      </button>
    </>
  );
}
