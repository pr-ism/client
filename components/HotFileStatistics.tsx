'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface HotFileStat {
  fileName: string;
  changeCount: number;
  totalAdditions: number;
  totalDeletions: number;
  modifiedCount: number;
  addedCount: number;
  removedCount: number;
  renamedCount: number;
}

interface HotFileStatisticsData {
  hotFiles: HotFileStat[];
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function shortenFileName(fileName: string): string {
  const parts = fileName.split('/');
  return parts.length > 1 ? '.../' + parts.pop() : parts[0];
}

export default function HotFileStatistics({ projectId }: { projectId: string }) {
  const [allData, setAllData] = useState<HotFileStat[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  const frequencyChartRef = useRef<HTMLCanvasElement>(null);
  const churnChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<unknown[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`/projects/${projectId}/statistics/hot-files?limit=50`);
        if (!res.ok) {
          setError('핫 파일 통계를 불러오는데 실패했습니다.');
          return;
        }
        const data: HotFileStatisticsData = await res.json();
        const sorted = [...data.hotFiles].sort(
          (a, b) => b.changeCount - a.changeCount,
        );
        setAllData(sorted);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const displayData = allData.slice(0, limit);

  // Charts
  useEffect(() => {
    if (loading || displayData.length === 0) return;

    const tryRenderCharts = () => {
      const win = window as unknown as Record<string, unknown>;
      if (!win.Chart) {
        setTimeout(tryRenderCharts, 200);
        return;
      }
      const ChartJS = win.Chart as any;

      chartInstancesRef.current.forEach((c: any) => c?.destroy());
      chartInstancesRef.current = [];

      const labels = displayData.map((d) => shortenFileName(d.fileName));

      // Chart 1: Change Frequency (Horizontal Bar)
      if (frequencyChartRef.current) {
        const ctx = frequencyChartRef.current.getContext('2d')!;
        chartInstancesRef.current.push(
          new ChartJS(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Change Count',
                  data: displayData.map((d) => d.changeCount),
                  backgroundColor: '#F43F5E',
                  borderRadius: 4,
                  barThickness: 20,
                },
              ],
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                y: {
                  grid: { display: false },
                  ticks: { font: { size: 11, family: 'Pretendard' } },
                },
              },
            },
          }),
        );
      }

      // Chart 2: Churn (Stacked Bar)
      if (churnChartRef.current) {
        const ctx = churnChartRef.current.getContext('2d')!;
        chartInstancesRef.current.push(
          new ChartJS(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Additions',
                  data: displayData.map((d) => d.totalAdditions),
                  backgroundColor: '#34D399',
                  stack: 'Stack 0',
                  borderRadius: 2,
                },
                {
                  label: 'Deletions',
                  data: displayData.map((d) => d.totalDeletions),
                  backgroundColor: '#FB7185',
                  stack: 'Stack 0',
                  borderRadius: 2,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top' as const,
                  align: 'end' as const,
                  labels: { boxWidth: 10, usePointStyle: true },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: '#f1f5f9' },
                  title: { display: true, text: 'Lines of Code' },
                },
                x: { grid: { display: false }, ticks: { display: false } },
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
  }, [loading, displayData]);

  // KPI derivations
  const hottest =
    displayData.length > 0 ? displayData[0] : null;
  const volatile =
    displayData.length > 0
      ? [...displayData].sort(
          (a, b) =>
            b.totalAdditions + b.totalDeletions - (a.totalAdditions + a.totalDeletions),
        )[0]
      : null;
  const moved =
    displayData.length > 0
      ? [...displayData].sort((a, b) => b.renamedCount - a.renamedCount)[0]
      : null;

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-6 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">
            핫 파일 분석 (Hot Spots)
          </h1>
          <p className="text-slate-500 text-sm">
            변경 빈도가 가장 높은 파일을 식별하여 잠재적인 병목 지점과 리팩토링 대상을 파악합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm text-sm hover:border-indigo-300 transition-colors">
            <span className="text-slate-500 font-medium">Show Top:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="bg-transparent font-bold text-indigo-600 outline-none cursor-pointer"
            >
              <option value={5}>5 Files</option>
              <option value={10}>10 Files</option>
              <option value={20}>20 Files</option>
              <option value={50}>50 Files</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <a
            href="/projects"
            className="text-indigo-600 hover:underline text-sm font-medium"
          >
            프로젝트 목록으로
          </a>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && allData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-500 font-medium">핫 파일 통계 데이터가 없습니다.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-3 h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && displayData.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Hottest File */}
            {hottest && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 z-0" />
                <div className="relative z-10">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                    Hottest File (Most Changes)
                  </div>
                  <div
                    className="mb-1 w-full overflow-hidden text-ellipsis whitespace-nowrap"
                    title={hottest.fileName}
                  >
                    <span className="text-lg font-bold text-slate-800">
                      {hottest.fileName.split('/').pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-rose-600">
                      {hottest.changeCount}
                    </span>
                    <span className="text-sm text-slate-500">Changes</span>
                  </div>
                </div>
              </div>
            )}

            {/* High Churn */}
            {volatile && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 z-0" />
                <div className="relative z-10">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                    Highest Churn (Volatile)
                  </div>
                  <div
                    className="mb-1 w-full overflow-hidden text-ellipsis whitespace-nowrap"
                    title={volatile.fileName}
                  >
                    <span className="text-lg font-bold text-slate-800">
                      {volatile.fileName.split('/').pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-indigo-600">
                      {fmt(volatile.totalAdditions + volatile.totalDeletions)}
                    </span>
                    <span className="text-sm text-slate-500">Lines Changed</span>
                  </div>
                </div>
              </div>
            )}

            {/* Renamed / Moved */}
            {moved && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 z-0" />
                <div className="relative z-10">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">
                    Renamed / Moved
                  </div>
                  <div
                    className="mb-1 w-full overflow-hidden text-ellipsis whitespace-nowrap"
                    title={moved.fileName}
                  >
                    <span className="text-lg font-bold text-slate-800">
                      {moved.fileName.split('/').pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-amber-600">
                      {moved.renamedCount}
                    </span>
                    <span className="text-sm text-slate-500">Renames</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-rose-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                  />
                </svg>
                변경 빈도 순위 (Change Count)
              </h3>
              <div className="h-80 relative">
                <canvas ref={frequencyChartRef} />
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                코드 변동폭 (Additions vs Deletions)
              </h3>
              <div className="h-80 relative">
                <canvas ref={churnChartRef} />
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">상세 파일 변경 내역</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 w-1/3">File Name</th>
                    <th className="px-6 py-3 text-right">Changes</th>
                    <th className="px-6 py-3 text-right">Total Impact</th>
                    <th className="px-6 py-3 text-center">Breakdown (Event Types)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayData.map((file) => {
                    const totalImpact = file.totalAdditions + file.totalDeletions;
                    return (
                      <tr
                        key={file.fileName}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span
                              className="font-medium text-slate-700 text-sm truncate"
                              title={file.fileName}
                            >
                              {file.fileName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                              {file.fileName.split('/').slice(0, -1).join('/') + '/'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-rose-500">
                            {file.changeCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-slate-700 font-mono text-xs font-bold">
                              {fmt(totalImpact)}
                            </span>
                            <div className="flex gap-1 text-[10px]">
                              <span className="text-emerald-500">
                                +{file.totalAdditions}
                              </span>
                              <span className="text-rose-400">
                                -{file.totalDeletions}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center flex-wrap gap-1">
                            {file.modifiedCount > 0 && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                                Mod: {file.modifiedCount}
                              </span>
                            )}
                            {file.addedCount > 0 && (
                              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded border border-green-100">
                                Add: {file.addedCount}
                              </span>
                            )}
                            {file.removedCount > 0 && (
                              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                                Rem: {file.removedCount}
                              </span>
                            )}
                            {file.renamedCount > 0 && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100">
                                Mov: {file.renamedCount}
                              </span>
                            )}
                          </div>
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
