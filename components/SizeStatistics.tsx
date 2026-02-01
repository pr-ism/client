'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface SizeStat {
  sizeCategory: string;
  count: number;
  percentage: number;
  averageChangedFileCount: number;
  averageCommitCount: number;
}

interface SizeStatisticsData {
  sizeStatistics: SizeStat[];
}

const SIZE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  SMALL: { color: '#10B981', bg: '#D1FAE5', label: 'Recommended' },
  MEDIUM: { color: '#3B82F6', bg: '#DBEAFE', label: 'Acceptable' },
  LARGE: { color: '#F59E0B', bg: '#FEF3C7', label: 'Warning' },
  EXTRA_LARGE: { color: '#EF4444', bg: '#FEE2E2', label: 'Risky' },
};

function fmtAvg(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export default function SizeStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SizeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const distributionChartRef = useRef<HTMLCanvasElement>(null);
  const complexityChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<unknown[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`/projects/${projectId}/statistics/size`);
        if (!res.ok) {
          setError('PR 크기 분포 통계를 불러오는데 실패했습니다.');
          return;
        }
        const result: SizeStatisticsData = await res.json();
        setData(result.sizeStatistics);
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
    if (loading || data.length === 0) return;

    const tryRenderCharts = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRenderCharts, 200);
        return;
      }
      const ChartJS = win.Chart as any;

      chartInstancesRef.current.forEach((c: any) => c?.destroy());
      chartInstancesRef.current = [];

      // Chart 1: Doughnut
      if (distributionChartRef.current) {
        const ctx = distributionChartRef.current.getContext('2d')!;
        chartInstancesRef.current.push(
          new ChartJS(ctx, {
            type: 'doughnut',
            data: {
              labels: data.map((d) => d.sizeCategory),
              datasets: [
                {
                  data: data.map((d) => d.count),
                  backgroundColor: data.map(
                    (d) => SIZE_CONFIG[d.sizeCategory]?.color ?? '#94A3B8',
                  ),
                  borderWidth: 2,
                  borderColor: '#ffffff',
                  hoverOffset: 4,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '70%',
              plugins: {
                legend: {
                  position: 'right' as const,
                  labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } },
                },
                tooltip: {
                  callbacks: {
                    label: (c: any) =>
                      ` ${c.label}: ${c.raw} PRs (${data[c.dataIndex].percentage}%)`,
                  },
                },
              },
            },
          }),
        );
      }

      // Chart 2: Complexity Bar
      if (complexityChartRef.current) {
        const ctx = complexityChartRef.current.getContext('2d')!;
        chartInstancesRef.current.push(
          new ChartJS(ctx, {
            type: 'bar',
            data: {
              labels: data.map((d) => d.sizeCategory),
              datasets: [
                {
                  label: 'Avg Changed Files',
                  data: data.map((d) => d.averageChangedFileCount),
                  backgroundColor: '#6366F1',
                  borderRadius: 4,
                  barPercentage: 0.6,
                },
                {
                  label: 'Avg Commits',
                  data: data.map((d) => d.averageCommitCount),
                  backgroundColor: '#94A3B8',
                  borderRadius: 4,
                  barPercentage: 0.6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' as const, align: 'end' as const },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: '#f1f5f9' },
                  title: { display: true, text: 'Count' },
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
  }, [loading, data]);

  // KPI derivations
  const totalPRs = data.reduce((acc, d) => acc + d.count, 0);
  const dominant =
    data.length > 0
      ? [...data].sort((a, b) => b.count - a.count)[0]
      : null;
  const healthyCount = data
    .filter((d) => d.sizeCategory === 'SMALL' || d.sizeCategory === 'MEDIUM')
    .reduce((acc, d) => acc + d.count, 0);
  const healthyRatio = totalPRs > 0 ? ((healthyCount / totalPRs) * 100).toFixed(1) : '0.0';
  const risky = data.find((d) => d.sizeCategory === 'EXTRA_LARGE');
  const riskyCount = risky ? risky.count : 0;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">
            PR 크기 분포 분석
          </h1>
          <p className="text-slate-500 text-sm">
            PR의 크기(Size Category)별 분포를 파악하여, 코드 리뷰의 난이도와 병합 리스크를 진단합니다.
          </p>
        </div>
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <a href="/projects" className="text-indigo-600 hover:underline text-sm font-medium">
            프로젝트 목록으로
          </a>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-500 font-medium">PR 크기 분포 통계 데이터가 없습니다.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-3 h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Dominant Size */}
            {dominant && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div
                  className="absolute right-0 top-0 w-24 h-24 opacity-50 rounded-bl-full -mr-4 -mt-4 z-0"
                  style={{
                    backgroundColor: SIZE_CONFIG[dominant.sizeCategory]?.bg ?? '#f1f5f9',
                  }}
                />
                <div className="relative z-10">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                    Dominant Size
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-slate-800">
                      {dominant.sizeCategory}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">
                    전체 PR의{' '}
                    <span className="font-bold text-slate-600">{dominant.percentage}%</span>
                    가 이 구간에 속합니다.
                  </p>
                </div>
              </div>
            )}

            {/* Healthy Ratio */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                  Healthy Ratio (S+M)
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-emerald-600">{healthyRatio}%</span>
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">
                    Good
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  Small 및 Medium 크기의 PR 비율입니다.
                </p>
              </div>
            </div>

            {/* Risk Alert */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                  High Risk (XL)
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-rose-600">{riskyCount} PRs</span>
                  <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold">
                    Action Needed
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  리뷰하기 어렵고 병합 충돌 가능성이 높은 PR입니다.
                </p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                  />
                </svg>
                크기별 점유율 (Distribution)
              </h3>
              <div className="h-72 relative flex items-center justify-center">
                <canvas ref={distributionChartRef} />
                <div className="absolute text-center pointer-events-none">
                  <div className="text-3xl font-bold text-slate-800">{totalPRs}</div>
                  <div className="text-xs text-slate-400">Total PRs</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                등급별 평균 복잡도 (Avg Files &amp; Commits)
              </h3>
              <div className="h-72 relative">
                <canvas ref={complexityChartRef} />
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">등급별 상세 통계</h3>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded">
                ※ Size 기준은 서버 정책에 따라 고정되어 있습니다.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Size Category</th>
                    <th className="px-6 py-3 text-right">Count</th>
                    <th className="px-6 py-3 text-right">Share (%)</th>
                    <th className="px-6 py-3 text-right text-indigo-600">Avg Changed Files</th>
                    <th className="px-6 py-3 text-right text-indigo-600">Avg Commits</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((stat) => {
                    const conf = SIZE_CONFIG[stat.sizeCategory] ?? {
                      color: '#94A3B8',
                      bg: '#F1F5F9',
                      label: '-',
                    };
                    return (
                      <tr
                        key={stat.sizeCategory}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5"
                            style={{ backgroundColor: conf.bg, color: conf.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {stat.sizeCategory}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700">
                          {stat.count}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-slate-500 w-8">
                              {stat.percentage}%
                            </span>
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${stat.percentage}%`,
                                  backgroundColor: conf.color,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 font-medium">
                          {fmtAvg(stat.averageChangedFileCount)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 font-medium">
                          {fmtAvg(stat.averageCommitCount)}
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-slate-400">
                          {conf.label}
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
