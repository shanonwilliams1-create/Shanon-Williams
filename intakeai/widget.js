(function () {
  'use strict';

  const script = document.currentScript;
  if (!script) return;
  const BASE  = new URL(script.src).origin;
  const TOKEN = (script.dataset.token || '').trim();

  if (window.__intakeai) return;
  window.__intakeai = true;

  const SID_KEY  = 'iai_sid_'  + TOKEN;
  const DONE_KEY = 'iai_done_' + TOKEN;

  // ── Shadow DOM host ────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:0;right:0;z-index:2147483647;pointer-events:none';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  // ── Styles ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    :host{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px}

    .btn{
      position:fixed;bottom:24px;right:24px;width:56px;height:56px;
      border-radius:50%;background:#7c3aed;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 20px rgba(124,58,237,.45);
      transition:transform .18s,background .18s;pointer-events:all;
    }
    .btn:hover{background:#6d28d9;transform:scale(1.07)}
    .btn svg{width:26px;height:26px;fill:white}

    .badge{
      position:absolute;top:-3px;right:-3px;
      width:15px;height:15px;background:#ef4444;
      border-radius:50%;border:2.5px solid white;display:none;
    }
    .badge.on{display:block}

    .panel{
      position:fixed;bottom:92px;right:24px;width:370px;
      background:white;border-radius:20px;
      box-shadow:0 8px 48px rgba(0,0,0,.18);
      display:flex;flex-direction:column;overflow:hidden;
      max-height:0;opacity:0;
      transition:max-height .3s ease,opacity .25s ease,transform .25s ease;
      transform:translateY(12px) scale(.97);
      pointer-events:none;
    }
    .panel.open{
      max-height:560px;opacity:1;
      transform:translateY(0) scale(1);
      pointer-events:all;
    }

    .hdr{
      background:linear-gradient(135deg,#7c3aed,#6d28d9);
      padding:14px 16px;display:flex;align-items:center;
      justify-content:space-between;flex-shrink:0;
    }
    .hdr-left{display:flex;align-items:center;gap:10px}
    .avatar{
      width:36px;height:36px;border-radius:50%;
      background:rgba(255,255,255,.2);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .avatar svg{width:19px;height:19px;fill:white}
    .hdr-text p:first-child{color:white;font-size:13.5px;font-weight:700;line-height:1.2}
    .hdr-text p:last-child{color:rgba(255,255,255,.7);font-size:11px;margin-top:2px}
    .hdr-right{display:flex;align-items:center;gap:4px}
    .xbtn,.spkbtn{
      background:none;border:none;cursor:pointer;
      color:rgba(255,255,255,.75);padding:5px;border-radius:7px;
      display:flex;align-items:center;pointer-events:all;
    }
    .xbtn:hover,.spkbtn:hover{background:rgba(255,255,255,.15);color:white}
    .xbtn svg{width:17px;height:17px}
    .spkbtn svg{width:16px;height:16px}
    .spkbtn.muted{color:rgba(255,255,255,.35)}

    .msgs{
      flex:1;overflow-y:auto;padding:14px;
      display:flex;flex-direction:column;gap:9px;
      scroll-behavior:smooth;min-height:200px;
    }
    .msg{
      max-width:86%;padding:9px 13px;border-radius:16px;
      font-size:13.5px;line-height:1.5;word-break:break-word;
    }
    .msg.ai{
      background:#f3f4f6;color:#111827;
      align-self:flex-start;border-bottom-left-radius:4px;
    }
    .msg.user{
      background:#7c3aed;color:white;
      align-self:flex-end;border-bottom-right-radius:4px;
    }

    .typing{
      display:flex;gap:4px;align-self:flex-start;
      background:#f3f4f6;padding:11px 15px;
      border-radius:16px;border-bottom-left-radius:4px;
    }
    .typing span{
      width:6px;height:6px;background:#9ca3af;border-radius:50%;
      animation:bop .85s infinite;
    }
    .typing span:nth-child(2){animation-delay:.15s}
    .typing span:nth-child(3){animation-delay:.3s}
    @keyframes bop{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}

    .done-wrap{
      text-align:center;padding:28px 20px;
      display:flex;flex-direction:column;align-items:center;gap:10px;
    }
    .done-icon{
      width:52px;height:52px;border-radius:50%;
      background:#f0fdf4;display:flex;align-items:center;justify-content:center;
    }
    .done-icon svg{width:26px;height:26px}
    .done-wrap h3{font-size:15px;font-weight:700;color:#111827}
    .done-wrap p{font-size:13px;color:#6b7280;line-height:1.5}

    .irow{
      padding:10px 12px;border-top:1.5px solid #f3f4f6;
      display:flex;gap:8px;align-items:center;flex-shrink:0;
    }
    .irow input{
      flex:1;border:1.5px solid #e5e7eb;border-radius:24px;
      padding:8px 15px;font-size:13.5px;color:#111827;outline:none;
      background:white;font-family:inherit;transition:border-color .15s;
    }
    .irow input:focus{border-color:#7c3aed}
    .irow input::placeholder{color:#9ca3af}
    .irow input:disabled{opacity:.5;cursor:default}
    .sbtn{
      width:37px;height:37px;border-radius:50%;background:#7c3aed;
      border:none;cursor:pointer;display:flex;align-items:center;
      justify-content:center;flex-shrink:0;transition:background .15s;
    }
    .sbtn:hover{background:#6d28d9}
    .sbtn:disabled{background:#e5e7eb;cursor:default}
    .sbtn svg{width:15px;height:15px;fill:white}

    .mbtn{
      width:37px;height:37px;border-radius:50%;
      background:#f3f4f6;border:1.5px solid #e5e7eb;
      cursor:pointer;display:flex;align-items:center;
      justify-content:center;flex-shrink:0;
      transition:background .15s,border-color .15s;
    }
    .mbtn:hover{background:#ede9fe;border-color:#c4b5fd}
    .mbtn svg{width:15px;height:15px;stroke:#6b7280;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .mbtn.listening{background:#fef2f2;border-color:#fca5a5;animation:ripple .9s infinite}
    .mbtn.listening svg{stroke:#dc2626}
    .mbtn:disabled{opacity:.4;cursor:default}
    .mbtn.hidden{display:none}
    @keyframes ripple{
      0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.25)}
      50%{box-shadow:0 0 0 7px rgba(220,38,38,0)}
    }

    .listen-hint{
      font-size:11px;color:#9ca3af;text-align:center;
      padding:0 12px 6px;flex-shrink:0;display:none;
    }
    .listen-hint.on{display:block}

    .pw{text-align:center;padding:5px;font-size:10px;color:#d1d5db;flex-shrink:0}
    .pw a{color:#a78bfa;text-decoration:none}

    @media(max-width:480px){
      .panel{width:calc(100vw - 16px);right:8px;bottom:80px;max-height:none}
      .panel.open{max-height:72vh}
      .btn{bottom:16px;right:16px}
    }
  `;
  root.appendChild(style);

  // ── Markup ─────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="panel" id="P">
      <div class="hdr">
        <div class="hdr-left">
          <div class="avatar">
            <svg viewBox="0 0 24 24"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          </div>
          <div class="hdr-text">
            <p>Legal Intake Assistant</p>
            <p>Available 24/7 &mdash; replies instantly</p>
          </div>
        </div>
        <div class="hdr-right">
          <button class="spkbtn" id="SPK" aria-label="Toggle voice responses" title="Toggle voice responses">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path id="SPK_WAVE" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="xbtn" id="X" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="msgs" id="M"></div>
      <div class="listen-hint" id="LH">Listening&hellip; speak now</div>
      <div class="irow" id="IR">
        <button class="mbtn hidden" id="MC" aria-label="Voice input" title="Speak your message">
          <svg viewBox="0 0 24 24">
            <rect x="9" y="1" width="6" height="11" rx="3"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <input id="I" type="text" placeholder="Type or speak…" autocomplete="off" />
        <button class="sbtn" id="S" disabled>
          <svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
      <div class="pw"><a href="https://www.myintakeai.com" target="_blank" rel="noopener">Powered by IntakeAI</a></div>
    </div>

    <button class="btn" id="B" aria-label="Chat with a legal intake specialist">
      <div class="badge" id="BD"></div>
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
  `;
  root.appendChild(wrap);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const panel   = root.getElementById('P');
  const btn     = root.getElementById('B');
  const badge   = root.getElementById('BD');
  const msgs    = root.getElementById('M');
  const irow    = root.getElementById('IR');
  const inp     = root.getElementById('I');
  const sbtn    = root.getElementById('S');
  const micBtn  = root.getElementById('MC');
  const spkBtn  = root.getElementById('SPK');
  const spkWave = root.getElementById('SPK_WAVE');
  const listenHint = root.getElementById('LH');

  let sid      = sessionStorage.getItem(SID_KEY) || null;
  let isDone   = sessionStorage.getItem(DONE_KEY) === '1';
  let isOpen   = false;
  let busy     = false;
  let ttsOn    = true;
  let listening = false;

  // ── Voice: Speech Recognition ──────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SR) {
    micBtn.classList.remove('hidden');
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const transcript = (e.results[0][0].transcript || '').trim();
      if (transcript) {
        inp.value = transcript;
        send(transcript);
      }
    };

    recognition.onend = () => {
      listening = false;
      micBtn.classList.remove('listening');
      listenHint.classList.remove('on');
    };

    recognition.onerror = () => {
      listening = false;
      micBtn.classList.remove('listening');
      listenHint.classList.remove('on');
    };
  }

  function startListening() {
    if (!recognition || busy || isDone) return;
    if (listening) {
      recognition.stop();
      return;
    }
    listening = true;
    micBtn.classList.add('listening');
    listenHint.classList.add('on');
    inp.value = '';
    try { recognition.start(); } catch (_) { /* already started */ }
  }

  // ── Voice: Text-to-Speech ──────────────────────────────────────────────────
  function speak(text) {
    if (!ttsOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 0.92;
    utt.pitch = 1.05;
    // Prefer a female English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && /female|woman|samantha|victoria|karen|moira|fiona/i.test(v.name)
    ) || voices.find(v => v.lang.startsWith('en')) || null;
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  }

  function toggleTts() {
    ttsOn = !ttsOn;
    if (!ttsOn) {
      window.speechSynthesis && window.speechSynthesis.cancel();
      spkBtn.classList.add('muted');
      spkWave.style.display = 'none';
    } else {
      spkBtn.classList.remove('muted');
      spkWave.style.display = '';
    }
  }

  // ── Message helpers ────────────────────────────────────────────────────────
  function addMsg(text, role) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    if (role === 'ai') speak(text);
  }

  function showTyping() {
    if (root.getElementById('TY')) return;
    const el = document.createElement('div');
    el.className = 'typing'; el.id = 'TY';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    const el = root.getElementById('TY');
    if (el) el.remove();
  }

  function setBusy(val) {
    busy = val;
    inp.disabled = val;
    sbtn.disabled = val || !inp.value.trim();
    if (micBtn) micBtn.disabled = val;
  }

  function showDone() {
    irow.style.display = 'none';
    listenHint.classList.remove('on');
    const d = document.createElement('div');
    d.className = 'done-wrap';
    d.innerHTML = `
      <div class="done-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="m20 6-11 11-5-5"/></svg>
      </div>
      <h3>You're in good hands</h3>
      <p>Your information has been received. A member of the legal team will follow up with you shortly.</p>
    `;
    msgs.after(d);
    sessionStorage.setItem(DONE_KEY, '1');
    isDone = true;
  }

  // ── API ────────────────────────────────────────────────────────────────────
  async function startChat() {
    setBusy(true);
    showTyping();
    try {
      const r = await fetch(BASE + '/api/intake/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'widget', client_token: TOKEN }),
      });
      const d = await r.json();
      sid = d.session_id;
      sessionStorage.setItem(SID_KEY, sid);
      hideTyping();
      if (d.message) addMsg(d.message, 'ai');
    } catch {
      hideTyping();
      addMsg("I'm sorry, I'm having trouble connecting. Please call us directly or try again in a moment.", 'ai');
    } finally {
      setBusy(false);
    }
  }

  async function send(text) {
    if (!text.trim() || busy || isDone) return;
    if (listening && recognition) recognition.stop();
    addMsg(text, 'user');
    inp.value = '';
    sbtn.disabled = true;
    setBusy(true);
    showTyping();
    try {
      const r = await fetch(BASE + '/api/intake/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, message: text }),
      });
      const d = await r.json();
      hideTyping();
      if (d.message) addMsg(d.message, 'ai');
      if (d.done) showDone();
    } catch {
      hideTyping();
      addMsg("I'm sorry, something went wrong. Please call us directly.", 'ai');
    } finally {
      setBusy(false);
    }
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  async function open() {
    if (isOpen) return;
    isOpen = true;
    badge.classList.remove('on');
    panel.classList.add('open');
    setTimeout(() => inp.focus(), 300);

    if (isDone) {
      if (!msgs.children.length) {
        addMsg("Welcome back. A member of the legal team will be in touch with you soon.", 'ai');
        showDone();
      }
      return;
    }
    if (!sid) {
      await startChat();
    }
  }

  function close() {
    isOpen = false;
    panel.classList.remove('open');
    if (listening && recognition) recognition.stop();
    window.speechSynthesis && window.speechSynthesis.cancel();
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  btn.addEventListener('click', () => { host.style.pointerEvents = 'all'; isOpen ? close() : open(); });
  root.getElementById('X').addEventListener('click', close);
  spkBtn.addEventListener('click', toggleTts);
  micBtn.addEventListener('click', startListening);

  inp.addEventListener('input', () => { sbtn.disabled = !inp.value.trim() || busy; });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && inp.value.trim()) {
      e.preventDefault();
      send(inp.value.trim());
    }
  });
  sbtn.addEventListener('click', () => send(inp.value.trim()));

  // ── Instant engagement ─────────────────────────────────────────────────────
  // Open the moment the visitor touches or interacts with the page.
  if (!isDone) {
    badge.classList.add('on'); // badge visible immediately

    const engage = () => {
      if (!isOpen) {
        host.style.pointerEvents = 'all';
        open();
      }
      document.removeEventListener('touchstart', engage, { passive: true });
      document.removeEventListener('click', engage);
      document.removeEventListener('mousemove', engage);
    };

    document.addEventListener('touchstart', engage, { passive: true });
    document.addEventListener('click',      engage);
    document.addEventListener('mousemove',  engage);

    // Fallback: open automatically after 8 seconds if no interaction
    setTimeout(() => { if (!isOpen) { host.style.pointerEvents = 'all'; open(); } }, 8000);

    // Exit intent
    document.addEventListener('mouseleave', function onLeave(e) {
      if (e.clientY < 5 && !isOpen) {
        host.style.pointerEvents = 'all';
        open();
        document.removeEventListener('mouseleave', onLeave);
      }
    });
  }
})();
