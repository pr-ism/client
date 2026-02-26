'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ReviewerConcentrationStatistics {
  giniCoefficient: number;
  top3ReviewerRate: number;
  totalReviewerCount: number;
}

interface DraftPrStatistics {
  repeatedDraftPrRate: number;
  repeatedDraftPrCount: number;
}

interface ReviewerAdditionStatistics {
  reviewerAddedRate: number;
  reviewerAddedPrCount: number;
}

interface AuthorReviewWaitTime {
  authorId: number;
  authorName: string;
  avgReviewWaitMinutes: number;
  prCount: number;
}

interface ReviewerStats {
  reviewerId: number;
  reviewerName: string;
  reviewCount: number;
  avgResponseTimeMinutes: number;
}

interface CollaborationStatisticsResponse {
  totalPullRequestCount: number;
  reviewedPullRequestCount: number;
  reviewerConcentration: ReviewerConcentrationStatistics;
  draftPr: DraftPrStatistics;
  reviewerAddition: ReviewerAdditionStatistics;
  authorReviewWaitTimes: AuthorReviewWaitTime[];
  reviewerStats: ReviewerStats[];
}

const EMPTY_DATA: CollaborationStatisticsResponse = {
  totalPullRequestCount: 0,
  reviewedPullRequestCount: 0,
  reviewerConcentration: {
    giniCoefficient: 0,
    top3ReviewerRate: 0,
    totalReviewerCount: 0,
  },
  draftPr: {
    repeatedDraftPrRate: 0,
    repeatedDraftPrCount: 0,
  },
  reviewerAddition: {
    reviewerAddedRate: 0,
    reviewerAddedPrCount: 0,
  },
  authorReviewWaitTimes: [],
  reviewerStats: [],
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

function getGiniColorClass(gini: number): string {
  if (gini > 0.6) return 'text-rose-500 bg-rose-50';
  if (gini > 0.4) return 'text-amber-500 bg-amber-50';
  return 'text-emerald-500 bg-emerald-50';
}

export default function CollaborationStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CollaborationStatisticsResponse>(EMPTY_DATA);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const authorWaitChartRef = useRef<HTMLCanvasElement>(null);
  const reviewerScatterChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<unknown[]>([]);

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
        const url = `/projects/${projectId}/statistics/collaboration?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('협업 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: CollaborationStatisticsResponse = await res.json();
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

  const authorRows = useMemo(
    () => [...data.authorReviewWaitTimes].sort((a, b) => b.avgReviewWaitMinutes - a.avgReviewWaitMinutes),
    [data.authorReviewWaitTimes],
  );
  const reviewerRows = useMemo(
    () => [...data.reviewerStats].sort((a, b) => b.reviewCount - a.reviewCount),
    [data.reviewerStats],
  );

  useEffect(() => {
    if (loading || error) return;
    const hasChartData = authorRows.length > 0 || reviewerRows.length > 0;
    if (!hasChartData) {
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

      if (authorWaitChartRef.current && authorRows.length > 0) {
        const ctx = authorWaitChartRef.current.getContext('2d');
        if (ctx) {
          chartInstancesRef.current.push(
            new ChartJS(ctx, {
              type: 'bar',
              data: {
                labels: authorRows.map((item) => item.authorName),
                datasets: [
                  {
                    label: 'Avg Wait (Minutes)',
                    data: authorRows.map((item) => item.avgReviewWaitMinutes),
                    backgroundColor: '#FB7185',
                    borderRadius: 4,
                    barPercentage: 0.6,
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
                  y: { grid: { display: false } },
                },
              },
            }),
          );
        }
      }

      if (reviewerScatterChartRef.current && reviewerRows.length > 0) {
        const ctx = reviewerScatterChartRef.current.getContext('2d');
        if (ctx) {
          chartInstancesRef.current.push(
            new ChartJS(ctx, {
              type: 'scatter',
              data: {
                datasets: [
                  {
                    label: 'Reviewers',
                    data: reviewerRows.map((item) => ({
                      x: item.reviewCount,
                      y: item.avgResponseTimeMinutes,
                      label: item.reviewerName,
                    })),
                    backgroundColor: '#6366F1',
                    pointRadius: 6,
                    pointHoverRadius: 8,
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
                      label: (context: any) => {
                        const point = context.raw;
                        return `${point.label}: ${point.x} Reviews, Avg ${formatMinutes(point.y)}`;
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    title: { display: true, text: 'Review Count (Workload)' },
                    grid: { color: '#f1f5f9' },
                    beginAtZero: true,
                  },
                  y: {
                    title: { display: true, text: 'Avg Response Time (Minutes)' },
                    grid: { color: '#f1f5f9' },
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
  }, [loading, error, authorRows, reviewerRows]);

  const reviewCoverageRate =
    data.totalPullRequestCount > 0
      ? (data.reviewedPullRequestCount / data.totalPullRequestCount) * 100
      : 0;

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
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">팀 협업 지표 (Collaboration)</h1>
          <p className="text-slate-500 text-sm">
            작성자와 리뷰어 간의 상호작용 속도, 리뷰 집중도 및 지연 유발 요인을 분석합니다.
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
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Review Coverage</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-indigo-600">{formatDecimal(reviewCoverageRate, 1)}%</span>
                <span className="text-sm font-medium text-slate-400 mb-1">
                  ({data.reviewedPullRequestCount}/{data.totalPullRequestCount} PRs)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full"
                  style={{ width: `${clampPercent(reviewCoverageRate)}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Reviewer Concentration</div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-slate-800">
                  {formatDecimal(data.reviewerConcentration.top3ReviewerRate)}%
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${getGiniColorClass(data.reviewerConcentration.giniCoefficient)}`}
                >
                  Gini: {formatDecimal(data.reviewerConcentration.giniCoefficient)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                상위 3명이 전체 리뷰의 {formatDecimal(data.reviewerConcentration.top3ReviewerRate)}%를 담당합니다.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Repeated Draft PRs</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-amber-500">{formatDecimal(data.draftPr.repeatedDraftPrRate)}%</span>
                <span className="text-sm font-medium text-slate-400 mb-1">({data.draftPr.repeatedDraftPrCount} PRs)</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">작업 컨텍스트 스위칭 지연 요소입니다.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Late Reviewer Addition</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-rose-500">{formatDecimal(data.reviewerAddition.reviewerAddedRate)}%</span>
                <span className="text-sm font-medium text-slate-400 mb-1">
                  ({data.reviewerAddition.reviewerAddedPrCount} PRs)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">리뷰어 지각 할당으로 인한 병목입니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  작성자별 리뷰 대기 시간
                </h3>
                <p className="text-xs text-slate-400">PR 작성 후 첫 리뷰가 달릴 때까지의 평균 시간</p>
              </div>
              <div className="h-64 relative">
                {authorRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">표시할 데이터가 없습니다.</div>
                ) : (
                  <canvas ref={authorWaitChartRef} />
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  리뷰어 응답 속도 및 작업량 (Scatter)
                </h3>
                <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">X: 리뷰 횟수 | Y: 평균 응답 시간</div>
              </div>
              <div className="h-64 relative">
                {reviewerRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">표시할 데이터가 없습니다.</div>
                ) : (
                  <canvas ref={reviewerScatterChartRef} />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">작성자 관점 (Author Stats)</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar flex-grow">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Author</th>
                      <th className="px-6 py-3 text-right">PR Count</th>
                      <th className="px-6 py-3 text-right">Avg Wait Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {authorRows.length === 0 && (
                      <tr>
                        <td className="px-6 py-4 text-slate-400" colSpan={3}>
                          작성자 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                    {authorRows.map((author) => (
                      <tr key={author.authorId} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-3 font-medium text-slate-700">{author.authorName}</td>
                        <td className="px-6 py-3 text-right font-bold text-slate-600">{author.prCount}</td>
                        <td className="px-6 py-3 text-right text-rose-600 font-medium">
                          {formatMinutes(author.avgReviewWaitMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">리뷰어 관점 (Reviewer Stats)</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar flex-grow">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Reviewer</th>
                      <th className="px-6 py-3 text-right">Review Count</th>
                      <th className="px-6 py-3 text-right">Avg Response Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reviewerRows.length === 0 && (
                      <tr>
                        <td className="px-6 py-4 text-slate-400" colSpan={3}>
                          리뷰어 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                    {reviewerRows.map((reviewer) => (
                      <tr key={reviewer.reviewerId} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-3 font-medium text-slate-700">{reviewer.reviewerName}</td>
                        <td className="px-6 py-3 text-right font-bold text-indigo-600">{reviewer.reviewCount}</td>
                        <td className="px-6 py-3 text-right text-slate-600 font-medium">
                          {formatMinutes(reviewer.avgResponseTimeMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
