import { useState } from 'react';
import type { ReactNode } from 'react';
import type { WiringRow } from '../shared/types';
import CameraModal from './CameraModal';
import { boardPhotoKey, loadPartPhotos, partPhotoKey, savePartPhotos } from './partPhotos';

/* ---------- wire roles and colours (same idea as a hand-drawn wiring legend) ---------- */
type Role = 'gnd' | 'pwr' | 'sda' | 'scl' | 'data';
const ROLE_COLOR: Record<Exclude<Role, 'data'>, string> = { gnd: '#111111', pwr: '#e11d1d', sda: '#16a34a', scl: '#7ddc7a' };
const DATA_COLORS = ['#c026d3', '#f97316', '#2563eb', '#0891b2', '#a16207', '#db2777', '#7c3aed'];

const isGnd = (p: string) => /^gnd/i.test(p);
const isPower = (p: string) => /^(vin|5v|3v3|3\.3v|vcc|vusb|v\+|vbat)/i.test(p);

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

/** The name of the connection point on the part, from the AI's partPin or worked out from the text. */
function partPinLabel(r: WiringRow): string {
  if (r.partPin) return r.partPin.slice(0, 10);
  const m = `${r.part} ${r.to}`.match(/\b(sda|scl|vcc|vin|gnd|sig|signal|data|din|dout|out|tx|rx|miso|mosi|sck|cs|en|anode|cathode|trig|echo|pwm|in1|in2|in3|in4|d0|d1)\b/i);
  if (m) return m[1].toUpperCase().replace('ANODE', 'anode').replace('CATHODE', 'cathode');
  if (isGnd(r.pin)) return 'GND';
  if (isPower(r.pin)) return 'VCC';
  return r.part.replace(/\(.*?\)/g, '').trim().slice(0, 9) || 'pin';
}

function roleOf(r: WiringRow, label: string): Role {
  if (isGnd(r.pin) || /^(gnd|cathode)$/i.test(label)) return 'gnd';
  if (isPower(r.pin)) return 'pwr';
  if (/sda/i.test(label) || /^sda$/i.test(r.pin)) return 'sda';
  if (/scl|sck/i.test(label) || /^scl$/i.test(r.pin)) return 'scl';
  return 'data';
}

function inferVolts(rows: WiringRow[]): string {
  const given = rows.find((r) => r.volts)?.volts;
  if (given) return given.slice(0, 6);
  for (const r of rows) {
    if (/^(3v3|3\.3v)/i.test(r.pin)) return '3.3V';
    if (/^5v/i.test(r.pin)) return '5V';
  }
  return '';
}

function resistorLabel(text: string): string {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(k|m)?\s*(?:ohm|Ω)/i);
  return m ? `${m[1]}${m[2] ? m[2].toLowerCase() : ''} Ω` : 'resistor';
}

/** A polyline with softly rounded corners. */
function roundedPath(pts: [number, number][], r = 9): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x - ((x - px) / (l1 || 1)) * rr;
    const ay = y - ((y - py) / (l1 || 1)) * rr;
    const bx = x + ((nx - x) / (l2 || 1)) * rr;
    const by = y + ((ny - y) / (l2 || 1)) * rr;
    d += ` L ${ax} ${ay} Q ${x} ${y} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L ${last[0]} ${last[1]}`;
}

/* ---------- drawings of the parts and boards (centre at 0,0, roughly 110 x 80) ---------- */
function PartArt({ kind, label }: { kind: string; label: string }): ReactNode {
  switch (kind) {
    case 'led':
      return (
        <g>
          <path d="M -9 8 L -9 32 M 9 8 L 9 24" stroke="#9ca3af" strokeWidth={3} strokeLinecap="round" />
          <path d="M -22 8 A 22 22 0 1 1 22 8 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth={1.5} />
          <ellipse cx={-8} cy={-14} rx={6} ry={9} fill="#fff" opacity={0.35} />
        </g>
      );
    case 'neopixel':
      return (
        <g>
          <rect x={-34} y={-24} width={68} height={48} rx={4} fill="#f3f4f6" stroke="#6b7280" />
          <circle cx={0} cy={0} r={17} fill="#fff" stroke="#9ca3af" />
          <rect x={-5} y={-5} width={10} height={10} fill="#f87171" />
          {[-24, -8, 8, 24].map((x) => (
            <rect key={x} x={x - 4} y={24} width={8} height={9} fill="#d4af37" />
          ))}
        </g>
      );
    case 'resistor':
      return (
        <g>
          <path d="M -50 0 H -30 M 30 0 H 50" stroke="#9ca3af" strokeWidth={3} />
          <rect x={-30} y={-11} width={60} height={22} rx={11} fill="#d8b98a" stroke="#7a5c2e" />
          {[-16, -7, 3, 14].map((dx, i) => (
            <rect key={i} x={dx} y={-11} width={5} height={22} fill={['#8b4513', '#111', '#ef4444', '#d4af37'][i]} />
          ))}
        </g>
      );
    case 'button':
      return (
        <g>
          <rect x={-26} y={-26} width={52} height={52} rx={6} fill="#374151" stroke="#111" />
          <circle cx={0} cy={0} r={15} fill="#9ca3af" stroke="#111" />
          {[[-26, -16], [-26, 16], [26, -16], [26, 16]].map(([x, y], i) => (
            <rect key={i} x={x - (x < 0 ? 7 : 0)} y={y - 3} width={7} height={6} fill="#cbd5e1" />
          ))}
        </g>
      );
    case 'servo':
      return (
        <g>
          <rect x={-36} y={-20} width={72} height={40} rx={4} fill="#2563eb" stroke="#1e3a8a" />
          <rect x={-46} y={-8} width={10} height={16} fill="#1d4ed8" stroke="#1e3a8a" />
          <circle cx={22} cy={-20} r={9} fill="#e5e7eb" stroke="#111" />
          <rect x={14} y={-40} width={16} height={22} rx={3} fill="#f3f4f6" stroke="#6b7280" />
          <path d="M -36 4 H -52" stroke="#f97316" strokeWidth={3} />
          <path d="M -36 10 H -52" stroke="#dc2626" strokeWidth={3} />
          <path d="M -36 -2 H -52" stroke="#78350f" strokeWidth={3} />
        </g>
      );
    case 'motor':
      return (
        <g>
          <rect x={-30} y={-22} width={52} height={44} rx={6} fill="#9ca3af" stroke="#111" />
          <rect x={22} y={-5} width={22} height={10} fill="#e5e7eb" stroke="#111" />
          <text x={-4} y={6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#111">M</text>
        </g>
      );
    case 'buzzer':
      return (
        <g>
          <circle cx={0} cy={0} r={28} fill="#111827" stroke="#000" strokeWidth={2} />
          <circle cx={0} cy={0} r={6} fill="#6b7280" />
          <text x={-16} y={-14} fontSize={12} fill="#e5e7eb">+</text>
        </g>
      );
    case 'display':
      return (
        <g>
          <rect x={-46} y={-26} width={92} height={52} rx={4} fill="#0b3b2e" stroke="#111" />
          <rect x={-40} y={-20} width={80} height={32} fill="#16a34a" />
          <text x={-34} y={-4} fontSize={10} fontFamily="ui-monospace, monospace" fill="#052e16">HELLO</text>
          {[-18, -6, 6, 18].map((x) => (
            <rect key={x} x={x - 3} y={16} width={6} height={8} fill="#d4af37" />
          ))}
        </g>
      );
    case 'relay':
      return (
        <g>
          <rect x={-40} y={-28} width={80} height={56} rx={4} fill="#1d4ed8" stroke="#1e3a8a" />
          <rect x={-26} y={-20} width={40} height={32} rx={3} fill="#2563eb" stroke="#1e3a8a" />
          <rect x={20} y={-18} width={16} height={36} fill="#16a34a" stroke="#14532d" />
          <circle cx={-8} cy={22} r={3} fill="#ef4444" />
        </g>
      );
    case 'driver':
      return (
        <g>
          <rect x={-42} y={-30} width={84} height={60} rx={3} fill="#1d4ed8" stroke="#1e3a8a" />
          <rect x={-20} y={-16} width={40} height={26} fill="#111827" stroke="#000" />
          {[-30, -18, 18, 30].map((x) => (
            <rect key={x} x={x - 3} y={16} width={6} height={10} fill="#16a34a" />
          ))}
        </g>
      );
    case 'pot':
      return (
        <g>
          <rect x={-30} y={-26} width={60} height={52} rx={4} fill="#1d4ed8" stroke="#1e3a8a" />
          <circle cx={0} cy={-2} r={15} fill="#e5e7eb" stroke="#111" />
          <path d="M 0 -2 L 8 -10" stroke="#111" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case 'sensor':
      return (
        <g>
          <rect x={-40} y={-28} width={80} height={56} rx={3} fill="#1d4ed8" stroke="#1e3a8a" />
          <rect x={-14} y={-14} width={28} height={22} fill="#111827" stroke="#000" />
          <circle cx={-30} cy={-18} r={3} fill="#0b1b4a" />
          <circle cx={30} cy={-18} r={3} fill="#0b1b4a" />
          {[-24, -8, 8, 24].map((x) => (
            <rect key={x} x={x - 3} y={18} width={6} height={9} fill="#d4af37" />
          ))}
        </g>
      );
    default:
      return (
        <g>
          <rect x={-40} y={-26} width={80} height={52} rx={4} fill="#1f2937" stroke="#000" />
          <rect x={-16} y={-12} width={32} height={22} fill="#0f172a" stroke="#475569" />
          <text x={0} y={22} textAnchor="middle" fontSize={9} fill="#e5e7eb">
            {label.length > 14 ? label.slice(0, 13) + '…' : label}
          </text>
        </g>
      );
  }
}

function boardLook(name: string): { pcb: string; edge: string; chip: string } {
  const n = name.toLowerCase();
  if (/esp32|esp8266|esp-|nodemcu|wemos|d1 mini/.test(n)) return { pcb: '#1f2937', edge: '#0b1220', chip: '#9ca3af' };
  if (/pico|rp2040|rp2350/.test(n)) return { pcb: '#15803d', edge: '#14532d', chip: '#111827' };
  if (/teensy/.test(n)) return { pcb: '#111827', edge: '#000', chip: '#6b7280' };
  if (/adafruit|feather|qt py|itsybitsy/.test(n)) return { pcb: '#111827', edge: '#000', chip: '#6b7280' };
  return { pcb: '#0a6f78', edge: '#064e56', chip: '#111827' };
}

function BoardArt({ name }: { name: string }) {
  const l = boardLook(name);
  return (
    <g>
      <rect x={-72} y={-52} width={144} height={104} rx={8} fill={l.pcb} stroke={l.edge} strokeWidth={2} />
      <rect x={-72} y={-30} width={22} height={30} rx={2} fill="#d1d5db" stroke="#6b7280" />
      <rect x={-22} y={-24} width={44} height={44} rx={3} fill={l.chip} stroke="#000" />
      <circle cx={52} cy={-34} r={7} fill="#ef4444" stroke="#7f1d1d" />
      {Array.from({ length: 12 }).map((_, i) => (
        <g key={i}>
          <rect x={-60 + i * 10} y={-50} width={7} height={7} fill="#111827" />
          <rect x={-60 + i * 10} y={43} width={7} height={7} fill="#111827" />
        </g>
      ))}
      <text x={0} y={34} textAnchor="middle" fontSize={9} fontWeight={700} fill="#e5e7eb">
        {name.length > 24 ? name.slice(0, 23) + '…' : name}
      </text>
    </g>
  );
}

/* ---------- the diagram ---------- */
const CARD_W = 300;
const BOARD_W = 220;
const PIN_H = 26;
const PAD = 20;
const TOP = 46;

type Target = { key: string; title: string } | null;

export default function WiringDiagram({ rows, boardName }: { rows: WiringRow[]; boardName: string }) {
  const [photos, setPhotos] = useState<Record<string, string>>(() => loadPartPhotos());
  const [target, setTarget] = useState<Target>(null);
  const [zoom, setZoom] = useState(1);

  function setPhoto(key: string, url: string | null) {
    setPhotos((cur) => {
      const next = { ...cur };
      delete next[key];
      if (url) next[key] = url;
      savePartPhotos(next);
      return next;
    });
  }

  const parts = groupParts(rows);

  // Board pins: power first, then signals in the order they are used, ground last.
  const seen: string[] = [];
  for (const r of rows) if (!seen.includes(r.pin)) seen.push(r.pin);
  const pins = [...seen.filter(isPower), ...seen.filter((p) => !isPower(p) && !isGnd(p)), ...seen.filter(isGnd)];

  const wires = rows.length;
  const boardX = PAD;
  const boardRight = boardX + BOARD_W;
  const partsX = boardRight + 60 + wires * 10 + 90;
  const W = partsX + CARD_W + PAD;

  const boardPicH = 150;
  const pinsTop = TOP + 34 + boardPicH + 40;
  const pinY = (p: string) => pinsTop + pins.indexOf(p) * PIN_H + PIN_H / 2;
  const boardH = 34 + boardPicH + 40 + pins.length * PIN_H + 14;

  const cardH = (p: Part) => Math.max(180, 50 + p.rows.length * 26 + 14);
  let y = TOP;
  const cards = parts.map((p) => {
    const h = cardH(p);
    const c = { part: p, y, h };
    y += h + 16;
    return c;
  });
  const partsTotal = y - 16 - TOP;
  const H = TOP + Math.max(boardH, partsTotal) + PAD;

  // Build every wire: from a board pin, along its own lane, into a pin on a part card.
  let dataIdx = 0;
  const wireList: { r: WiringRow; label: string; role: Role; color: string; sy: number; ty: number; card: (typeof cards)[number] }[] = [];
  for (const c of cards) {
    c.part.rows.forEach((r, j) => {
      const label = partPinLabel(r);
      const role = roleOf(r, label);
      const color = role === 'data' ? DATA_COLORS[dataIdx++ % DATA_COLORS.length] : ROLE_COLOR[role];
      wireList.push({ r, label, role, color, sy: pinY(r.pin), ty: c.y + 50 + j * 26 + 13, card: c });
    });
  }
  // Lanes: neighbouring wires get neighbouring lanes, ordered by where they start, so they cross as little as they can.
  const ordered = [...wireList].sort((a, b) => (a.ty > a.sy ? 0 : 1) - (b.ty > b.sy ? 0 : 1) || (a.ty > a.sy ? a.sy - b.sy : b.sy - a.sy));
  const laneOf = new Map<(typeof wireList)[number], number>();
  ordered.forEach((w, i) => laneOf.set(w, boardRight + 40 + i * 10));

  const legend: [string, string][] = [['GND', ROLE_COLOR.gnd], ['PWR', ROLE_COLOR.pwr], ['SDA', ROLE_COLOR.sda], ['SCL', ROLE_COLOR.scl], ['Data', DATA_COLORS[0]]];

  const photoBtn = (x: number, yy: number, key: string, title: string, w = 96) => (
    <g className="wd-btn" transform={`translate(${x} ${yy})`}>
      <g onClick={() => setTarget({ key, title })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setTarget({ key, title })}>
        <rect width={w} height={20} rx={10} fill="#ffffff" stroke="#94a3b8" />
        <text x={w / 2} y={14} textAnchor="middle" fontSize={11} fill="#1e293b">
          {photos[key] ? 'Change photo' : 'Add my photo'}
        </text>
      </g>
      {photos[key] && (
        <g onClick={() => setPhoto(key, null)} role="button" tabIndex={0} transform={`translate(${w + 4} 0)`}>
          <rect width={20} height={20} rx={10} fill="#ffffff" stroke="#94a3b8" />
          <text x={10} y={14} textAnchor="middle" fontSize={11} fill="#b91c1c">
            ✕
          </text>
        </g>
      )}
    </g>
  );

  const boardKey = boardPhotoKey(boardName);

  return (
    <div className="wd">
      <div className="wd-bar">
        <span className="muted small">Tap “Add my photo” on a part or your board to show your own photo instead of the drawing.</span>
        <span className="wd-zoom">
          <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}>−</button>
          <button title="Fit to width" onClick={() => setZoom(1)}>Fit</button>
          <button title="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}>+</button>
        </span>
      </div>
      <div className="wd-scroll">
        <svg className="wd-svg" style={{ width: `${zoom * 100}%`, minWidth: 0 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wiring diagram">
          <rect x={0} y={0} width={W} height={H} rx={10} fill="#f7f5ee" />

          {/* legend */}
          <g transform={`translate(${PAD} 14)`}>
            {legend.map(([t, c], i) => (
              <g key={t} transform={`translate(${i * 78} 0)`}>
                <rect width={26} height={7} y={4} rx={3} fill={c} />
                <text x={32} y={12} fontSize={12} fill="#334155" fontFamily="system-ui, sans-serif">
                  {t}
                </text>
              </g>
            ))}
          </g>

          {/* board */}
          <g>
            <rect x={boardX} y={TOP} width={BOARD_W} height={boardH} rx={12} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.5} />
            <text x={boardX + 14} y={TOP + 24} fontSize={13} fontWeight={700} fill="#0f172a" fontFamily="system-ui, sans-serif">
              {boardName.length > 26 ? boardName.slice(0, 25) + '…' : boardName}
            </text>
            {photos[boardKey] ? (
              <g>
                <clipPath id="clip-board">
                  <rect x={boardX + 10} y={TOP + 34} width={BOARD_W - 20} height={boardPicH} rx={8} />
                </clipPath>
                <image href={photos[boardKey]} x={boardX + 10} y={TOP + 34} width={BOARD_W - 20} height={boardPicH} preserveAspectRatio="xMidYMid slice" clipPath="url(#clip-board)" />
              </g>
            ) : (
              <g transform={`translate(${boardX + BOARD_W / 2} ${TOP + 34 + boardPicH / 2}) scale(1.28)`}>
                <BoardArt name={boardName} />
              </g>
            )}
            {photoBtn(boardX + 14, TOP + 34 + boardPicH + 8, boardKey, boardName, 110)}
            {pins.map((p) => (
              <g key={p}>
                <text x={boardRight - 16} y={pinY(p) + 4} textAnchor="end" fontSize={12} fontWeight={600} fontFamily="ui-monospace, Consolas, monospace" fill="#0f172a">
                  {p}
                </text>
                <circle cx={boardRight} cy={pinY(p)} r={5.5} fill="#fbbf24" stroke="#78350f" />
              </g>
            ))}
          </g>

          {/* wires (under the cards' pin labels) */}
          {wireList.map((w, i) => {
            const lane = laneOf.get(w)!;
            const sx = boardRight;
            const tx = partsX;
            const pts: [number, number][] = [[sx, w.sy], [lane, w.sy], [lane, w.ty], [tx, w.ty]];
            const hasRes = w.card.part.kind !== 'resistor' && w.role !== 'gnd' && w.role !== 'pwr' && /resistor/i.test(`${w.r.to} ${w.r.part} ${w.r.note ?? ''}`);
            return (
              <g key={i}>
                <path d={roundedPath(pts)} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" opacity={0.85} />
                <path d={roundedPath(pts)} fill="none" stroke={w.color} strokeWidth={3.4} strokeLinecap="round" />
                {hasRes && (
                  <g transform={`translate(${tx - 48} ${w.ty})`}>
                    <rect x={-20} y={-8} width={40} height={16} rx={8} fill="#d8b98a" stroke="#7a5c2e" />
                    {[-10, -3, 4, 12].map((dx, k) => (
                      <rect key={k} x={dx} y={-8} width={3.5} height={16} fill={['#8b4513', '#111', '#ef4444', '#d4af37'][k]} />
                    ))}
                    <text y={-12} textAnchor="middle" fontSize={10} fontWeight={700} fill="#3f3a2a" fontFamily="system-ui, sans-serif">
                      {resistorLabel(`${w.r.to} ${w.r.note ?? ''}`)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* part cards */}
          {cards.map(({ part, y: cy, h }) => {
            const key = partPhotoKey(part.label);
            const volts = inferVolts(part.rows);
            const picX = partsX + 176;
            return (
              <g key={part.label}>
                <rect x={partsX} y={cy} width={CARD_W} height={h} rx={12} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.5} />
                <text x={partsX + 16} y={cy + 26} fontSize={13} fontWeight={700} fill="#0f172a" fontFamily="system-ui, sans-serif">
                  {part.label.length > 18 ? part.label.slice(0, 17) + '…' : part.label}
                </text>
                {volts && (
                  <g transform={`translate(${partsX + CARD_W - 52} ${cy + 10})`}>
                    <rect width={40} height={20} rx={10} fill="#fef3c7" stroke="#d97706" />
                    <text x={20} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#92400e" fontFamily="system-ui, sans-serif">
                      {volts}
                    </text>
                  </g>
                )}
                {photos[key] ? (
                  <g>
                    <clipPath id={`clip-${cy}`}>
                      <rect x={picX} y={cy + 40} width={112} height={88} rx={8} />
                    </clipPath>
                    <image href={photos[key]} x={picX} y={cy + 40} width={112} height={88} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${cy})`} />
                  </g>
                ) : (
                  <g transform={`translate(${picX + 56} ${cy + 40 + 44}) scale(0.85)`}>
                    <PartArt kind={part.kind} label={part.label} />
                  </g>
                )}
                {photoBtn(picX, cy + h - 34, key, part.label, 92)}
                {part.rows.map((r, j) => {
                  const ty = cy + 50 + j * 26 + 13;
                  const label = partPinLabel(r);
                  const w = wireList.find((x) => x.r === r)!;
                  return (
                    <g key={j}>
                      <circle cx={partsX} cy={ty} r={5.5} fill={w.color} stroke="#111" strokeWidth={0.8} />
                      <text x={partsX + 14} y={ty + 4} fontSize={12} fontWeight={600} fontFamily="ui-monospace, Consolas, monospace" fill="#0f172a">
                        {label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {target && (
        <CameraModal
          title={target.title}
          onClose={() => setTarget(null)}
          onPhoto={(url) => {
            setPhoto(target.key, url);
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}
