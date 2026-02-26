import { redirect } from 'next/navigation';

export default function ProjectEntryPage({
  params,
}: {
  params: { projectId: string };
}) {
  redirect(`/projects/${params.projectId}/statistics/summary`);
}
