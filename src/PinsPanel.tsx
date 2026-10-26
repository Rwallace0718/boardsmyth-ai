import { factsFor } from '../shared/boardFacts';

/** Pin reference for the selected board. The same facts are sent to the AI with every request. */
export default function PinsPanel({ fqbn, boardName }: { fqbn: string; boardName: string }) {
  const { facts, familyNote } = factsFor(fqbn);
  if (!facts) {
    return (
      <div className="wiring-empty muted">
        <p>
          <strong>{boardName}</strong>: there is no built-in pin sheet for this board yet.
        </p>
        {familyNote && <p>{familyNote}</p>}
        <p>The AI uses its general knowledge of the board. For anything where a wrong pin could damage the board or your parts, check the maker's pinout page first.</p>
      </div>
    );
  }
  return (
    <div className="wiring">
      <p>
        <strong>{facts.name}</strong>. {facts.summary}
      </p>
      <table className="wiring-table">
        <tbody>
          {facts.rows.map((r) => (
            <tr key={r.label}>
              <th style={{ width: 170 }}>{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {facts.docs && (
        <p className="small">
          <button className="link-btn" onClick={() => window.open(facts.docs, '_blank')}>
            Open the maker's page for this board
          </button>
        </p>
      )}
      <p className="muted small">These facts are also sent to the AI with every request so it picks pins that really exist and work on this board.</p>
    </div>
  );
}
