'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface TrendDataPoint {
  periodStart: string;
  prCount: number;
  averageChangeAmount: number;
}

interface TrendStatisticsData {
  period: string;
  trends: TrendDataPoint[];
}

function fmt(n: number): string {
  return n.toLocaleString();
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
          <div className="flex justify-between items-center mb-3">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}년 {MONTH_NAMES[viewMonth]}</span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

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
export default function TrendStatistics({ projectId }: { projectId: string }) {
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [period, setPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /* 초기 날짜 설정: 3개월 전 ~ 오늘 */
  useEffect(() => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    setStartDate(toDateStr(threeMonthsAgo));
    setEndDate(toDateStr(now));
  }, []);

  /* 데이터 로드 */
  useEffect(() => {
    if (!startDate || !endDate) return;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('period', period);
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        const url = `/projects/${projectId}/statistics/trends?${params.toString()}`;
        const res = await fetchWithAuth(url);
        if (!res.ok) {
          setError('트렌드 통계를 불러오는데 실패했습니다.');
          return;
        }
        const data: TrendStatisticsData = await res.json();
        setTrends(data.trends);
        setError('');
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, period, startDate, endDate]);

  /* Chart */
  useEffect(() => {
    if (loading || trends.length === 0) return;

    const tryRender = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) { setTimeout(tryRender, 200); return; }
      const ChartJS = win.Chart as any;

      if (chartRef.current) {
        if (chartInstanceRef.current) (chartInstanceRef.current as any).destroy();
        const ctx = chartRef.current.getContext('2d')!;
        chartInstanceRef.current = new ChartJS(ctx, {
          type: 'bar',
          data: {
            labels: trends.map((d) => d.periodStart),
            datasets: [
              {
                label: 'PR Count',
                data: trends.map((d) => d.prCount),
                backgroundColor: '#818CF8',
                borderRadius: 4,
                barPercentage: 0.6,
                order: 2,
                yAxisID: 'y',
              },
              {
                label: 'Avg Change Amount',
                data: trends.map((d) => d.averageChangeAmount),
                borderColor: '#10B981',
                backgroundColor: '#10B981',
                type: 'line',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.3,
                order: 1,
                yAxisID: 'y1',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const label = context.dataset.label || '';
                    if (context.dataset.yAxisID === 'y1') {
                      return `${label}: ${context.raw.toLocaleString()} lines`;
                    }
                    return `${label}: ${context.raw} PRs`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: 45, minRotation: 0 },
              },
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: 'PR Count' },
                grid: { color: '#f1f5f9' },
                beginAtZero: true,
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'Avg Lines' },
                grid: { display: false },
                beginAtZero: true,
              },
            },
          },
        });
      }
    };
    tryRender();

    return () => {
      if (chartInstanceRef.current) { (chartInstanceRef.current as any).destroy(); chartInstanceRef.current = null; }
    };
  }, [trends, loading]);

  /* KPI 계산 */
  const totalPRs = trends.reduce((acc, cur) => acc + cur.prCount, 0);
  const peak = trends.length > 0
    ? [...trends].sort((a, b) => b.prCount - a.prCount)[0]
    : null;
  const validPeriods = trends.filter((d) => d.averageChangeAmount > 0);
  const avgImpact = validPeriods.length
    ? Math.round(validPeriods.reduce((acc, cur) => acc + cur.averageChangeAmount, 0) / validPeriods.length)
    : 0;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      {/* Header + Controls */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">PR 생성 및 변경 트렌드</h1>
          <p className="text-slate-500 text-sm">시간 흐름에 따른 PR 생성 횟수와 코드 변경량 추이를 분석하여 개발 리듬을 파악합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Toggle */}
          <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
            <button
              onClick={() => setPeriod('WEEKLY')}
              className={[
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                period === 'WEEKLY'
                  ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50',
              ].join(' ')}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod('MONTHLY')}
              className={[
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                period === 'MONTHLY'
                  ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50',
              ].join(' ')}
            >
              Monthly
            </button>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <DatePicker value={startDate} onChange={setStartDate} placeholder="시작일" />
            <span className="text-slate-400 text-sm">~</span>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="종료일" alignRight />
          </div>
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
      {!loading && !error && trends.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-500 font-medium">트렌드 통계 데이터가 없습니다.</p>
        </div>
      )}

      {!loading && !error && trends.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Total Activity */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 pointer-events-none" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Total Activity</div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-slate-800">{totalPRs}</span>
                  <span className="text-sm text-slate-500 font-medium">PRs Generated</span>
                </div>
              </div>
            </div>

            {/* Peak Period */}
            {peak && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
                <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 pointer-events-none" />
                <div className="relative z-10">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Peak Period</div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-slate-800">{peak.periodStart}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-emerald-600">{peak.prCount}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Highest</span>
                  </div>
                </div>
              </div>
            )}

            {/* Average Impact */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 pointer-events-none" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Avg Code Change</div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-rose-600">{fmt(avgImpact)}</span>
                  <span className="text-sm text-slate-500 font-medium">Lines / PR</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                활동량 및 변경량 추이 (Activity &amp; Impact)
              </h3>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-indigo-400 rounded-sm" />
                  <span className="text-slate-600">PR Count (Bar)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                  <span className="text-slate-600">Avg Change Amount (Line)</span>
                </div>
              </div>
            </div>
            <div className="h-80 relative">
              <canvas ref={chartRef} />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">기간별 상세 데이터</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Period Start</th>
                    <th className="px-6 py-3 text-right">PR Count</th>
                    <th className="px-6 py-3 text-right">Avg Change Amount</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trends.map((row, index) => {
                    let statusHtml: React.ReactNode = <span className="text-slate-400">-</span>;
                    if (index > 0) {
                      const prev = trends[index - 1];
                      if (row.prCount > prev.prCount) {
                        statusHtml = (
                          <span className="text-emerald-600 inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            Up
                          </span>
                        );
                      } else if (row.prCount < prev.prCount) {
                        statusHtml = (
                          <span className="text-rose-500 inline-flex items-center gap-1 text-xs font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                            Down
                          </span>
                        );
                      }
                    }

                    return (
                      <tr key={row.periodStart} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-slate-600">{row.periodStart}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">{row.prCount}</td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600">{fmt(row.averageChangeAmount)}</td>
                        <td className="px-6 py-4 text-center">{statusHtml}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing {trends.length} periods · {totalPRs} total PRs
              </span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
