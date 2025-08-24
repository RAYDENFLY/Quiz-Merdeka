"use client";
import React, { useState, useEffect } from "react";
import { Flag, Star, Trophy, Users, Clock, ArrowRight, Lightbulb, Award, Medal, ShieldCheck, Handshake, Globe2, Flame, Dumbbell } from "lucide-react";
import Link from "next/link";

export default function Home() {
  // Registration states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  // Leaderboard states
  const [filter, setFilter] = useState("all");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const envBase = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
        const base = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8001";
        const url = `${base}/quiz/leaderboard`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch leaderboard data: ${response.status}`);
        const data = await response.json();
        setLeaderboard(data);
      } catch (err: any) {
        console.error("Error fetching leaderboard:", err);
        setError(err.message || "Gagal mengambil data leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Filter leaderboard by difficulty (if backend provides difficulty)
  const filteredLeaderboard = filter === "all"
    ? leaderboard
    : leaderboard.filter(entry => entry.difficulty === filter);
  const topPerformers = filteredLeaderboard.slice(0, 3);

  // Quiz statistics
  const totalParticipants = leaderboard.length;
  const averageScore = leaderboard.length > 0 ? Math.round(leaderboard.reduce((sum, entry) => sum + (entry.percentage || 0), 0) / leaderboard.length) : 0;
  const topScore = leaderboard.length > 0 ? Math.max(...leaderboard.map(entry => entry.percentage || 0)) : 0;

  // Registration submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      localStorage.setItem("cerdasMerdekaName", name);
      localStorage.setItem("cerdasMerdekaEmail", email);
      localStorage.setItem("cerdasMerdekaDifficulty", difficulty);
      // Map internal difficulty values to labels the backend/frontend expect
      const diffMap: Record<string, string> = {
        easy: "Mudah",
        medium: "Sedang",
        hard: "Sulit",
      };
      const diffLabel = diffMap[difficulty] || difficulty;
      const params = new URLSearchParams({ name, email, difficulty: diffLabel });
      window.location.href = `/quiz?${params.toString()}`;
    }
  };

  // Difficulty options for registration
  const difficultyOptions = [
    { value: "easy", label: "Mudah", description: "Untuk anak-anak (SD)", icon: <Star className="h-5 w-5" />, questions: 10, time: "5 menit" },
    { value: "medium", label: "Sedang", description: "Untuk remaja (SMP-SMA)", icon: <Trophy className="h-5 w-5" />, questions: 15, time: "8 menit" },
    { value: "hard", label: "Sulit", description: "Untuk dewasa/mahasiswa", icon: <Award className="h-5 w-5" />, questions: 20, time: "12 menit" }
  ];

  return (
    <div className="w-full max-w-none mx-auto px-0">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="relative py-16 px-8 rounded-2xl shadow-2xl mb-8 w-full overflow-hidden animate-fade-in">
          {/* Background Image */}
          <div className="absolute inset-0 w-full h-full">
            <img src="/bg_patern.png" alt="Batik Background" className="w-full h-full object-cover brightness-50 animate-zoom-in" />
            <div className="absolute inset-0 bg-black/40 rounded-2xl" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-center mb-6 animate-fade-up">
              <div className="bg-white/20 p-4 rounded-full">
                <img src="/logo-quiz.png" alt="Logo Quiz" className="h-16 w-16 object-contain animate-pop" />
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-lg animate-fade-up">Quiz Kemerdekaan</h1>
            <p className="text-xl text-white mb-6 max-w-2xl mx-auto drop-shadow-lg animate-fade-up">
              Uji pengetahuan Anda tentang sejarah kemerdekaan Indonesia dengan quiz AI yang interaktif dan edukatif. Dapatkan badge digital dan sertifikat!
            </p>
            <div className="flex items-center justify-center space-x-8 text-white animate-fade-up">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Leaderboard</span>
              </div>
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5" />
                <span>Digital Badge</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 w-full">
        <h2 className="text-3xl font-bold text-red-800 mb-6 text-center">Mulai Quiz Anda</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-red-700 mb-2">Nama Lengkap</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-colors text-black placeholder:text-gray-500"
                placeholder="Masukkan nama lengkap Anda"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-red-700 mb-2">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-colors text-black placeholder:text-gray-500"
                placeholder="email@example.com"
                required
              />
              <p className="text-sm text-red-600 mt-1">Hasil quiz akan dikirim ke email ini</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-red-700 mb-4">Pilih Tingkat Kesulitan</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {difficultyOptions.map((option) => (
                <label
                  key={option.value}
                  className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all hover:scale-105 ${
                    difficulty === option.value
                      ? "border-red-500 bg-red-50 shadow-lg"
                      : "border-red-200 bg-white hover:border-red-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="difficulty"
                    value={option.value}
                    checked={difficulty === option.value}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className={`inline-flex p-3 rounded-full mb-3 ${
                      difficulty === option.value ? "bg-red-500 text-white" : "bg-red-100 text-red-600"
                    }`}>
                      {option.icon}
                    </div>
                    <h3 className="font-bold text-lg text-red-800 mb-1">{option.label}</h3>
                    <p className="text-sm text-red-600 mb-3">{option.description}</p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-red-500">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{option.time}</span>
                      </span>
                      <span>{option.questions} soal</span>
                    </div>
                  </div>
                  {difficulty === option.value && (
                    <div className="absolute -top-2 -right-2">
                      <div className="bg-red-500 text-white rounded-full p-1">
                        <Star className="h-4 w-4 fill-current" />
                      </div>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !email.trim()}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
          >
            <span>Mulai Quiz Kemerdekaan</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Top Leaderboard Section */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 w-full">
        <div className="flex items-center justify-between mb-4 w-full">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-red-800 text-2xl">Top 10 Leaderboard</h3>
          </div>
          <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border border-red-300 rounded-lg px-4 py-2 text-red-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              <option value="all">Semua</option>
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
            </select>
          <Link href="/leaderboard">
            <button className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow hover:bg-red-700 transition">
              Lihat Semua Leaderboard →
            </button>
          </Link>
        </div>

        {loading && (
          <div className="py-8 text-center text-gray-600">Memuat leaderboard...</div>
        )}

        {error && (
          <div className="py-4 px-4 mb-4 bg-red-50 border border-red-100 text-red-700 rounded">Error: {error}</div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto w-full mb-2">
            <table className="min-w-[900px] w-full bg-white rounded-xl shadow border border-red-100">
              <thead>
                <tr className="bg-red-100 text-red-700 text-sm">
                  <th className="py-2 px-4 font-semibold text-center">Rank</th>
                  <th className="py-2 px-4 font-semibold text-left">Nama</th>
                  <th className="py-2 px-4 font-semibold text-center">Badge</th>
                  <th className="py-2 px-4 font-semibold text-center">Skor</th>
                  <th className="py-2 px-4 font-semibold text-center">Level</th>
                  <th className="py-2 px-4 font-semibold text-center">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-600">Belum ada peserta yang menyelesaikan quiz.</td>
                  </tr>
                ) : (
                  (filteredLeaderboard as any[]).slice(0, 10).map((entry: any, idx: number) => (
                    <tr key={idx} className={idx === 0 ? "bg-yellow-50" : ""}>
                     <td className="px-4 py-2 font-bold text-black text-center">
                     {idx === 0 ? (
                       <Trophy className="h-5 w-5 text-yellow-500 inline" />
                     ) : idx === 1 ? (
                       <Medal className="h-5 w-5 text-gray-400 inline" />
                     ) : idx === 2 ? (
                       <Award className="h-5 w-5 text-amber-600 inline" />
                     ) : (
                       entry.rank || idx + 1
                     )}
                     </td>
                     <td className="px-4 py-2 text-black">
                       <div className="font-semibold">{entry.name}</div>
                       <div className="text-xs text-gray-500">{entry.date}</div>
                     </td>
                     <td className="px-4 py-2 text-black text-center">
                       <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                         (entry.percentage || entry.score || 0) >= 90 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                         (entry.percentage || entry.score || 0) >= 80 ? "bg-red-100 text-red-800 border-red-300" :
                         (entry.percentage || entry.score || 0) >= 70 ? "bg-orange-100 text-orange-800 border-orange-300" :
                         (entry.percentage || entry.score || 0) >= 60 ? "bg-blue-100 text-blue-800 border-blue-300" :
                         (entry.percentage || entry.score || 0) >= 50 ? "bg-green-100 text-green-800 border-green-300" :
                         "bg-gray-100 text-gray-800 border-gray-300"
                       }`}>
                         {(entry.percentage || entry.score || 0) >= 90 ? "Sang Proklamator" :
                          (entry.percentage || entry.score || 0) >= 80 ? "Penjaga Negeri" :
                          (entry.percentage || entry.score || 0) >= 70 ? "Pembela Rakyat" :
                          (entry.percentage || entry.score || 0) >= 60 ? "Putra/Putri Nusantara" :
                          (entry.percentage || entry.score || 0) >= 50 ? "Semangat Merdeka" :
                          "Api Perjuangan"}
                       </span>
                     </td>
                     <td className="px-4 py-2 text-black text-center">
                       <div className="font-bold">{entry.percentage ? `${entry.percentage}%` : `${entry.score || 0}%`}</div>
                       <div className="text-xs text-gray-600">({entry.score || 0}/{entry.totalQuestions || '-'})</div>
                     </td>
                     <td className="px-4 py-2 capitalize text-black text-center">{entry.difficulty === "easy" ? "Mudah" : entry.difficulty === "medium" ? "Sedang" : entry.difficulty === "hard" ? "Sulit" : "-"}</td>
                     <td className="px-4 py-2 text-black text-center">
                       <div className="flex items-center justify-center space-x-1 text-gray-700">
                         <Clock className="h-4 w-4" />
                         <span>{Math.floor((entry.timeSpent || 0) / 60)}m {(entry.timeSpent || 0) % 60}s</span>
                       </div>
                     </td>
                   </tr>
                 ))
                )}
               </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Badge Quiz Kemerdekaan Section */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 w-full flex flex-col items-center">
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

      {/* Features Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <div className="bg-white p-6 rounded-xl shadow-lg text-center w-full">
          <div className="bg-red-100 p-3 rounded-full inline-flex mb-4">
            <Lightbulb className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="font-bold text-red-800 mb-2">Smart Questions</h3>
          <p className="text-red-600 text-sm">Pertanyaan yang disesuaikan dengan level dan memberikan feedback yang personal</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg text-center w-full">
          <div className="bg-red-100 p-3 rounded-full inline-flex mb-4">
            <Award className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="font-bold text-red-800 mb-2">Digital Badge</h3>
          <p className="text-red-600 text-sm">Dapatkan badge kemerdekaan digital dan sertifikat yang bisa dishare</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg text-center w-full">
          <div className="bg-red-100 p-3 rounded-full inline-flex mb-4">
            <Trophy className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="font-bold text-red-800 mb-2">Leaderboard</h3>
          <p className="text-red-600 text-sm">Compete dengan peserta lain dan lihat ranking Anda di leaderboard</p>
        </div>
      </div>
    </div>
  );
}
