"use client";
import React, { useEffect, useRef, useState } from 'react';
import { User, Bot, Send } from 'lucide-react';

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_chat') : null;
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    try { sessionStorage.setItem('quiz_chat', JSON.stringify(messages)); } catch (e) {}
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const friendlyFallback = 'Maaf, saat ini jawabannya belum tersedia. Coba lagi beberapa saat atau tanyakan hal lain.';

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, '') : 'http://localhost:8001';
      const res = await fetch(`${base}/chat`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: userMsg.text }) });
      if (!res.ok) {
        setToast('Server mengembalikan error. Coba lagi nanti.');
        setMessages(prev => [...prev, { role: 'assistant', text: friendlyFallback }]);
        return;
      }
      let j: any = null;
      try { j = await res.json(); } catch (e) { /* ignore */ }
      const answer = j && j.answer ? j.answer : friendlyFallback;
      setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (e) {
      setToast('Gagal menghubungi server. Pastikan backend berjalan.');
      setMessages(prev => [...prev, { role: 'assistant', text: friendlyFallback }]);
    } finally {
      setLoading(false);
    }
  }

  const clear = () => {
    setMessages([]);
    try { sessionStorage.removeItem('quiz_chat'); } catch (e) {}
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 flex flex-col h-[80vh]">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-xl text-red-700 font-bold">Tanya Seputar Sejarah Indonesia</h1>
          <div className="flex items-center gap-2">
            <button onClick={clear} className="text-sm px-3 text-white py-1 bg-red-500 rounded">Bersihkan</button>
          </div>
        </header>

        {toast && (
          <div className="fixed right-6 top-6 z-50">
            <div className="bg-red-600 text-white px-4 py-2 rounded shadow">{toast}</div>
          </div>
        )}

        <div ref={listRef} className="flex-1 overflow-auto space-y-4 p-2" style={{overscrollBehavior:'contain'}}>
          {messages.length === 0 && (
            <div className="text-center text-gray-500">Tanya apa saja tentang sejarah Indonesia, mis. "Siapa proklamator kemerdekaan?"</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex items-start gap-3 max-w-[85%] ${m.role==='user' ? 'ml-auto justify-end' : 'mr-auto'}`}>
              <div className="flex-shrink-0">
                {m.role === 'assistant' ? (
                  <Bot className="w-9 h-9 text-gray-700" />
                ) : (
                  <User className="w-9 h-9 text-red-600" />
                )}
              </div>
              <div className={`${m.role==='user' ? 'bg-red-600 text-white ml-2 rounded-lg px-4 py-2' : 'bg-gray-100 text-gray-900 rounded-lg px-4 py-2'}`}>
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3 mr-auto">
              <Bot className="w-9 h-9 text-gray-700" />
              <div className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 inline-flex items-center">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce inline-block" style={{animationDelay: '0s'}} />
                  <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce inline-block" style={{animationDelay: '0.12s'}} />
                  <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce inline-block" style={{animationDelay: '0.24s'}} />
                </div>
                <span className="ml-3 text-sm">Mengetik...</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') send(); }} placeholder="Tulis pertanyaan..." className="flex-1 border rounded px-3 py-2" />
          <button onClick={send} disabled={loading} className={`px-4 py-2 ${loading ? 'bg-red-300' : 'bg-red-600'} text-white rounded flex items-center gap-2`}>
            <Send className="w-4 h-4" />
            <span>{loading ? 'Mengirim...' : 'Kirim'}</span>
          </button>
        </div>
      </div>
    </main>
  )
}
