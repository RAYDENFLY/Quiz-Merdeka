"use client";
import React, { useState, useEffect } from 'react';
import { Trophy, Star, Mail, Share2, Award, Flag, Clock, Target, Users, ShieldCheck, Handshake, Globe2, Dumbbell, Flame, CheckCircle } from 'lucide-react';
import { useRouter } from "next/navigation";

const getBadge = (percentage: number) => {
	if (percentage >= 90) return { level: 'Sang Proklamator', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '🏆', desc: 'Melambangkan pemimpin dan pencetus kemerdekaan, level tertinggi' };
	if (percentage >= 80) return { level: 'Penjaga Negeri', color: 'text-red-600 bg-red-50 border-red-200', icon: '🥇', desc: 'Melambangkan mereka yang menjaga dan mempertahankan tanah air' };
	if (percentage >= 70) return { level: 'Pembela Rakyat', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🥈', desc: 'Tetap gigih, berjuang untuk rakyat' };
	if (percentage >= 60) return { level: 'Putra/Putri Nusantara', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: '🥉', desc: 'Identitas kebangsaan, semangat belajar terus' };
	if (percentage >= 50) return { level: 'Semangat Merdeka', color: 'text-green-600 bg-green-50 border-green-200', icon: '📚', desc: 'Masih butuh belajar, tapi punya semangat juang' };
	return { level: 'Api Perjuangan', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: '🔥', desc: 'Skor rendah, api kecil yang harus dipupuk agar jadi besar' };
};

const defaultFunFacts = [
	'Bendera Merah Putih yang dikibarkan saat proklamasi dijahit sendiri oleh Fatmawati, istri Bung Karno, dari kain sprei!',
	'Teks proklamasi asli ditulis tangan oleh Sayuti Melik menggunakan pensil di rumah Laksamana Maeda!',
	'Kata "Indonesia" berasal dari bahasa Yunani "Indos" (India) dan "nesos" (pulau) yang berarti kepulauan India.',
	'Lagu "Indonesia Raya" pertama kali dimainkan saat Kongres Pemuda II pada 28 Oktober 1928!',
];


const ResultsScreen: React.FC = () => {
	const router = useRouter();

	// Hydration-safe state: initialize with server-friendly defaults and populate from URL on mount
	const [name, setName] = useState<string>("User");
	const [email, setEmail] = useState<string>("cerdasmerdeka@mailsry.web.id");
	const [score, setScore] = useState<number>(0);
	const [totalQuestions, setTotalQuestions] = useState<number>(3);
	const [percentage, setPercentage] = useState<number>(0);
	const [timeSpent, setTimeSpent] = useState<number>(0);
	const [difficulty, setDifficulty] = useState<string>("Hard");
	// loading state while authoritative result is fetched
	const [isLoadingResult, setIsLoadingResult] = useState<boolean>(true);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const sp = new URLSearchParams(window.location.search);
		const id = sp.get("id");
		if (id) {
			setIsLoadingResult(true);
			// fetch authoritative result from backend
			const base = process.env.NEXT_PUBLIC_API_BASE ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "") : "http://localhost:8001";
			fetch(`${base}/quiz/submission/${encodeURIComponent(id)}`)
				.then(res => res.json())
				.then((doc) => {
					if (doc && doc.id) {
						setName(doc.name || "User");
						setEmail(doc.email || "user@email.com");
						setScore(Number(doc.score || 0));
						setTotalQuestions(Number(doc.totalQuestions || 3));
						setPercentage(Number(doc.percentage || 0));
						setTimeSpent(Number(doc.timeSpent || 0));
						setDifficulty(doc.difficulty || "Unknown");
					}
				})
				.catch(() => {
					// fallback to URL params if fetch failed
					const s = sp.get("score");
					const tq = sp.get("totalQuestions");
					const p = sp.get("percentage");
					const ts = sp.get("timeSpent");
					const nm = sp.get("name");
					const em = sp.get("email");
					const diff = sp.get("difficulty");
					if (s) setScore(Number(s));
					if (tq) setTotalQuestions(Number(tq));
					if (p) setPercentage(Number(p));
					if (ts) setTimeSpent(Number(ts));
					if (nm) setName(nm);
					if (em) setEmail(em);
					if (diff) setDifficulty(diff);
				})
				.finally(() => setIsLoadingResult(false));
			return;
		}

		// no id present -> use legacy params (less secure)
		const s = sp.get("score");
		const tq = sp.get("totalQuestions");
		const p = sp.get("percentage");
		const ts = sp.get("timeSpent");
		const nm = sp.get("name");
		const em = sp.get("email");
		const diff = sp.get("difficulty");
		if (s) setScore(Number(s));
		if (tq) setTotalQuestions(Number(tq));
		if (p) setPercentage(Number(p));
		if (ts) setTimeSpent(Number(ts));
		if (nm) setName(nm);
		if (em) setEmail(em);
		if (diff) setDifficulty(diff);
		setIsLoadingResult(false);
	}, []);

	const [emailSent, setEmailSent] = useState(false);
	const [isLoadingEmail, setIsLoadingEmail] = useState(false);
	const [funFacts, setFunFacts] = useState<string[]>(defaultFunFacts);

	useEffect(() => {
		// Ambil fakta menarik dari backend jika tersedia
		const base = process.env.NEXT_PUBLIC_API_BASE ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "") : "http://localhost:8001";
		fetch(`${base}/quiz/fakta`)
			.then(res => res.json())
			.then(data => {
				// prepend to existing facts (don't clobber any client-side state)
				if (data.fakta) setFunFacts(prev => [data.fakta, ...prev]);
			})
			.catch(() => {});
	}, []);

	// Note: AI fact is fetched automatically on mount (see useEffect) — manual button removed

	const badge = getBadge(percentage);

	const getMotivationalMessage = () => {
		if (percentage >= 90) return "Luar biasa! Anda benar-benar memahami sejarah kemerdekaan Indonesia! 🇮🇩";
		if (percentage >= 80) return "Hebat! Pengetahuan Anda tentang kemerdekaan Indonesia sangat baik!";
		if (percentage >= 70) return "Bagus! Anda memiliki pemahaman yang solid tentang sejarah kemerdekaan!";
		if (percentage >= 60) return "Tidak buruk! Terus belajar dan tingkatkan pengetahuan sejarah Anda!";
		return "Jangan menyerah! Sejarah kemerdekaan Indonesia sangat menarik untuk dipelajari!";
	};

	const handleSendEmail = async () => {
		setIsLoadingEmail(true);
		const base = process.env.NEXT_PUBLIC_API_BASE ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "") : "http://localhost:8001";
		try {
			const res = await fetch(`${base}/quiz/email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, score, totalQuestions, percentage, badge: badge.level })
			});
			if (!res.ok) throw new Error('send failed');
			setEmailSent(true);
		} catch (e) {
			alert('Gagal mengirim email. Coba lagi nanti.');
		} finally {
			setIsLoadingEmail(false);
		}
	};

	const handleShare = () => {
		const shareText = `Saya baru saja menyelesaikan Quiz Kemerdekaan Indonesia dan mendapat skor ${score}/${totalQuestions} (${percentage}%)! Dapatkan badge "${badge.level}" ${badge.icon}`;
		if (navigator.share) {
			navigator.share({
				title: 'Quiz Kemerdekaan Indonesia',
				text: shareText,
				url: window.location.href
			});
		} else {
			navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
			alert('Link berhasil disalin ke clipboard!');
		}
	};

	return (
		<main className="container mx-auto px-4 py-10">
			<div className="max-w-5xl mx-auto space-y-8 relative">
				{isLoadingResult && (
					<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
						<div className="text-center">
							<div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent mx-auto mb-4" aria-hidden="true"></div>
							<div className="text-sm font-medium text-red-700">Memuat data pengguna...</div>
						</div>
					</div>
				)}
				<div className={isLoadingResult ? 'blur-sm pointer-events-none' : ''}>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
					{/* Results Header - Modern Redesign */}
					<div className="bg-white rounded-2xl shadow-lg p-8 text-center relative overflow-hidden">
				{/* Trophy Icon */}
				<Trophy className="mx-auto mb-6 h-28 w-28 text-yellow-500 drop-shadow-sm" aria-hidden="true" />
				<h1 className="text-4xl font-extrabold text-red-700 mb-4 tracking-wide">Quiz Selesai!</h1>
				<p className="text-lg text-red-600 mb-8 px-4">
					Selamat <span className="font-semibold text-red-800">{name}</span>, Anda telah menyelesaikan Quiz Kemerdekaan Indonesia!
				</p>
				<div className="inline-flex items-baseline justify-center space-x-2 mb-4">
					<span className="text-7xl font-extrabold text-red-700 drop-shadow-lg">{percentage}%</span>
					<span className="text-xl font-semibold text-red-500">Benar</span>
				</div>
				<p className="text-red-500 font-medium text-lg">
					{score} dari {totalQuestions} jawaban benar
				</p>
				<div className="mt-10 flex justify-center space-x-6">
					<button
						onClick={() => router.push('/quiz')}
						className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-full shadow-lg transition duration-300"
					>
						<Flag className="text-xl" />
						<span>Ulangi Quiz</span>
					</button>
					<button
						onClick={() => router.push('/')}
						className="flex items-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 px-6 rounded-full shadow-inner transition duration-300"
					>
						<Star className="text-xl" />
						<span>Beranda</span>
					</button>
				</div>
					</div>

					{/* Card Badge Dinamis sesuai Nilai */}
					<div className="bg-white rounded-2xl shadow-lg p-8 w-full flex flex-col items-center">
				<h2 className="text-2xl font-bold text-red-800 mb-6 text-center">Badge Kemerdekaan</h2>
				<div
					className={`inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-6
						${percentage >= 90 ? 'bg-yellow-100 border-yellow-300' : ''}
						${percentage >= 80 && percentage < 90 ? 'bg-red-100 border-red-300' : ''}
						${percentage >= 70 && percentage < 80 ? 'bg-orange-100 border-orange-300' : ''}
						${percentage >= 60 && percentage < 70 ? 'bg-blue-100 border-blue-300' : ''}
						${percentage >= 50 && percentage < 60 ? 'bg-green-100 border-green-300' : ''}
						${percentage < 50 ? 'bg-gray-100 border-gray-300' : ''}
					`}
				>
					{(() => {
						if (percentage >= 90) return <Trophy className="h-20 w-20 text-yellow-500" />;
						if (percentage >= 80) return <ShieldCheck className="h-20 w-20 text-red-500" />;
						if (percentage >= 70) return <Handshake className="h-20 w-20 text-orange-500" />;
						if (percentage >= 60) return <Globe2 className="h-20 w-20 text-blue-500" />;
						if (percentage >= 50) return <Dumbbell className="h-20 w-20 text-green-500" />;
						return <Flame className="h-20 w-20 text-gray-500" />;
					})()}
				</div>
				<div
					className={`inline-block px-6 py-3 rounded-full border-2 font-bold text-lg mb-4
						${percentage >= 90 ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : ''}
						${percentage >= 80 && percentage < 90 ? 'bg-red-100 border-red-300 text-red-800' : ''}
						${percentage >= 70 && percentage < 80 ? 'bg-orange-100 border-orange-300 text-orange-800' : ''}
						${percentage >= 60 && percentage < 70 ? 'bg-blue-100 border-blue-300 text-blue-800' : ''}
						${percentage >= 50 && percentage < 60 ? 'bg-green-100 border-green-300 text-green-800' : ''}
						${percentage < 50 ? 'bg-gray-100 border-gray-300 text-gray-800' : ''}
					`}
				>
					{badge.level}
				</div>
				<p className="text-gray-700 mb-6 text-center">{badge.desc}</p>
				<div className="grid grid-cols-3 gap-4 mb-6 w-full max-w-md">
					<div className="text-center">
						<div className="bg-red-100 p-3 rounded-lg mb-2">
							<Target className="h-6 w-6 text-red-600 mx-auto" />
						</div>
						<div className="text-2xl font-bold text-red-800">{percentage}%</div>
						<div className="text-sm text-red-600">Akurasi</div>
					</div>
					<div className="text-center">
						<div className="bg-red-100 p-3 rounded-lg mb-2">
							<Clock className="h-6 w-6 text-red-600 mx-auto" />
						</div>
						<div className="text-2xl font-bold text-red-800">
							{Math.floor(timeSpent / 60)}m {timeSpent % 60}s
						</div>
						<div className="text-sm text-red-600">Waktu</div>
					</div>
					<div className="text-center">
						<div className="bg-red-100 p-3 rounded-lg mb-2">
							<Star className="h-6 w-6 text-red-600 mx-auto" />
						</div>
						<div className="text-2xl font-bold text-red-800">{score}</div>
						<div className="text-sm text-red-600">Benar</div>
					</div>
				</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Actions & Email */}
					<div className="space-y-6">
						{/* Email Results */}
						<div className="bg-white rounded-2xl shadow-lg p-8">
					<div className="flex items-center space-x-3 mb-4">
						<Mail className="h-6 w-6 text-red-600" />
						<h3 className="text-xl font-bold text-red-800">Kirim Hasil via Email</h3>
					</div>
					<p className="text-red-600 mb-6">
						Dapatkan sertifikat digital dan badge kemerdekaan dikirim ke email Anda!
					</p>
					<div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
						<p className="text-sm text-red-700 mb-2">
							<strong>Email akan berisi:</strong>
						</p>
						<ul className="text-sm text-red-600 space-y-1">
							<li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Badge {badge.level} yang bisa dishare</li>
							<li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Detail skor dan jawaban</li>
							<li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Fakta-fakta menarik kemerdekaan Indonesia</li>
						</ul>
					</div>
					{!emailSent ? (
						<button
							onClick={handleSendEmail}
							disabled={isLoadingEmail}
							className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
						>
							{isLoadingEmail ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
									<span>Mengirim...</span>
								</>
							) : (
								<>
									<Mail className="h-4 w-4" />
									<span>Kirim ke {email}</span>
								</>
							)}
						</button>
					) : (
						<div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
							<div className="text-green-600 mb-2">
								<Mail className="h-8 w-8 mx-auto mb-2" />
								<p className="font-bold">Email Terkirim!</p>
								<p className="text-sm">Cek kotak masuk Anda di {email}</p>
							</div>
						</div>
					)}
				</div>

				{/* Action Buttons */}
				<div className="bg-white rounded-2xl shadow-xl p-8">
					<h3 className="text-xl font-bold text-red-800 mb-6">Apa Selanjutnya?</h3>
					<div className="space-y-4">
						<button
							onClick={handleShare}
							className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
						>
							<Share2 className="h-4 w-4" />
							<span>Share Pencapaian</span>
						</button>
						<button
							onClick={() => router.push('/leaderboard')}
							className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
						>
							<Users className="h-4 w-4" />
							<span>Lihat Leaderboard</span>
						</button>
						<button
							onClick={() => router.push('/quiz')}
							className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
						>
							<Flag className="h-4 w-4" />
							<span>Coba Lagi</span>
						</button>
					</div>
				</div>
						</div>
					
					{/* Fun Facts Section */}
					<div className="bg-white rounded-2xl shadow-lg p-8">
				<div className="flex items-center space-x-3 mb-6">
					<div className="bg-yellow-100 p-2 rounded-lg">
						<Award className="h-6 w-6 text-yellow-600" />
					</div>
					<h3 className="text-xl font-bold text-red-800">Fakta Menarik Kemerdekaan Indonesia</h3>
				</div>
				<div className="flex flex-col space-y-4">
					{funFacts.map((fact, idx) => (
						<div key={idx} className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
							<p className="text-red-700">{fact}</p>
						</div>
						))}
				</div>
					</div>
					
					{/* Badge Quiz Kemerdekaan Section */}
					<div className="bg-white rounded-2xl shadow-lg p-8 w-full flex flex-col items-center lg:col-span-2 max-w-5xl mx-auto">
				<h2 className="text-2xl font-bold text-red-800 mb-6 text-center">Badge Quiz Kemerdekaan</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 w-full justify-items-center">
					<div className="bg-yellow-100 border border-yellow-300 rounded-xl p-6 text-center">
						<Trophy className="mx-auto h-10 w-10 text-yellow-500 mb-2" />
						<div className="font-bold text-yellow-800 mb-1">Sang Proklamator</div>
						<div className="text-xs text-yellow-700 mb-2">≥ 90%</div>
						<div className="text-xs text-yellow-700">Melambangkan pemimpin dan pencetus kemerdekaan, level tertinggi</div>
					</div>
					<div className="bg-red-100 border border-red-300 rounded-xl p-6 text-center">
						<ShieldCheck className="mx-auto h-10 w-10 text-red-500 mb-2" />
						<div className="font-bold text-red-800 mb-1">Penjaga Negeri</div>
						<div className="text-xs text-red-700 mb-2">80–89%</div>
						<div className="text-xs text-red-700">Melambangkan mereka yang menjaga dan mempertahankan tanah air</div>
					</div>
					<div className="bg-orange-100 border border-orange-300 rounded-xl p-6 text-center">
						<Handshake className="mx-auto h-10 w-10 text-orange-500 mb-2" />
						<div className="font-bold text-orange-800 mb-1">Pembela Rakyat</div>
						<div className="text-xs text-orange-700 mb-2">70–79%</div>
						<div className="text-xs text-orange-700">Tetap gigih, berjuang untuk rakyat</div>
					</div>
					<div className="bg-blue-100 border border-blue-300 rounded-xl p-6 text-center">
						<Globe2 className="mx-auto h-10 w-10 text-blue-500 mb-2" />
						<div className="font-bold text-blue-800 mb-1">Putra/Putri Nusantara</div>
						<div className="text-xs text-blue-700 mb-2">60–69%</div>
						<div className="text-xs text-blue-700">Identitas kebangsaan, semangat belajar terus</div>
					</div>
					<div className="bg-green-100 border border-green-300 rounded-xl p-6 text-center">
						<Dumbbell className="mx-auto h-10 w-10 text-green-500 mb-2" />
						<div className="font-bold text-green-800 mb-1">Semangat Merdeka</div>
						<div className="text-xs text-green-700 mb-2">50–59%</div>
						<div className="text-xs text-green-700">Masih butuh belajar, tapi punya semangat juang</div>
					</div>
					<div className="bg-gray-100 border border-gray-300 rounded-xl p-6 text-center">
						<Flame className="mx-auto h-10 w-10 text-gray-500 mb-2" />
						<div className="font-bold text-gray-800 mb-1">Api Perjuangan</div>
						<div className="text-xs text-gray-700 mb-2">&lt; 50%</div>
						<div className="text-xs text-gray-700">Skor rendah, api kecil yang harus dipupuk agar jadi besar</div>
					</div>
				</div>
					</div>
				</div>
			</div>
		</div>
		</main>
	);
};

export default ResultsScreen;
