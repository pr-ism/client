'use client';

import TrendStatistics from '../../../../../components/TrendStatistics';

export default function TrendStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <TrendStatistics projectId={params.projectId} />;
}
