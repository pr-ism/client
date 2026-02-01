'use client';

import TopNav from '../../components/TopNav';

/**
 * Tailwind CDN JIT 프리로드:
 * /projects 진입 시점에 하위 모든 페이지의 클래스를 미리 선언하여
 * 클라이언트 네비게이션 시 CSS가 이미 생성되어 있도록 합니다.
 */
const PRELOAD_CLASSES = [
  'bg-white bg-slate-50 bg-slate-100 rounded-2xl rounded-xl rounded-lg rounded-full',
  'border border-slate-200 border-slate-100 border-indigo-100 border-indigo-200 border-white',
  'shadow-sm shadow-md shadow-lg shadow-xl',
  'text-slate-900 text-slate-800 text-slate-700 text-slate-600 text-slate-500 text-slate-400 text-slate-300',
  'text-indigo-600 text-indigo-700 text-indigo-900 text-emerald-600 text-rose-500 text-amber-600 text-purple-700',
  'bg-indigo-50 bg-indigo-100 bg-indigo-600 bg-emerald-50 bg-emerald-100 bg-amber-50 bg-amber-100',
  'bg-rose-100 bg-sky-100 bg-violet-100 bg-orange-100 bg-green-100 bg-purple-100 bg-yellow-100',
  'text-emerald-600 text-rose-600 text-amber-600 text-sky-600 text-violet-600 text-orange-600',
  'text-green-800 text-purple-800 text-yellow-800 text-red-600',
  'hover:bg-slate-50 hover:bg-slate-100 hover:bg-indigo-200 hover:bg-white/80 hover:bg-red-50',
  'hover:border-indigo-300 hover:text-indigo-600 hover:text-slate-800 hover:text-red-700',
  'font-bold font-semibold font-medium font-mono',
  'text-xs text-sm text-base text-lg text-xl text-2xl text-3xl',
  'px-2 px-2.5 px-3 px-4 px-5 px-6 px-8 py-0.5 py-1 py-1.5 py-2 py-2.5 py-3 py-4 py-5 py-6',
  'gap-1 gap-1.5 gap-2 gap-3 gap-4 gap-6 space-y-6 space-y-8',
  'w-3 w-4 w-5 w-6 w-8 w-12 w-16 w-24 w-32 w-40 w-full h-2.5 h-3 h-4 h-5 h-8 h-12 h-16 h-24 h-32 h-64 h-72',
  'grid grid-cols-1 grid-cols-2 grid-cols-7 grid-cols-12 md:grid-cols-2 md:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 lg:grid-cols-3',
  'col-span-2 col-span-3 col-span-4 col-span-8 md:col-span-1 md:col-span-7',
  'flex flex-col flex-row flex-grow flex-1 items-center items-start items-end justify-center justify-between',
  'md:flex-row md:items-center md:items-start md:flex md:block md:text-left md:hidden',
  'min-w-0 min-h-[180px] max-w-md max-w-sm max-w-7xl shrink-0 truncate break-all',
  'absolute relative z-0 z-10 z-50 top-0 right-0 left-0 overflow-hidden overflow-x-auto',
  'transition-all transition-colors transition-opacity duration-200 duration-300 duration-500',
  'animate-pulse cursor-pointer pointer-events-none whitespace-nowrap tracking-wide tracking-wider uppercase',
  'divide-y divide-slate-100 border-b border-t border-dashed border-2',
  'backdrop-blur-sm bg-white/60 shadow-indigo-200',
  'line-through decoration-slate-400 opacity-0 opacity-50 opacity-90 hover:opacity-100',
  'group group-hover:opacity-100 group-hover:text-indigo-600 group-hover:bg-indigo-50',
  '-mr-4 -mt-4 -mr-20 -mt-20 blur-3xl scale-125 scale-150 rotate-180',
  'hover:-translate-y-0.5 hover:shadow-lg hover:underline',
  'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-2 focus:ring-indigo-500',
  'self-center origin-top-right',
  'pl-2 pb-3 pb-4 mb-1 mb-2 mb-3 mb-4 mb-5 mb-6 mb-8 mb-10 mt-0.5 mt-1 mt-1.5 mt-2 mt-3 mt-4 mr-1 pr-3',
  'text-right text-center text-left',
  'inline-flex border-indigo-50 border-emerald-50 border-sky-50 border-amber-50 border-rose-50 border-violet-50',
  'bg-blue-50 bg-blue-100 text-blue-600 border-blue-100',
  'bg-teal-100 text-teal-600',
  'w-0.5 w-px bg-slate-200 border-slate-200/80',
  'bg-indigo-50/60 hover:bg-indigo-50/60',
  // ProjectList에서 쓰는 클래스
  'border-indigo-50 border-sky-50 border-emerald-50 border-amber-50 border-rose-50 border-violet-50',
  'bg-indigo-100 bg-sky-100 bg-emerald-100 bg-amber-100 bg-rose-100 bg-violet-100',
  'text-indigo-600 text-sky-600 text-emerald-600 text-amber-600 text-rose-600 text-violet-600',
  'border-slate-300 hover:border-indigo-400 hover:text-indigo-600 hover:bg-white',
  'group-hover:bg-indigo-50 shadow-md shadow-indigo-100',
  'bg-indigo-600 hover:bg-indigo-700 text-white',
  'scale-98 scale-100 filter grayscale',
  'fade-in-up',
].join(' ');

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#EEF2FF]">
      {/* Tailwind CDN preload */}
      <div className="hidden" aria-hidden="true">
        <div className={PRELOAD_CLASSES} />
      </div>
      <div className="sticky top-0 z-50 bg-[#EEF2FF]">
        <TopNav />
      </div>
      {children}
    </div>
  );
}
