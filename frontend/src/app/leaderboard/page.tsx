"use client";
import React, { useEffect, useState } from "react";
import { Trophy, Medal, Award, Clock } from "lucide-react";

type LeaderboardEntry = {
  name: string;
  score?: number;
  percentage?: number;
  totalQuestions?: number;
  difficulty?: string;
  timeSpent?: number;
  date?: string;
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const envBase = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
        const base = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8001";
        const url = `${base}/quiz/leaderboard`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch leaderboard: ${resp.status}`);
        const json = await resp.json();
        setData(Array.isArray(json) ? json : (json.data || []));
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Gagal memuat leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // No filter UI requested — show full leaderboard paginated
  const leaderboard = data;
  const filteredLeaderboard = leaderboard;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredLeaderboard.length / pageSize));
  useEffect(() => { setCurrentPage(1); }, [data]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-center mb-6">
        <h1 className="text-2xl font-bold text-red-800 text-center">Leaderboard Lengkap</h1>
      </div>

      {loading && <div className="p-8 text-center text-gray-600">Memuat leaderboard...</div>}
      {error && <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded">Error: {error}</div>}

      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 w-full">
        {error && (
          <div className="py-4 px-4 mb-4 bg-red-50 border border-red-100 text-red-700 rounded">Error: {error}</div>
        )}

        {!loading && !error && (
          <>
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
                  // paginate
                  (filteredLeaderboard as any[]).slice((currentPage - 1) * pageSize, currentPage * pageSize).map((entry: any, idx: number) => (
                    <tr key={idx} className={idx === 0 ? "bg-yellow-50" : ""}>
                     <td className="px-4 py-2 font-bold text-black text-center">
                     {((currentPage - 1) * pageSize + idx) === 0 ? (
                       <Trophy className="h-5 w-5 text-yellow-500 inline" />
                      ) : ((currentPage - 1) * pageSize + idx) === 1 ? (
                        <Medal className="h-5 w-5 text-gray-400 inline" />
                      ) : ((currentPage - 1) * pageSize + idx) === 2 ? (
                        <Award className="h-5 w-5 text-amber-600 inline" />
                      ) : (
                        entry.rank || ((currentPage - 1) * pageSize + idx + 1)
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

          {/* Pagination controls */}
          <div className="flex items-center justify-center space-x-2 mt-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p-1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-red-100 text-red-700 disabled:opacity-50"
            >Prev</button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i+1)}
                className={`px-3 py-1 rounded ${currentPage === i+1 ? 'bg-red-600 text-white' : 'bg-white text-red-700 border border-red-100'}`}
              >{i+1}</button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-red-100 text-red-700 disabled:opacity-50"
            >Next</button>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
