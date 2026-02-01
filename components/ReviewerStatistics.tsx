'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ReviewerStat {
  reviewerGithubMention: string;
  reviewCount: number;
  totalAdditions: number;
  totalDeletions: number;
  averageAdditions: number;
  averageDeletions: number;
  averageCommitCount: number;
  averageChangedFileCount: number;
}

interface ReviewerStatisticsData {
  reviewerStatistics: ReviewerStat[];
}

function getInitials(name: string): string {
  const cleaned = name.replace(/^@/, '');
  return cleaned
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtAvg(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-600',
  'bg-emerald-100 text-emerald-600',
  'bg-rose-100 text-rose-600',
  'bg-amber-100 text-amber-600',
  'bg-sky-100 text-sky-600',
];

function getColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ReviewerStatistics({ projectId }: { projectId: string }) {
  const [reviewers, setReviewers] = useState<ReviewerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const activityChartRef = useRef<HTMLCanvasElement>(null);
  const impactChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<unknown[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`/projects/${projectId}/statistics/reviewers`);
        if (!res.ok) {
          setError('리뷰어 통계를 불러오는데 실패했습니다.');
          return;
        }
        const data: ReviewerStatisticsData = await res.json();
        const sorted = [...data.reviewerStatistics].sort(
          (a, b) => b.reviewCount - a.reviewCount,
        );
        setReviewers(sorted);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  // Charts
  useEffect(() => {
    if (loading || reviewers.length === 0) return;

    const tryRenderCharts = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRenderCharts, 200);
        return;
      }
      const ChartJS = win.Chart as any;

      // Destroy previous
      chartInstancesRef.current.forEach((c: any) => c?.destroy());
      chartInstancesRef.current = [];

      const labels = reviewers.map((d) =>
        d.reviewerGithubMention.length > 12
          ? d.reviewerGithubMention.slice(0, 12) + '…'
          : d.reviewerGithubMention,
      );

      // Chart 1: Review Activity
      if (activityChartRef.current) {
        const ctx = activityChartRef.current.getContext('2d')!;
        chartInstancesRef.current.push(
          new ChartJS(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Review Count',
                  data: reviewers.map((d) => d.reviewCount),
                  backgroundColor: '#818CF8',
                  borderRadius: 4,
                  barPercentage: 0.6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } },
              },
            },
          }),
        );
      }

      // Chart 2: Average Impact
      if (impactChartRef.current) {
        const ctx = impactChartRef.current.getContext('2d')!;
        chartInstancesRef.current.push(
          new ChartJS(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Avg Additions',
                  data: reviewers.map((d) => d.averageAdditions),
                  backgroundColor: '#34D399',
                  borderRadius: 4,
                },
                {
                  label: 'Avg Deletions',
                  data: reviewers.map((d) => d.averageDeletions),
                  backgroundColor: '#FB7185',
                  borderRadius: 4,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top' as const, align: 'end' as const } },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: '#f1f5f9' },
                  title: { display: true, text: 'Lines of Code' },
                },
                x: { grid: { display: false } },
              },
            },
          }),
        );
      }
    };

    tryRenderCharts();

    return () => {
      chartInstancesRef.current.forEach((c: any) => c?.destroy());
      chartInstancesRef.current = [];
    };
  }, [loading, reviewers]);

  // KPI derivations
  const mostActive = reviewers.length > 0
    ? [...reviewers].sort((a, b) => b.reviewCount - a.reviewCount)[0]
    : null;
  const heavyLifter = reviewers.length > 0
    ? [...reviewers].sort(
        (a, b) =>
          b.totalAdditions + b.totalDeletions - (a.totalAdditions + a.totalDeletions),
      )[0]
    : null;
  const complexReviewer = reviewers.length > 0
    ? [...reviewers].sort(
        (a, b) => b.averageChangedFileCount - a.averageChangedFileCount,
      )[0]
    : null;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">리뷰어별 참여 분석</h1>
            <p className="text-slate-500 text-sm">프로젝트 내 리뷰어들의 활동량(Count)과 리뷰한 코드의 규모(Impact)를 분석합니다.</p>
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
        {!loading && !error && reviewers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-slate-500 font-medium">리뷰어 통계 데이터가 없습니다.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-3 h-32 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        )}

        {!loading && !error && reviewers.length > 0 && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Most Active */}
              {mostActive && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 z-0" />
                  <div className="relative z-10">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Most Active Reviewer</div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl font-bold text-slate-800 break-all">{mostActive.reviewerGithubMention}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-indigo-600">{mostActive.reviewCount}</span>
                      <span className="text-sm text-slate-500">Reviews</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Heavy Lifter */}
              {heavyLifter && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 z-0" />
                  <div className="relative z-10">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Code Guardian (Total Lines)</div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl font-bold text-slate-800 break-all">{heavyLifter.reviewerGithubMention}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-emerald-600">
                        {fmt(heavyLifter.totalAdditions + heavyLifter.totalDeletions)}
                      </span>
                      <span className="text-sm text-slate-500">Lines Reviewed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Complex Reviewer */}
              {complexReviewer && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 z-0" />
                  <div className="relative z-10">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Complex Reviews (Avg Files)</div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl font-bold text-slate-800 break-all">{complexReviewer.reviewerGithubMention}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-amber-600">{fmtAvg(complexReviewer.averageChangedFileCount)}</span>
                      <span className="text-sm text-slate-500">Files / Review</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  리뷰 활동량 (Review Count)
                </h3>
                <div className="h-64 relative">
                  <canvas ref={activityChartRef} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  평균 리뷰 코드 규모 (Avg. Lines)
                </h3>
                <div className="h-64 relative">
                  <canvas ref={impactChartRef} />
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">리뷰어별 상세 지표</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Reviewer</th>
                      <th className="px-6 py-3 text-right">Review Count</th>
                      <th className="px-6 py-3 text-right">Total Add/Del</th>
                      <th className="px-6 py-3 text-right">Avg Additions</th>
                      <th className="px-6 py-3 text-right">Avg Deletions</th>
                      <th className="px-6 py-3 text-right text-indigo-600">Avg Commits</th>
                      <th className="px-6 py-3 text-right text-indigo-600">Avg Files</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reviewers.map((stat) => {
                      const totalImpact = stat.totalAdditions + stat.totalDeletions;
                      const avatarClass = getColor(stat.reviewerGithubMention);
                      const initials = getInitials(stat.reviewerGithubMention) || 'R';

                      return (
                        <tr key={stat.reviewerGithubMention} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full ${avatarClass} flex items-center justify-center text-xs font-bold border border-white shadow-sm`}>
                                {initials}
                              </div>
                              <span className="font-medium text-slate-700">{stat.reviewerGithubMention}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-100">
                              {stat.reviewCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-500 text-xs font-mono">
                            {fmt(totalImpact)}
                          </td>
                          <td className="px-6 py-4 text-right text-emerald-600 font-mono text-xs font-medium">
                            +{fmtAvg(stat.averageAdditions)}
                          </td>
                          <td className="px-6 py-4 text-right text-rose-500 font-mono text-xs font-medium">
                            -{fmtAvg(stat.averageDeletions)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700">
                            {fmtAvg(stat.averageCommitCount)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700">
                            {fmtAvg(stat.averageChangedFileCount)}
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
