import { useEffect, useState } from 'react';
import type { LibraryInfo } from '../shared/types';

/** Search the Arduino Library Manager and install or remove libraries without leaving the app. */
export default function LibraryPanel() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LibraryInfo[] | null>(null);
  const [installed, setInstalled] = useState<LibraryInfo[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = () => window.api.libraries.installed().then(setInstalled).catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);

  async function search() {
    if (!q.trim()) return;
    setBusy('search');
    setMsg('');
    try {
      setResults(await window.api.libraries.search(q));
    } finally {
      setBusy('');
    }
  }

  async function act(kind: 'install' | 'remove', name: string) {
    setBusy(name);
    setMsg('');
    const r = await window.api.libraries[kind](name);
    setMsg(r.ok ? `${kind === 'install' ? 'Installed' : 'Removed'} ${name}.` : r.output.slice(-400));
    await refresh();
    if (results) setResults(await window.api.libraries.search(q));
    setBusy('');
  }

  const row = (l: LibraryInfo, canRemove: boolean) => (
    <li key={l.name} className="lib-row">
      <div>
        <strong>{l.name}</strong> {l.version && <span className="muted small">v{l.version}</span>}
        {l.author && <span className="muted small"> · {l.author}</span>}
        {l.summary && <div className="small muted">{l.summary}</div>}
      </div>
      {l.installed ? (
        canRemove ? (
          <button disabled={!!busy} onClick={() => void act('remove', l.name)}>
            {busy === l.name ? 'Removing…' : 'Remove'}
          </button>
        ) : (
          <span className="small muted">Installed</span>
        )
      ) : (
        <button className="primary" disabled={!!busy} onClick={() => void act('install', l.name)}>
          {busy === l.name ? 'Installing…' : 'Install'}
        </button>
      )}
    </li>
  );

  return (
    <div className="wiring">
      <form
        className="lib-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input placeholder="Search libraries, for example servo, DHT, OLED, NeoPixel…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" disabled={busy === 'search' || !q.trim()}>
          {busy === 'search' ? 'Searching…' : 'Search'}
        </button>
      </form>
      {msg && <p className="small">{msg}</p>}
      <p className="muted small">The AI installs the libraries your program needs by itself. Use this to add one yourself or remove one you do not use.</p>
      {results && (
        <>
          <h3 className="lesson-h">Search results</h3>
          {results.length ? <ul className="lib-list">{results.map((l) => row(l, false))}</ul> : <p className="muted">Nothing found. Try another word.</p>}
        </>
      )}
      <h3 className="lesson-h">Installed ({installed.length})</h3>
      {installed.length ? <ul className="lib-list">{installed.map((l) => row(l, true))}</ul> : <p className="muted">No libraries installed yet.</p>}
    </div>
  );
}
