'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ReviewWaitTimeStatistics {
  avgReviewWaitMinutes: number;
  reviewWaitP50Minutes: number;
  reviewWaitP90Minutes: number;
}

interface MergeWaitTimeStatistics {
  avgMergeWaitMinutes: number;
  mergedWithApprovalCount: number;
}

interface ReviewCompletionStatistics {
  coreTimeReviewRate: number;
  coreTimeReviewCount: number;
  sameDayReviewRate: number;
  sameDayReviewCount: number;
}

interface ReviewSpeedStatisticsResponse {
  totalPullRequestCount: number;
  reviewedPullRequestCount: number;
  reviewRate: number;
  reviewWaitTime: ReviewWaitTimeStatistics;
  mergeWaitTime: MergeWaitTimeStatistics;
  reviewCompletion: ReviewCompletionStatistics;
}

const EMPTY_DATA: ReviewSpeedStatisticsResponse = {
  totalPullRequestCount: 0,
  reviewedPullRequestCount: 0,
  reviewRate: 0,
  reviewWaitTime: {
    avgReviewWaitMinutes: 0,
    reviewWaitP50Minutes: 0,
    reviewWaitP90Minutes: 0,
  },
  mergeWaitTime: {
    avgMergeWaitMinutes: 0,
    mergedWithApprovalCount: 0,
  },
  reviewCompletion: {
    coreTimeReviewRate: 0,
    coreTimeReviewCount: 0,
    sameDayReviewRate: 0,
    sameDayReviewCount: 0,
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

function RateProgress({ label, rate, barClass }: { label: string; rate: number; barClass: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1 font-medium text-slate-700">
        <span>{label}</span>
        <span>{formatDecimal(rate)}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`${barClass} h-2 rounded-full`} style={{ width: `${clampPercent(rate)}%` }} />
      </div>
    </div>
  );
}

export default function ReviewSpeedStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ReviewSpeedStatisticsResponse>(EMPTY_DATA);
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
        const url = `/projects/${projectId}/statistics/review-speed?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('리뷰 속도 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: ReviewSpeedStatisticsResponse = await res.json();
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

      const rw = data.reviewWaitTime;
      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: ['P50 (중앙값)', 'Average (평균)', 'P90 (상위 90%)'],
          datasets: [
            {
              label: '대기 시간 (Minutes)',
              data: [rw.reviewWaitP50Minutes, rw.avgReviewWaitMinutes, rw.reviewWaitP90Minutes],
              backgroundColor: ['#34D399', '#60A5FA', '#F87171'],
              borderRadius: 6,
              barPercentage: 0.6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => ` ${formatMinutes(context.raw)} (${context.raw}분)`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { weight: 'bold' as const },
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              title: { display: true, text: 'Minutes' },
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
  }, [loading, error, data.reviewWaitTime]);

  const rw = data.reviewWaitTime;
  const mw = data.mergeWaitTime;
  const rc = data.reviewCompletion;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">리뷰 처리 속도 분석 (Speed &amp; Agility)</h1>
          <p className="text-slate-500 text-sm">
            PR 대기 시간의 분포와 업무 시간 내 처리 비율을 통해 팀의 코드 리뷰 민첩성을 분석합니다.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Review Coverage</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-slate-800">{formatDecimal(data.reviewRate)}%</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-2">
                <span className="text-indigo-600">{data.reviewedPullRequestCount}</span> / {data.totalPullRequestCount} PRs
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-emerald-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2" title="전체 PR 중 중간에 위치한 대기 시간">
                  P50 Wait (Median)
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-3xl font-bold text-emerald-600">{formatMinutes(rw.reviewWaitP50Minutes)}</span>
                </div>
                <p className="text-xs text-emerald-600 font-medium mt-2">일반적인 대기 수준</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-rose-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2" title="하위 10%의 가장 느린 PR 대기 시간 기준선">
                  P90 Wait
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-3xl font-bold text-rose-600">{formatMinutes(rw.reviewWaitP90Minutes)}</span>
                </div>
                <p className="text-xs text-rose-500 mt-2 font-medium">주의: 롱테일 딜레이 구간</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Avg Review Wait</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-indigo-600">{formatMinutes(rw.avgReviewWaitMinutes)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">전체 평균 대기 시간</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Same-Day Review</div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl font-bold text-sky-500">{formatDecimal(rc.sameDayReviewRate)}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                <span className="font-medium text-slate-600">{rc.sameDayReviewCount}</span>건 당일 처리 완료
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Core Time Sync</div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl font-bold text-amber-500">{formatDecimal(rc.coreTimeReviewRate)}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                <span className="font-medium text-slate-600">{rc.coreTimeReviewCount}</span>건 업무 집중 시간 내 처리
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-start mb-2">
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
                    리뷰 대기 시간 분포 (Wait Time Distribution)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    평균(Avg)과 상위 90%(P90)의 격차가 클수록 심각하게 방치되는 소수의 PR이 존재함을 의미합니다.
                  </p>
                </div>
              </div>
              <div className="h-64 relative mt-4">
                <canvas ref={chartRef} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                업무 리듬 및 병합 지연
              </h3>

              <div className="flex-grow flex flex-col justify-center space-y-6">
                <div className="space-y-4">
                  <RateProgress label="당일 리뷰율 (Same Day)" rate={rc.sameDayReviewRate} barClass="bg-sky-400" />
                  <RateProgress label="코어 타임 일치도 (Core Time)" rate={rc.coreTimeReviewRate} barClass="bg-amber-400" />
                </div>

                <hr className="border-slate-100" />

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 border border-white shadow-sm">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                      />
                    </svg>
                  </div>
                  <div className="flex-grow">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-0.5">승인 후 병합 대기 시간</div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-black text-slate-800">{formatMinutes(mw.avgMergeWaitMinutes)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      <span className="font-bold">{mw.mergedWithApprovalCount}</span>개의 승인된 PR 기준
                    </div>
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
