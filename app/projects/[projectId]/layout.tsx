'use client';

import ProjectNav from '../../../components/ProjectNav';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  return (
    <>
      <script src="https://cdn.jsdelivr.net/npm/chart.js" async />
      <ProjectNav projectId={params.projectId} />
      {children}
    </>
  );
}
