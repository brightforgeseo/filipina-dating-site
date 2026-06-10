import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import { useAuth } from '../../lib/useAuth';
import { getProfile, saveProfile, deleteProfile, type Profile } from '../../lib/profiles';
import { recordSwipe } from '../../lib/matching';
import { signOutUser, deleteAccount } from '../../lib/auth';
import { uploadProfileImage } from '../../lib/storage';
import { INTEREST_OPTIONS, COUNTRY_OPTIONS, LOOKING_FOR_OPTIONS, SUPPORT_EMAIL, reportMailto } from '../../lib/constants';

export default function ProfileView() {
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [target, setTarget] = React.useState<Profile | null | undefined>(undefined);
  const [toast, setToast] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  const targetId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
    : null;

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    (async () => {
      const mine = await getProfile(user.uid);
      setMe(mine);
      if (!targetId || targetId === user.uid) setTarget(mine ?? { id: user.uid, name: user.displayName || 'You' });
      else setTarget(await getProfile(targetId));
    })();
  }, [user, loading, targetId]);

  const like = async () => {
    if (!user || !target) return;
    try {
      const res = await recordSwipe(user.uid, target.id, 'right');
      if (res.matched) {
        setToast(`It's a match with ${res.matchedName || target.name}!`);
        setTimeout(() => (window.location.href = '/app/messages'), 1400);
      } else {
        setToast('Liked! We’ll let them know.');
        setTimeout(() => setToast(null), 2200);
      }
    } catch {
      setToast('Could not send your like. Please try again.');
      setTimeout(() => setToast(null), 2200);
    }
  };

  if (loading || !user || target === undefined) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;

  if (target === null) {
    return (
      <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
        <Sidebar route="profile" user={user} me={me} />
        <main className="p-10">
          <h1 className="font-display font-bold text-3xl mb-2">Profile not found</h1>
          <p className="text-ink-soft">That profile doesn’t exist or was removed.</p>
          <a href="/app" className="btn btn-primary mt-5">Back to Discover</a>
        </main>
      </div>
    );
  }

  const p = target;
  const isMyProfile = user.uid === p.id;

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="profile" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 flex items-center justify-between px-10 py-6 border-b border-line backdrop-blur-xl" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <h1 className="font-display font-bold text-[28px] m-0 tracking-[-0.015em]">
            {isMyProfile ? (editing ? 'Edit your profile' : 'Your profile') : `${p.name}'s profile`}
          </h1>
          {!isMyProfile && (
            <a href={reportMailto(p.id, p.name)} className="icon-btn" title="Report this profile" aria-label="Report this profile">
              <Icon.Flag size={14} />
            </a>
          )}
          {isMyProfile && !editing && (
            <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">Edit profile</button>
          )}
        </div>
        <div className="p-10 max-w-[1000px] mx-auto">
          {toast && <div className="mb-6 px-5 py-3 rounded-2xl text-white font-semibold flex items-center gap-2" style={{ background: 'var(--coral)' }}><Icon.Heart size={16} filled />{toast}</div>}

          {isMyProfile && editing ? (
            <EditProfile
              profile={p}
              onSaved={(updated) => {
                setTarget(updated);
                setMe(updated);
                setEditing(false);
                setToast('Profile saved.');
                setTimeout(() => setToast(null), 2200);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="grid md:grid-cols-[1.1fr_1fr] gap-8">
              <div className="rounded-[20px] overflow-hidden h-[480px] relative" style={{ background: p.images?.[0] ? `url(${p.images[0]}) center/cover` : 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
                {!p.images?.[0] && (
                  <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[180px] text-white/40">{p.name?.[0] || '?'}</div>
                )}
              </div>
              <div>
                <div className="flex gap-2 mb-3">
                  {p.verified && <span className="chip chip-verified"><Icon.Shield size={11} />Verified</span>}
                  {p.online && <span className="chip" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)', borderColor: 'rgba(76,175,80,0.25)' }}>Online now</span>}
                </div>
                <h2 className="font-display font-bold text-5xl tracking-[-0.02em] m-0 mb-2">
                  {p.name}{p.age ? <span className="text-muted font-normal">, {p.age}</span> : null}
                </h2>
                {(p.city || p.country) && (
                  <div className="text-[15px] text-ink-soft flex gap-1.5 items-center mb-5">
                    <Icon.Pin size={13} /> {[p.city, p.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {p.bio && <p className="text-[15px] leading-[1.6] text-ink-soft mb-6">{p.bio}</p>}
                {(p.interests?.length || p.lookingFor) && (
                  <div className="py-5 border-y border-line flex flex-col gap-4">
                    {p.lookingFor && (
                      <div>
                        <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-1 font-semibold">Looking for</div>
                        <div className="text-[15px]">{p.lookingFor}</div>
                      </div>
                    )}
                    {p.interests?.length ? (
                      <div>
                        <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-2 font-semibold">Interests</div>
                        <div className="flex flex-wrap gap-1.5">
                          {p.interests.map((t) => <span key={t} className="chip">{t}</span>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {!isMyProfile && (
                  <div className="flex gap-2.5 mt-6">
                    <a href="/app" className="btn btn-ghost" aria-label="Back to Discover"><Icon.X size={14} /></a>
                    <button onClick={like} className="btn btn-primary flex-1 justify-center">
                      <Icon.Heart size={14} filled /> Like
                    </button>
                  </div>
                )}
                {isMyProfile && (
                  <div className="mt-6 text-sm text-muted">This is how others see you.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EditProfile({ profile, onSaved, onCancel }: { profile: Profile; onSaved: (p: Profile) => void; onCancel: () => void }) {
  const [name, setName] = React.useState(profile.name || '');
  const [age, setAge] = React.useState(profile.age ? String(profile.age) : '');
  const [city, setCity] = React.useState(profile.city || '');
  const [country, setCountry] = React.useState(profile.country || 'Philippines');
  const [bio, setBio] = React.useState(profile.bio || '');
  const [lookingFor, setLookingFor] = React.useState(profile.lookingFor || 'Serious relationship');
  const [interests, setInterests] = React.useState<string[]>(profile.interests || []);
  const [photo, setPhoto] = React.useState(profile.images?.[0] || '');
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const toggle = (t: string) =>
    setInterests((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      setPhoto(await uploadProfileImage(profile.id, file));
    } catch (ex: any) {
      if (ex?.message === 'not-an-image') setErr('Please choose an image file.');
      else if (ex?.message === 'too-large') setErr('Photos must be under 5 MB.');
      else setErr('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const images = [...(profile.images ?? [])];
      if (photo) images[0] = photo;
      const data: Partial<Profile> = {
        name: name.trim(),
        age: Number(age) || undefined,
        city: city.trim(),
        country,
        bio: bio.trim(),
        lookingFor,
        interests,
        images,
      };
      await saveProfile(profile.id, data);
      onSaved({ ...profile, ...data, images });
    } catch {
      setErr('Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!window.confirm('Delete your FilWest account? Your profile will be removed permanently. This cannot be undone.')) return;
    setErr(null);
    setDeleting(true);
    const { id: _id, ...backup } = profile;
    try {
      await deleteProfile(profile.id);
      await deleteAccount();
      window.location.href = '/';
    } catch (ex: any) {
      // The auth deletion failed after the profile doc was removed — restore
      // it so a failed attempt doesn't wipe the user's profile.
      await saveProfile(profile.id, backup).catch(() => {});
      if (ex?.code?.includes('requires-recent-login')) {
        setErr('For security, deleting your account requires a recent login. Please log out, log back in, and try again.');
        await signOutUser().catch(() => {});
      } else {
        setErr(`Could not delete your account. Please try again or contact ${SUPPORT_EMAIL}.`);
      }
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={save} className="grid md:grid-cols-[1.1fr_1fr] gap-8 items-start">
      <div>
        <div className="rounded-[20px] overflow-hidden h-[480px] relative" style={{ background: photo ? `url(${photo}) center/cover` : 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
          {!photo && (
            <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[180px] text-white/40">{(name || '?')[0]}</div>
          )}
          <label className="absolute bottom-4 left-4 btn btn-primary btn-sm cursor-pointer">
            {uploading ? 'Uploading…' : photo ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="hidden" aria-label="Upload profile photo" />
          </label>
        </div>
        <div className="text-xs text-muted mt-2">JPG or PNG, up to 5 MB. Your photo should clearly show your face.</div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>First name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Age</label>
            <input required type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
        </div>
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
          <label>About you</label>
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

        <div className="flex gap-2.5 mt-1">
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy || deleting}>Cancel</button>
          <button type="submit" disabled={busy || uploading || deleting} className="btn btn-primary flex-1 justify-center disabled:opacity-60">
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-line">
          <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-2 font-semibold">Danger zone</div>
          <button type="button" onClick={removeAccount} disabled={deleting || busy} className="text-sm text-coral font-semibold hover:underline underline-offset-2 disabled:opacity-60">
            {deleting ? 'Deleting account…' : 'Delete my account'}
          </button>
          <div className="text-xs text-muted mt-1.5">Removes your profile permanently. See our <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a> for details.</div>
        </div>
      </div>
    </form>
  );
}
