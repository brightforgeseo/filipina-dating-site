import React from 'react';
import type { User } from 'firebase/auth';
import { Icon } from '../icons';
import { sendVerification, signOutUser } from '../../lib/auth';

export default function VerifyEmail({ user }: { user: User }) {
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
      setErr(e?.code?.includes('too-many-requests')
        ? 'Too many emails sent — please wait a few minutes and try again.'
        : 'Could not send the email. Please try again.');
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
      setErr("Not verified yet — click the link in the email first, then try again.");
    } catch {
      setErr('Could not check your status. Please try again.');
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
        <h1 className="font-display font-bold text-[26px] m-0 mb-2">Verify your email</h1>
        <p className="text-[15px] text-ink-soft leading-[1.55]">
          We sent a verification link to <strong>{user.email}</strong>. Click it, then come back here — it keeps FilWest free of fake accounts.
        </p>
        {sent && (
          <div className="text-sm px-3 py-2 rounded-lg mt-4" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)' }}>
            Verification email sent. Check your inbox and spam folder.
          </div>
        )}
        {err && (
          <div className="text-sm px-3 py-2 rounded-lg mt-4" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>
            {err}
          </div>
        )}
        <div className="flex flex-col gap-2.5 mt-6">
          <button onClick={check} disabled={checking} className="btn btn-primary justify-center disabled:opacity-60">
            {checking ? 'Checking…' : "I've verified — continue"}
          </button>
          <button onClick={resend} disabled={busy} className="btn btn-ghost justify-center disabled:opacity-60">
            {busy ? 'Sending…' : 'Resend email'}
          </button>
        </div>
        <button
          onClick={async () => { await signOutUser(); window.location.href = '/'; }}
          className="text-xs text-muted hover:text-coral mt-5"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
