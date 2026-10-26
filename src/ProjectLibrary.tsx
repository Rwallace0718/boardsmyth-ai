import { useMemo, useState } from 'react';
import { PROJECT_CATEGORIES, STARTER_PROJECTS, type StarterProject } from '../shared/projects';

export default function ProjectLibrary({
  boardName,
  onPick,
  onClose,
}: {
  boardName: string;
  onPick: (p: StarterProject) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<string>('All');
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return STARTER_PROJECTS.filter(
      (p) =>
        (cat === 'All' || p.category === cat) &&
        (!needle || `${p.title} ${p.summary} ${p.parts}`.toLowerCase().includes(needle))
    );
  }, [cat, q]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal projects" role="dialog" aria-label="Starter projects" onClick={(e) => e.stopPropagation()}>
        <div className="projects-head">
          <h2>Starter projects</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <p className="muted small">
          Pick one and the AI writes it for <strong>{boardName}</strong>, with the right pins and wiring. You can change the request before you press Generate.
        </p>
        <div className="projects-filter">
          <input placeholder="Search projects or parts…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {['All', ...PROJECT_CATEGORIES].map((c) => (
              <button key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="project-grid">
          {shown.map((p) => (
            <button key={p.id} className="project-card" onClick={() => onPick(p)}>
              <span className="project-level">{p.level}</span>
              <strong>{p.title}</strong>
              <span className="small">{p.summary}</span>
              <span className="small muted">Parts: {p.parts}</span>
            </button>
          ))}
          {!shown.length && <p className="muted">No projects match. Try another word.</p>}
        </div>
      </div>
    </div>
  );
}
