"use client";
import React, { useState } from 'react';
import { X, Github, Code, Layers, Users } from 'lucide-react';

export default function TeamModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-red-200 hover:text-white underline focus:outline-none">
        Tim GakTau.Dev
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative max-w-2xl w-full bg-white rounded-xl shadow-xl p-6 mx-4 transform transition-all duration-200 scale-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-50 rounded-md">
                  <Layers className="w-7 h-7 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Tim GakTau.Dev</h2>
                  <p className="text-sm text-gray-600">Quiz Kemerdekaan — aplikasi kuis interaktif berbasis AI untuk belajar sejarah Indonesia.</p>
                </div>
              </div>
              <button aria-label="Tutup" onClick={() => setOpen(false)} className="p-2 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-sm text-gray-800 mb-2">Teknologi & Integrasi</h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded"><Code className="w-3 h-3" /> Next.js</span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">React</span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Tailwind CSS</span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">FastAPI</span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">MongoDB</span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">unli.dev / lunos.tech</span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">mailry</span>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-800 mb-2">Anggota</h3>
              <ul className="space-y-3">
                <li className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Azis Maulana Suhada</div>
                      <div className="text-xs text-gray-600">Fullstack Developer</div>
                    </div>
                  </div>
                  <a href="https://github.com/RAYDENFLY" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded text-sm text-gray-700 hover:bg-gray-200">
                    <Github className="w-4 h-4" />
                    <span>RAYDENFLY</span>
                  </a>
                </li>

                <li className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Fahat Fajar Andhika</div>
                      <div className="text-xs text-gray-600">Support Designer</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">&nbsp;</div>
                </li>

                <li className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Bagus Setiawan</div>
                      <div className="text-xs text-gray-600">Tester / QC</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">&nbsp;</div>
                </li>
              </ul>
            </div>

            <div className="mt-6 text-right">
              <button onClick={() => setOpen(false)} className="px-4 py-2 bg-red-600 text-white rounded">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
