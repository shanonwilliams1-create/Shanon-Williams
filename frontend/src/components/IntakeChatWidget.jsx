/**
 * IntakeChatWidget — Floating chat widget for client intake
 *
 * Collects: name → case type → description → urgency → phone → email
 * then POSTs each message to /api/intake/chat/message.
 * When the session completes, the backend scores and notifies the attorney.
 */
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Loader2, Scale } from 'lucide-react';
import { intakeAPI } from '../services/api';

const BUBBLE_BASE = 'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed';
const BOT_BUBBLE  = `${BUBBLE_BASE} bg-slate-800 text-white rounded-tl-sm`;
const USER_BUBBLE = `${BUBBLE_BASE} bg-indigo-600 text-white rounded-tr-sm ml-auto`;

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-end px-4 py-3 bg-slate-800 rounded-2xl rounded-tl-sm w-fit">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export default function IntakeChatWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [typing, setTyping]       = useState(false);
  const [done, setDone]           = useState(false);
  const [started, setStarted]     = useState(false);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Focus input when opened
  useEffect(() => {
    if (open && !done) inputRef.current?.focus();
  }, [open, done]);

  const addMessage = (role, text) => {
    setMessages((prev) => [...prev, { role, text, id: Date.now() + Math.random() }]);
  };

  const startChat = async () => {
    if (started) return;
    setStarted(true);
    setLoading(true);
    try {
      const { data } = await intakeAPI.startSession();
      setSessionId(data.session_id);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addMessage('bot', data.message);
        setLoading(false);
      }, 600);
    } catch {
      addMessage('bot', 'Sorry, something went wrong. Please call us directly.');
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!started) startChat();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !sessionId || loading || done) return;

    setInput('');
    addMessage('user', text);
    setTyping(true);
    setLoading(true);

    try {
      const { data } = await intakeAPI.sendMessage(sessionId, text);
      setTimeout(() => {
        setTyping(false);
        addMessage('bot', data.message);
        setLoading(false);
        if (data.done) setDone(true);
      }, 500);
    } catch {
      setTyping(false);
      addMessage('bot', 'Something went wrong. Please try again or call us directly.');
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-700"
             style={{ maxHeight: '75vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                <Scale size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Legal Intake</p>
                <p className="text-xs text-slate-400 mt-0.5">We typically reply in minutes</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/95"
               style={{ minHeight: '200px' }}>
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={m.role === 'bot' ? BOT_BUBBLE : USER_BUBBLE}
                     style={{ whiteSpace: 'pre-line' }}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {done ? (
            <div className="px-4 py-3 bg-slate-800 text-center">
              <p className="text-sm text-slate-300">
                ✅ Intake complete — an attorney will be in touch soon.
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2 px-3 py-3 bg-slate-800 border-t border-slate-700">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading || !sessionId}
                placeholder="Type your reply…"
                rows={1}
                className="flex-1 resize-none bg-slate-700 text-white text-sm placeholder-slate-500
                           border border-slate-600 rounded-xl px-3 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           disabled:opacity-50 leading-relaxed"
                style={{ maxHeight: '100px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || !sessionId}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600
                           hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors flex-shrink-0"
              >
                {loading
                  ? <Loader2 size={16} className="text-white animate-spin" />
                  : <Send size={16} className="text-white" />
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="fixed bottom-4 right-4 sm:right-6 z-50
                   w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500
                   shadow-lg hover:shadow-xl transition-all
                   flex items-center justify-center"
        aria-label="Open intake chat"
      >
        {open
          ? <X size={22} className="text-white" />
          : <MessageSquare size={22} className="text-white" />
        }
        {/* Unread dot — show before first open */}
        {!open && !started && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  );
}
