import type { WiringRow } from '../shared/types';

/** Table plus a simple diagram of how to wire the parts, built from the AI's wiring list. */
export default function WiringPanel({ rows, boardName }: { rows: WiringRow[]; boardName: string }) {
  if (!rows.length) {
    return (
      <div className="wiring-empty muted">
        Wiring for your program shows here after you press Generate. If the program needs no parts, there is nothing to wire.
      </div>
    );
  }

  const rowH = 46;
  const top = 44;
  const height = top + rows.length * rowH + 16;
  const boardX = 16;
  const boardW = 150;
  const partX = 330;
  const partW = 300;
  const width = partX + partW + 16;
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

      <svg className="wiring-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Wiring diagram">
        <rect x={boardX} y={8} width={boardW} height={height - 16} rx={10} className="w-board" />
        <text x={boardX + boardW / 2} y={30} textAnchor="middle" className="w-title">
          {boardName.length > 22 ? boardName.slice(0, 21) + '…' : boardName}
        </text>
        {rows.map((r, i) => {
          const y = top + i * rowH + rowH / 2;
          return (
            <g key={i}>
              <text x={boardX + boardW - 10} y={y + 4} textAnchor="end" className={power(r.pin) ? 'w-pin power' : 'w-pin'}>
                {r.pin}
              </text>
              <circle cx={boardX + boardW} cy={y} r={4} className="w-dot" />
              <line x1={boardX + boardW} y1={y} x2={partX} y2={y} className={power(r.pin) ? 'w-wire power' : 'w-wire'} />
              <rect x={partX} y={y - 16} width={partW} height={32} rx={6} className="w-part" />
              <text x={partX + 10} y={y + 4} className="w-text">
                {r.part.length > 40 ? r.part.slice(0, 39) + '…' : r.part}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="muted small">Check every wire against the safety notes in the chat before you power the board.</p>
    </div>
  );
}
