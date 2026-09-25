import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/ProjectView";
import { projects, getProject, getProjectIndex } from "@/content/projects";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.text,
    openGraph: { images: [project.image] },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = getProjectIndex(slug);
  if (index < 0) notFound();
  return <ProjectView index={index} />;
}
