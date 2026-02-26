'use client';

import LifecycleStatistics from '../../../../../components/LifecycleStatistics';

export default function LifecycleStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <LifecycleStatistics projectId={params.projectId} />;
}
