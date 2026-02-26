'use client';

import SummaryStatistics from '../../../../../components/SummaryStatistics';

export default function SummaryStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <SummaryStatistics projectId={params.projectId} />;
}
