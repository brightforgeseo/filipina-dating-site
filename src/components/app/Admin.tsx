import React from 'react';
import { useAuth } from '../../lib/useAuth';
import {
  banUser,
  deleteMessage,
  deletePost,
  isAdmin,
  resolveReport,
  subscribeBans,
  subscribeOpenReports,
  unbanUser,
  type Ban,
  type Report,
} from '../../lib/moderation';

export default function Admin() {
  const { user, loading } = useAuth();
  const [admin, setAdmin] = React.useState<boolean | null>(null);
  const [reports, setReports] = React.useState<Report[]>([]);
  const [bans, setBans] = React.useState<Ban[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    isAdmin(user.uid).then(setAdmin);
  }, [user, loading]);

  React.useEffect(() => {
    if (admin !== true) return;
    const u1 = subscribeOpenReports(setReports);
    const u2 = subscribeBans(setBans);
    return () => {
      u1();
      u2();
    };
  }, [admin]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      window.alert('Action failed — check your admin access and try again.');
    } finally {
      setBusy(null);
    }
  };

  const dismiss = (r: Report) => run(r.id, () => resolveReport(r.id, 'dismissed'));
  const ban = (r: Report) =>
    run(r.id, async () => {
      await banUser(r.targetId, `report:${r.reason}`);
      await resolveReport(r.id, 'banned');
    });
  const removeContent = (r: Report) =>
    run(r.id, async () => {
      if (r.kind === 'post' && r.postId) await deletePost(r.postId);
      else if ((r.kind === 'message' || r.messageId) && r.matchId && (r.messageId || r.postId)) {
        await deleteMessage(r.matchId, (r.messageId ?? r.postId) as string);
      }
      await resolveReport(r.id, 'content-removed');
    });

  if (loading || admin === null) {
    return <div className="min-h-screen flex items-center justify-center bg-ivory text-muted">Loading…</div>;
  }
  if (admin === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ivory text-center px-6">
        <div className="text-4xl mb-2">🔒</div>
        <div className="font-display font-bold text-xl">Admins only</div>
        <div className="text-sm text-ink-soft mt-1">Your account isn’t on the moderator allowlist.</div>
        <a href="/app" className="btn btn-primary btn-sm mt-4">Back to app</a>
      </div>
    );
  }

  const canRemove = (r: Report) => (r.kind === 'post' && r.postId) || ((r.kind === 'message' || !!r.messageId) && r.matchId);

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-3xl tracking-[-0.02em]">Moderation</h1>
          <a href="/app" className="text-sm text-muted hover:text-coral">← App</a>
        </div>

        {/* Reports queue */}
        <h2 className="font-semibold text-lg mt-6 mb-2">Open reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <div className="card p-6 text-center text-muted text-sm">Queue is clear. 🎉</div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="chip" style={{ background: r.autoFlag ? 'rgba(255,180,0,0.15)' : 'rgba(255,20,147,0.1)', color: r.autoFlag ? '#8a6100' : 'var(--coral)' }}>
                    {r.autoFlag ? 'AUTO' : 'REPORT'} · {r.reason}
                  </span>
                  {r.kind && <span className="chip">{r.kind}</span>}
                </div>
                <div className="text-sm mt-2">
                  Target: <a href={`/app/profile?id=${r.targetId}`} className="text-coral underline underline-offset-2">{r.targetId}</a>
                  {r.reporterId && r.reporterId !== 'system' && <span className="text-muted"> · by {r.reporterId}</span>}
                </div>
                {(r.snippet || r.messageText || r.details) && (
                  <div className="text-[13px] text-ink-soft mt-1 bg-ivory rounded-lg px-3 py-2 break-words">
                    {r.snippet || r.messageText || r.details}
                  </div>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => dismiss(r)} disabled={busy === r.id} className="btn btn-ghost btn-sm">Dismiss</button>
                  {canRemove(r) && (
                    <button onClick={() => removeContent(r)} disabled={busy === r.id} className="btn btn-ghost btn-sm">Remove content</button>
                  )}
                  <button onClick={() => ban(r)} disabled={busy === r.id} className="btn btn-sm" style={{ background: 'var(--coral)', color: '#fff' }}>
                    Ban user
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Banned users */}
        <h2 className="font-semibold text-lg mt-8 mb-2">Banned ({bans.length})</h2>
        {bans.length === 0 ? (
          <div className="card p-6 text-center text-muted text-sm">No banned members.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {bans.map((b) => (
              <div key={b.id} className="card p-3 flex items-center justify-between gap-3">
                <div className="text-sm min-w-0">
                  <a href={`/app/profile?id=${b.id}`} className="text-coral underline underline-offset-2 break-all">{b.id}</a>
                  {b.reason && <span className="text-muted"> · {b.reason}</span>}
                </div>
                <button onClick={() => run(`unban-${b.id}`, () => unbanUser(b.id))} disabled={busy === `unban-${b.id}`} className="btn btn-ghost btn-sm flex-shrink-0">
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
