'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface LabelStat {
  labelName: string;
  pullRequestCount: number;
  totalAdditions: number;
  totalDeletions: number;
  averageAdditions: number;
  averageDeletions: number;
  averageCommitCount: number;
  averageChangedFileCount: number;
}

interface LabelStatisticsData {
  labelStatistics: LabelStat[];
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtAvg(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

const LABEL_COLORS: Record<string, string> = {
  feature: '#6366F1',
  bug: '#EF4444',
  refactor: '#F59E0B',
  documentation: '#10B981',
  chore: '#94A3B8',
  test: '#8B5CF6',
  enhancement: '#0EA5E9',
  hotfix: '#F43F5E',
};

function getLabelColor(name: string): string {
  return LABEL_COLORS[name.toLowerCase()] || '#CBD5E1';
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ── DatePicker ── */
function DatePicker({
  value,
  onChange,
  placeholder,
  alignRight = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const MONTH_NAMES = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월',
  ];
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toDateStr(d));
    setOpen(false);
  };

  const selectedStr = value;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 hover:border-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 min-w-[140px]"
      >
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value ? 'text-slate-800 font-medium' : 'text-slate-400'}>{value || placeholder}</span>
      </button>

      {open && (
        <div className={`absolute top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-[280px] ${alignRight ? 'right-0' : 'left-0'}`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}년 {MONTH_NAMES[viewMonth]}</span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
              const isSelected = dateStr === selectedStr;
              const isToday = dateStr === toDateStr(new Date());
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={[
                    'w-8 h-8 rounded-lg text-sm font-medium transition-all flex items-center justify-center',
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isToday
                        ? 'bg-indigo-50 text-indigo-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-3 w-full text-xs text-slate-500 hover:text-red-500 transition-colors text-center py-1"
            >
              날짜 초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function LabelStatistics({ projectId }: { projectId: string }) {
  const [labels, setLabels] = useState<LabelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLCanvasElement>(null);
  const doughnutInstanceRef = useRef<unknown>(null);
  const bubbleInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const qs = params.toString();
        const url = `/projects/${projectId}/statistics/labels${qs ? `?${qs}` : ''}`;
        const res = await fetchWithAuth(url);
        if (!res.ok) {
          setError('라벨 통계를 불러오는데 실패했습니다.');
          return;
        }
        const data: LabelStatisticsData = await res.json();
        setLabels(data.labelStatistics);
        setError('');
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, startDate, endDate]);

  /* Charts */
  useEffect(() => {
    if (loading || labels.length === 0) return;

    const tryRender = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) { setTimeout(tryRender, 200); return; }
      const ChartJS = win.Chart as any;

      /* Doughnut */
      if (doughnutRef.current) {
        if (doughnutInstanceRef.current) (doughnutInstanceRef.current as any).destroy();
        const ctx = doughnutRef.current.getContext('2d')!;
        doughnutInstanceRef.current = new ChartJS(ctx, {
          type: 'doughnut',
          data: {
            labels: labels.map((d) => d.labelName),
            datasets: [{
              data: labels.map((d) => d.pullRequestCount),
              backgroundColor: labels.map((d) => getLabelColor(d.labelName)),
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
              tooltip: { callbacks: { label: (c: any) => ` ${c.label}: ${c.raw} PRs` } },
            },
          },
        });
      }

      /* Bubble */
      if (bubbleRef.current) {
        if (bubbleInstanceRef.current) (bubbleInstanceRef.current as any).destroy();
        const ctx = bubbleRef.current.getContext('2d')!;
        const bubbleData = labels.map((d) => ({
          x: d.averageAdditions + d.averageDeletions,
          y: d.averageChangedFileCount,
          r: Math.max(5, Math.sqrt(d.pullRequestCount) * 5),
          label: d.labelName,
          commits: d.averageCommitCount,
        }));
        bubbleInstanceRef.current = new ChartJS(ctx, {
          type: 'bubble',
          data: {
            datasets: [{
              label: 'Label Complexity',
              data: bubbleData,
              backgroundColor: bubbleData.map((d) => getLabelColor(d.label) + '99'),
              borderColor: bubbleData.map((d) => getLabelColor(d.label)),
              borderWidth: 1,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const raw = context.raw;
                    return [
                      `Label: ${raw.label}`,
                      `Impact: ${raw.x.toFixed(0)} lines`,
                      `Files: ${raw.y.toFixed(1)} files`,
                      `Avg Commits: ${raw.commits.toFixed(1)}`,
                    ];
                  },
                },
              },
            },
            scales: {
              x: { title: { display: true, text: 'Avg Code Change (Lines)' }, grid: { color: '#f1f5f9' }, beginAtZero: true },
              y: { title: { display: true, text: 'Avg Changed Files' }, grid: { color: '#f1f5f9' }, beginAtZero: true },
            },
          },
        });
      }
    };
    tryRender();

    return () => {
      if (doughnutInstanceRef.current) { (doughnutInstanceRef.current as any).destroy(); doughnutInstanceRef.current = null; }
      if (bubbleInstanceRef.current) { (bubbleInstanceRef.current as any).destroy(); bubbleInstanceRef.current = null; }
    };
  }, [labels, loading]);

  const totalPRs = labels.reduce((acc, cur) => acc + cur.pullRequestCount, 0);

  /* KPI 계산 */
  const sorted = [...labels].sort((a, b) => b.pullRequestCount - a.pullRequestCount);
  const topFreq = sorted[0];
  const heaviest = [...labels].sort((a, b) => (b.averageAdditions + b.averageDeletions) - (a.averageAdditions + a.averageDeletions))[0];
  const broadest = [...labels].sort((a, b) => b.averageChangedFileCount - a.averageChangedFileCount)[0];

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
        {/* Header + Date Filter */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">작업 유형 및 라벨 분석</h1>
            <p className="text-slate-500 text-sm">라벨별 PR 빈도와 코드 변경량, 복잡도(파일/커밋 수)를 분석합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <DatePicker value={startDate} onChange={setStartDate} placeholder="시작일" />
            <span className="text-slate-400 text-sm">~</span>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="종료일" alignRight />
          </div>
        </div>

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500 font-medium mb-4">{error}</p>
            <a href="/projects" className="text-indigo-600 hover:underline text-sm font-medium">프로젝트 목록으로</a>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && labels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-slate-500 font-medium">라벨 통계 데이터가 없습니다.</p>
          </div>
        )}

        {!loading && !error && labels.length > 0 && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Most Frequent */}
              {topFreq && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Most Frequent</div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-slate-800">{topFreq.labelName}</span>
                      <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
                        {totalPRs > 0 ? Math.round((topFreq.pullRequestCount / totalPRs) * 100) : 0}%
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">전체 PR 중 가장 높은 비중을 차지합니다.</p>
                  </div>
                </div>
              )}

              {/* Heaviest Impact */}
              {heaviest && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Heaviest Work</div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-indigo-600">{heaviest.labelName}</span>
                      <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        ~{Math.round(heaviest.averageAdditions + heaviest.averageDeletions)} lines
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">평균 코드 변경량이 가장 많습니다.</p>
                  </div>
                </div>
              )}

              {/* Broadest Scope */}
              {broadest && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Broadest Scope</div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-amber-600">{broadest.labelName}</span>
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {fmtAvg(broadest.averageChangedFileCount)} files
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">평균 수정 파일 수가 가장 많습니다.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Doughnut */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                  작업 유형 점유율 (PR Count %)
                </h3>
                <div className="h-72 relative flex items-center justify-center">
                  <canvas ref={doughnutRef} />
                  <div className="absolute text-center pointer-events-none">
                    <div className="text-3xl font-bold text-slate-800">{totalPRs}</div>
                    <div className="text-xs text-slate-400">Total PRs</div>
                  </div>
                </div>
              </div>

              {/* Bubble */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    작업 복잡도 분석 (Impact vs Files)
                  </h3>
                  <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                    X: 코드 변경량 | Y: 파일 수 | 크기: 빈도
                  </div>
                </div>
                <div className="h-72 relative">
                  <canvas ref={bubbleRef} />
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  우측 상단에 위치할수록 변경 범위가 넓고 수정량이 많은(쪼개야 할) 작업입니다.
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">상세 통계 데이터</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Label Name</th>
                      <th className="px-6 py-3 text-right">PR Count</th>
                      <th className="px-6 py-3 text-right">Total Impact</th>
                      <th className="px-6 py-3 text-right">Avg Additions</th>
                      <th className="px-6 py-3 text-right">Avg Deletions</th>
                      <th className="px-6 py-3 text-right text-indigo-600">Avg Files</th>
                      <th className="px-6 py-3 text-right text-indigo-600">Avg Commits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.map((stat) => {
                      const color = getLabelColor(stat.labelName);
                      const totalImpact = stat.totalAdditions + stat.totalDeletions;
                      return (
                        <tr key={stat.labelName} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span
                              className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 uppercase tracking-wide"
                              style={{ backgroundColor: color + '15', color: color, border: `1px solid ${color}30` }}
                            >
                              {stat.labelName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-700">{stat.pullRequestCount}</td>
                          <td className="px-6 py-4 text-right text-slate-500 text-xs">{fmt(totalImpact)}</td>
                          <td className="px-6 py-4 text-right text-emerald-600 font-mono text-xs">+{fmtAvg(stat.averageAdditions)}</td>
                          <td className="px-6 py-4 text-right text-rose-500 font-mono text-xs">-{fmtAvg(stat.averageDeletions)}</td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700">
                            {fmtAvg(stat.averageChangedFileCount)} <span className="text-xs text-slate-400 font-normal">files</span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700">{fmtAvg(stat.averageCommitCount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-500">Showing {labels.length} labels · {totalPRs} total PRs</span>
              </div>
            </div>
          </>
        )}
    </main>
  );
}
