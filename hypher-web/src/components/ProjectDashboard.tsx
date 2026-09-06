"use client";

import type { Project } from "@/types";

interface Props {
  projects: Project[];
  onSelectProject: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectDashboard({ projects, onSelectProject }: Props) {
  if (projects.length === 0) {
    return (
      <div className="dashboard">
        <div className="dashboard-empty">
          <p className="dashboard-empty-title">No projects yet</p>
          <p className="dashboard-empty-sub">Go home and give Hypher a scrap of context, or create a project here.</p>
        </div>
      </div>
    );
  }

  const sorted = [...projects].sort(
    (a, b) => (b.lastActivity ?? b.modifiedAt) - (a.lastActivity ?? a.modifiedAt)
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Projects</h2>
      </div>

      <div className="dashboard-grid">
        {sorted.map((project) => (
          <article key={project.id} className="dashboard-card">
            <div className="dashboard-card-top">
              <button
                type="button"
                className="dashboard-card-name dashboard-card-name-btn"
                onClick={() => onSelectProject(project.id)}
              >
                {project.name}
              </button>
            </div>

            <div className="dashboard-card-bottom">
              {project.githubRepo ? (
                <code className="integrations-repo-badge">{project.githubRepo}</code>
              ) : (
                <span className="dashboard-card-count">No repo bound</span>
              )}
              <span className="dashboard-card-activity">
                {timeAgo(project.lastActivity ?? project.modifiedAt)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
