import React from 'react';
import { Icon, BrandMark } from '../icons';
import { signUpEmail, signInGoogle, sendVerification } from '../../lib/auth';
import { saveProfile } from '../../lib/profiles';
import { INTEREST_OPTIONS, COUNTRY_OPTIONS, LOOKING_FOR_OPTIONS } from '../../lib/constants';

type Gender = 'female' | 'male' | 'other';

export default function SignupWizard() {
  const [step, setStep] = React.useState(1);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Step 1
  const [firstName, setFirstName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [age, setAge] = React.useState('');
  const [gender, setGender] = React.useState<Gender>('female');

  // Step 2 (profile)
  const [city, setCity] = React.useState('');
  const [country, setCountry] = React.useState('Philippines');
  const [bio, setBio] = React.useState('');
  const [lookingFor, setLookingFor] = React.useState('Serious relationship');

  const [interests, setInterests] = React.useState<string[]>([]);
  const toggle = (t: string) =>
    setInterests((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const submit1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const user = await signUpEmail(email.trim(), password);
      // Fire-and-forget: the /app pages gate on emailVerified and offer resend.
      sendVerification(user).catch(() => {});
      await saveProfile(user.uid, {
        name: firstName.trim(),
        age: Number(age) || undefined,
        gender,
        verified: false,
      });
      setStep(2);
    } catch (e: any) {
      setErr(humanizeAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  const submit2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { currentUser } = await import('../../lib/auth');
      const u = currentUser();
      if (!u) throw new Error('not-signed-in');
      await saveProfile(u.uid, {
        name: firstName.trim(),
        age: Number(age) || undefined,
        gender,
        city: city.trim(),
        country,
        bio: bio.trim(),
        lookingFor,
        interests,
      });
      window.location.href = '/app';
    } catch {
      setErr('Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const googleSignup = async () => {
    setErr(null);
    setBusy(true);
    try {
      const user = await signInGoogle();
      await saveProfile(user.uid, {
        name: user.displayName?.split(' ')[0] || 'New member',
        verified: false,
      });
      setStep(2);
    } catch (e: any) {
      setErr(humanizeAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 min-h-[calc(100vh-68px)]">
      <div className="p-10 md:p-14 flex flex-col justify-center max-w-[520px] md:ml-auto w-full">
        <div className="eyebrow">Step {step} of 2</div>
        <h1 className="heading-1 text-5xl mt-3">
          {step === 1 ? 'Create your account.' : 'Tell us about you.'}
        </h1>
        <p className="text-[15px] text-ink-soft mt-2.5 mb-8">
          {step === 1 ? 'Free for women from the Philippines. Always.' : "A few details so we can show you real matches."}
        </p>

        {step === 1 && (
          <form onSubmit={submit1} className="flex flex-col gap-3.5">
            <div className="field">
              <label>First name</label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input required type="password" minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>Age</label>
                <input required type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="field">
                <label>I am a</label>
                <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="female">Woman</option>
                  <option value="male">Man</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary btn-lg justify-center disabled:opacity-60">
              {busy ? 'Creating account…' : 'Continue'} <Icon.Arrow />
            </button>
            <div className="flex items-center gap-3.5 my-1 text-muted text-xs before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line"><span>or</span></div>
            <button type="button" onClick={googleSignup} disabled={busy} className="flex items-center justify-center gap-2.5 p-3 border border-line rounded-xl bg-white text-sm font-medium hover:bg-ivory disabled:opacity-60">
              Continue with Google
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submit2} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cebu City" />
              </div>
              <div className="field">
                <label>Country</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Looking for</label>
              <select value={lookingFor} onChange={(e) => setLookingFor(e.target.value)}>
                {LOOKING_FOR_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>A line about you</label>
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Teacher by day, coffee person always. Family means everything." />
            </div>
            <div className="field">
              <label>Interests</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {INTEREST_OPTIONS.map((t) => (
                  <span
                    key={t}
                    onClick={() => toggle(t)}
                    className="chip cursor-pointer"
                    style={interests.includes(t) ? { background: 'var(--coral)', color: '#fff', borderColor: 'var(--coral)' } : {}}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}
            <div className="flex gap-2.5">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button type="submit" disabled={busy} className="btn btn-primary flex-1 justify-center disabled:opacity-60">
                {busy ? 'Saving…' : 'Enter FilWest'} <Icon.Arrow />
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-sm text-ink-soft">
          Already a member? <a href="/login" className="text-coral font-semibold underline underline-offset-[3px]">Log in</a>
        </div>
      </div>

      <div className="hidden md:flex p-14 flex-col justify-between relative" style={{ background: 'linear-gradient(135deg, #2A1F24 0%, #4A2332 100%)', color: '#FFF5F7' }}>
        <div>
          <div className="flex items-center gap-2.5 text-[22px] font-display font-bold">
            <BrandMark size={32} />
            FilWest
          </div>
          <div className="mt-12 font-display font-bold text-[30px] leading-[1.1]">
            Two steps to<br /><span style={{ color: 'var(--coral-2)' }}>your first match.</span>
          </div>
          <div className="mt-9 flex flex-col gap-3">
            {[
              { n: '1', t: 'Create account' },
              { n: '2', t: 'About you' },
            ].map((s, i) => {
              const idx = i + 1;
              const active = idx === step, done = idx < step;
              return (
                <div key={s.n} className="flex gap-4 items-center px-4 py-3 rounded-xl" style={{ background: active ? 'rgba(255,107,157,0.12)' : 'transparent', border: active ? '1px solid rgba(255,107,157,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: done ? 'var(--ok)' : active ? 'var(--coral)' : 'rgba(255,255,255,0.08)', color: done || active ? '#fff' : 'rgba(255,245,247,0.6)' }}>
                    {done ? <Icon.Check size={14} /> : s.n}
                  </div>
                  <div className="text-sm" style={{ color: active ? '#FFF5F7' : 'rgba(255,245,247,0.7)', fontWeight: active ? 600 : 400 }}>{s.t}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,245,247,0.55)' }}>
          <Icon.Lock size={12} /> Your password is never visible to other members.
        </div>
      </div>
    </div>
  );
}

function humanizeAuthError(code?: string): string {
  if (!code) return 'Something went wrong. Please try again.';
  if (code.includes('email-already-in-use')) return 'An account already exists with that email. Try logging in.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('network')) return 'Network trouble. Check your connection.';
  return 'Sign up failed. Please try again.';
}
