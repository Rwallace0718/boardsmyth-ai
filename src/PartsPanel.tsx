import { useState } from 'react';
import type { PartItem } from '../shared/types';

/** Shopping / gathering list for the project, with tick boxes. */
export default function PartsPanel({
  parts,
  onAnalyze,
  canAnalyze,
}: {
  parts: PartItem[];
  onAnalyze: () => void;
  canAnalyze: boolean;
}) {
  const [have, setHave] = useState<Record<string, boolean>>({});
  if (!parts.length) {
    return (
      <div className="wiring-empty muted">
        <p>The list of parts you need (wires, resistors, servos, speaker and so on) shows here after you press Generate.</p>
        <p>
          Already have a program? <button className="link-btn" disabled={!canAnalyze} onClick={onAnalyze}>Work out the parts and wiring for this program</button> (uses 1 generation, the
          program is not changed).
        </p>
      </div>
    );
  }
  const need = parts.filter((p) => !p.optional);
  const extra = parts.filter((p) => p.optional);
  const row = (p: PartItem, i: number, key: string) => (
    <tr key={key + i}>
      <td>
        <input type="checkbox" checked={!!have[key + i]} onChange={(e) => setHave((h) => ({ ...h, [key + i]: e.target.checked }))} title="Tick off what you already have" />
      </td>
      <td>{p.qty} ×</td>
      <td>
        <strong>{p.name}</strong>
        {p.spec && <span className="muted"> · {p.spec}</span>}
        {p.note && <div className="muted small">{p.note}</div>}
      </td>
    </tr>
  );
  return (
    <div className="wiring">
      <p className="muted small">Tick each item as you collect it. Besides the board, this is everything the program needs.</p>
      <table className="wiring-table">
        <tbody>{need.map((p, i) => row(p, i, 'n'))}</tbody>
      </table>
      {extra.length > 0 && (
        <>
          <h3 className="lesson-h">Nice to have</h3>
          <table className="wiring-table">
            <tbody>{extra.map((p, i) => row(p, i, 'o'))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}
