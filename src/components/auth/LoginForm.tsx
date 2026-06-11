import React from 'react';
import { Icon, BrandMark } from '../icons';
import { signInEmail, signInGoogle, resetPassword } from '../../lib/auth';
import { t, localizePath, type Lang, type Dict } from '../../i18n';

export default function LoginForm({ lang = 'en' }: { lang?: Lang }) {
  const d = t(lang);
  const A = d.auth.login;
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<'login' | 'reset'>('login');
  const [resetSent, setResetSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInEmail(email, pw);
      window.location.href = '/app';
    } catch (e: any) {
      setErr(humanizeAuthError(e, d));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (e: any) {
      if (e?.code?.includes('invalid-email')) setErr(d.auth.errors.invalidEmail);
      // Don't reveal whether an account exists for this email.
      else setResetSent(true);
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
      setErr(humanizeAuthError(e, d));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 min-h-[calc(100vh-68px)]">
      <div className="p-10 md:p-14 flex flex-col justify-center max-w-[520px] md:ml-auto w-full">
        {mode === 'login' ? (
          <>
            <div className="eyebrow">{A.eyebrow}</div>
            <h1 className="heading-1 text-5xl mt-3">{A.title}</h1>
            <p className="text-[15px] text-ink-soft mt-2.5 mb-8">{A.sub}</p>
            <form onSubmit={submit} className="flex flex-col gap-3.5">
              <div className="field">
                <label>{A.email}</label>
                <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <div className="flex justify-between items-baseline">
                  <label>{A.password}</label>
                  <button type="button" onClick={() => { setMode('reset'); setErr(null); }} className="text-xs text-coral font-semibold hover:underline underline-offset-2">
                    {A.forgot}
                  </button>
                </div>
                <input type="password" required autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} />
              </div>
              {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}
              <button type="submit" disabled={busy} className="btn btn-primary btn-lg justify-center mt-2 disabled:opacity-60">
                {busy ? A.busy : A.cta} <Icon.Arrow />
              </button>
            </form>
            <div className="flex items-center gap-3.5 my-5 text-muted text-xs before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line"><span>{A.or}</span></div>
            <button onClick={googleLogin} disabled={busy} className="flex items-center justify-center gap-2.5 p-3 border border-line rounded-xl bg-white text-sm font-medium hover:bg-ivory disabled:opacity-60">
              {A.google}
            </button>
            <div className="mt-6 text-sm text-ink-soft">
              {A.newTo} <a href={localizePath('/signup', lang)} className="text-coral font-semibold underline underline-offset-[3px]">{A.create}</a>
            </div>
          </>
        ) : (
          <>
            <div className="eyebrow">{A.resetEyebrow}</div>
            <h1 className="heading-1 text-5xl mt-3">{A.resetTitle}</h1>
            <p className="text-[15px] text-ink-soft mt-2.5 mb-8">
              {A.resetSub}
            </p>
            {resetSent ? (
              <div className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)' }}>
                {A.resetSentA} <strong>{email}</strong>, {A.resetSentB}
              </div>
            ) : (
              <form onSubmit={submitReset} className="flex flex-col gap-3.5">
                <div className="field">
                  <label>{A.email}</label>
                  <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}
                <button type="submit" disabled={busy} className="btn btn-primary btn-lg justify-center mt-2 disabled:opacity-60">
                  {busy ? A.resetBusy : A.resetCta} <Icon.Arrow />
                </button>
              </form>
            )}
            <div className="mt-6 text-sm text-ink-soft">
              {A.remembered}{' '}
              <button onClick={() => { setMode('login'); setResetSent(false); setErr(null); }} className="text-coral font-semibold underline underline-offset-[3px]">
                {A.backToLogin}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="hidden md:flex p-14 flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2A1F24 0%, #4A2332 100%)', color: '#FFF5F7' }}>
        <div>
          <div className="flex items-center gap-2.5 text-[22px] font-display font-bold">
            <BrandMark size={32} />
            FilWest
          </div>
          <div className="mt-10 flex gap-2 flex-wrap">
            <span className="chip" style={{ background: 'rgba(255,107,157,0.15)', color: 'var(--coral-2)', borderColor: 'rgba(255,107,157,0.25)' }}><Icon.Shield size={12} /> {A.chipVerified}</span>
            <span className="chip" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,245,247,0.85)', borderColor: 'rgba(255,255,255,0.12)' }}>{A.chipCountries}</span>
          </div>
        </div>
        <div>
          <div className="font-display font-semibold text-[26px] leading-[1.22] mb-5">{A.panelQuote}</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-ink" style={{ background: 'var(--blush)' }}>D</div>
            <div>
              <div className="text-sm font-semibold">{A.panelName}</div>
              <div className="text-xs" style={{ color: 'rgba(255,245,247,0.6)' }}>{A.panelMeta}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function humanizeAuthError(e: any, d: Dict): string {
  const E = d.auth.errors;
  if (e?.message === 'firebase-not-configured') return E.notConfigured;
  const code: string | undefined = e?.code;
  if (!code) return E.generic;
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
    return E.noMatch;
  if (code.includes('invalid-email')) return E.invalidEmail;
  if (code.includes('too-many-requests')) return E.tooMany;
  if (code.includes('network')) return E.network;
  return E.loginFailed;
}
