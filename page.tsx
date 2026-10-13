'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Message = { id: string; role: 'user' | 'assistant'; text: string };
type GeminiHistory = { role: 'user' | 'model'; text: string };
const CHAT_KEY = 'degeloki-chat-v1';
const MEMORY_KEY = 'degeloki-memories-v1';

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    try {
      const savedChat = localStorage.getItem(CHAT_KEY);
      const savedMemories = localStorage.getItem(MEMORY_KEY);
      if (savedChat) setMessages(JSON.parse(savedChat));
      if (savedMemories) setMemories(JSON.parse(savedMemories));
    } catch { /* armazenamento local indisponível */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-60)));
  }, [messages, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
  }, [memories, ready]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  function speak(text: string) {
    if (!voiceOn || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /pt-BR/i.test(v.lang) && /female|feminina|Google português/i.test(v.name))
      || voices.find(v => /pt-BR/i.test(v.lang));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.04;
    utterance.pitch = 1.08;
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput('');
    const nextMessages = [...messages, { id: makeId(), role: 'user' as const, text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const history: GeminiHistory[] = messages.slice(-16).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text }));
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, memories })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível responder.');
      const reply = String(data.answer || '').trim();
      setMessages(current => [...current, { id: makeId(), role: 'assistant', text: reply }]);
      speak(reply);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Algo deu errado.';
      setMessages(current => [...current, { id: makeId(), role: 'assistant', text: `Aff... tive um problema: ${message}` }]);
    } finally { setLoading(false); }
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(current => [...current, { id: makeId(), role: 'assistant', text: 'Seu navegador não oferece reconhecimento de voz. Tente pelo Chrome.' }]);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => { const result = event.results?.[0]?.[0]?.transcript; if (result) setInput(result); };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition; setListening(true); recognition.start();
  }

  function newChat() {
    if (loading) return;
    setMessages([]); localStorage.removeItem(CHAT_KEY); window.speechSynthesis?.cancel();
  }

  function saveMemory(e: FormEvent) {
    e.preventDefault(); const value = memoryDraft.trim();
    if (!value) return;
    setMemories(current => [...current, value].slice(-30)); setMemoryDraft('');
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <section className="chat-frame">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark">D<span>.</span></div>
            <div><div className="brand-name">DEGELOKI</div><div className="brand-status"><i/> ONLINE · GEMINI</div></div>
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setMemoryOpen(true)} aria-label="Memórias" title="Memórias">✦</button>
            <button className="icon-button" onClick={() => setVoiceOn(v => !v)} aria-label="Ativar ou desativar voz" title={voiceOn ? 'Desativar voz' : 'Ativar voz'}>{voiceOn ? '♫' : '♩'}</button>
            <button className="icon-button" onClick={newChat} aria-label="Nova conversa" title="Nova conversa">＋</button>
          </div>
        </header>

        <div className="chat-content">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="orb"><span> D </span><b/></div>
              <div className="eyebrow">NÃO CONFUNDA MINHA PACIÊNCIA COM DISPONIBILIDADE</div>
              <h1>Até que enfim.<br/><em>Alguém interessante?</em></h1>
              <p>Sou a DEGELOKI. Pergunte alguma coisa. Só não espere aplausos por perguntas óbvias. 🙄</p>
              <div className="suggestions">
                {['Me conta uma curiosidade', 'Me ajuda com uma ideia', 'O que você sabe fazer?'].map(s => <button key={s} onClick={() => sendMessage(s)}>{s}<span>↗</span></button>)}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map(message => <div key={message.id} className={`message-row ${message.role}`}>
                {message.role === 'assistant' && <div className="mini-mark">D</div>}
                <div className="bubble"><div className="message-label">{message.role === 'assistant' ? 'DEGELOKI' : 'VOCÊ'}</div><div className="message-text">{message.text}</div>
                  {message.role === 'assistant' && <button className="speak-again" onClick={() => speak(message.text)}>♫ ouvir</button>}
                </div>
              </div>)}
              {loading && <div className="message-row assistant"><div className="mini-mark">D</div><div className="bubble typing"><span/><span/><span/></div></div>}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        <footer className="composer-area">
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <button type="button" className={`mic-button ${listening ? 'active' : ''}`} onClick={startListening} aria-label="Falar">{listening ? '●' : '♩'}</button>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Manda logo..." aria-label="Mensagem" maxLength={5000}/>
            <button type="submit" className="send-button" disabled={!input.trim() || loading} aria-label="Enviar">↗</button>
          </form>
          <div className="footer-note">A DEGELOKI pode errar. Até ela sabe disso.</div>
        </footer>
      </section>

      {memoryOpen && <div className="modal-backdrop" onClick={() => setMemoryOpen(false)}><section className="memory-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-heading"><div><div className="eyebrow">MEMÓRIA LOCAL</div><h2>O que devo lembrar?</h2></div><button className="close-button" onClick={() => setMemoryOpen(false)}>×</button></div>
        <p>Adicione informações que a DEGELOKI pode usar em conversas futuras neste mesmo navegador. Você controla e pode apagar tudo.</p>
        <form className="memory-form" onSubmit={saveMemory}><input value={memoryDraft} onChange={e => setMemoryDraft(e.target.value)} placeholder="Ex.: estou aprendendo programação" maxLength={300}/><button disabled={!memoryDraft.trim()}>Salvar</button></form>
        <div className="memory-list">{memories.length ? memories.map((memory, i) => <div className="memory-item" key={`${memory}-${i}`}><span>{memory}</span><button onClick={() => setMemories(current => current.filter((_, index) => index !== i))}>Remover</button></div>) : <div className="empty-memory">Nenhuma memória salva por enquanto.</div>}</div>
        {memories.length > 0 && <button className="clear-memory" onClick={() => setMemories([])}>Apagar todas as memórias</button>}
      </section></div>}
    </main>
  );
}
