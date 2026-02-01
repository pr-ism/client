'use client';

import ReviewerStatistics from '../../../../../components/ReviewerStatistics';

export default function ReviewerStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <ReviewerStatistics projectId={params.projectId} />;
}
