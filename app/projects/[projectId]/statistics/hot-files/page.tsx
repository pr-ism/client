'use client';

import HotFileStatistics from '../../../../../components/HotFileStatistics';

export default function HotFileStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <HotFileStatistics projectId={params.projectId} />;
}
