import { useCallback, useEffect, useState } from 'react';
import type { ClassProject, ClassReply } from '../shared/types';

export default function ClassPanel({
  currentCode,
  boardName,
  fqbn,
  hasProgram,
  onOpen,
  onClose,
  onChanged,
}: {
  currentCode: string;
  boardName: string;
  fqbn: string;
  hasProgram: boolean;
  onOpen: (p: ClassProject) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [info, setInfo] = useState<ClassReply | null>(null);
  const [projects, setProjects] = useState<ClassProject[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  const load = useCallback(async () => {
    const me = await window.api.classes.call({ action: 'me' });
    setInfo(me);
    if (me.role === 'teacher' || me.role === 'student') {
      const g = await window.api.classes.call({ action: 'gallery' });
      setProjects(g.projects ?? []);
    } else setProjects([]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>, done?: string) {
    setBusy(true);
    setMsg('');
    const r = await window.api.classes.call(body);
    setBusy(false);
    if (r.error) setMsg(r.error);
    else if (done) setMsg(done);
    await load();
    onChanged();
    return r;
  }

  const role = info?.role ?? 'none';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal projects" role="dialog" aria-label="Classroom" onClick={(e) => e.stopPropagation()}>
        <div className="projects-head">
          <h2>{role === 'none' ? 'Classroom' : info?.className ?? 'Classroom'}</h2>
          <button onClick={onClose}>Close</button>
        </div>
        {!info && <p className="muted">Loading…</p>}
        {msg && <p className="small" style={{ color: 'var(--accent)' }}>{msg}</p>}

        {info && role === 'none' && (
          <>
            <h3>Join a class</h3>
            <p className="muted small">Your teacher gives you a class code. Joining uses your teacher's Schools plan, so the AI works without your own subscription (up to 100 generations a month).</p>
            <div className="projects-filter" style={{ flexDirection: 'row', gap: 8 }}>
              <input placeholder="Class code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="primary" disabled={busy || !code.trim()} onClick={() => void act({ action: 'join', code }, 'You joined the class.')}>
                Join
              </button>
            </div>
            <h3>Teacher?</h3>
            <p className="muted small">With an active Schools plan you can create one class, hand out its code and see what your students share. </p>
            <p>
              <button onClick={() => void window.api.classes.buy()}>Buy Schools plan ($5 per student a month)</button>{' '}
              <button onClick={() => void load()}>I've bought it — refresh</button>
            </p>
            <div className="projects-filter" style={{ flexDirection: 'row', gap: 8 }}>
              <input placeholder="Class name, e.g. Period 3 Robotics" value={name} onChange={(e) => setName(e.target.value)} />
              <button disabled={busy || !name.trim()} onClick={() => void act({ action: 'create', name }, 'Class created.')}>
                Create class
              </button>
            </div>
          </>
        )}

        {info && role === 'teacher' && (
          <>
            <p>
              Class code: <strong style={{ fontSize: 20, letterSpacing: 2 }}>{info.joinCode}</strong>{' '}
              <button onClick={() => void navigator.clipboard.writeText(info.joinCode ?? '')}>Copy</button>{' '}
              <button disabled={busy} title="Old code stops working. Students already in the class stay." onClick={() => void act({ action: 'newcode' }, 'New code created.')}>
                New code
              </button>
            </p>
            <p className="muted small">
              {info.students} of {info.seats} seats used. Each student makes a free BoardSmyth account, then enters this code under Classroom. Students get up to 100 AI generations a month each.
            </p>
            <h3>Students</h3>
            {(info.members ?? []).length === 0 && <p className="muted small">No students yet.</p>}
            {(info.members ?? []).map((m) => (
              <div key={m.userId} className="small" style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>{m.name}</span>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Remove ${m.name} from the class? They lose Schools plan access.`)) void act({ action: 'remove', userId: m.userId }, 'Removed.');
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </>
        )}

        {info && role === 'student' && (
          <p className="muted small">
            You are in this class. Your teacher can see the projects you share here and your account email.{' '}
            <button
              disabled={busy}
              onClick={() => {
                if (confirm('Leave this class? You lose Schools plan access.')) void act({ action: 'leave' }, 'You left the class.');
              }}
            >
              Leave class
            </button>
          </p>
        )}

        {info && role !== 'none' && (
          <>
            <h3>Class gallery</h3>
            <p className="muted small">Only people in this class can see these. Do not share personal information in titles or code.</p>
            <div className="projects-filter" style={{ flexDirection: 'row', gap: 8 }}>
              <input placeholder="Title for your project" value={title} onChange={(e) => setTitle(e.target.value)} />
              <button
                className="primary"
                disabled={busy || !title.trim() || !hasProgram}
                title={hasProgram ? 'Share the program in the editor with this class' : 'Generate or open a program first'}
                onClick={async () => {
                  const r = await act({ action: 'share', title, code: currentCode, boardName, fqbn }, 'Shared with the class.');
                  if (!r.error) setTitle('');
                }}
              >
                Share current program
              </button>
            </div>
            <div className="project-grid">
              {projects.map((p) => (
                <div key={p.id} className="project-card" style={{ cursor: 'default' }}>
                  <strong>{p.title}</strong>
                  <span className="small muted">
                    {p.author}
                    {p.boardName ? ` · ${p.boardName}` : ''} · {new Date(p.created).toLocaleDateString()}
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onOpen(p)}>Open in editor</button>
                    {(p.mine || role === 'teacher') && (
                      <button disabled={busy} onClick={() => void act({ action: 'unshare', id: p.id }, 'Removed from the gallery.')}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {!projects.length && <p className="muted">Nothing shared yet.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
