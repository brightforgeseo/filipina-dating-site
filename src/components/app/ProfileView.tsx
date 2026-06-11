import React from 'react';
import { Icon } from '../icons';
import Sidebar from './Sidebar';
import { useAuth } from '../../lib/useAuth';
import { getProfile, saveProfile, deleteProfile, type Profile } from '../../lib/profiles';
import { recordSwipe } from '../../lib/matching';
import { signOutUser, deleteAccount, needsEmailVerification } from '../../lib/auth';
import { uploadProfileImage } from '../../lib/storage';
import { blockUser } from '../../lib/blocking';
import { markOnline } from '../../lib/presence';
import VerifyEmail from './VerifyEmail';
import {
  INTEREST_OPTIONS, COUNTRY_OPTIONS, LOOKING_FOR_OPTIONS,
  EDUCATION_OPTIONS, RELIGION_OPTIONS, DRINKING_OPTIONS, SMOKING_OPTIONS,
  MAX_PHOTOS, SUPPORT_EMAIL,
} from '../../lib/constants';
import ReportDialog, { type ReportTarget } from './ReportDialog';
import { useLang } from '../../i18n/react';
import type { Dict } from '../../i18n';

// Fields counted toward profile completion — photos and bio matter most for
// getting matches, so they're weighted double.
function completionPercent(p: Profile): number {
  const checks = [
    !!p.images?.length, !!p.images?.length,
    !!p.bio, !!p.bio,
    !!p.age, !!p.city, !!p.country, !!p.lookingFor, !!p.interests?.length,
    !!p.occupation, !!p.education, !!p.height, !!p.religion, !!p.drinking, !!p.smoking,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function ProfileView() {
  const { d } = useLang();
  const P = d.app.profile;
  const { user, loading } = useAuth();
  const [me, setMe] = React.useState<Profile | null>(null);
  const [target, setTarget] = React.useState<Profile | null | undefined>(undefined);
  const [loadError, setLoadError] = React.useState<'rules' | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [photoIdx, setPhotoIdx] = React.useState(0);
  const [report, setReport] = React.useState<ReportTarget | null>(null);

  const targetId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
    : null;

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (needsEmailVerification(user)) return;
    markOnline(user.uid);
    (async () => {
      try {
        const mine = await getProfile(user.uid);
        setMe(mine);
        if (!targetId || targetId === user.uid) setTarget(mine ?? { id: user.uid, name: user.displayName || 'You' });
        else setTarget(await getProfile(targetId));
      } catch (ex: any) {
        // Distinguish "the security rules block reads" (fixable server config)
        // from a malformed ?id= or missing doc.
        if (ex?.code === 'permission-denied') setLoadError('rules');
        setTarget(null);
      }
    })();
  }, [user, loading, targetId]);

  const like = async () => {
    if (!user || !target) return;
    try {
      const res = await recordSwipe(user.uid, target.id, 'right');
      if (res.matched) {
        setToast(P.matchToast(res.matchedName || target.name));
        setTimeout(() => (window.location.href = '/app/messages'), 1400);
      } else {
        setToast(P.liked);
        setTimeout(() => setToast(null), 2200);
      }
    } catch {
      setToast(P.likeFail);
      setTimeout(() => setToast(null), 2200);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;
  if (needsEmailVerification(user)) return <VerifyEmail user={user} />;
  if (target === undefined) return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">{d.app.loading}</div>;

  if (target === null) {
    return (
      <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
        <Sidebar route="profile" user={user} me={me} />
        <main className="p-10 max-w-[640px]">
          <h1 className="font-display font-bold text-3xl mb-2">{loadError === 'rules' ? P.loadFailTitle : P.notFoundTitle}</h1>
          <p className="text-ink-soft">{loadError === 'rules' ? d.app.rulesHint : P.notFoundBody}</p>
          <a href="/app" className="btn btn-primary mt-5">{P.backToDiscover}</a>
        </main>
      </div>
    );
  }

  const p = target;
  const isMyProfile = user.uid === p.id;
  const photos = p.images?.filter(Boolean) ?? [];
  const mainPhoto = photos[Math.min(photoIdx, Math.max(photos.length - 1, 0))];

  const details: [string, string | undefined][] = [
    [P.occupation, p.occupation],
    [P.education, p.education ? d.options.education[p.education] || p.education : undefined],
    [P.height, p.height ? `${p.height} cm` : undefined],
    [P.religion, p.religion ? d.options.religion[p.religion] || p.religion : undefined],
    [P.drinking, p.drinking ? d.options.drinking[p.drinking] || p.drinking : undefined],
    [P.smoking, p.smoking ? d.options.smoking[p.smoking] || p.smoking : undefined],
  ];
  const setDetails = details.filter(([, v]) => v);

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-ivory max-md:grid-cols-1">
      <Sidebar route="profile" user={user} me={me} />
      <main>
        <div className="sticky top-0 z-10 flex items-center justify-between px-10 py-6 border-b border-line backdrop-blur-xl max-md:px-5 max-md:py-4" style={{ background: 'rgba(255,245,247,0.88)' }}>
          <h1 className="font-display font-bold text-[28px] m-0 tracking-[-0.015em] max-md:text-[22px]">
            {isMyProfile ? (editing ? P.editYourProfile : P.yourProfile) : P.othersProfile(p.name)}
          </h1>
          {!isMyProfile && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!window.confirm(P.blockConfirm(p.name))) return;
                  try {
                    await blockUser(user.uid, p.id);
                    window.location.href = '/app';
                  } catch {
                    setToast(P.blockFail);
                    setTimeout(() => setToast(null), 2200);
                  }
                }}
                className="icon-btn"
                title={P.blockAction}
                aria-label={P.blockAction}
              >
                <Icon.Ban size={14} />
              </button>
              <button
                onClick={() => setReport({ targetId: p.id, targetName: p.name })}
                className="icon-btn"
                title={P.reportAction}
                aria-label={P.reportAction}
              >
                <Icon.Flag size={14} />
              </button>
            </div>
          )}
          {isMyProfile && !editing && (
            <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">{P.editCta}</button>
          )}
        </div>
        <div className="p-10 max-w-[1000px] mx-auto max-md:p-5">
          {toast && <div className="mb-6 px-5 py-3 rounded-2xl text-white font-semibold flex items-center gap-2" style={{ background: 'var(--coral)' }}><Icon.Heart size={16} filled />{toast}</div>}

          {isMyProfile && editing ? (
            <EditProfile
              profile={p}
              d={d}
              onSaved={(updated) => {
                setTarget(updated);
                setMe(updated);
                setEditing(false);
                setPhotoIdx(0);
                setToast(P.saved);
                setTimeout(() => setToast(null), 2200);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="grid md:grid-cols-[1.1fr_1fr] gap-8">
              <div>
                <div className="rounded-[20px] overflow-hidden h-[480px] relative max-md:h-[400px]" style={{ background: mainPhoto ? `url(${mainPhoto}) center/cover` : 'linear-gradient(135deg, var(--blush), var(--ivory-2))' }}>
                  {!mainPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[180px] text-white/40">{p.name?.[0] || '?'}</div>
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="flex gap-2 mt-2.5 flex-wrap">
                    {photos.map((url, i) => (
                      <button
                        key={url}
                        onClick={() => setPhotoIdx(i)}
                        className={`w-16 h-16 rounded-xl bg-cover bg-center border-2 ${i === photoIdx ? 'border-coral' : 'border-transparent opacity-75 hover:opacity-100'}`}
                        style={{ backgroundImage: `url(${url})` }}
                        aria-label={`Photo ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex gap-2 mb-3">
                  {p.verified && <span className="chip chip-verified"><Icon.Shield size={11} />{P.verified}</span>}
                  {p.online && <span className="chip" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)', borderColor: 'rgba(76,175,80,0.25)' }}>{P.onlineNow}</span>}
                </div>
                <h2 className="font-display font-bold text-5xl tracking-[-0.02em] m-0 mb-2">
                  {p.name}{p.age ? <span className="text-muted font-normal">, {p.age}</span> : null}
                </h2>
                {(p.city || p.country) && (
                  <div className="text-[15px] text-ink-soft flex gap-1.5 items-center mb-5">
                    <Icon.Pin size={13} /> {[p.city, p.country ? (d.options.countries[p.country] || p.country) : ''].filter(Boolean).join(', ')}
                  </div>
                )}
                {p.bio && <p className="text-[15px] leading-[1.6] text-ink-soft mb-6">{p.bio}</p>}
                {(p.interests?.length || p.lookingFor) ? (
                  <div className="py-5 border-y border-line flex flex-col gap-4">
                    {p.lookingFor && (
                      <div>
                        <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-1 font-semibold">{P.lookingFor}</div>
                        <div className="text-[15px]">{d.options.lookingFor[p.lookingFor] || p.lookingFor}</div>
                      </div>
                    )}
                    {p.interests?.length ? (
                      <div>
                        <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-2 font-semibold">{P.interests}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {p.interests.map((t) => <span key={t} className="chip">{d.options.interests[t] || t}</span>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {setDetails.length > 0 && (
                  <div className="py-5 border-b border-line">
                    <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-3 font-semibold">{P.details}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {setDetails.map(([label, value]) => (
                        <div key={label}>
                          <div className="text-[11px] text-muted">{label}</div>
                          <div className="text-[14px] font-medium">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!isMyProfile && (
                  <div className="flex gap-2.5 mt-6">
                    <a href="/app" className="btn btn-ghost" aria-label={P.backToDiscover}><Icon.X size={14} /></a>
                    <button onClick={like} className="btn btn-primary flex-1 justify-center">
                      <Icon.Heart size={14} filled /> {P.like}
                    </button>
                  </div>
                )}
                {isMyProfile && (
                  <div className="mt-6">
                    <div className="flex justify-between items-baseline text-[13px] mb-1.5">
                      <span className="font-semibold">{P.completion}</span>
                      <span className="text-muted">{completionPercent(p)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-line overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${completionPercent(p)}%`, background: 'var(--coral)' }} />
                    </div>
                    <div className="text-xs text-muted mt-2">{completionPercent(p) < 100 ? P.completionHint : P.howOthersSee}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      {report && <ReportDialog reporterId={user.uid} target={report} d={d} onClose={() => setReport(null)} />}
    </div>
  );
}

function EditProfile({ profile, d, onSaved, onCancel }: { profile: Profile; d: Dict; onSaved: (p: Profile) => void; onCancel: () => void }) {
  const E = d.app.profile.edit;
  const [name, setName] = React.useState(profile.name || '');
  const [age, setAge] = React.useState(profile.age ? String(profile.age) : '');
  const [city, setCity] = React.useState(profile.city || '');
  const [country, setCountry] = React.useState(profile.country || 'Philippines');
  const [bio, setBio] = React.useState(profile.bio || '');
  const [lookingFor, setLookingFor] = React.useState(profile.lookingFor || 'Serious relationship');
  const [interests, setInterests] = React.useState<string[]>(profile.interests || []);
  const [occupation, setOccupation] = React.useState(profile.occupation || '');
  const [education, setEducation] = React.useState(profile.education || '');
  const [height, setHeight] = React.useState(profile.height ? String(profile.height) : '');
  const [religion, setReligion] = React.useState(profile.religion || '');
  const [drinking, setDrinking] = React.useState(profile.drinking || '');
  const [smoking, setSmoking] = React.useState(profile.smoking || '');
  const [images, setImages] = React.useState<string[]>(profile.images?.filter(Boolean) || []);
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const toggle = (t: string) =>
    setInterests((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || images.length >= MAX_PHOTOS) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await uploadProfileImage(profile.id, file);
      setImages((imgs) => [...imgs, url]);
    } catch (ex: any) {
      if (ex?.message === 'not-an-image') setErr(E.errNotImage);
      else if (ex?.message === 'too-large') setErr(E.errTooLarge);
      else if (ex?.code === 'storage/unauthorized' || ex?.code === 'storage/unknown') setErr(E.errStorageRules);
      else setErr(E.errUpload);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (i: number) => setImages((imgs) => imgs.filter((_, idx) => idx !== i));
  const makeMain = (i: number) => setImages((imgs) => [imgs[i], ...imgs.filter((_, idx) => idx !== i)]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const data: Partial<Profile> = {
        name: name.trim(),
        age: Number(age) || undefined,
        city: city.trim(),
        country,
        bio: bio.trim(),
        lookingFor,
        interests,
        images,
        occupation: occupation.trim(),
        education,
        height: Number(height) || undefined,
        religion,
        drinking,
        smoking,
      };
      await saveProfile(profile.id, data);
      onSaved({ ...profile, ...data, images });
    } catch {
      setErr(E.errSave);
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!window.confirm(E.deleteConfirm)) return;
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
        setErr(E.errRecentLogin);
        await signOutUser().catch(() => {});
      } else {
        setErr(E.errDelete(SUPPORT_EMAIL));
      }
      setDeleting(false);
    }
  };

  const selectField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    options: string[],
    labels: Record<string, string>
  ) => (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">{E.notSet}</option>
        {options.map((o) => <option key={o} value={o}>{labels[o] || o}</option>)}
      </select>
    </div>
  );

  return (
    <form onSubmit={save} className="grid md:grid-cols-[1.1fr_1fr] gap-8 items-start">
      <div>
        <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-2 font-semibold">{E.photos}</div>
        <div className="grid grid-cols-3 gap-2.5">
          {images.map((url, i) => (
            <div key={url} className="relative aspect-[4/5] rounded-xl bg-cover bg-center overflow-hidden group" style={{ backgroundImage: `url(${url})` }}>
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold uppercase tracking-wide text-white px-1.5 py-0.5 rounded" style={{ background: 'var(--coral)' }}>1</span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.45))' }}>
                {i !== 0 && (
                  <button type="button" onClick={() => makeMain(i)} title={E.makeMain} aria-label={E.makeMain} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-ink hover:bg-white">
                    <Icon.Heart size={12} />
                  </button>
                )}
                <button type="button" onClick={() => removePhoto(i)} title={E.removePhoto} aria-label={E.removePhoto} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-ink hover:bg-white">
                  <Icon.X size={12} />
                </button>
              </div>
            </div>
          ))}
          {images.length < MAX_PHOTOS && (
            <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-1.5 text-muted text-xs cursor-pointer hover:border-coral hover:text-coral">
              <span className="text-2xl leading-none">+</span>
              {uploading ? E.uploading : E.addPhoto}
              <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="hidden" aria-label={E.uploadLabel} />
            </label>
          )}
        </div>
        <div className="text-xs text-muted mt-2">{E.photoHint}</div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>{E.firstName}</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>{E.age}</label>
            <input required type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>{E.city}</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={E.cityPh} />
          </div>
          <div className="field">
            <label>{E.country}</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{d.options.countries[c] || c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{E.lookingFor}</label>
          <select value={lookingFor} onChange={(e) => setLookingFor(e.target.value)}>
            {LOOKING_FOR_OPTIONS.map((o) => <option key={o} value={o}>{d.options.lookingFor[o] || o}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>{E.occupation}</label>
            <input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder={E.occupationPh} />
          </div>
          <div className="field">
            <label>{E.height}</label>
            <input type="number" min={120} max={230} value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {selectField(E.education, education, setEducation, EDUCATION_OPTIONS, d.options.education)}
          {selectField(E.religion, religion, setReligion, RELIGION_OPTIONS, d.options.religion)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {selectField(E.drinking, drinking, setDrinking, DRINKING_OPTIONS, d.options.drinking)}
          {selectField(E.smoking, smoking, setSmoking, SMOKING_OPTIONS, d.options.smoking)}
        </div>
        <div className="field">
          <label>{E.aboutYou}</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={E.bioPh} />
        </div>
        <div className="field">
          <label>{E.interests}</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {INTEREST_OPTIONS.map((t) => (
              <span
                key={t}
                onClick={() => toggle(t)}
                className="chip cursor-pointer"
                style={interests.includes(t) ? { background: 'var(--coral)', color: '#fff', borderColor: 'var(--coral)' } : {}}
              >
                {d.options.interests[t] || t}
              </span>
            ))}
          </div>
        </div>

        {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}

        <div className="flex gap-2.5 mt-1">
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={busy || deleting}>{E.cancel}</button>
          <button type="submit" disabled={busy || uploading || deleting} className="btn btn-primary flex-1 justify-center disabled:opacity-60">
            {busy ? E.saving : E.save}
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-line">
          <div className="text-[10px] tracking-[0.1em] uppercase text-muted mb-2 font-semibold">{E.dangerZone}</div>
          <button type="button" onClick={removeAccount} disabled={deleting || busy} className="text-sm text-coral font-semibold hover:underline underline-offset-2 disabled:opacity-60">
            {deleting ? E.deleting : E.deleteAccount}
          </button>
          <div className="text-xs text-muted mt-1.5">{E.deleteNote1} <a href="/privacy" className="underline underline-offset-2">{E.privacyPolicy}</a> {E.deleteNote2}</div>
        </div>
      </div>
    </form>
  );
}
