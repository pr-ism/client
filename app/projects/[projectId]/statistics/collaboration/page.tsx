'use client';

import CollaborationStatistics from '../../../../../components/CollaborationStatistics';

export default function CollaborationStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <CollaborationStatistics projectId={params.projectId} />;
}
