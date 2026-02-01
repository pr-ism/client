'use client';

import AuthorStatistics from '../../../../../components/AuthorStatistics';

export default function AuthorStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <AuthorStatistics projectId={params.projectId} />;
}
