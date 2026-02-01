'use client';

import SizeStatistics from '../../../../../components/SizeStatistics';

export default function SizeStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <SizeStatistics projectId={params.projectId} />;
}
