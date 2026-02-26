'use client';

import WeeklyTrendStatistics from '../../../../../components/WeeklyTrendStatistics';

export default function WeeklyTrendStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <WeeklyTrendStatistics projectId={params.projectId} />;
}
