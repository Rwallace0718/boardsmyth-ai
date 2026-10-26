import { useState } from 'react';
import type { AuthState } from '../shared/types';

interface Props {
  email?: string;
  onAccepted: (state: AuthState) => void;
  onSignOut: () => void;
}

/** Shown once to anyone who has not yet agreed to the current Terms and Privacy Policy. */
export default function TermsGate({ email, onAccepted, onSignOut }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setBusy(true);
    setError('');
    const res = await window.api.auth.acceptTerms();
    setBusy(false);
    if (res.ok && res.state) onAccepted(res.state);
    else setError(res.error ?? 'Could not save your choice. Check your internet connection and try again.');
  }

  return (
    <div className="login">
      <div className="card" style={{ width: 400 }}>
        <h1>Before you continue</h1>
        <p className="muted">
          {email ? `${email}, please` : 'Please'} review the terms for BoardSmyth AI. They explain how the service works,
          what you are responsible for when connecting hardware, and how your data is handled.
        </p>
        <label className="agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the{' '}
            <a href="https://boardsmythai.com/terms.html" target="_blank" rel="noreferrer">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="https://boardsmythai.com/privacy.html" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={!agreed || busy} onClick={() => void accept()}>
          {busy ? 'Please wait…' : 'Continue'}
        </button>
        <button className="link" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
