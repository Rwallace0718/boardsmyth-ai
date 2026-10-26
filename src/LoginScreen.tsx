import { useState } from 'react';
import type { AuthState } from '../shared/types';

interface Props {
  onSignedIn: (state: AuthState) => void;
}

export default function LoginScreen({ onSignedIn }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res =
      mode === 'signin'
        ? await window.api.auth.signIn(email, password)
        : await window.api.auth.signUp(email, password);
    setBusy(false);
    if (res.ok && res.state) onSignedIn(res.state);
    else setError(res.error ?? 'Something went wrong.');
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>BoardSmyth AI</h1>
        <p className="muted">Describe it. Your board does it.</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
