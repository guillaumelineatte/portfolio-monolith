"use client";

import { projects } from "@/content/projects";
import { pad } from "@/lib/format";
import { ProjectVisual } from "./ProjectVisual";

export function ProjectView({ index }: { index: number }) {
  const p = projects[index];

  return (
    <section className="view project" tabIndex={-1}>
      {/* Static, outside the split/reveal animation (it sometimes stayed hidden after a route change). */}
      <header>
        <span className="pj-num">
          {pad(index + 1)} / {pad(projects.length)}
        </span>
        <h1 className="pj-title">{p.title}</h1>
      </header>
      {/* Same for the meta/desc, they used to get stuck hidden mid-transition. */}
      <div className="pj-grid">
        <dl className="pj-meta">
          <div>
            <dt>Year</dt>
            <dd>{p.year}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{p.role}</dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>{p.client}</dd>
          </div>
        </dl>
        <p className="pj-desc">{p.text}</p>
      </div>
      <ProjectVisual project={p} />
    </section>
  );
}
