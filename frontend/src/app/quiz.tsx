"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flag, Clock, Star, RotateCcw, CheckCircle, XCircle, Book } from "lucide-react";

interface Question {
	question: string;
	choices: string[];
	answer: number;
}
interface Result {
	name: string;
	email: string;
	difficulty: string;
	score: number;
	totalQuestions: number;
	percentage: number;
	timeSpent: number;
}

export default function QuizPage() {
	const searchParams = useSearchParams();
	const [questions, setQuestions] = useState<Question[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
	const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds
	const [answers, setAnswers] = useState<number[]>([]);
	const [step, setStep] = useState(0);
		const [result, setResult] = useState<Result | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
		const [submitted, setSubmitted] = useState(false);
		const [submissionId, setSubmissionId] = useState<string | null>(null);
			const [explanations, setExplanations] = useState<Record<number,string>>({});
			const [loadingExps, setLoadingExps] = useState<Record<number, boolean>>({});
			const [fetchingAllExps, setFetchingAllExps] = useState(false);

	const name = (searchParams?.get("name") as string) || "";
	const email = (searchParams?.get("email") as string) || "";
	const difficulty = (searchParams?.get("difficulty") as string) || "Mudah";

	// fisher-yates shuffle (returns new array)
	function shuffleArray<T>(arr: T[]): T[] {
		const a = arr.slice();
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = a[i];
			a[i] = a[j];
			a[j] = tmp;
		}
		return a;
	}

	async function fetchQuestions() {
		setLoading(true);
		// Use env base or default to localhost:8001
		const envBase = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
		const base = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8001";
		// Ganti ke endpoint backend FastAPI
		const res = await fetch(`${base}/quiz/questions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, email, difficulty })
		});
		const data = await res.json();
		// backend may return { total_questions, time_minutes, questions }
		// normalize questions and shuffle choices per question so correct option isn't always first
		const qsRaw: Question[] = data.questions || [];
		const qs = qsRaw.map((q: Question) => {
			if (!q.choices || q.choices.length <= 1) return q;
			// keep original correct value
			const correctValue = q.choices[q.answer];
			const shuffled = shuffleArray(q.choices);
			const newIndex = shuffled.findIndex(c => c === correctValue);
			return { ...q, choices: shuffled, answer: newIndex };
		});
		setQuestions(qs);
		setAnswers(Array(qs.length).fill(-1));
		if (data.time_minutes) {
			setTimeMinutes(Number(data.time_minutes));
			setTimeLeft(Number(data.time_minutes) * 60);
		}
		setLoading(false);
	}

	useEffect(() => {
		fetchQuestions();
		// eslint-disable-next-line
	}, []);

	// Timer effect
	useEffect(() => {
		if (timeLeft === null) return;
		if (timeLeft <= 0) {
			// auto-submit when time over
			handleAutoSubmit();
			return;
		}
		const t = setInterval(() => setTimeLeft(v => (v !== null ? v - 1 : v)), 1000);
		return () => clearInterval(t);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [timeLeft]);

	const formatTime = (secs: number | null) => {
		if (secs === null) return "00:00";
		const m = Math.floor(secs / 60).toString().padStart(2, '0');
		const s = (secs % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	};

	const handleAutoSubmit = async () => {
		if (!questions) return;
		// compute score
		const correct = answers.filter((a, i) => Number(a) === Number(questions[i].answer)).length;
		const total = questions.length;
		const percent = Math.round((correct / total) * 100);
		// send aggregated result
		await submitResult(correct, total, percent, (timeMinutes ? (timeMinutes * 60 - (timeLeft || 0)) : 0));
	};

	const submitResult = async (scoreNum: number, totalNum: number, percentNum: number, timeSpentSec: number) => {
		const envBase = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
		const base = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8001";
		const payload = {
			name,
			email,
			question: "Quiz Kemerdekaan Indonesia",
			answer: scoreNum,
			age_group: timeMinutes && timeMinutes <= 5 ? "anak" : "remaja",
			totalQuestions: totalNum,
			percentage: percentNum,
			timeSpent: timeSpentSec,
			difficulty: difficulty,
		};
		const res = await fetch(`${base}/quiz/submit`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const data = await res.json();

		// Instead of navigating away, keep on page and show results.
		if (data && data.inserted_id) {
			setSubmissionId(data.inserted_id);
		}
		setResult({ name, email, difficulty, score: scoreNum, totalQuestions: totalNum, percentage: percentNum, timeSpent: timeSpentSec });
		setSubmitted(true);

		// persist review payload (already done before) — ensure present
		try { if (typeof window !== 'undefined') sessionStorage.setItem('quiz_review', JSON.stringify({ questions, answers, difficulty, name, email })); } catch(e) {}

		// start fetching explanations with limited concurrency
		(async () => {
			if (!questions) return;
			setFetchingAllExps(true);
			setExplanations({});
			const total = questions.length;
			let pointer = 0;
			const concurrency = 3;
			const workers = Array.from({ length: concurrency }).map(async () => {
				while (true) {
					const i = pointer;
					pointer += 1;
					if (i >= total) break;
					setLoadingExps(prev => ({ ...prev, [i]: true }));
					try {
						const q = questions[i];
						const res2 = await fetch(`${base}/quiz/explain`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: q.question, choices: q.choices, correct_index: q.answer }) });
						const j2 = await res2.json();
						if (j2 && j2.explanation) setExplanations(prev => ({ ...prev, [i]: j2.explanation }));
						else setExplanations(prev => ({ ...prev, [i]: 'Penjelasan tidak tersedia.' }));
					} catch (e) {
						setExplanations(prev => ({ ...prev, [i]: 'Gagal mengambil penjelasan.' }));
					} finally {
						setLoadingExps(prev => ({ ...prev, [i]: false }));
					}
				}
			});
			await Promise.all(workers);
			setFetchingAllExps(false);
		})();
	};

	function handleAnswer(val: number) {
		if (!questions) return;
		const newAns = [...answers];
		newAns[step] = val;
		setAnswers(newAns);
		if (step < questions.length - 1) setStep(step + 1);
	}

	async function handleSubmit() {
		if (!questions) return;
		const envBase = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
		const base = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8001";
		// Kirim jawaban ke backend FastAPI
		const res = await fetch(`${base}/quiz/submit`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name,
				email,
				question: questions[step].question,
				answer: answers[step],
				age_group: "remaja" // atau "anak" sesuai kebutuhan
			})
		});
		const data = await res.json();
		setResult(data);
	}

	if (loading)
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div
					role="status"
					aria-label="Memuat soal"
					className="w-12 h-12 border-4 border-red-700 border-t-transparent rounded-full animate-spin"
				/>
			</div>
		);
	if (!questions) return <div>Soal belum tersedia.</div>;
		// keep showing quiz; after submit `submitted` toggles to true and we show explanations

	const q = questions[step];
	const canSubmit = answers[step] !== -1;
	return (
		<main className="min-h-screen p-4 sm:p-6 md:p-10">
			<div className="max-w-3xl mx-auto space-y-8">
			{/* Navigation for question numbers */}
			<div className="flex flex-wrap gap-2">
				{questions.map((_, idx) => (
					<button key={idx} onClick={() => setStep(idx)} className={`w-8 h-8 rounded ${idx===step ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-800'} flex items-center justify-center`}>{idx+1}</button>
				))}
			</div>
				{/* Header Card */}
				<section className="bg-white rounded-2xl shadow-[0_10px_25px_-3px_rgba(254,205,205,0.4)] p-8 sm:p-10">
					<div className="flex justify-between items-center mb-3">
						<div className="flex items-center space-x-3">
							<div>
								<h1 className="text-[#9b2c2c] font-semibold text-base leading-5">
									Quiz Kemerdekaan
								</h1>
								<p className="text-[#c53030] text-sm leading-5">
									Tingkat: {difficulty}
								</p>
							</div>
						</div>
										<div className="flex items-center space-x-6 text-[#9b2c2c] font-semibold text-sm leading-5">
											<div className="flex items-center space-x-1">
												<Clock className="h-4 w-4" />
												<span>{formatTime(timeLeft)}</span>
											</div>
											<span>
												{step + 1}/{questions.length}
											</span>
										</div>
					</div>
					<div className="w-full bg-[#fed7d7] rounded-full h-3 overflow-hidden">
						<div
							className="bg-[#c53030] h-3 rounded-full"
							style={{ width: `${((step + 1) / questions.length) * 100}%` }}
						></div>
					</div>
					<p className="text-[#9b2c2c] text-xs text-center mt-2">
						Pertanyaan {step + 1} dari {questions.length}
					</p>
				</section>

				{/* Question Card */}
				<section className="bg-white rounded-2xl shadow-[0_10px_25px_-3px_rgba(254,205,205,0.4)] p-10 sm:p-12 flex flex-col">
					<h2 className="text-[#9b2c2c] font-bold text-2xl sm:text-3xl leading-8 mb-8">
						{q.question}
					</h2>
					<form className="space-y-6 flex-grow">
						{q.choices.map((opt, idx) => {
							// determine classes depending on submitted state
							let base = 'block border rounded-lg p-5 text-gray-800 text-lg sm:text-xl cursor-pointer transition-all';
							let dynamic = 'border border-[#fbb6b6] bg-white';
							if (!submitted) {
								if (answers[step] === idx) {
									dynamic = 'bg-[#ffe0e0] border-2 border-[#c53030] font-bold shadow-md';
								}
							} else {
								// after submit: highlight correct and wrong
								if (idx === q.answer) {
									dynamic = 'bg-green-100 border border-green-400 text-green-800';
								} else if (answers[step] === idx && answers[step] !== q.answer) {
									dynamic = 'bg-red-100 border border-red-400 text-red-800';
								} else {
									dynamic = 'bg-white border border-gray-200 text-gray-700';
								}
							}
							return (
								<label key={idx} className={`${base} ${dynamic}`}>
									<input
										type="radio"
										name={`answer-${step}`}
										className="hidden"
										checked={answers[step] === idx}
										onChange={() => { if (!submitted) handleAnswer(idx); }}
										disabled={submitted}
									/>
									<div className="flex items-center justify-between">
										<div className="text-gray-800">{String.fromCharCode(65+idx)}. {opt}</div>
										<div className="text-sm text-gray-500">{submitted ? (idx===q.answer ? 'Kunci' : (idx===answers[step] ? 'Jawaban Anda' : '')) : (idx===answers[step] ? 'Jawaban Anda' : '')}</div>
									</div>
								</label>
							)
						})}
					</form>
					{/* After submit show correctness and explanation for this question */}
					{submitted && (
						<div className="mt-6 bg-gray-50 p-4 rounded">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									{Number(answers[step]) === Number(q.answer) ? <CheckCircle className="text-green-600" /> : <XCircle className="text-red-600" />}
									<span className="text-black font-semibold">{Number(answers[step]) === Number(q.answer) ? 'Benar' : 'Salah'}</span>
								</div>
								<div className="text-sm text-gray-500">Kunci: {String.fromCharCode(65+q.answer)}</div>
							</div>
							<div className="mt-3">
								{loadingExps[step] ? (
									<div className="text-sm text-gray-500">Mengambil penjelasan...</div>
								) : (
									<div className="text-sm text-gray-700">{explanations[step] || 'Penjelasan belum tersedia.'}</div>
								)}
							</div>
						</div>
					)}
					<div className="flex justify-between items-center mt-6 text-[#9b2c2c] text-sm font-normal">
						<div className="flex items-center space-x-1">
							<Star className="h-4 w-4" />
							<span>
								Skor: {answers.filter((a, i) => Number(a) === Number(questions[i].answer)).length}/{questions.length}
							</span>
						</div>
						{!submitted ? (
							<button
								type="button"
								className={`font-bold text-lg rounded-lg px-8 py-3 flex items-center space-x-2 transition-colors ${canSubmit && !isSubmitting ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
								onClick={async () => {
									if (!canSubmit || isSubmitting) return;
									setIsSubmitting(true);
									// persist current quiz and answers to sessionStorage so result review page can show details
									try {
										if (typeof window !== 'undefined') {
											const payloadForReview = { questions, answers, difficulty, name, email };
											sessionStorage.setItem('quiz_review', JSON.stringify(payloadForReview));
										}
									} catch (e) {}
									const correct = answers.filter((a, i) => Number(a) === Number(questions[i].answer)).length;
									const total = questions.length;
									const percent = Math.round((correct / total) * 100);
									const timeSpentSec = timeMinutes ? (timeMinutes * 60 - (timeLeft || 0)) : 0;
									await submitResult(correct, total, percent, timeSpentSec);
									setIsSubmitting(false);
								}}
								disabled={!canSubmit || isSubmitting}
								>
								{isSubmitting ? (
									<>
										<span className="sr-only">Mengirim...</span>
										<RotateCcw className={`h-5 w-5 text-white animate-spin`} />
									</>
								) : (
									<>
										<span>Kirim Jawaban</span>
										<RotateCcw className={`h-5 w-5 text-white`} />
									</>
								)}
							</button>
						) : (
							<button onClick={() => {
								if (submissionId) {
									window.location.href = `/result?id=${encodeURIComponent(submissionId)}`;
								} else {
									// fallback to result with query
									window.location.href = `/result?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
								}
							}} className="font-bold text-lg rounded-lg px-8 py-3 bg-red-600 text-white">Hasil</button>
						)}
					</div>
				</section>
			</div>
		</main>
	);
}
