import { useMemo, useState } from 'react';
import type { BoardOption } from '../shared/types';
import './picker.css';

interface Props {
  popular: BoardOption[];
  catalog: BoardOption[];
  valueName: string;
  loading: boolean;
  disabled: boolean;
  onPick: (board: BoardOption) => void;
}

const MAX_RESULTS = 120;

/** Friendly names for the vendor part of a board id (the first segment of its fqbn). */
const FAMILY_LABELS: Record<string, string> = {
  arduino: 'Arduino',
  esp32: 'ESP32 (Espressif)',
  esp8266: 'ESP8266',
  rp2040: 'Raspberry Pi Pico / RP2040 / RP2350',
  STMicroelectronics: 'STM32',
  teensy: 'Teensy',
  adafruit: 'Adafruit',
  SparkFun: 'SparkFun',
  MiniCore: 'ATmega328 chips (MiniCore)',
  MegaCore: 'ATmega2560 / 1280 chips (MegaCore)',
  MightyCore: 'ATmega1284 / 644 chips (MightyCore)',
  MicroCore: 'ATtiny13 chips (MicroCore)',
};

const familyOf = (b: BoardOption) => b.fqbn.split(':')[0];
const familyLabel = (id: string) => FAMILY_LABELS[id] ?? id;

export default function BoardPicker({ popular, catalog, valueName, loading, disabled, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');

  // Board families that exist in the downloaded catalog (or the popular list while it loads).
  const families = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of catalog.length > 0 ? catalog : popular) {
      counts.set(familyOf(b), (counts.get(familyOf(b)) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, label: familyLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog, popular]);

  const { list, heading } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = family ? (catalog.length > 0 ? catalog : popular).filter((b) => familyOf(b) === family) : catalog;
    if (!q && !family) return { list: popular, heading: 'Popular boards' };
    const words = q ? q.split(/\s+/) : [];
    const hits = pool.filter((b) => {
      const hay = `${b.name} ${b.fqbn} ${b.vendor ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const shown = hits.slice(0, MAX_RESULTS);
    const more = hits.length > MAX_RESULTS ? ` (showing first ${MAX_RESULTS}, type more to narrow)` : '';
    return { list: shown, heading: `${hits.length} board${hits.length === 1 ? '' : 's'} found${more}` };
  }, [query, family, popular, catalog]);

  function pick(b: BoardOption) {
    onPick(b);
    setOpen(false);
    setQuery('');
    setFamily('');
  }

  return (
    <div className="picker" onClick={(e) => e.preventDefault()}>
      <button className="picker-button" onClick={() => setOpen((o) => !o)} disabled={disabled}>
        {valueName}
        <span className="picker-caret">▾</span>
      </button>

      {open && (
        <>
          <div className="picker-backdrop" onClick={() => setOpen(false)} />
          <div className="picker-panel">
            <input
              autoFocus
              placeholder={
                loading
                  ? 'Loading every supported board…'
                  : `Search ${catalog.length.toLocaleString()} boards (e.g. "nano", "esp32", "pico", "teensy")`
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="">All board types</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.count})
                </option>
              ))}
            </select>
            <div className="picker-heading">{heading}</div>
            <div className="picker-list">
              {list.length === 0 && (
                <div className="picker-empty">
                  {loading ? 'Still loading the board list…' : 'No boards match that search.'}
                </div>
              )}
              {list.map((b) => (
                <button key={b.fqbn} className="picker-item" onClick={() => pick(b)}>
                  <span>{b.name}</span>
                  <span className="picker-vendor">{b.vendor ?? b.core}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
