import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type {
  AuthState,
  BoardDetails,
  BoardOption,
  DetectedPort,
  HistoryItem,
  WiringRow,
  Lesson,
  PartItem,
  GenerateResult,
  PhoneSession,
  StatusEvent,
  UpdateState,
} from '../shared/types';
import LoginScreen from './LoginScreen';
import TermsGate from './TermsGate';
import BoardPicker from './BoardPicker';
import WiringPanel from './WiringPanel';
import ProjectLibrary from './ProjectLibrary';
import LessonPanel from './LessonPanel';
import PartsPanel from './PartsPanel';
import PinsPanel from './PinsPanel';
import LibraryPanel from './LibraryPanel';
import { factsForPrompt } from '../shared/boardFacts';

const STARTER = `// Describe what you want in the box on the left, then press Generate.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`;

interface ChatItem {
  role: 'you' | 'ai' | 'system' | 'warn';
  text: string;
  images?: string[];
}

const MAX_PHOTOS = 3;
const MAX_HISTORY = 20;

/** Shrinks a photo to a 1280px JPEG so it uploads fast and costs little to send to the AI. */
async function fileToJpeg(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [popular, setPopular] = useState<BoardOption[]>([]);
  const [catalog, setCatalog] = useState<BoardOption[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [ports, setPorts] = useState<DetectedPort[]>([]);
  const [baseFqbn, setBaseFqbn] = useState('arduino:avr:uno');
  const [detectedName, setDetectedName] = useState('');
  const [details, setDetails] = useState<BoardDetails | null>(null);
  const [changed, setChanged] = useState<Record<string, string>>({});
  const [preparing, setPreparing] = useState(false);
  const [port, setPort] = useState('');
  const [code, setCode] = useState(STARTER);
  const [prompt, setPrompt] = useState('');
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [status, setStatus] = useState<StatusEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  // Raw tool output (copyright banners, progress lines) tucked behind "Show details" when a step succeeds.
  const [logDetail, setLogDetail] = useState<{ for: string; text: string } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [monitorOn, setMonitorOn] = useState(false);
  const [tab, setTab] = useState<'log' | 'serial' | 'wiring' | 'parts' | 'pins' | 'libs' | 'lesson'>('log');
  const [parts, setParts] = useState<PartItem[]>([]);
  const [consoleH, setConsoleH] = useState(() => {
    try {
      return Number(localStorage.getItem('consoleH')) || 320;
    } catch {
      return 320;
    }
  });
  const consoleHRef = useRef(320);
  consoleHRef.current = consoleH;
  const [lesson, setLesson] = useState<Lesson | undefined>();
  const [teach, setTeach] = useState(() => {
    try {
      return localStorage.getItem('teach') === '1';
    } catch {
      return false;
    }
  });
  const [wiring, setWiring] = useState<WiringRow[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const lastGoal = useRef('');
  const [selfCheck, setSelfCheck] = useState(() => {
    try {
      return localStorage.getItem('selfCheck') === '1';
    } catch {
      return false;
    }
  });
  const [serial, setSerial] = useState('');
  const serialRef = useRef<HTMLPreElement>(null);
  const userPickedBoard = useRef(false);
  const [filePath, setFilePath] = useState('');
  const savedCode = useRef(STARTER);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [keyPanel, setKeyPanel] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [phone, setPhone] = useState<PhoneSession | null>(null);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [lastSafety, setLastSafety] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [startupError, setStartupError] = useState('');
  const refreshAuth = useCallback(async () => {
    try {
      setAuth(await window.api.auth.state());
    } catch (err) {
      setStartupError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshPorts = useCallback(async () => {
    const found = await window.api.boards.detect();
    setPorts(found);
    setPort((p) => {
      if (p && found.some((f) => f.address === p)) return p;
      return found[0]?.address ?? '';
    });
    const withBoard = found.find((f) => f.fqbn);
    if (withBoard?.fqbn && !userPickedBoard.current) {
      setBaseFqbn(withBoard.fqbn);
      setDetectedName(withBoard.boardName ?? '');
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
    void window.api.boards.popular().then(setPopular);
    const offStatus = window.api.onStatus(setStatus);
    void window.api.updateState().then(setUpdate);
    const offUpdate = window.api.onUpdateState(setUpdate);
    const offData = window.api.monitor.onData((chunk) =>
      setSerial((s) => (s + chunk).slice(-20000))
    );
    return () => {
      offStatus();
      offUpdate();
      offData();
    };
  }, [refreshAuth]);

  // Bring back the last program and board from the previous session.
  useEffect(() => {
    void window.api.draft
      .get()
      .then((d) => {
        if (d?.code) {
          setCode(d.code);
          savedCode.current = d.code;
        }
        if (d?.fqbn) {
          userPickedBoard.current = true;
          setBaseFqbn(d.fqbn);
        }
        if (d?.history) setHistory(d.history);
        if (d?.wiring) setWiring(d.wiring);
        if (d?.parts) setParts(d.parts);
        if (d?.lesson) setLesson(d.lesson);
      })
      .finally(() => setDraftLoaded(true));
  }, []);

  // Keep the program saved as you work, so it is still there next time.
  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => void window.api.draft.set({ code, fqbn: baseFqbn, history, wiring, parts, lesson }), 600);
    return () => clearTimeout(t);
  }, [code, baseFqbn, history, wiring, parts, lesson, draftLoaded]);

  // File menu actions (New, Open, Save, Save as).
  const codeRef = useRef(code);
  codeRef.current = code;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  useEffect(() => {
    const doSave = async (saveAs: boolean) => {
      const r = await window.api.file.save(codeRef.current, filePathRef.current, saveAs);
      if (r.ok && r.path) {
        setFilePath(r.path);
        savedCode.current = codeRef.current;
        setLog(`Saved ${r.path}`);
        setTab('log');
      } else if (!r.canceled && r.error) {
        setLog(`Could not save: ${r.error}`);
        setTab('log');
      }
    };
    const confirmDiscard = () =>
      codeRef.current === savedCode.current ||
      window.confirm('You have changes that are not saved. Continue and discard them?');
    return window.api.onMenu(async (a) => {
      if (a === 'save') await doSave(false);
      else if (a === 'saveAs') await doSave(true);
      else if (a === 'new') {
        if (!confirmDiscard()) return;
        setCode(STARTER);
        savedCode.current = STARTER;
        setFilePath('');
      } else if (a === 'open') {
        if (!confirmDiscard()) return;
        const r = await window.api.file.open();
        if (r.ok && r.code !== undefined) {
          setCode(r.code);
          savedCode.current = r.code;
          setFilePath(r.path ?? '');
        } else if (!r.canceled && r.error) {
          setLog(`Could not open: ${r.error}`);
          setTab('log');
        }
      }
    });
  }, []);

  const addPhotos = useCallback((urls: string[]) => {
    if (urls.length) setImages((cur) => [...cur, ...urls].slice(0, MAX_PHOTOS));
  }, []);

  // While the phone panel is open, collect photos the phone sends.
  useEffect(() => {
    if (!phone) return;
    const t = setInterval(async () => {
      const got = await window.api.phone.poll(phone.session);
      addPhotos(got);
    }, 2000);
    return () => clearInterval(t);
  }, [phone, addPhotos]);

  async function addFiles(files: FileList | File[]) {
    const out: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      try {
        out.push(await fileToJpeg(f));
      } catch {
        /* unreadable image: skip it */
      }
    }
    addPhotos(out);
  }

  async function togglePhone() {
    if (phone) {
      setPhone(null);
      return;
    }
    setPhone(await window.api.phone.start());
  }

  function pushHistory(label: string, snapshot: string) {
    if (!snapshot.trim()) return;
    setHistory((h) => {
      if (h[0]?.code === snapshot) return h;
      return [{ t: Date.now(), label, code: snapshot }, ...h].slice(0, MAX_HISTORY);
    });
  }

  // Load every supported board once signed in.
  useEffect(() => {
    if (!auth?.signedIn) return;
    void window.api.boards
      .catalog(false)
      .then(setCatalog)
      .finally(() => {
        setCatalogReady(true);
        setStatus(null);
      });
  }, [auth?.signedIn]);

  // Install the chosen board's core and load its option menus (processor, flash size, etc.).
  useEffect(() => {
    if (!auth?.signedIn || !catalogReady) return;
    let cancelled = false;
    setPreparing(true);
    setDetails(null);
    setChanged({});
    void window.api.boards
      .details(baseFqbn)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .finally(() => {
        if (!cancelled) {
          setPreparing(false);
          setStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.signedIn, catalogReady, baseFqbn]);

  useEffect(() => {
    if (auth?.signedIn) {
      void refreshPorts();
      const t = setInterval(refreshPorts, 4000);
      return () => clearInterval(t);
    }
  }, [auth?.signedIn, refreshPorts]);

  useEffect(() => {
    serialRef.current?.scrollTo({ top: serialRef.current.scrollHeight });
  }, [serial]);

  // Popular boards are always shown; their board package downloads on first use.
  const popularShown = popular;

  const boardName = useMemo(() => {
    const hit =
      catalog.find((b) => b.fqbn === baseFqbn) ?? popular.find((b) => b.fqbn === baseFqbn);
    return hit?.name ?? (detectedName || baseFqbn);
  }, [catalog, popular, baseFqbn, detectedName]);

  // Full board id, including only the options the user changed from the defaults.
  const fqbn = useMemo(() => {
    const parts = Object.entries(changed).map(([k, v]) => `${k}=${v}`);
    return parts.length ? `${baseFqbn}:${parts.join(',')}` : baseFqbn;
  }, [baseFqbn, changed]);

  const working = busy || preparing;

  function pickBoard(b: BoardOption) {
    userPickedBoard.current = true;
    setDetectedName('');
    setBaseFqbn(b.fqbn);
  }

  async function generate(override?: { prompt: string; shown: string; teach?: boolean }): Promise<GenerateResult | undefined> {
    const request = (override?.prompt ?? prompt).trim();
    if (!request || working) return undefined;
    if (!override) lastGoal.current = request;
    const photos = override ? [] : images;
    if (!override) {
      setPrompt('');
      setImages([]);
    }
    setBusy(true);
    setChat((c) => [
      ...c,
      { role: 'you', text: override?.shown ?? request, images: photos.length ? photos : undefined },
    ]);

    const cur = codeRef.current;
    const hasUserCode = cur.trim() !== '' && cur !== STARTER;
    if (hasUserCode) pushHistory(`Before: ${(override?.shown ?? request).slice(0, 40)}`, cur);
    let res: GenerateResult;
    try {
      res = await window.api.generate({
        prompt: request,
        fqbn,
        boardName,
        currentCode: hasUserCode ? cur : undefined,
        images: photos.length ? photos : undefined,
        teach: override?.teach ?? teach,
        boardFacts: factsForPrompt(fqbn) || undefined,
      });
    } catch (e) {
      // Never leave the app stuck "busy" (that locks the prompt box) if the request itself blows up.
      res = { ok: false, error: `The request failed: ${e instanceof Error ? e.message : String(e)}` } as GenerateResult;
    }

    if (res.code) setCode(res.code);
    setLastSafety(res.safety ?? '');
    if (res.ok) {
      setWiring(res.wiring ?? []);
      setParts(res.parts ?? []);
      if (res.lesson || override?.teach === undefined) setLesson(res.lesson);
      setTab(res.lesson ? 'lesson' : res.wiring?.length ? 'wiring' : res.parts?.length ? 'parts' : tab);
      if (res.wiring?.length || res.parts?.length) setConsoleH((h) => Math.max(h, Math.min(window.innerHeight - 220, 460)));
      if ((override?.teach ?? teach) && !res.lesson)
        setChat((c) => [...c, { role: 'system', text: 'The AI did not include a lesson this time. Press "Explain this program" on the Lesson tab to try again.' }]);
      setChat((c) => [
        ...c,
        { role: 'ai', text: res.notes || 'Done. The program compiled successfully.' },
        ...(res.safety ? [{ role: 'warn' as const, text: `Check before you upload:\n${res.safety}` }] : []),
      ]);
      setLog('Compiled successfully.');
    } else {
      setChat((c) => [...c, { role: 'system', text: res.error ?? 'Something went wrong.' }]);
      setLog(res.error ?? '');
      setTab('log');
    }
    setBusy(false);
    setStatus(null);
    void refreshAuth();
    return res;
  }

  const KEEP = 'Do NOT change the program: return the code exactly as it is, character for character. ';
  function analyzeProgram() {
    void generate({
      shown: 'Work out the wiring and parts for this program',
      prompt: KEEP + 'Only fill in the wiring block and the parts block for the program above, and say in the notes what it does.',
    });
  }
  function explainProgram() {
    void generate({
      shown: 'Explain this program',
      teach: true,
      prompt: KEEP + 'Only fill in the wiring block, the parts block and the lesson block for the program above.',
    });
  }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = consoleHRef.current;
    const move = (ev: MouseEvent) =>
      setConsoleH(Math.min(window.innerHeight - 200, Math.max(120, startH + (startY - ev.clientY))));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      try {
        localStorage.setItem('consoleH', String(consoleHRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  async function runCompile() {
    setBusy(true);
    setTab('log');
    try {
      const res = await window.api.compile(code, fqbn);
      if (res.ok) {
        setLog('Compiled successfully.');
        setLogDetail({ for: 'Compiled successfully.', text: res.output });
        setShowDetail(false);
      } else {
        setLog(res.output);
      }
    } catch (e) {
      setLog(`Check failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function runUpload() {
    if (!port) {
      setLog('No board detected. Plug it in with a USB data cable, then pick a port.');
      setTab('log');
      return;
    }
    if (
      lastSafety &&
      !window.confirm(`The AI flagged hardware risks:\n\n${lastSafety}\n\nUpload anyway?`)
    )
      return;
    setBusy(true);
    setTab('log');
    setMonitorOn(false);
    let uploaded = false;
    try {
      const res = await window.api.upload(code, fqbn, port);
      if (res.ok) {
        const done = `Uploaded to ${port}.`;
        setLog(done);
        setLogDetail({ for: done, text: res.output });
        setShowDetail(false);
        uploaded = true;
      } else {
        setLog(res.output);
      }
    } catch (e) {
      setLog(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setStatus(null);
    }
    if (uploaded && selfCheck) await runSelfCheck(1);
  }

  /** Listens to the board for a few seconds after an upload and asks the AI whether it is doing what was asked. */
  async function runSelfCheck(round: number) {
    const sent = codeRef.current;
    const begin = /Serial\.begin\s*\(\s*(\d+)/.exec(sent);
    if (!begin) {
      setLog((l) => `${l}\n\nSelf-check skipped: this program never calls Serial.begin, so there is nothing to listen to.`);
      return;
    }
    const baud = Number(begin[1]) || 9600;
    setTab('serial');
    setSerial('');
    setLog((l) => `${l}\n\nListening to the board for 8 seconds…`);
    let heard = '';
    const off = window.api.monitor.onData((chunk) => (heard += chunk));
    try {
      await new Promise((r) => setTimeout(r, 1500)); // let the board restart after the upload
      await window.api.monitor.start(port, baud);
      setMonitorOn(true);
      await new Promise((r) => setTimeout(r, 8000));
    } finally {
      off();
      await window.api.monitor.stop().catch(() => undefined);
      setMonitorOn(false);
    }

    if (/(could not|cannot|can't|busy|denied|no such|not found)/i.test(heard) && heard.length < 400) {
      setLog(
        (l) =>
          `${l}\n\nCould not open the serial port after the upload. Some boards change port when they restart. Pick the port again and press Start on the Serial monitor tab.`
      );
      return;
    }

    const goal = lastGoal.current || 'what the program comments say it should do';
    const res = await generate({
      shown: `Checking what the board printed after upload (check ${round} of 2)`,
      prompt:
        `The program above was just uploaded and ran for 8 seconds. What I asked for: ${goal}\n\n` +
        `This is everything it printed on the serial monitor (${baud} baud):\n` +
        (heard.trim() ? heard.slice(-2500) : '(nothing was printed)') +
        `\n\nDecide whether this output shows the program doing what I asked. ` +
        `If it does, return the code EXACTLY unchanged and start the notes with "Check passed:" and one line on what you saw. ` +
        `If it does not, or nothing printed, fix the code and start the notes with "Problem found:" and say what was wrong and what to check on the hardware.`,
    });

    if (!res?.ok || !res.code || res.code === sent) return;
    if (round >= 2) {
      setChat((c) => [...c, { role: 'system', text: 'The AI made another fix. Press Upload when you are ready to try it.' }]);
      return;
    }
    if (window.confirm('The AI found a problem and fixed the program. Upload the fix and check again?')) {
      await runUploadFix(round + 1);
    }
  }

  async function runUploadFix(nextRound: number) {
    setBusy(true);
    setTab('log');
    let uploaded = false;
    try {
      const res = await window.api.upload(codeRef.current, fqbn, port);
      setLog(res.ok ? `Uploaded the fix to ${port}.` : res.output);
      uploaded = res.ok;
    } catch (e) {
      setLog(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setStatus(null);
    }
    if (uploaded) await runSelfCheck(nextRound);
  }

  async function toggleMonitor() {
    if (monitorOn) {
      await window.api.monitor.stop();
      setMonitorOn(false);
      return;
    }
    if (!port) return;
    setSerial('');
    setTab('serial');
    await window.api.monitor.start(port, 9600);
    setMonitorOn(true);
  }

  if (!auth) {
    return startupError ? (
      <div className="center muted" style={{ padding: 24, whiteSpace: 'pre-wrap' }}>
        BoardSmyth AI could not start:{'\n\n'}
        {startupError}
      </div>
    ) : (
      <div className="center muted">Loading…</div>
    );
  }
  if (!auth.signedIn) return <LoginScreen onSignedIn={setAuth} />;
  if (auth.termsAccepted === false)
    return (
      <TermsGate
        email={auth.email}
        onAccepted={setAuth}
        onSignOut={async () => {
          await window.api.auth.signOut();
          await refreshAuth();
        }}
      />
    );

  const needsSub = auth.subscribed === false;
  const freeLimit = auth.freeLimit ?? 5;
  const freeLeft = Math.max(0, freeLimit - (auth.usageMonth ?? 0));
  const outOfFree = needsSub && freeLeft === 0;
  const isByok = auth.subscribed === true && auth.plan === 'byok';
  const needsKey = isByok && !auth.hasOwnKey;

  async function saveKey() {
    const r = await window.api.claudeKey.set(keyInput);
    if (!r.ok) {
      setKeyError(r.error ?? 'Could not save the key.');
      return;
    }
    setKeyError('');
    setKeyInput('');
    setKeyPanel(false);
    await refreshAuth();
  }

  async function removeKey() {
    await window.api.claudeKey.clear();
    await refreshAuth();
  }

  return (
    <div className="app">
      {showProjects && (
        <ProjectLibrary
          boardName={boardName}
          onClose={() => setShowProjects(false)}
          onPick={(p) => {
            setPrompt(p.prompt);
            setShowProjects(false);
          }}
        />
      )}
      <header className="topbar">
        <strong className="brand">BoardSmyth AI</strong>
        <div className="field">
          Board
          <BoardPicker
            popular={popularShown}
            catalog={catalog}
            valueName={boardName}
            loading={!catalogReady}
            disabled={working}
            onPick={pickBoard}
          />
        </div>
        <label>
          Port
          <select value={port} onChange={(e) => setPort(e.target.value)} disabled={working}>
            {ports.length === 0 && <option value="">No board found</option>}
            {ports.map((p) => (
              <option key={p.address} value={p.address}>
                {p.address}
                {p.boardName ? ` (${p.boardName})` : ''}
              </option>
            ))}
          </select>
        </label>
        <button onClick={runCompile} disabled={working}>
          Check
        </button>
        <button className="primary" onClick={runUpload} disabled={working}>
          Upload
        </button>
        <label
          className="teach-toggle small"
          title="After uploading, listen to the board for 8 seconds and let the AI check it works. Uses 1 generation per check."
        >
          <input
            type="checkbox"
            checked={selfCheck}
            onChange={(e) => {
              setSelfCheck(e.target.checked);
              try {
                localStorage.setItem('selfCheck', e.target.checked ? '1' : '0');
              } catch {
                /* ignore */
              }
            }}
          />
          Check it works after upload
        </label>
        <button
          title="Save this program as a .ino file (Ctrl+S)"
          onClick={() => window.api.file.save(code, filePath, false).then((r) => {
            if (r.ok && r.path) {
              setFilePath(r.path);
              savedCode.current = code;
              setLog(`Saved ${r.path}`);
              setTab('log');
            }
          })}
        >
          Save
        </button>
        <button
          title="Open a saved program (Ctrl+O)"
          disabled={working}
          onClick={() => {
            if (code !== savedCode.current && !window.confirm('You have changes that are not saved. Continue and discard them?')) return;
            void window.api.file.open().then((r) => {
              if (r.ok && r.code !== undefined) {
                setCode(r.code);
                savedCode.current = r.code;
                setFilePath(r.path ?? '');
              }
            });
          }}
        >
          Open
        </button>
        {working && status && <span className="muted small">{status.message}</span>}
        <span className="spacer" />
        <span className="muted small">
          {auth.email}
          {auth.subscribed && auth.plan === 'hosted'
            ? ` · ${auth.usageMonth ?? 0}/${auth.monthlyLimit ?? 300} this month`
            : ''}
          {isByok ? ' · your own Claude key' : ''}
        </span>
        {isByok && (
          <button className="link" onClick={() => setKeyPanel((v) => !v)}>
            Claude key
          </button>
        )}
        {auth.subscribed && (
          <button
            className="link"
            onClick={async () => {
              const r = await window.api.auth.openManage();
              if (!r.ok && r.error) alert(r.error);
            }}
          >
            Manage subscription
          </button>
        )}
        <button
          className={update?.available ? 'link update-available' : 'link'}
          title={update?.available ? `Version ${update.latest} is ready to download` : 'Look for a newer version'}
          onClick={() => void window.api.checkForUpdates()}
        >
          {update?.available ? `Update available: ${update.latest}` : 'Check for updates'}
        </button>
        <button
          className="link"
          onClick={async () => {
            await window.api.auth.signOut();
            await refreshAuth();
          }}
        >
          Sign out
        </button>
      </header>

      {details && details.options.length > 0 && (
        <details className="options-bar">
          <summary>
            Board options ({details.options.length})
            {Object.keys(changed).length > 0 ? ` · ${Object.keys(changed).length} changed` : ''}
          </summary>
          <div className="options-grid">
            {details.options.map((o) => {
              const current =
                changed[o.option] ?? o.values.find((v) => v.selected)?.value ?? o.values[0].value;
              const defaultValue = o.values.find((v) => v.selected)?.value ?? o.values[0].value;
              return (
                <label key={o.option}>
                  {o.label}
                  <select
                    value={current}
                    disabled={working}
                    onChange={(e) => {
                      const v = e.target.value;
                      setChanged((prev) => {
                        const next = { ...prev };
                        if (v === defaultValue) delete next[o.option];
                        else next[o.option] = v;
                        return next;
                      });
                    }}
                  >
                    {o.values.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </details>
      )}
      {details?.hint && <div className="hint">Tip for this board: {details.hint}</div>}
      {details?.error && <div className="hint">Could not prepare this board: {details.error}</div>}

      {needsSub && (
        <div className="banner">
          {outOfFree
            ? `You have used your ${freeLimit} free generations this month. Subscribe to keep generating. You can still edit, check and upload your own code.`
            : `Free plan: ${freeLeft} of ${freeLimit} free generations left this month. Subscribe for 300 a month with automatic error fixing.`}
          <button className="primary" onClick={() => window.api.auth.openCheckout()}>
            Subscribe
          </button>
          <button onClick={refreshAuth}>I've subscribed — refresh</button>
        </div>
      )}

      {isByok && (needsKey || keyPanel) && (
        <div className="banner">
          <span>
            {needsKey
              ? 'Your plan uses your own Claude API key. Paste it here (get one at console.anthropic.com). It is stored encrypted on this computer only.'
              : 'Replace your Claude API key. It is stored encrypted on this computer only.'}
          </span>
          <input
            type="password"
            placeholder="sk-ant-…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <button className="primary" onClick={saveKey} disabled={!keyInput.trim()}>
            Save key
          </button>
          {!needsKey && <button onClick={removeKey}>Remove key</button>}
          {keyError && <span className="small" style={{ color: '#ff8a8a' }}>{keyError}</span>}
        </div>
      )}

      <main className="workspace">
        <aside
          className={`chat${dragOver ? ' dragover' : ''}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addFiles(e.dataTransfer.files);
          }}
        >
          <div className="chat-log">
            {chat.length === 0 && (
              <p className="muted">
                Try: “Blink an LED on pin 8 faster when I press the button on pin 2.” Or press{' '}
                <button className="link-btn" onClick={() => setShowProjects(true)}>Starter projects</button> for ready-made ideas.
              </p>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.images && (
                  <div className="thumbs">
                    {m.images.map((src, k) => (
                      <img key={k} src={src} alt="" />
                    ))}
                  </div>
                )}
                {m.text}
              </div>
            ))}
            {working && status && <div className="bubble status">{status.message}</div>}
          </div>
          {phone && (
            <div className="phone-panel">
              <img src={phone.qr} alt="QR code" width={110} height={110} />
              <div>
                <strong>Take a photo with your phone</strong>
                <div className="small muted">
                  Point your phone camera at this code, tap the link, and take a photo. It shows up here in a second or
                  two. Works with any phone, nothing to install.
                </div>
                <button onClick={() => setPhone(null)}>Done</button>
              </div>
            </div>
          )}
          {images.length > 0 && (
            <div className="thumbs tray">
              {images.map((src, k) => (
                <span key={k} className="thumb">
                  <img src={src} alt="" />
                  <button title="Remove photo" onClick={() => setImages((cur) => cur.filter((_, j) => j !== k))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="chat-input">
            <textarea
              placeholder="What should your board do? (paste or drop a photo of your wiring here)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
                if (files.length) {
                  e.preventDefault();
                  void addFiles(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void generate();
                }
              }}
              rows={3}
            />
            <label className="teach-toggle" title="The AI also explains the code line by line and asks you three questions">
              <input
                type="checkbox"
                checked={teach}
                onChange={(e) => {
                  setTeach(e.target.checked);
                  try {
                    localStorage.setItem('teach', e.target.checked ? '1' : '0');
                  } catch {
                    /* ignore */
                  }
                }}
              />
              Teaching mode: explain the code and quiz me
            </label>
            <div className="chat-buttons">
              <button className="primary" onClick={() => void generate()} disabled={working || outOfFree || needsKey}>
                {busy ? 'Working…' : preparing ? 'Preparing board…' : 'Generate'}
              </button>
              <button title="Pick a ready-made project to start from" onClick={() => setShowProjects(true)} disabled={working}>
                Starter projects
              </button>
              <button title="Send a photo from your phone camera" onClick={() => void togglePhone()} disabled={working}>
                {phone ? 'Hide phone camera' : 'Photo from phone'}
              </button>
            </div>
          </div>
        </aside>

        <section className="editor-pane">
          {history.length > 0 && (
            <div className="history-bar">
              <label>
                Version history
                <select
                  value=""
                  disabled={working}
                  onChange={(e) => {
                    const item = history[Number(e.target.value)];
                    if (!item) return;
                    pushHistory('Before restore', code);
                    setCode(item.code);
                  }}
                >
                  <option value="">Go back to…</option>
                  {history.map((h, i) => (
                    <option key={h.t} value={i}>
                      {new Date(h.t).toLocaleTimeString()} · {h.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={working}
                title={
                  history[0]?.label === 'Redo point'
                    ? 'Bring back the change you just undid'
                    : 'Put back the program from before the last AI change'
                }
                onClick={() => {
                  const item = history[0];
                  if (!item) return;
                  // Swap, don't delete: the program we are leaving becomes the redo point,
                  // so the history bar stays and the button can flip back and forth.
                  const leaving = history[0].label === 'Redo point' ? 'Before redo' : 'Redo point';
                  setHistory((h) => [{ t: Date.now(), label: leaving, code }, ...h.slice(1)]);
                  setCode(item.code);
                }}
              >
                {history[0]?.label === 'Redo point' ? 'Redo' : 'Undo last AI change'}
              </button>
            </div>
          )}
          <div className="editor">
            <Editor
              height="100%"
              language="cpp"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? '')}
              options={{ fontSize: 14, automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false, contextmenu: false }}
            />
          </div>
          <div
            className="splitter"
            title="Drag up to make the bottom panel taller. Double-click to switch between tall and short."
            onMouseDown={startDrag}
            onDoubleClick={() => {
              const h = consoleHRef.current > 380 ? 230 : Math.min(window.innerHeight - 200, 560);
              setConsoleH(h);
              try {
                localStorage.setItem('consoleH', String(h));
              } catch {
                /* ignore */
              }
            }}
          />
          <div className="console" style={{ height: consoleH }}>
            <div className="tabs">
              <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
                Output
              </button>
              <button className={tab === 'wiring' ? 'active' : ''} onClick={() => setTab('wiring')}>
                Wiring{wiring.length ? ` (${wiring.length})` : ''}
              </button>
              <button className={tab === 'libs' ? 'active' : ''} onClick={() => setTab('libs')}>
                Libraries
              </button>
              <button className={tab === 'pins' ? 'active' : ''} onClick={() => setTab('pins')}>
                Pins
              </button>
              <button className={tab === 'parts' ? 'active' : ''} onClick={() => setTab('parts')}>
                Parts{parts.length ? ` (${parts.length})` : ''}
              </button>
              <button className={tab === 'lesson' ? 'active' : ''} onClick={() => setTab('lesson')}>
                Lesson
              </button>
              <button className={tab === 'serial' ? 'active' : ''} onClick={() => setTab('serial')}>
                Serial monitor
              </button>
              <span className="spacer" />
              {tab === 'serial' && (
                <>
                  <button
                    className="primary"
                    title="Send what your board printed to the AI and ask what is wrong"
                    disabled={!serial.trim() || working || outOfFree || needsKey}
                    onClick={() =>
                      void generate({
                        shown: 'Ask AI about the serial monitor output',
                        prompt:
                          'My board is running the sketch above. Here is what it printed on the serial monitor:\n' +
                          serial.slice(-2500) +
                          '\n\nExplain in plain English what this means. If the program is not doing what it should, or there is a bug or a wiring problem, fix the code and say what to check on the hardware.',
                      })
                    }
                  >
                    Ask AI about this
                  </button>
                  <button onClick={toggleMonitor} disabled={!port || working}>
                    {monitorOn ? 'Stop' : 'Start (9600 baud)'}
                  </button>
                </>
              )}
            </div>
            {tab === 'lesson' ? (
              <LessonPanel lesson={lesson} teach={teach} onExplain={explainProgram} canExplain={!working && !outOfFree && !needsKey} />
            ) : tab === 'libs' ? (
              <LibraryPanel />
            ) : tab === 'pins' ? (
              <PinsPanel fqbn={fqbn} boardName={boardName} />
            ) : tab === 'parts' ? (
              <PartsPanel parts={parts} onAnalyze={analyzeProgram} canAnalyze={!working && !outOfFree && !needsKey} />
            ) : tab === 'wiring' ? (
              <WiringPanel rows={wiring} boardName={boardName} onAnalyze={analyzeProgram} canAnalyze={!working && !outOfFree && !needsKey} />
            ) : tab === 'log' ? (
              <pre className="output">
                {log || 'Output from checking and uploading shows here.'}
                {logDetail && logDetail.for === log && (
                  <>
                    {'\n\n'}
                    <button className="link-btn" onClick={() => setShowDetail((v) => !v)}>
                      {showDetail ? 'Hide details' : 'Show details'}
                    </button>
                    {showDetail && `\n\n${logDetail.text}`}
                  </>
                )}
              </pre>
            ) : (
              <pre className="output" ref={serialRef}>
                {serial || 'Press Start to see what your board prints.'}
              </pre>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
