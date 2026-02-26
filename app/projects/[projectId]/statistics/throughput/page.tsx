'use client';

import ThroughputStatistics from '../../../../../components/ThroughputStatistics';

export default function ThroughputStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <ThroughputStatistics projectId={params.projectId} />;
}
