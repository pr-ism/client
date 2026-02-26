'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface MonthlyThroughput {
  year: number;
  month: number;
  mergedCount: number;
  closedCount: number;
}

interface WeeklyThroughput {
  weekStartDate: string;
  mergedCount: number;
  closedCount: number;
}

interface WeeklyReviewWaitTimeTrend {
  weekStartDate: string;
  avgReviewWaitTimeMinutes: number;
}

interface WeeklyPrSizeTrend {
  weekStartDate: string;
  avgSizeScore: number;
}

interface WeeklyTrendStatisticsResponse {
  monthlyThroughput: MonthlyThroughput[];
  weeklyThroughput: WeeklyThroughput[];
  weeklyReviewWaitTimeTrend: WeeklyReviewWaitTimeTrend[];
  weeklyPrSizeTrend: WeeklyPrSizeTrend[];
}

interface UnifiedWeeklyData {
  weekStartDate: string;
  mergedCount: number;
  closedCount: number;
  avgSizeScore: number;
  avgReviewWaitTimeMinutes: number;
}

const EMPTY_DATA: WeeklyTrendStatisticsResponse = {
  monthlyThroughput: [],
  weeklyThroughput: [],
  weeklyReviewWaitTimeTrend: [],
  weeklyPrSizeTrend: [],
};

function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0m';
  const rounded = Math.round(totalMinutes);
  const days = Math.floor(rounded / (24 * 60));
  const hours = Math.floor((rounded % (24 * 60)) / 60);
  const minutes = rounded % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDecimal(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(precision)).toString();
}

function formatShortDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  return dateStr.slice(5);
}

function downloadRowsAsCsv(rows: UnifiedWeeklyData[]) {
  const header = ['Week Start Date', 'Merged', 'Closed', 'Avg Size Score', 'Avg Wait Time (Minutes)'];
  const lines = [
    header.join(','),
    ...rows.map((row) => {
      return [
        row.weekStartDate,
        row.mergedCount,
        row.closedCount,
        Number(row.avgSizeScore.toFixed(2)),
        Number(row.avgReviewWaitTimeMinutes.toFixed(2)),
      ].join(',');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'weekly-trend.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getSignal(row: UnifiedWeeklyData): { label: string; className: string } | null {
  if (row.avgReviewWaitTimeMinutes > 150 && row.avgSizeScore > 80) {
    return {
      label: 'BottleNeck',
      className: 'text-rose-500 bg-rose-50 border border-rose-100',
    };
  }
  if (row.mergedCount >= 15) {
    return {
      label: 'High Output',
      className: 'text-emerald-600 bg-emerald-50 border border-emerald-100',
    };
  }
  return null;
}

export default function WeeklyTrendStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<WeeklyTrendStatisticsResponse>(EMPTY_DATA);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const throughputChartRef = useRef<HTMLCanvasElement>(null);
  const sizeWaitChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<unknown[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    setStartDate(toDateStr(defaultStart));
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
        const url = `/projects/${projectId}/statistics/weekly-trend?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('주간 트렌드 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: WeeklyTrendStatisticsResponse = await res.json();
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

  const unifiedRows = useMemo(() => {
    const byWeek = new Map<string, UnifiedWeeklyData>();

    data.weeklyThroughput.forEach((item) => {
      byWeek.set(item.weekStartDate, {
        weekStartDate: item.weekStartDate,
        mergedCount: item.mergedCount,
        closedCount: item.closedCount,
        avgSizeScore: 0,
        avgReviewWaitTimeMinutes: 0,
      });
    });

    data.weeklyPrSizeTrend.forEach((item) => {
      const existing = byWeek.get(item.weekStartDate) ?? {
        weekStartDate: item.weekStartDate,
        mergedCount: 0,
        closedCount: 0,
        avgSizeScore: 0,
        avgReviewWaitTimeMinutes: 0,
      };
      existing.avgSizeScore = item.avgSizeScore;
      byWeek.set(item.weekStartDate, existing);
    });

    data.weeklyReviewWaitTimeTrend.forEach((item) => {
      const existing = byWeek.get(item.weekStartDate) ?? {
        weekStartDate: item.weekStartDate,
        mergedCount: 0,
        closedCount: 0,
        avgSizeScore: 0,
        avgReviewWaitTimeMinutes: 0,
      };
      existing.avgReviewWaitTimeMinutes = item.avgReviewWaitTimeMinutes;
      byWeek.set(item.weekStartDate, existing);
    });

    return Array.from(byWeek.values()).sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  }, [data.weeklyPrSizeTrend, data.weeklyReviewWaitTimeTrend, data.weeklyThroughput]);

  const sortedMonthly = useMemo(
    () =>
      [...data.monthlyThroughput].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }),
    [data.monthlyThroughput],
  );

  const currentMonth = sortedMonthly[0] ?? null;
  const previousMonth = sortedMonthly[1] ?? null;
  const mergedDiff = currentMonth && previousMonth ? currentMonth.mergedCount - previousMonth.mergedCount : null;

  useEffect(() => {
    if (loading || error) {
      chartInstancesRef.current.forEach((instance: any) => instance?.destroy());
      chartInstancesRef.current = [];
      return;
    }

    const hasData = unifiedRows.length > 0;
    if (!hasData) {
      chartInstancesRef.current.forEach((instance: any) => instance?.destroy());
      chartInstancesRef.current = [];
      return;
    }

    const tryRender = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRender, 200);
        return;
      }
      const ChartJS = win.Chart as any;

      chartInstancesRef.current.forEach((instance: any) => instance?.destroy());
      chartInstancesRef.current = [];

      const labels = unifiedRows.map((row) => formatShortDate(row.weekStartDate));

      if (throughputChartRef.current) {
        const ctx = throughputChartRef.current.getContext('2d');
        if (ctx) {
          chartInstancesRef.current.push(
            new ChartJS(ctx, {
              type: 'bar',
              data: {
                labels,
                datasets: [
                  {
                    label: 'Merged',
                    data: unifiedRows.map((row) => row.mergedCount),
                    backgroundColor: '#10B981',
                    stack: 'stack0',
                    borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                  },
                  {
                    label: 'Closed',
                    data: unifiedRows.map((row) => row.closedCount),
                    backgroundColor: '#CBD5E1',
                    stack: 'stack0',
                    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, boxWidth: 8 },
                  },
                  tooltip: { mode: 'index', intersect: false },
                },
                scales: {
                  x: {
                    grid: { display: false },
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { stepSize: 5 },
                  },
                },
              },
            }),
          );
        }
      }

      if (sizeWaitChartRef.current) {
        const ctx = sizeWaitChartRef.current.getContext('2d');
        if (ctx) {
          chartInstancesRef.current.push(
            new ChartJS(ctx, {
              data: {
                labels,
                datasets: [
                  {
                    label: 'Avg Size Score',
                    data: unifiedRows.map((row) => row.avgSizeScore),
                    borderColor: '#818CF8',
                    backgroundColor: 'rgba(129, 140, 248, 0.9)',
                    type: 'bar',
                    yAxisID: 'y1',
                    borderRadius: 4,
                    barPercentage: 0.5,
                  },
                  {
                    label: 'Avg Wait (Mins)',
                    data: unifiedRows.map((row) => row.avgReviewWaitTimeMinutes),
                    borderColor: '#FB7185',
                    backgroundColor: '#FB7185',
                    type: 'line',
                    yAxisID: 'y',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 2,
                    tension: 0.3,
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
                        if (context.dataset.yAxisID === 'y') {
                          return `Wait: ${formatMinutes(context.raw)}`;
                        }
                        return `Size Score: ${context.raw}`;
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                  },
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Wait Time (Mins)', color: '#FB7185' },
                    grid: { color: '#f1f5f9' },
                    beginAtZero: true,
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Size Score', color: '#818CF8' },
                    grid: { display: false },
                    beginAtZero: true,
                  },
                },
              },
            }),
          );
        }
      }
    };

    tryRender();

    return () => {
      chartInstancesRef.current.forEach((instance: any) => instance?.destroy());
      chartInstancesRef.current = [];
    };
  }, [loading, error, unifiedRows]);

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
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">주간 종합 트렌드 (Weekly Trend)</h1>
          <p className="text-slate-500 text-sm">
            주차별 PR 처리량, 대기 시간 및 코드 크기의 변화를 추적하여 팀의 중장기적인 개발 템포를 점검합니다.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                Monthly Merged ({currentMonth ? `${currentMonth.year}.${currentMonth.month}` : '-'})
              </div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold text-emerald-600">{currentMonth?.mergedCount ?? 0}</span>
                {mergedDiff !== null && mergedDiff > 0 && (
                  <span className="text-emerald-500 text-xs font-bold">▲ +{mergedDiff} vs last mo</span>
                )}
                {mergedDiff !== null && mergedDiff < 0 && (
                  <span className="text-rose-500 text-xs font-bold">▼ {mergedDiff} vs last mo</span>
                )}
                {mergedDiff === 0 && <span className="text-slate-400 text-xs font-bold">- No change</span>}
              </div>
              <p className="text-xs text-slate-400 mt-2">이번 달 성공적으로 병합된 PR 수량입니다.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                Monthly Closed ({currentMonth ? `${currentMonth.year}.${currentMonth.month}` : '-'})
              </div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold text-slate-600">{currentMonth?.closedCount ?? 0}</span>
                <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">폐기됨</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">이번 달 병합되지 못하고 닫힌 PR 수량입니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    주간 처리량 (Weekly Throughput)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">주차별로 병합(Merged)되거나 닫힌(Closed) PR의 수입니다.</p>
                </div>
              </div>
              <div className="h-64 relative flex-grow">
                {unifiedRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">표시할 데이터가 없습니다.</div>
                ) : (
                  <canvas ref={throughputChartRef} />
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                      />
                    </svg>
                    PR 크기 및 대기 시간 트렌드
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">PR 크기(Size Score) 증감이 리뷰 대기 시간에 미치는 영향을 확인합니다.</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-[10px] font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400" /> Avg Wait Time
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-indigo-400" /> Avg Size Score
                  </span>
                </div>
              </div>
              <div className="h-64 relative flex-grow">
                {unifiedRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">표시할 데이터가 없습니다.</div>
                ) : (
                  <canvas ref={sizeWaitChartRef} />
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">주간 종합 지표 테이블</h3>
              <button
                type="button"
                onClick={() => downloadRowsAsCsv(unifiedRows)}
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                Download CSV
              </button>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Week Start Date</th>
                    <th className="px-6 py-3 text-right">Merged</th>
                    <th className="px-6 py-3 text-right">Closed</th>
                    <th className="px-6 py-3 text-right">Avg Size Score</th>
                    <th className="px-6 py-3 text-right">Avg Wait Time</th>
                    <th className="px-6 py-3 text-center">Trend Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unifiedRows.length === 0 && (
                    <tr>
                      <td className="px-6 py-4 text-slate-400" colSpan={6}>
                        주간 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                  {unifiedRows.map((row) => {
                    const signal = getSignal(row);
                    return (
                      <tr key={row.weekStartDate} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-3 font-mono text-sm text-slate-600">{row.weekStartDate}</td>
                        <td className="px-6 py-3 text-right font-bold text-emerald-600">{row.mergedCount}</td>
                        <td className="px-6 py-3 text-right font-bold text-slate-400">{row.closedCount}</td>
                        <td className="px-6 py-3 text-right text-indigo-600 font-medium">{formatDecimal(row.avgSizeScore)}</td>
                        <td className="px-6 py-3 text-right text-rose-500 font-medium">
                          {formatMinutes(row.avgReviewWaitTimeMinutes)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {signal ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${signal.className}`}>{signal.label}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
