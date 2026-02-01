'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TopNav() {
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const container = document.getElementById('user-menu-container');
      if (container && !container.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleLogout = () => {
    document.cookie = 'prism_access_token=; path=/; max-age=0';
    window.location.href = '/';
  };

  return (
    <nav className="w-full px-8 py-5 flex justify-between items-center max-w-7xl mx-auto">
      <div
        className="font-bold text-xl text-indigo-900 tracking-tight flex items-center gap-2 cursor-pointer"
        onClick={() => router.push('/projects')}
      >
        <svg width="24" height="24" viewBox="0 0 300 300" fill="none">
          <path d="M150 40 L150 260 L250 140 Z" fill="#6366F1" stroke="#1E293B" strokeWidth="20" strokeLinejoin="round" />
          <path d="M150 40 L50 180 L150 260 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="20" strokeLinejoin="round" />
        </svg>
        PR-ism
      </div>
      <div className="flex items-center gap-4">
        <div className="relative" id="user-menu-container">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-200 hover:bg-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            U
          </button>
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 origin-top-right z-50">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleLogout(); }}
                className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                로그아웃
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
