import React from 'react';
import { Icon } from '../icons';
import { signInEmail, signInGoogle } from '../../lib/auth';

export default function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInEmail(email, pw);
      window.location.href = '/app';
    } catch (e: any) {
      setErr(humanizeAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signInGoogle();
      window.location.href = '/app';
    } catch (e: any) {
      setErr(humanizeAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 min-h-[calc(100vh-68px)]">
      <div className="p-10 md:p-14 flex flex-col justify-center max-w-[520px] md:ml-auto w-full">
        <div className="eyebrow">Welcome back</div>
        <h1 className="heading-1 text-5xl mt-3">Log in to FilWest.</h1>
        <p className="text-[15px] text-ink-soft mt-2.5 mb-8">Your messages and matches are waiting.</p>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="field">
            <label>Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} />
          </div>
          {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary btn-lg justify-center mt-2 disabled:opacity-60">
            {busy ? 'Logging in…' : 'Log in'} <Icon.Arrow />
          </button>
        </form>
        <div className="flex items-center gap-3.5 my-5 text-muted text-xs before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line"><span>or</span></div>
        <button onClick={googleLogin} disabled={busy} className="flex items-center justify-center gap-2.5 p-3 border border-line rounded-xl bg-white text-sm font-medium hover:bg-ivory disabled:opacity-60">
          Continue with Google
        </button>
        <div className="mt-6 text-sm text-ink-soft">
          New to FilWest? <a href="/signup" className="text-coral font-semibold underline underline-offset-[3px]">Create an account</a>
        </div>
      </div>
      <div className="hidden md:flex p-14 flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2A1F24 0%, #4A2332 100%)', color: '#FFF5F7' }}>
        <div>
          <div className="flex items-center gap-2.5 text-[22px] font-display font-bold">
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--coral)' }}>
              <Icon.Heart size={16} filled className="text-white" />
            </span>
            FilWest
          </div>
          <div className="mt-10 flex gap-2 flex-wrap">
            <span className="chip" style={{ background: 'rgba(255,107,157,0.15)', color: 'var(--coral-2)', borderColor: 'rgba(255,107,157,0.25)' }}><Icon.Shield size={12} /> Verified members only</span>
            <span className="chip" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,245,247,0.85)', borderColor: 'rgba(255,255,255,0.12)' }}>38 countries</span>
          </div>
        </div>
        <div>
          <div className="font-display font-semibold text-[26px] leading-[1.22] mb-5">"We met on a Tuesday. Six months later I was meeting her family in Cebu."</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-ink" style={{ background: 'var(--blush)' }}>D</div>
            <div>
              <div className="text-sm font-semibold">David, 41</div>
              <div className="text-xs" style={{ color: 'rgba(255,245,247,0.6)' }}>Austin · member since '24</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function humanizeAuthError(code?: string): string {
  if (!code) return 'Something went wrong. Please try again.';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
    return "That email and password don't match. Try again, or sign up.";
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a minute.';
  if (code.includes('network')) return 'Network trouble. Check your connection.';
  return 'Login failed. Please try again.';
}
