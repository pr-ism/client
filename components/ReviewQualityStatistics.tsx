'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ReviewActivityStatistics {
  avgReviewRoundTrips: number;
  avgCommentCount: number;
  avgCommentDensity: number;
  withAdditionalReviewersCount: number;
  withChangesAfterReviewCount: number;
  firstReviewApproveRate: number;
  postReviewCommitRate: number;
  changesRequestedRate: number;
  avgChangesResolutionMinutes: number;
  highIntensityPrRate: number;
}

interface ReviewerEngagementStatistics {
  totalReviewerCount: number;
  avgReviewersPerPr: number;
  avgSessionDurationMinutes: number;
  avgReviewsPerSession: number;
}

interface ReviewQualityStatisticsResponse {
  totalPullRequestCount: number;
  reviewedPullRequestCount: number;
  reviewRate: number;
  reviewActivity: ReviewActivityStatistics;
  reviewerStats: ReviewerEngagementStatistics;
}

const EMPTY_DATA: ReviewQualityStatisticsResponse = {
  totalPullRequestCount: 0,
  reviewedPullRequestCount: 0,
  reviewRate: 0,
  reviewActivity: {
    avgReviewRoundTrips: 0,
    avgCommentCount: 0,
    avgCommentDensity: 0,
    withAdditionalReviewersCount: 0,
    withChangesAfterReviewCount: 0,
    firstReviewApproveRate: 0,
    postReviewCommitRate: 0,
    changesRequestedRate: 0,
    avgChangesResolutionMinutes: 0,
    highIntensityPrRate: 0,
  },
  reviewerStats: {
    totalReviewerCount: 0,
    avgReviewersPerPr: 0,
    avgSessionDurationMinutes: 0,
    avgReviewsPerSession: 0,
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

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function DetailProgressBar({
  label,
  value,
  barClass,
}: {
  label: string;
  value: number;
  barClass: string;
}) {
  const normalized = clampPercent(value);
  return (
    <div>
      <div className="flex justify-between items-end mb-1">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-800">{formatDecimal(value)}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`${barClass} h-2 rounded-full`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

export default function ReviewQualityStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ReviewQualityStatisticsResponse>(EMPTY_DATA);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const radarChartRef = useRef<HTMLCanvasElement>(null);
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
        const url = `/projects/${projectId}/statistics/review-quality?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('리뷰 품질 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: ReviewQualityStatisticsResponse = await res.json();
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

  const radarValues = useMemo(() => {
    const act = data.reviewActivity;
    const rev = data.reviewerStats;

    return [
      safeNumber(act.avgCommentCount) * 5,
      safeNumber(act.avgReviewRoundTrips) * 25,
      safeNumber(act.avgCommentDensity) * 20,
      safeNumber(act.highIntensityPrRate) * 3,
      safeNumber(rev.avgReviewersPerPr) * 30,
    ];
  }, [data.reviewActivity, data.reviewerStats]);

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

      if (!radarChartRef.current) return;
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).destroy();
      }

      const ctx = radarChartRef.current.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'radar',
        data: {
          labels: ['코멘트 수', '핑퐁 횟수 (Round Trips)', '코멘트 밀도', '고강도 논의 비율', '참여 리뷰어 수'],
          datasets: [
            {
              label: 'Review Culture Shape',
              data: radarValues,
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              borderColor: '#6366F1',
              pointBackgroundColor: '#6366F1',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: '#6366F1',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            r: {
              angleLines: { color: '#f1f5f9' },
              grid: { color: '#f1f5f9' },
              pointLabels: {
                font: { size: 11 },
                color: '#64748b',
              },
              ticks: {
                display: false,
                min: 0,
              },
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
  }, [loading, error, radarValues]);

  const act = data.reviewActivity;
  const rev = data.reviewerStats;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">리뷰 품질 및 심도 분석 (Review Quality)</h1>
          <p className="text-slate-500 text-sm">
            리뷰 과정의 밀도, 핑퐁(Round Trips), 수정 발생률을 통해 리뷰가 코드에 미치는 실질적인 파급력을 진단합니다.
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Review Rate</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-indigo-600">{formatDecimal(data.reviewRate)}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {data.reviewedPullRequestCount} / {data.totalPullRequestCount} PRs reviewed.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div
                className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2 cursor-help"
                title="단 한 번의 리뷰 라운드로 승인된 비율"
              >
                First Review Approve (LGTM)
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-emerald-500">{formatDecimal(act.firstReviewApproveRate)}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">수정 없이 즉시 승인된 PR의 비율.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Changes Requested Rate</div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl font-bold text-amber-500">{formatDecimal(act.changesRequestedRate)}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">공식적인 수정 요청이 발생한 비율.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-rose-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">High Intensity PRs</div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl font-bold text-rose-500">{formatDecimal(act.highIntensityPrRate)}%</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">다수의 핑퐁과 코멘트가 발생한 고강도 리뷰.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 flex flex-col items-center">
              <div className="w-full flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  팀 리뷰 문화 형태
                </h3>
              </div>
              <p className="text-xs text-slate-400 w-full mb-4">코멘트, 핑퐁, 밀도 등 5가지 핵심 지표의 밸런스입니다.</p>
              <div className="h-64 w-full relative">
                <canvas ref={radarChartRef} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                리뷰 파급력 및 결과 (Outcomes)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex flex-col justify-center">
                  <div className="text-sm font-bold text-slate-700 mb-1">리뷰 후 커밋 발생률 (Post-Review Commits)</div>
                  <div className="text-xs text-slate-500 mb-3">
                    리뷰 피드백을 수용하여 추가 커밋이 발생한 PR의 비중입니다. 리뷰의 실효성을 나타냅니다.
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-indigo-600">{formatDecimal(act.postReviewCommitRate)}%</span>
                    <span className="text-sm font-medium text-slate-400 mb-1">({act.withChangesAfterReviewCount} PRs changed)</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex flex-col justify-center">
                  <div className="text-sm font-bold text-slate-700 mb-1">공식 수정 요청률 (Changes Requested)</div>
                  <div className="text-xs text-slate-500 mb-3">
                    단순 코멘트를 넘어, 리뷰어가 &apos;Changes Requested&apos; 상태를 마크한 강한 피드백의 비중입니다.
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-amber-500">{formatDecimal(act.changesRequestedRate)}%</span>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100 my-6" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border-2 border-white shadow-sm">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">피드백 평균 해결 시간 (Resolution Time)</div>
                    <div className="text-xs text-slate-500">
                      수정 요청(Changes Requested)이 발생한 시점부터 최종 승인(LGTM)을 받기까지 걸리는 시간입니다.
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-emerald-600">{formatMinutes(act.avgChangesResolutionMinutes)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm">
                세부 리뷰 활동 (Activity Details)
              </div>
              <div className="p-6 space-y-4">
                <DetailProgressBar label="Avg Review Round Trips" value={act.avgReviewRoundTrips} barClass="bg-indigo-400" />
                <DetailProgressBar label="Avg Comment Count" value={act.avgCommentCount} barClass="bg-sky-400" />
                <DetailProgressBar
                  label="Avg Comment Density (per 100 LOC)"
                  value={act.avgCommentDensity}
                  barClass="bg-teal-400"
                />
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                  <span className="text-sm text-slate-600 font-medium">PRs with Additional Reviewers</span>
                  <span className="font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
                    {act.withAdditionalReviewersCount} 건
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm">
                리뷰어 참여 지표 (Reviewer Engagement)
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-slate-600">Total Active Reviewers</span>
                  <span className="font-bold text-slate-800 text-lg">{rev.totalReviewerCount} 명</span>
                </div>

                <DetailProgressBar label="Avg Reviewers per PR" value={rev.avgReviewersPerPr} barClass="bg-indigo-400" />

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <div className="text-xs text-slate-500 font-semibold mb-1">Avg Session Duration</div>
                    <div className="text-xl font-bold text-emerald-600">{formatMinutes(rev.avgSessionDurationMinutes)}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <div className="text-xs text-slate-500 font-semibold mb-1">Reviews per Session</div>
                    <div className="text-xl font-bold text-indigo-600">{formatDecimal(rev.avgReviewsPerSession)}</div>
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
