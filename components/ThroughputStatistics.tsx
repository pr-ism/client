'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

interface ThroughputStatisticsResponse {
  mergedPrCount: number;
  closedPrCount: number;
  avgMergeTimeMinutes: number;
  mergeSuccessRate: number;
  closedPrRate: number;
}

const EMPTY_DATA: ThroughputStatisticsResponse = {
  mergedPrCount: 0,
  closedPrCount: 0,
  avgMergeTimeMinutes: 0,
  mergeSuccessRate: 0,
  closedPrRate: 0,
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

function RateDetail({
  dotClass,
  label,
  value,
  barClass,
  description,
}: {
  dotClass: string;
  label: string;
  value: number;
  barClass: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${dotClass}`} />
          <span className="font-bold text-slate-700">{label}</span>
        </div>
        <div className="text-xl font-black text-slate-700">{formatDecimal(value)}%</div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 shadow-inner">
        <div className={`${barClass} h-3 rounded-full transition-all duration-1000`} style={{ width: `${clampPercent(value)}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-2">{description}</p>
    </div>
  );
}

export default function ThroughputStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ThroughputStatisticsResponse>(EMPTY_DATA);
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
        const url = `/projects/${projectId}/statistics/throughput?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('처리율 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: ThroughputStatisticsResponse = await res.json();
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

      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Merged (성공)', 'Closed (폐기)'],
          datasets: [
            {
              data: [data.mergeSuccessRate, data.closedPrRate],
              backgroundColor: ['#10B981', '#CBD5E1'],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => ` ${context.label}: ${context.raw}%`,
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
  }, [loading, error, data.closedPrRate, data.mergeSuccessRate]);

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">팀 처리율 분석 (Throughput)</h1>
          <p className="text-slate-500 text-sm">
            팀이 기간 내에 성공적으로 병합한 PR의 양과 속도를 분석하여 전반적인 생산성을 측정합니다.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-emerald-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide">Merged PRs</div>
                </div>
                <div className="text-4xl font-black text-slate-800 mb-1">{data.mergedPrCount}</div>
                <p className="text-xs text-slate-400 font-medium mt-1">성공적으로 반영된 코드 변경 건수</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-slate-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide">Closed PRs</div>
                </div>
                <div className="text-4xl font-black text-slate-600 mb-1">{data.closedPrCount}</div>
                <p className="text-xs text-slate-400 font-medium mt-1">병합되지 못하고 취소/폐기된 건수</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden hover:border-indigo-300 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 z-0" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wide">Avg Merge Time</div>
                </div>
                <div className="text-4xl font-black text-indigo-600 mb-1">{formatMinutes(data.avgMergeTimeMinutes)}</div>
                <p className="text-xs text-slate-400 font-medium mt-1">오픈 후 반영되기까지의 평균 소요 시간</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                PR 전환율 (Conversion Rate)
              </h3>
              <div className="h-64 relative flex items-center justify-center">
                <canvas ref={chartRef} />
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-800">{formatDecimal(data.mergeSuccessRate)}%</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Success</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-8">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                성공 및 취소 비율 상세
              </h3>

              <div className="space-y-8">
                <RateDetail
                  dotClass="bg-emerald-500"
                  label="Merge Success Rate"
                  value={data.mergeSuccessRate}
                  barClass="bg-emerald-500"
                  description="전체 PR 중 코드가 최종적으로 베이스 브랜치에 반영된 비율입니다."
                />

                <RateDetail
                  dotClass="bg-slate-400"
                  label="Closed PR Rate"
                  value={data.closedPrRate}
                  barClass="bg-slate-400"
                  description="작업이 취소되거나 반려되어 병합 없이 닫힌 비율입니다."
                />
              </div>

              <hr className="border-slate-100 my-8" />

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-indigo-900 mb-1">인사이트 (Insight)</div>
                  <p className="text-xs text-indigo-700 leading-relaxed leading-5">
                    병합 성공률(Merge Success Rate)이 높고 평균 병합 시간이 짧을수록 팀의 개발 흐름이 매끄럽습니다. 만약 닫힌 PR
                    비율(Closed PR Rate)이 지속적으로 15%를 초과한다면, 요구사항의 불명확성이나 불필요한 작업이 진행되고 있는지 점검이
                    필요합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
