import { contextBridge, ipcRenderer } from 'electron';
import type { Api, MenuAction, StatusEvent, UpdateState } from '../shared/types';

const api: Api = {
  auth: {
    state: () => ipcRenderer.invoke('auth:state'),
    signIn: (email, password) => ipcRenderer.invoke('auth:signIn', email, password),
    signUp: (email, password) => ipcRenderer.invoke('auth:signUp', email, password),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    openCheckout: () => ipcRenderer.invoke('auth:openCheckout'),
    openManage: () => ipcRenderer.invoke('auth:openManage'),
  },
  claudeKey: {
    set: (key) => ipcRenderer.invoke('claudeKey:set', key),
    clear: () => ipcRenderer.invoke('claudeKey:clear'),
  },
  boards: {
    popular: () => ipcRenderer.invoke('boards:popular'),
    catalog: (refresh) => ipcRenderer.invoke('boards:catalog', refresh),
    details: (fqbn) => ipcRenderer.invoke('boards:details', fqbn),
    detect: () => ipcRenderer.invoke('boards:detect'),
  },
  generate: (req) => ipcRenderer.invoke('ai:generate', req),
  compile: (code, fqbn) => ipcRenderer.invoke('arduino:compile', code, fqbn),
  upload: (code, fqbn, port) => ipcRenderer.invoke('arduino:upload', code, fqbn, port),
  monitor: {
    start: (port, baud) => ipcRenderer.invoke('monitor:start', port, baud),
    stop: () => ipcRenderer.invoke('monitor:stop'),
    onData: (cb) => {
      const handler = (_: unknown, chunk: string) => cb(chunk);
      ipcRenderer.on('monitor:data', handler);
      return () => ipcRenderer.removeListener('monitor:data', handler);
    },
  },
  file: {
    save: (code, path, saveAs) => ipcRenderer.invoke('file:save', code, path, saveAs),
    open: () => ipcRenderer.invoke('file:open'),
  },
  draft: {
    get: () => ipcRenderer.invoke('draft:get'),
    set: (d) => ipcRenderer.invoke('draft:set', d),
  },
  phone: {
    start: () => ipcRenderer.invoke('phone:start'),
    poll: (session) => ipcRenderer.invoke('phone:poll', session),
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  updateState: () => ipcRenderer.invoke('update:state'),
  onUpdateState: (cb) => {
    const handler = (_: unknown, u: UpdateState) => cb(u);
    ipcRenderer.on('update:state', handler);
    return () => ipcRenderer.removeListener('update:state', handler);
  },
  onMenu: (cb) => {
    const handler = (_: unknown, a: MenuAction) => cb(a);
    ipcRenderer.on('menu:action', handler);
    return () => ipcRenderer.removeListener('menu:action', handler);
  },
  onStatus: (cb) => {
    const handler = (_: unknown, e: StatusEvent) => cb(e);
    ipcRenderer.on('status', handler);
    return () => ipcRenderer.removeListener('status', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
