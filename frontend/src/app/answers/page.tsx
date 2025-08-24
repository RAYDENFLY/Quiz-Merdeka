"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Book, RefreshCcw } from 'lucide-react';

interface Q { question: string; choices: string[]; answer: number }

export default function AnswersPage() {
  const router = useRouter();
  const [data, setData] = useState<{questions: Q[]; answers: number[]}|null>(null);
  const [explanations, setExplanations] = useState<Record<number,string>>({});
  const [loadingIdx, setLoadingIdx] = useState<number|null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchedCount, setFetchedCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('quiz_review');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setData({ questions: parsed.questions || [], answers: parsed.answers || [] });
    } catch (e) {}
  }, []);

  // When data is loaded, automatically fetch explanations for all questions.
  useEffect(() => {
    if (!data || !data.questions || data.questions.length === 0) return;
    // start sequential fetching to avoid overwhelming AI endpoint
    let mounted = true;
    (async () => {
      setFetchingAll(true);
      setFetchedCount(0);
      for (let i = 0; i < data.questions.length; i++) {
        if (!mounted) break;
        try {
          // small delay between requests to be polite (100-300ms)
          // but keep short so UX feels snappy
          await fetchExplanation(i);
        } catch (e) {
          // ignore; fetchExplanation sets error text when it fails
        }
        setFetchedCount(prev => prev + 1);
      }
      if (mounted) setFetchingAll(false);
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return (
    <main className="min-h-screen flex items-center justify-center text-gray-900">
        <div className="text-center">
        <p className="mb-4">Tidak ada data quiz. Coba ikuti quiz terlebih dahulu.</p>
        <div className="space-x-2">
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-red-600 text-white rounded">Mulai Quiz</button>
        </div>
      </div>
    </main>
  );

  const fetchExplanation = async (idx:number) => {
    if (!data) return;
    if (explanations[idx]) return; // already fetched
    setLoadingIdx(idx);
    const q = data.questions[idx];
    const correctIndex = q.answer;
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "") : 'http://localhost:8001';
      const res = await fetch(`${base}/quiz/explain`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: q.question, choices: q.choices, correct_index: correctIndex }) });
      const j = await res.json();
      if (j && j.explanation) {
  setExplanations(prev => ({ ...prev, [idx]: j.explanation }));
      } else {
        setExplanations(prev => ({ ...prev, [idx]: 'Penjelasan tidak tersedia.' }));
      }
    } catch (e) {
      setExplanations(prev => ({ ...prev, [idx]: 'Gagal mengambil penjelasan.' }));
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 text-gray-900">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Ulas Jawaban</h1>
          <div className="space-x-2 text-sm text-gray-600">
            {fetchingAll ? (
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Mengambil penjelasan {fetchedCount}/{data ? data.questions.length : 0}</span>
              </div>
            ) : (
                <div className="inline-flex items-center gap-2">
                <button onClick={() => { sessionStorage.removeItem('quiz_review'); router.push('/') }} className="px-3 py-2 bg-red-600 text-white rounded">Ulangi Quiz</button>
                <button onClick={() => { setExplanations({}); setFetchedCount(0); setFetchingAll(true); /* refetch via effect by nudging data */ const d = data; setData(null); setTimeout(()=>setData(d),50); }} className="px-3 py-2 bg-gray-200 rounded flex items-center gap-2"><RefreshCcw /> Refresh</button>
              </div>
            )}
          </div>
        </div>

        {data.questions.map((q, idx) => {
          const userAns = data.answers[idx];
          const correct = Number(userAns) === Number(q.answer);
          return (
            <div key={idx} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{idx+1}. {q.question}</h3>
                  <div className="mt-3 space-y-2">
                    {q.choices.map((c, i) => (
                      <div key={i} className={`p-3 rounded ${i===q.answer ? 'bg-green-50 border border-green-200' : ''} ${i===userAns && i!==q.answer ? 'bg-red-50 border border-red-200' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-gray-800">{String.fromCharCode(65+i)}. {c}</div>
                          <div className="text-sm text-gray-900">{i===q.answer ? 'Benar' : (i===userAns ? 'Jawaban Anda' : '')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-2 rounded-full font-semibold ${correct ? 'bg-green-100 text-gray-900' : 'bg-red-100 text-gray-900'}`}>
                    {correct ? <CheckCircle className="mr-2" /> : <XCircle className="mr-2" />} {correct ? 'Benar' : 'Salah'}
                  </div>
                  <div className="mt-4">
                    <button onClick={() => fetchExplanation(idx)} className="px-3 py-2 mt-2 bg-blue-600 text-white rounded">Lihat Penjelasan</button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                {loadingIdx===idx ? <div className="text-sm text-gray-500">Mengambil penjelasan...</div> : (
                  explanations[idx] ? <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">{explanations[idx]}</div> : <div className="text-sm text-gray-700">Penjelasan sedang di muat mohon tunggu sebentar</div>
                )}
              </div>
            </div>
          )
        })}

      </div>
    </main>
  )
}
