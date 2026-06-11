import React from 'react';
import type { User } from 'firebase/auth';
import { Icon } from '../icons';
import { sendVerification, signOutUser } from '../../lib/auth';
import { useLang } from '../../i18n/react';

export default function VerifyEmail({ user }: { user: User }) {
  const { d } = useLang();
  const V = d.app.verify;
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const resend = async () => {
    setErr(null);
    setBusy(true);
    try {
      await sendVerification(user);
      setSent(true);
    } catch (e: any) {
      setErr(e?.code?.includes('too-many-requests') ? V.errTooMany : V.errSend);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setErr(null);
    setChecking(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        window.location.reload();
        return;
      }
      setErr(V.errNotYet);
    } catch {
      setErr(V.errCheck);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-6">
      <div className="bg-white border border-line rounded-2xl p-10 max-w-[440px] w-full text-center">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white mb-5" style={{ background: 'var(--coral)' }}>
          <Icon.Mail size={26} />
        </div>
        <h1 className="font-display font-bold text-[26px] m-0 mb-2">{V.title}</h1>
        <p className="text-[15px] text-ink-soft leading-[1.55]">
          {V.body1} <strong>{user.email}</strong>. {V.body2}
        </p>
        {sent && (
          <div className="text-sm px-3 py-2 rounded-lg mt-4" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)' }}>
            {V.sent}
          </div>
        )}
        {err && (
          <div className="text-sm px-3 py-2 rounded-lg mt-4" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>
            {err}
          </div>
        )}
        <div className="flex flex-col gap-2.5 mt-6">
          <button onClick={check} disabled={checking} className="btn btn-primary justify-center disabled:opacity-60">
            {checking ? V.checking : V.continueCta}
          </button>
          <button onClick={resend} disabled={busy} className="btn btn-ghost justify-center disabled:opacity-60">
            {busy ? V.sending : V.resend}
          </button>
        </div>
        <button
          onClick={async () => { await signOutUser(); window.location.href = '/'; }}
          className="text-xs text-muted hover:text-coral mt-5"
        >
          {V.logout}
        </button>
      </div>
    </div>
  );
}
