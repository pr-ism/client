'use client';

import PullRequestSizeStatistics from '../../../../../components/PullRequestSizeStatistics';

export default function PullRequestSizeStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <PullRequestSizeStatistics projectId={params.projectId} />;
}
