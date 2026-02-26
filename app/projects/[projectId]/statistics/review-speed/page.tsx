'use client';

import ReviewSpeedStatistics from '../../../../../components/ReviewSpeedStatistics';

export default function ReviewSpeedStatisticsPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <ReviewSpeedStatistics projectId={params.projectId} />;
}
