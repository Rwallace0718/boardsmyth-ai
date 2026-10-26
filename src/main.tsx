import React from 'react';
import ReactDOM from 'react-dom/client';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { loader } from '@monaco-editor/react';
import App from './App';
import Splash from './Splash';
import './styles.css';

// Bundle Monaco locally so the editor works offline.
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};
loader.config({ monaco });

function Root() {
  const [splash, setSplash] = React.useState(true);
  return (
    <>
      <App />
      {splash && <Splash onDone={() => setSplash(false)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
