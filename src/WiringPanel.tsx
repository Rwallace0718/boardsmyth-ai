import type { WiringRow } from '../shared/types';
import BreadboardView from './BreadboardView';

/** Table plus a simple diagram of how to wire the parts, built from the AI's wiring list. */
export default function WiringPanel({ rows, boardName }: { rows: WiringRow[]; boardName: string }) {
  if (!rows.length) {
    return (
      <div className="wiring-empty muted">
        Wiring for your program shows here after you press Generate. If the program needs no parts, there is nothing to wire.
      </div>
    );
  }

  const power = (pin: string) => /^(gnd|vin|5v|3v3|3\.3v|vcc)/i.test(pin);

  return (
    <div className="wiring">
      <table className="wiring-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Board pin</th>
            <th>Part</th>
            <th>How to connect it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <code className={power(r.pin) ? 'pin power' : 'pin'}>{r.pin}</code>
              </td>
              <td>{r.part}</td>
              <td>
                {r.to}
                {r.note && <div className="muted small">{r.note}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <BreadboardView rows={rows} boardName={boardName} />
      <p className="muted small">The picture is an illustration of which pin goes to which part, not exact breadboard holes. Check every wire against the safety notes in the chat before you power the board.</p>
    </div>
  );
}
