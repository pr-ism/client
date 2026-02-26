'use client';

import ReviewQualityStatistics from '../../../../../components/ReviewQualityStatistics';

export default function ReviewQualityStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <ReviewQualityStatistics projectId={params.projectId} />;
}
