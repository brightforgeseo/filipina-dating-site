import React from 'react';
import { useAuth } from '../../lib/useAuth';
import {
  getVerification,
  submitVerification,
  uploadVerificationFile,
  type VerificationState,
} from '../../lib/verification';

type Method = 'selfie' | 'id';

export default function Verify() {
  const { user, loading } = useAuth();
  const [state, setState] = React.useState<VerificationState | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [method, setMethod] = React.useState<Method>('selfie');
  const [selfie, setSelfie] = React.useState<File | null>(null);
  const [idFront, setIdFront] = React.useState<File | null>(null);
  const [idBack, setIdBack] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    getVerification(user.uid)
      .then(setState)
      .finally(() => setChecking(false));
  }, [user, loading]);

  const canSubmit = method === 'selfie' ? !!selfie : !!selfie && !!idFront && !!idBack;

  const submit = async () => {
    if (!user || !selfie || busy) return;
    setBusy(true);
    setErr('');
    try {
      const selfieUrl = await uploadVerificationFile(user.uid, 'selfie', selfie);
      let idFrontUrl: string | undefined;
      let idBackUrl: string | undefined;
      if (method === 'id') {
        if (!idFront || !idBack) throw new Error('missing-id');
        idFrontUrl = await uploadVerificationFile(user.uid, 'idFront', idFront);
        idBackUrl = await uploadVerificationFile(user.uid, 'idBack', idBack);
      }
      await submitVerification(user.uid, { method, selfieUrl, idFrontUrl, idBackUrl });
      setState({ status: 'pending', verified: false });
    } catch (e: any) {
      setErr(e?.message === 'too-large' ? 'Each image must be under 10 MB.' : 'Could not submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;
  }

  const done = state?.verified || state?.status === 'pending' || state?.status === 'approved';

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-lg mx-auto px-5 py-8">
        <a href="/app/profile" className="text-sm text-muted hover:text-coral">← Back to profile</a>
        <h1 className="font-display font-bold text-4xl tracking-[-0.02em] mt-3 mb-1">Get verified</h1>
        <p className="text-ink-soft text-sm mb-6">
          Verified members build trust and stand out. Your documents are private and reviewed by our team.
        </p>

        {done ? (
          <div className="card p-6 text-center">
            <div className="text-3xl mb-2">{state?.verified ? '✅' : '⏳'}</div>
            <div className="font-semibold mb-1">
              {state?.verified ? "You're verified" : 'Verification submitted'}
            </div>
            <div className="text-sm text-ink-soft">
              {state?.verified
                ? 'Your badge is now visible on your profile.'
                : "We're reviewing your documents — this usually takes under 24 hours."}
            </div>
            <a href="/app/profile" className="btn btn-primary btn-sm mt-4 inline-block">Back to profile</a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {(['selfie', 'id'] as Method[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`card p-4 text-left border-2 ${method === m ? 'border-coral' : 'border-line'}`}
                >
                  <div className="font-semibold">{m === 'selfie' ? 'Selfie' : 'Photo ID'}</div>
                  <div className="text-xs text-ink-soft mt-1">
                    {m === 'selfie' ? 'Quick — a clear photo of your face' : 'Selfie + government ID (front & back)'}
                  </div>
                  <span className="chip mt-2 inline-block text-[10px]">{m === 'selfie' ? 'BASIC' : 'PREMIUM'}</span>
                </button>
              ))}
            </div>

            <FilePick label="Selfie" hint="A clear, well-lit photo of your face" file={selfie} onPick={setSelfie} />
            {method === 'id' && (
              <>
                <FilePick label="ID — front" hint="Front of your government ID" file={idFront} onPick={setIdFront} />
                <FilePick label="ID — back" hint="Back of your government ID" file={idBack} onPick={setIdBack} />
              </>
            )}

            {err && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!canSubmit || busy}
              className="btn btn-primary justify-center disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit for verification'}
            </button>
            <p className="text-xs text-muted text-center">
              Your ID is never shown to other members and is used only to confirm your identity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilePick({
  label,
  hint,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File) => void;
}) {
  return (
    <label className="card p-4 cursor-pointer flex items-center gap-3 hover:border-coral border border-line">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--blush)' }}>
        {file ? '✓' : '📷'}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-ink-soft truncate">{file ? file.name : hint}</div>
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </label>
  );
}
