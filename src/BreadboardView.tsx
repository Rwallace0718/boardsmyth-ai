import type { WiringRow } from '../shared/types';

const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
const isGnd = (p: string) => /^gnd/i.test(p);
const isPower = (p: string) => /^(vin|5v|3v3|3\.3v|vcc|vusb)/i.test(p);

interface Part {
  label: string;
  kind: string;
  rows: WiringRow[];
}

function groupParts(rows: WiringRow[]): Part[] {
  const map = new Map<string, Part>();
  for (const r of rows) {
    const key = r.group || r.part;
    if (!map.has(key)) map.set(key, { label: key, kind: r.kind || 'other', rows: [] });
    map.get(key)!.rows.push(r);
  }
  return [...map.values()];
}

function Icon({ kind, x, y, label }: { kind: string; x: number; y: number; label: string }) {
  // Part body sits at (x, y) = centre of a 96x56 area.
  switch (kind) {
    case 'led':
      return (
        <g>
          <circle cx={x} cy={y} r={16} fill="#ef4444" stroke="#7f1d1d" />
          <circle cx={x - 5} cy={y - 5} r={4} fill="#fff" opacity={0.5} />
        </g>
      );
    case 'resistor':
      return (
        <g>
          <rect x={x - 30} y={y - 9} width={60} height={18} rx={9} fill="#d8b98a" stroke="#7a5c2e" />
          {[-14, -6, 2, 12].map((dx, i) => (
            <rect key={i} x={x + dx} y={y - 9} width={4} height={18} fill={['#8b4513', '#111', '#ef4444', '#d4af37'][i]} />
          ))}
        </g>
      );
    case 'button':
      return (
        <g>
          <rect x={x - 20} y={y - 20} width={40} height={40} rx={5} fill="#374151" stroke="#111" />
          <circle cx={x} cy={y} r={11} fill="#9ca3af" stroke="#111" />
        </g>
      );
    case 'servo':
      return (
        <g>
          <rect x={x - 30} y={y - 16} width={60} height={32} rx={4} fill="#2563eb" stroke="#1e3a8a" />
          <circle cx={x + 30} cy={y} r={8} fill="#e5e7eb" stroke="#111" />
        </g>
      );
    case 'motor':
      return (
        <g>
          <circle cx={x} cy={y} r={18} fill="#9ca3af" stroke="#111" />
          <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#111">M</text>
        </g>
      );
    case 'buzzer':
      return (
        <g>
          <circle cx={x} cy={y} r={18} fill="#111827" stroke="#000" />
          <circle cx={x} cy={y} r={4} fill="#6b7280" />
        </g>
      );
    case 'display':
      return (
        <g>
          <rect x={x - 34} y={y - 18} width={68} height={36} rx={3} fill="#0b3b2e" stroke="#111" />
          <rect x={x - 28} y={y - 12} width={56} height={24} fill="#15803d" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={x - 30} y={y - 16} width={60} height={32} rx={3} fill="#1f2937" stroke="#000" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill="#e5e7eb">
            {label.length > 9 ? label.slice(0, 8) + '…' : label}
          </text>
        </g>
      );
  }
}

/** Breadboard-style picture of the parts and wires. Illustrative, not hole-exact. */
export default function BreadboardView({ rows, boardName }: { rows: WiringRow[]; boardName: string }) {
  const parts = groupParts(rows);
  const pins = [...new Set(rows.map((r) => r.pin))];

  const cols = Math.min(3, Math.max(1, parts.length));
  const cellW = 150;
  const cellH = 130;
  const gridRows = Math.ceil(parts.length / cols);
  const bbX = 240;
  const bbW = cols * cellW + 30;
  const bbY = 20;
  const bbH = gridRows * cellH + 70;
  const width = bbX + bbW + 20;
  const pinGap = 26;
  const boardH = Math.max(bbH, pins.length * pinGap + 60);
  const height = Math.max(bbH, boardH) + 40;
  const pinY = (p: string) => 60 + pins.indexOf(p) * pinGap;

  let colorIdx = 0;
  const wireColor = new Map<string, string>();
  for (const p of pins) wireColor.set(p, isGnd(p) ? '#111827' : isPower(p) ? '#dc2626' : COLORS[colorIdx++ % COLORS.length]);

  return (
    <svg className="wiring-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Breadboard wiring picture">
      <defs>
        <pattern id="holes" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="1.6" fill="#8a8470" />
        </pattern>
      </defs>

      {/* the microcontroller board */}
      <rect x={10} y={bbY} width={150} height={boardH} rx={10} fill="#0e6b52" stroke="#064e3b" strokeWidth={2} />
      <text x={85} y={bbY + 22} textAnchor="middle" fontSize={11} fontWeight={700} fill="#d1fae5">
        {boardName.length > 20 ? boardName.slice(0, 19) + '…' : boardName}
      </text>
      {pins.map((p) => (
        <g key={p}>
          <text x={150 - 14} y={bbY + pinY(p) - 8 + 4} textAnchor="end" fontSize={11} fontFamily="ui-monospace, Consolas, monospace" fill="#ecfdf5">
            {p}
          </text>
          <circle cx={160} cy={bbY + pinY(p) - 8} r={5} fill="#fbbf24" stroke="#78350f" />
        </g>
      ))}

      {/* the breadboard */}
      <rect x={bbX} y={bbY} width={bbW} height={bbH} rx={8} fill="#e9e4d6" stroke="#a8a290" strokeWidth={2} />
      <rect x={bbX + 6} y={bbY + 6} width={bbW - 12} height={bbH - 12} fill="url(#holes)" />
      <rect x={bbX + 4} y={bbY + 4} width={bbW - 8} height={4} fill="#ef4444" opacity={0.8} />
      <rect x={bbX + 4} y={bbY + bbH - 8} width={bbW - 8} height={4} fill="#3b82f6" opacity={0.8} />

      {parts.map((part, i) => {
        const cx = bbX + 15 + (i % cols) * cellW + cellW / 2 - 15;
        const cy = bbY + 50 + Math.floor(i / cols) * cellH + 30;
        const n = part.rows.length;
        return (
          <g key={part.label}>
            <Icon kind={part.kind} x={cx} y={cy} label={part.label} />
            <text x={cx} y={cy - 30} textAnchor="middle" fontSize={11} fontWeight={600} fill="#3f3a2a">
              {part.label.length > 18 ? part.label.slice(0, 17) + '…' : part.label}
            </text>
            {part.rows.map((r, j) => {
              const tx = cx - 22 + (n === 1 ? 22 : (j * 44) / (n - 1));
              const ty = cy + 22;
              const sx = 160;
              const sy = bbY + pinY(r.pin) - 8;
              const c = wireColor.get(r.pin)!;
              return (
                <g key={j}>
                  <path
                    d={`M ${sx} ${sy} C ${sx + 60} ${sy}, ${tx - 60} ${ty + 60}, ${tx} ${ty}`}
                    fill="none"
                    stroke={c}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle cx={tx} cy={ty} r={3.5} fill={c} stroke="#111" strokeWidth={0.5} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
