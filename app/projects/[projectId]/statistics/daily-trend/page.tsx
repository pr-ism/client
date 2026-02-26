'use client';

import DailyTrendStatistics from '../../../../../components/DailyTrendStatistics';

export default function DailyTrendStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <DailyTrendStatistics projectId={params.projectId} />;
}
