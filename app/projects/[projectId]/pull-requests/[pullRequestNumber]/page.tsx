'use client';

import PullRequestDetail from '../../../../../components/PullRequestDetail';

export default function PullRequestDetailPage({
  params,
}: {
  params: { projectId: string; pullRequestNumber: string };
}) {
  return (
    <PullRequestDetail
      projectId={params.projectId}
      pullRequestNumber={params.pullRequestNumber}
    />
  );
}
