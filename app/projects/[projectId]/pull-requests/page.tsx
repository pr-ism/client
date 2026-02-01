'use client';

import PullRequestList from '../../../../components/PullRequestList';

export default function PullRequestsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <PullRequestList projectId={params.projectId} />;
}
