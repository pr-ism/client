'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../lib/fetchWithAuth';

type SizeGrade = 'XS' | 'S' | 'M' | 'L' | 'XL';

interface CorrelationStatistics {
  correlationCoefficient: number;
  interpretation: string;
}

interface PullRequestSizeStatisticsResponse {
  totalPullRequestCount: number;
  avgSizeScore: number;
  sizeGradeDistribution: Partial<Record<SizeGrade, number>>;
  largePullRequestRate: number;
  sizeReviewWaitCorrelation: CorrelationStatistics;
  sizeReviewRoundTripCorrelation: CorrelationStatistics;
}

const EMPTY_DATA: PullRequestSizeStatisticsResponse = {
  totalPullRequestCount: 0,
  avgSizeScore: 0,
  sizeGradeDistribution: {
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
  },
  largePullRequestRate: 0,
  sizeReviewWaitCorrelation: {
    correlationCoefficient: 0,
    interpretation: '데이터 부족',
  },
  sizeReviewRoundTripCorrelation: {
    correlationCoefficient: 0,
    interpretation: '데이터 부족',
  },
};

function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDecimal(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(precision)).toString();
}

function getRateStyle(rate: number): { colorClass: string; badgeClass: string; label: string } {
  if (rate > 25) {
    return {
      colorClass: 'text-rose-600',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'High Risk',
    };
  }
  if (rate > 15) {
    return {
      colorClass: 'text-amber-600',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Warning',
    };
  }
  return {
    colorClass: 'text-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Good',
  };
}

function getGaugeColorClass(coef: number): string {
  const abs = Math.abs(coef);
  if (coef > 0) {
    if (abs >= 0.7) return 'bg-rose-500';
    if (abs >= 0.3) return 'bg-amber-500';
    return 'bg-indigo-400';
  }
  if (coef < 0) {
    if (abs >= 0.7) return 'bg-emerald-500';
    if (abs >= 0.3) return 'bg-teal-400';
    return 'bg-sky-400';
  }
  return 'bg-slate-400';
}

function getGaugePositionStyle(coef: number): { width: string; left?: string; right?: string } {
  const pct = `${Math.abs(coef) * 50}%`;
  if (coef >= 0) return { width: pct, left: '50%' };
  return { width: pct, right: '50%' };
}

function CorrelationGauge({
  coef,
  interpretation,
  title,
  description,
}: {
  coef: number;
  interpretation: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-end mb-2">
        <div>
          <div className="font-bold text-slate-700">{title}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-800">{coef.toFixed(2)}</div>
          <div className="text-xs font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {interpretation}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full h-3 bg-slate-100 rounded-full relative overflow-hidden mt-1 shadow-inner border border-slate-200/50">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 z-10" />
        <div
          className={`absolute top-0 bottom-0 ${getGaugeColorClass(coef)} transition-all duration-1000 ease-out rounded-sm`}
          style={getGaugePositionStyle(coef)}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
        <span>-1.0 (음의 상관)</span>
        <span>0.0 (상관없음)</span>
        <span>1.0 (양의 상관)</span>
      </div>
    </div>
  );
}

export default function PullRequestSizeStatistics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<PullRequestSizeStatisticsResponse>(EMPTY_DATA);
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
        const url = `/projects/${projectId}/statistics/pullrequest-size?${params.toString()}`;
        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (!active) return;
          setError('PR 크기 통계를 불러오는데 실패했습니다.');
          setData(EMPTY_DATA);
          return;
        }

        const json: PullRequestSizeStatisticsResponse = await res.json();
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

  const grades: SizeGrade[] = ['XS', 'S', 'M', 'L', 'XL'];
  const distributionCounts = useMemo(
    () => grades.map((grade) => data.sizeGradeDistribution[grade] ?? 0),
    [data.sizeGradeDistribution],
  );

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
          labels: grades,
          datasets: [
            {
              label: 'PR Count',
              data: distributionCounts,
              backgroundColor: ['#34D399', '#60A5FA', '#818CF8', '#FBBF24', '#F87171'],
              borderRadius: 6,
              barPercentage: 0.7,
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
                  const total = data.totalPullRequestCount;
                  const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                  return ` ${context.raw} PRs (${pct}%)`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { weight: 'bold' as const } },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
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
  }, [data.totalPullRequestCount, distributionCounts, loading, error]);

  const rateStyle = getRateStyle(data.largePullRequestRate);

  return (
    <main
      className="flex-grow w-full max-w-7xl mx-auto px-6 py-4 pb-32 transition-opacity duration-300 ease-in-out"
      style={{ opacity: isReady ? 1 : 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">PR 크기 및 영향도 분석</h1>
          <p className="text-slate-500 text-sm">
            PR의 크기 분포를 확인하고, 크기가 리뷰 지연 및 복잡도에 미치는 상관관계를 분석합니다.
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
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Total Analyzed PRs</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-slate-800">{data.totalPullRequestCount}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Avg Size Score</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-indigo-600">{formatDecimal(data.avgSizeScore)}</span>
                <span className="text-sm font-medium text-slate-400 mb-1">Points</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">PR의 추가/삭제 라인수 및 수정 파일 기반 점수</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">Large PR Rate (L, XL)</div>
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-3xl font-bold ${rateStyle.colorClass}`}>{formatDecimal(data.largePullRequestRate)}%</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${rateStyle.badgeClass}`}>
                  {rateStyle.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">리뷰하기 버거운 크기의 PR 비율입니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    크기 등급 분포 (Size Grade Distribution)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">코드 변경량을 기반으로 산정된 PR 크기 등급별 비율입니다.</p>
                </div>
              </div>
              <div className="h-64 relative flex-grow">
                <canvas ref={chartRef} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    영향도 상관관계 분석 (Correlation)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">PR 크기가 지연 및 복잡도(리뷰 핑퐁)에 미치는 영향을 분석합니다.</p>
                </div>
                <div
                  className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100"
                  title="-1.0 ~ 1.0 (양수: 크기가 커질수록 지표도 증가)"
                >
                  Pearson 상관계수 기준
                </div>
              </div>

              <div className="flex-grow flex flex-col justify-center gap-8">
                <CorrelationGauge
                  coef={data.sizeReviewWaitCorrelation.correlationCoefficient}
                  interpretation={data.sizeReviewWaitCorrelation.interpretation}
                  title="PR 크기 ↔ 리뷰 대기 시간"
                  description="PR이 커질수록 첫 리뷰를 받기까지의 시간이 길어지는지 확인합니다."
                />

                <hr className="border-slate-100" />

                <CorrelationGauge
                  coef={data.sizeReviewRoundTripCorrelation.correlationCoefficient}
                  interpretation={data.sizeReviewRoundTripCorrelation.interpretation}
                  title="PR 크기 ↔ 리뷰 핑퐁 (Round Trips)"
                  description="PR이 커질수록 리뷰어와의 수정 요청/피드백 횟수가 증가하는지 확인합니다."
                />

                <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 flex gap-2 items-start">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    <strong>인사이트:</strong> 양의 상관관계가 강하게 나타난다면, 큰 PR이 개발 병목을 유발하고 있음을 의미합니다. PR을 더 작게 분할(Split)하여 올리는 정책을 권장합니다.
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
