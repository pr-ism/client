'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface AverageTimeStatistics {
  averageTimeToMergeMinutes: number;
  averageLifespanMinutes: number;
  averageActiveWorkMinutes: number;
}

interface HealthStatistics {
  closedWithoutReviewCount: number;
  closedWithoutReviewRate: number;
  reopenedCount: number;
  reopenedRate: number;
  averageStateChangeCount: number;
}

interface LifecycleStatisticsResponse {
  totalPullRequestCount: number;
  mergedCount: number;
  closedWithoutMergeCount: number;
  mergeRate: number;
  averageTime: AverageTimeStatistics;
  health: HealthStatistics;
}

const EMPTY_DATA: LifecycleStatisticsResponse = {
  totalPullRequestCount: 0,
  mergedCount: 0,
  closedWithoutMergeCount: 0,
  mergeRate: 0,
  averageTime: {
    averageTimeToMergeMinutes: 0,
    averageLifespanMinutes: 0,
    averageActiveWorkMinutes: 0,
  },
  health: {
    closedWithoutReviewCount: 0,
    closedWithoutReviewRate: 0,
    reopenedCount: 0,
    reopenedRate: 0,
    averageStateChangeCount: 0,
  },
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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getAlertClass(rate: number, threshold: number): string {
  if (rate === 0) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (rate > threshold) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function LifecycleStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<LifecycleStatisticsResponse>(EMPTY_DATA);
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
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setStartDate(toDateStr(defaultStart));
    setEndDate(toDateStr(defaultEnd));
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
        const url = `/projects/${projectId}/statistics/lifecycle?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('수명주기 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: LifecycleStatisticsResponse = await res.json();
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

  const activeTimeRatio = useMemo(() => {
    const lifespan = data.averageTime.averageLifespanMinutes;
    if (lifespan <= 0) return 0;
    return (data.averageTime.averageActiveWorkMinutes / lifespan) * 100;
  }, [data.averageTime.averageActiveWorkMinutes, data.averageTime.averageLifespanMinutes]);

  useEffect(() => {
    if (loading || error) {
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
        type: 'bar',
        data: {
          labels: ['총 수명 (Lifespan)', '병합 소요 시간 (To Merge)', '실제 작업 시간 (Active)'],
          datasets: [
            {
              label: '평균 소요 시간 (Minutes)',
              data: [
                data.averageTime.averageLifespanMinutes,
                data.averageTime.averageTimeToMergeMinutes,
                data.averageTime.averageActiveWorkMinutes,
              ],
              backgroundColor: ['#94A3B8', '#6366F1', '#10B981'],
              borderRadius: 4,
              barPercentage: 0.5,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => ` ${formatMinutes(context.raw)} (${context.raw} mins)`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              title: { display: true, text: 'Minutes' },
            },
            y: {
              grid: { display: false },
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
  }, [data.averageTime, loading, error]);

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">PR 생명주기 분석 (Lifecycle)</h1>
          <p className="text-slate-500 text-sm">
            PR이 열리고 닫히기까지의 전체 수명과 소요 시간, 그리고 그 과정의 건전성을 분석합니다.
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
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Total PRs</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-slate-800">{data.totalPullRequestCount}</span>
              </div>
              <div className="flex gap-2 text-xs font-medium mt-3">
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Merged: {data.mergedCount}</span>
                <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
                  Closed: {data.closedWithoutMergeCount}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Merge Rate</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-emerald-600">{formatDecimal(data.mergeRate)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${clampPercent(data.mergeRate)}%` }} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Avg Lifespan</div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl font-bold text-indigo-600">
                    {formatMinutes(data.averageTime.averageLifespanMinutes)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">PR 오픈부터 완전히 닫히기까지의 총 시간</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">State Changes / PR</div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl font-bold text-amber-600">{formatDecimal(data.health.averageStateChangeCount)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Draft, Open, Review 등의 상태 변경 평균 횟수</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    수명주기 소요 시간 (Time Metrics)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">PR이 오픈된 후 닫힐 때까지의 시간적 분포입니다.</p>
                </div>
              </div>
              <div className="h-64 relative">
                <canvas ref={chartRef} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    프로세스 건전성 진단 (Health)
                  </h3>
                </div>
              </div>

              <div className="p-6 flex-grow flex flex-col justify-center gap-6">
                <div className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${getAlertClass(data.health.closedWithoutReviewRate, 5.0)}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm opacity-80">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-sm mb-0.5">Closed Without Review</div>
                      <div className="text-xs opacity-80">리뷰 없이 닫히거나 강제 병합된 PR의 비율입니다.</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{formatDecimal(data.health.closedWithoutReviewRate)}%</div>
                    <div className="text-xs font-medium opacity-80">{data.health.closedWithoutReviewCount} PRs</div>
                  </div>
                </div>

                <div className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${getAlertClass(data.health.reopenedRate, 2.0)}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm opacity-80">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-sm mb-0.5">Reopened Rate</div>
                      <div className="text-xs opacity-80">닫혔던 PR이 문제 해결을 위해 다시 열린 비율입니다.</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{formatDecimal(data.health.reopenedRate)}%</div>
                    <div className="text-xs font-medium opacity-80">{data.health.reopenedCount} PRs</div>
                  </div>
                </div>

                <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 text-sm mb-0.5">Active Time Ratio</div>
                      <div className="text-xs text-slate-500">총 수명 중 실제 작업이 이루어진 시간의 비중입니다.</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">{formatDecimal(activeTimeRatio, 1)}%</div>
                    <div className="text-xs text-slate-400 font-medium">Active / Lifespan</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
