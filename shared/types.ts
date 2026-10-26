export interface BoardOption {
  name: string;
  fqbn: string;
  /** Core package id that must be installed, e.g. "arduino:avr" */
  core: string;
  /** Human-readable platform/vendor name, e.g. "Arduino AVR Boards" */
  vendor?: string;
}

export interface BoardConfigValue {
  value: string;
  label: string;
  selected: boolean;
}

/** A per-board menu such as Processor, Flash Size or Partition Scheme. */
export interface BoardConfigOption {
  option: string;
  label: string;
  values: BoardConfigValue[];
}

export interface BoardDetails {
  options: BoardConfigOption[];
  /** Short upload tip for this board family, if there is a known gotcha. */
  hint?: string;
  error?: string;
}

export interface DetectedPort {
  address: string;
  label: string;
  boardName?: string;
  fqbn?: string;
}

export interface GenerateRequest {
  prompt: string;
  fqbn: string;
  boardName: string;
  currentCode?: string;
  /** Photos of the board or wiring as data:image/jpeg;base64 URLs (max 3). */
  images?: string[];
}

export interface GenerateResult {
  ok: boolean;
  code: string;
  notes: string;
  /** Hardware risks the AI spotted, one per line. Empty when there are none. */
  safety?: string;
  attempts: number;
  error?: string;
}

export interface ActionResult {
  ok: boolean;
  output: string;
}

export type Stage =
  | 'generating'
  | 'installing'
  | 'compiling'
  | 'fixing'
  | 'uploading'
  | 'done'
  | 'error';

export interface StatusEvent {
  stage: Stage;
  message: string;
}

export interface AuthState {
  signedIn: boolean;
  email?: string;
  subscribed?: boolean;
  /** 'hosted' = our AI key; 'byok' = the user's own Claude key. */
  plan?: 'hosted' | 'byok';
  /** Generations used this month (hosted plan). */
  usageMonth?: number;
  monthlyLimit?: number;
  /** True when a Claude API key is saved on this computer (byok plan). */
  hasOwnKey?: boolean;
  /** Hosted generations a non-subscriber gets each month. */
  freeLimit?: number;
  /** True once this user has accepted the current Terms of Service and Privacy Policy. */
  termsAccepted?: boolean;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  state?: AuthState;
}

export interface FileResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  code?: string;
  error?: string;
}

export interface HistoryItem {
  t: number;
  label: string;
  code: string;
}

export interface Draft {
  code: string;
  fqbn: string;
  history?: HistoryItem[];
}

export interface PhoneSession {
  session: string;
  url: string;
  /** QR code image as a data URL. */
  qr: string;
}

export type MenuAction = 'new' | 'open' | 'save' | 'saveAs';

export interface Api {
  auth: {
    state(): Promise<AuthState>;
    signIn(email: string, password: string): Promise<AuthResult>;
    signUp(email: string, password: string): Promise<AuthResult>;
    signOut(): Promise<void>;
    acceptTerms(): Promise<AuthResult>;
    openCheckout(): Promise<void>;
    openManage(): Promise<{ ok: boolean; error?: string }>;
  };
  claudeKey: {
    set(key: string): Promise<{ ok: boolean; error?: string }>;
    clear(): Promise<void>;
  };
  boards: {
    /** Short list of the most common boards, shown first in the picker. */
    popular(): Promise<BoardOption[]>;
    /** Every board from every installed and installable board package. */
    catalog(refresh: boolean): Promise<BoardOption[]>;
    /** Installs the board's core if needed and returns its option menus. */
    details(fqbn: string): Promise<BoardDetails>;
    detect(): Promise<DetectedPort[]>;
  };
  generate(req: GenerateRequest): Promise<GenerateResult>;
  compile(code: string, fqbn: string): Promise<ActionResult>;
  upload(code: string, fqbn: string, port: string): Promise<ActionResult>;
  monitor: {
    start(port: string, baud: number): Promise<void>;
    stop(): Promise<void>;
    onData(cb: (chunk: string) => void): () => void;
  };
  onStatus(cb: (e: StatusEvent) => void): () => void;
  file: {
    /** Saves to `path`, or asks where to save when path is empty or saveAs is true. */
    save(code: string, path: string, saveAs: boolean): Promise<FileResult>;
    open(): Promise<FileResult>;
  };
  draft: {
    get(): Promise<Draft | null>;
    set(d: Draft): Promise<void>;
  };
  phone: {
    /** Starts a photo session and returns the QR code to scan with a phone. */
    start(): Promise<PhoneSession>;
    /** Returns (and removes) any photos the phone has sent for this session. */
    poll(session: string): Promise<string[]>;
  };
  onMenu(cb: (a: MenuAction) => void): () => void;
  /** Looks for a newer version and tells the user (a dialog is shown by the app). */
  checkForUpdates(): Promise<void>;
  /** Latest known update state (checked at launch and every few hours). */
  updateState(): Promise<UpdateState>;
  onUpdateState(cb: (u: UpdateState) => void): () => void;
}

export interface UpdateState {
  current: string;
  available: boolean;
  latest?: string;
  url?: string;
  notes?: string;
}
