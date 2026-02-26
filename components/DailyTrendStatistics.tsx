'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface DailyPrTrend {
  date: string;
  count: number;
}

interface TrendSummary {
  totalCreatedCount: number;
  totalMergedCount: number;
  avgDailyCreatedCount: number;
  avgDailyMergedCount: number;
  peakCreatedDate: string | null;
  peakCreatedCount: number;
  peakMergedDate: string | null;
  peakMergedCount: number;
}

interface DailyTrendStatisticsResponse {
  dailyCreatedTrend: DailyPrTrend[];
  dailyMergedTrend: DailyPrTrend[];
  summary: TrendSummary;
}

interface DailyTrendRow {
  date: string;
  created: number;
  merged: number;
  net: number;
}

const EMPTY_DATA: DailyTrendStatisticsResponse = {
  dailyCreatedTrend: [],
  dailyMergedTrend: [],
  summary: {
    totalCreatedCount: 0,
    totalMergedCount: 0,
    avgDailyCreatedCount: 0,
    avgDailyMergedCount: 0,
    peakCreatedDate: null,
    peakCreatedCount: 0,
    peakMergedDate: null,
    peakMergedCount: 0,
  },
};

function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDecimal(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(precision)).toString();
}

function formatLabelDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  return dateStr.slice(5);
}

function downloadRowsAsCsv(rows: DailyTrendRow[]) {
  const header = ['Date', 'Created PRs', 'Merged PRs', 'Net Change'];
  const lines = [
    header.join(','),
    ...rows.map((row) => [row.date, row.created, row.merged, row.net].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'daily-trend.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DailyTrendStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DailyTrendStatisticsResponse>(EMPTY_DATA);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 13);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(now));
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        const url = `/projects/${projectId}/statistics/daily-trend?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('일간 추이 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: DailyTrendStatisticsResponse = await res.json();
        if (!active) return;
        setData(json);
        setError('');
      } catch {
        if (!active) return;
        setError('서버에 연결할 수 없습니다.');
        setData(EMPTY_DATA);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [projectId, startDate, endDate]);

  const rows = useMemo(() => {
    const createdMap = new Map<string, number>();
    const mergedMap = new Map<string, number>();

    data.dailyCreatedTrend.forEach((item) => createdMap.set(item.date, item.count));
    data.dailyMergedTrend.forEach((item) => mergedMap.set(item.date, item.count));

    const dateSet = new Set<string>([...createdMap.keys(), ...mergedMap.keys()]);
    const sortedDates = Array.from(dateSet).sort();

    return sortedDates.map((date) => {
      const created = createdMap.get(date) ?? 0;
      const merged = mergedMap.get(date) ?? 0;
      return {
        date,
        created,
        merged,
        net: created - merged,
      };
    });
  }, [data.dailyCreatedTrend, data.dailyMergedTrend]);

  useEffect(() => {
    if (loading || error || rows.length === 0) {
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    const tryRender = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRender, 200);
        return;
      }
      const ChartJS = win.Chart as any;

      if (!chartRef.current) return;
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'line',
        data: {
          labels: rows.map((row) => formatLabelDate(row.date)),
          datasets: [
            {
              label: 'Created PRs',
              data: rows.map((row) => row.created),
              borderColor: '#6366F1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: '#6366F1',
              fill: true,
              tension: 0.3,
            },
            {
              label: 'Merged PRs',
              data: rows.map((row) => row.merged),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: '#10B981',
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => `${context.dataset.label}: ${context.raw}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
            },
            y: {
              grid: { color: '#f1f5f9' },
              beginAtZero: true,
              ticks: { stepSize: 1 },
            },
          },
        },
      });
    };

    tryRender();

    return () => {
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [loading, error, rows]);

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">일간 트렌드 (Daily Trend)</h1>
          <p className="text-slate-500 text-sm">
            매일 생성 및 병합되는 PR의 수를 비교하여 팀의 개발 리듬과 병목 발생 시점을 파악합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm text-sm">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-28 text-center font-medium text-slate-700 bg-transparent outline-none cursor-pointer hover:text-indigo-600"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-28 text-center font-medium text-slate-700 bg-transparent outline-none cursor-pointer hover:text-indigo-600"
          />
        </div>
      </div>

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <a href="/projects" className="text-indigo-600 hover:underline text-sm font-medium">
            프로젝트 목록으로
          </a>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Total Activity</div>
              <div className="flex justify-between items-end mt-2">
                <div>
                  <div className="text-sm text-slate-500 font-medium mb-0.5">Created</div>
                  <div className="text-2xl font-bold text-indigo-600">{data.summary.totalCreatedCount}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium mb-0.5 text-right">Merged</div>
                  <div className="text-2xl font-bold text-emerald-600 text-right">{data.summary.totalMergedCount}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Daily Averages</div>
              <div className="flex justify-between items-end mt-2">
                <div>
                  <div className="text-sm text-slate-500 font-medium mb-0.5">Created</div>
                  <div className="text-2xl font-bold text-indigo-400">{formatDecimal(data.summary.avgDailyCreatedCount)}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium mb-0.5 text-right">Merged</div>
                  <div className="text-2xl font-bold text-emerald-400 text-right">{formatDecimal(data.summary.avgDailyMergedCount)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Peak Creation Day</div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl font-bold text-indigo-600">{data.summary.peakCreatedCount}</span>
                  <span className="text-sm text-slate-500">PRs</span>
                </div>
                <div className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded w-fit mt-1">
                  {data.summary.peakCreatedDate ?? '-'}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Peak Merge Day</div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl font-bold text-emerald-600">{data.summary.peakMergedCount}</span>
                  <span className="text-sm text-slate-500">PRs</span>
                </div>
                <div className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded w-fit mt-1">
                  {data.summary.peakMergedDate ?? '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                생성 vs 병합 추이 (Created vs Merged)
              </h3>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-indigo-500 rounded-sm" />
                  <span className="text-slate-600">Created PRs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-500 rounded-sm" />
                  <span className="text-slate-600">Merged PRs</span>
                </div>
              </div>
            </div>
            <div className="h-80 relative">
              {rows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">표시할 데이터가 없습니다.</div>
              ) : (
                <canvas ref={chartRef} />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">일자별 상세 데이터</h3>
              <button
                onClick={() => downloadRowsAsCsv(rows)}
                className="text-xs text-indigo-600 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
                disabled={rows.length === 0}
              >
                Download CSV
              </button>
            </div>
            <div className="overflow-x-auto custom-scrollbar flex-grow">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Created PRs</th>
                    <th className="px-6 py-3 text-right">Merged PRs</th>
                    <th className="px-6 py-3 text-right">Net Change (Created - Merged)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-6 py-4 text-slate-400" colSpan={4}>
                        일간 추이 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-3 font-mono text-sm text-slate-600">{row.date}</td>
                      <td className="px-6 py-3 text-right font-bold text-indigo-600">{row.created}</td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-600">{row.merged}</td>
                      <td className="px-6 py-3 text-right">
                        {row.net === 0 && <span className="text-slate-500 font-medium">0</span>}
                        {row.net > 0 && (
                          <span className="text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded">
                            +{row.net} (Backlog 늘어남)
                          </span>
                        )}
                        {row.net < 0 && (
                          <span className="text-emerald-500 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            {row.net} (Backlog 해소됨)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
