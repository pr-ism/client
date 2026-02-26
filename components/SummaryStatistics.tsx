'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface OverviewSummary {
  totalPrCount: number;
  mergedPrCount: number;
  closedPrCount: number;
  mergeSuccessRate: number;
  avgMergeTimeMinutes: number;
  avgSizeScore: number;
  dominantSizeGrade: string;
}

interface ReviewHealthSummary {
  reviewRate: number;
  avgReviewWaitMinutes: number;
  firstReviewApproveRate: number;
  changesRequestedRate: number;
  closedWithoutReviewRate: number;
}

interface TeamActivitySummary {
  totalReviewerCount: number;
  avgReviewersPerPr: number;
  avgReviewRoundTrips: number;
  avgCommentCount: number;
  reviewerGiniCoefficient: number;
}

interface BottleneckSummary {
  avgReviewWaitMinutes: number;
  avgReviewProgressMinutes: number;
  avgMergeWaitMinutes: number;
  totalCycleTimeMinutes: number;
}

interface StatisticsSummaryResponse {
  overview: OverviewSummary;
  reviewHealth: ReviewHealthSummary;
  teamActivity: TeamActivitySummary;
  bottleneck: BottleneckSummary;
}

const EMPTY_SUMMARY: StatisticsSummaryResponse = {
  overview: {
    totalPrCount: 0,
    mergedPrCount: 0,
    closedPrCount: 0,
    mergeSuccessRate: 0,
    avgMergeTimeMinutes: 0,
    avgSizeScore: 0,
    dominantSizeGrade: 'N/A',
  },
  reviewHealth: {
    reviewRate: 0,
    avgReviewWaitMinutes: 0,
    firstReviewApproveRate: 0,
    changesRequestedRate: 0,
    closedWithoutReviewRate: 0,
  },
  teamActivity: {
    totalReviewerCount: 0,
    avgReviewersPerPr: 0,
    avgReviewRoundTrips: 0,
    avgCommentCount: 0,
    reviewerGiniCoefficient: 0,
  },
  bottleneck: {
    avgReviewWaitMinutes: 0,
    avgReviewProgressMinutes: 0,
    avgMergeWaitMinutes: 0,
    totalCycleTimeMinutes: 0,
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

function getGiniBadge(gini: number): { colorClass: string; label: string } {
  if (gini > 0.6) {
    return { colorClass: 'text-rose-600 bg-rose-50', label: 'Highly Unequal' };
  }
  if (gini > 0.4) {
    return { colorClass: 'text-amber-600 bg-amber-50', label: 'Slightly Skewed' };
  }
  return { colorClass: 'text-emerald-600 bg-emerald-50', label: 'Well Distributed' };
}

export default function SummaryStatistics({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<StatisticsSummaryResponse>(EMPTY_SUMMARY);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

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
        const url = `/projects/${projectId}/statistics/summary?${params.toString()}`;

        const res = await fetchWithAuth(url);
        if (!res.ok) {
          if (!active) return;
          setError('종합 통계를 불러오는데 실패했습니다.');
          setSummary(EMPTY_SUMMARY);
          return;
        }

        const data: StatisticsSummaryResponse = await res.json();
        if (!active) return;
        setSummary(data);
        setError('');
      } catch {
        if (!active) return;
        setError('서버에 연결할 수 없습니다.');
        setSummary(EMPTY_SUMMARY);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [projectId, startDate, endDate]);

  const bottleneck = summary.bottleneck;
  const totalCycleTime =
    bottleneck.totalCycleTimeMinutes > 0
      ? bottleneck.totalCycleTimeMinutes
      : bottleneck.avgReviewWaitMinutes + bottleneck.avgReviewProgressMinutes + bottleneck.avgMergeWaitMinutes;

  const bottleneckPercentages = useMemo(() => {
    if (totalCycleTime <= 0) {
      return { wait: 0, progress: 0, merge: 0 };
    }
    return {
      wait: clampPercent((bottleneck.avgReviewWaitMinutes / totalCycleTime) * 100),
      progress: clampPercent((bottleneck.avgReviewProgressMinutes / totalCycleTime) * 100),
      merge: clampPercent((bottleneck.avgMergeWaitMinutes / totalCycleTime) * 100),
    };
  }, [
    bottleneck.avgMergeWaitMinutes,
    bottleneck.avgReviewProgressMinutes,
    bottleneck.avgReviewWaitMinutes,
    totalCycleTime,
  ]);

  const giniBadge = getGiniBadge(summary.teamActivity.reviewerGiniCoefficient);

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">종합 통계 요약 (Overview)</h1>
          <p className="text-slate-500 text-sm">
            프로젝트의 PR 처리 현황, 리뷰 건전성 및 팀 협업 활동을 종합적으로 분석합니다.
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
              <div className="text-3xl font-bold text-slate-800 mb-1">{summary.overview.totalPrCount}</div>
              <div className="flex gap-2 text-xs font-medium mt-2">
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Merged: {summary.overview.mergedPrCount}
                </span>
                <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Closed: {summary.overview.closedPrCount}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Merge Success Rate</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-emerald-600">
                  {formatDecimal(summary.overview.mergeSuccessRate)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full"
                  style={{ width: `${clampPercent(summary.overview.mergeSuccessRate)}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Avg Merge Time</div>
              <div className="text-3xl font-bold text-indigo-600 mb-1">
                {formatMinutes(summary.overview.avgMergeTimeMinutes)}
              </div>
              <p className="text-xs text-slate-400 mt-2">생성부터 병합 완료까지 소요 시간</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                Dominant Size Grade
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-amber-500">{summary.overview.dominantSizeGrade}</span>
                <span className="text-sm font-medium text-slate-500">
                  Score: {formatDecimal(summary.overview.avgSizeScore)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">가장 자주 생성되는 PR 규모</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    병목 구간 분석 (Cycle Time)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    PR 생성부터 병합까지 소요되는 총 리드 타임(Lead Time)의 세부 구성입니다.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-medium">Total Cycle Time</div>
                  <div className="text-2xl font-bold text-slate-800">{formatMinutes(totalCycleTime)}</div>
                </div>
              </div>

              <div className="relative w-full h-12 bg-slate-100 rounded-lg overflow-hidden flex shadow-inner mt-4">
                <div
                  className="bg-amber-400 h-full transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${bottleneckPercentages.wait}%` }}
                  title={`Wait: ${formatMinutes(bottleneck.avgReviewWaitMinutes)}`}
                />
                <div
                  className="bg-indigo-500 h-full transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${bottleneckPercentages.progress}%` }}
                  title={`Progress: ${formatMinutes(bottleneck.avgReviewProgressMinutes)}`}
                />
                <div
                  className="bg-emerald-400 h-full transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${bottleneckPercentages.merge}%` }}
                  title={`Merge Wait: ${formatMinutes(bottleneck.avgMergeWaitMinutes)}`}
                />
              </div>

              <div className="flex justify-between mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-amber-400" />
                  <div>
                    <div className="font-medium text-slate-700">1. 리뷰 대기</div>
                    <div className="text-xs text-slate-500">{formatMinutes(bottleneck.avgReviewWaitMinutes)}</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500" />
                  <div>
                    <div className="font-medium text-slate-700">2. 리뷰 진행</div>
                    <div className="text-xs text-slate-500">{formatMinutes(bottleneck.avgReviewProgressMinutes)}</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-400" />
                  <div>
                    <div className="font-medium text-slate-700">3. 병합 대기</div>
                    <div className="text-xs text-slate-500">{formatMinutes(bottleneck.avgMergeWaitMinutes)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                팀 협업 지수 (Team Activity)
              </h3>

              <div className="space-y-4 flex-grow flex flex-col justify-center">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-sm font-medium text-slate-600">Total Reviewers</span>
                  <span className="font-bold text-slate-800">{summary.teamActivity.totalReviewerCount}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-sm font-medium text-slate-600">Avg Reviewers / PR</span>
                  <span className="font-bold text-indigo-600">{formatDecimal(summary.teamActivity.avgReviewersPerPr)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-sm font-medium text-slate-600">Round Trips / PR</span>
                  <span className="font-bold text-slate-800">{formatDecimal(summary.teamActivity.avgReviewRoundTrips)}</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-600">
                      Gini Coefficient{' '}
                      <span
                        className="text-[10px] text-slate-400 cursor-help"
                        title="0에 가까울수록 리뷰 부담이 균등함"
                      >
                        (?)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${giniBadge.colorClass}`}>
                      {giniBadge.label}
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatDecimal(summary.teamActivity.reviewerGiniCoefficient)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                리뷰 건전성 진단 (Review Health)
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="flex flex-col pt-4 md:pt-0 md:px-6 first:px-0 first:pt-0">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Avg Review Wait</div>
                <div className="text-2xl font-bold text-sky-600 mb-2">
                  {formatMinutes(summary.reviewHealth.avgReviewWaitMinutes)}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                  <div className="bg-sky-400 h-1.5 rounded-full" style={{ width: '100%' }} />
                </div>
                <div className="text-xs text-slate-400 leading-tight">
                  리뷰어가 할당된 후 첫 리뷰가 달리기까지의 대기 시간입니다.
                </div>
              </div>

              <div className="flex flex-col pt-4 md:pt-0 md:px-6 first:px-0 first:pt-0">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Review Rate</div>
                <div className="text-2xl font-bold text-indigo-600 mb-2">
                  {formatDecimal(summary.reviewHealth.reviewRate)}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full"
                    style={{ width: `${clampPercent(summary.reviewHealth.reviewRate)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 leading-tight">최소 1개 이상의 리뷰가 달린 PR의 비율입니다.</div>
              </div>

              <div className="flex flex-col pt-4 md:pt-0 md:px-6 first:px-0 first:pt-0">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">First Review Approve</div>
                <div className="text-2xl font-bold text-emerald-500 mb-2">
                  {formatDecimal(summary.reviewHealth.firstReviewApproveRate)}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full"
                    style={{ width: `${clampPercent(summary.reviewHealth.firstReviewApproveRate)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 leading-tight">
                  단 한 번의 리뷰 라운드로 승인된(LGTM) 비율입니다.
                </div>
              </div>

              <div className="flex flex-col pt-4 md:pt-0 md:px-6 first:px-0 first:pt-0">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Changes Requested</div>
                <div className="text-2xl font-bold text-amber-500 mb-2">
                  {formatDecimal(summary.reviewHealth.changesRequestedRate)}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full"
                    style={{ width: `${clampPercent(summary.reviewHealth.changesRequestedRate)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 leading-tight">
                  수정 요청(Changes Requested)이 발생한 PR의 비율입니다.
                </div>
              </div>

              <div className="flex flex-col pt-4 md:pt-0 md:px-6 first:px-0 first:pt-0">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Closed W/O Review</div>
                <div className="text-2xl font-bold text-rose-500 mb-2">
                  {formatDecimal(summary.reviewHealth.closedWithoutReviewRate)}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-rose-400 h-1.5 rounded-full"
                    style={{ width: `${clampPercent(summary.reviewHealth.closedWithoutReviewRate)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 leading-tight">
                  리뷰 없이 닫히거나 병합된(패스된) 위험 PR 비율입니다.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
