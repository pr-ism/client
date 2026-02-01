'use client';

import LabelStatistics from '../../../../../components/LabelStatistics';

export default function LabelStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <LabelStatistics projectId={params.projectId} />;
}
