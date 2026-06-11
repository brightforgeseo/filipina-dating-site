import React from 'react';
import { submitReport, REPORT_REASONS, type ReportReason } from '../../lib/reports';
import type { Dict } from '../../i18n';

export type ReportTarget = {
  targetId: string;
  targetName: string;
  defaultReason?: ReportReason;
  matchId?: string;
  messageId?: string;
  messageText?: string;
};

export default function ReportDialog({ reporterId, target, d, onClose }: {
  reporterId: string;
  target: ReportTarget;
  d: Dict;
  onClose: () => void;
}) {
  const R = d.app.report;
  const [reason, setReason] = React.useState<ReportReason>(target.defaultReason ?? 'fake');
  const [details, setDetails] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const labels: Record<ReportReason, string> = {
    fake: R.reasonFake,
    money: R.reasonMoney,
    abusive: R.reasonAbusive,
    other: R.reasonOther,
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await submitReport({
        reporterId,
        targetId: target.targetId,
        reason,
        details,
        matchId: target.matchId,
        messageId: target.messageId,
        messageText: target.messageText,
      });
      setDone(true);
    } catch {
      setErr(R.fail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(31,20,25,0.7)' }} onClick={onClose}>
      <div
        className="bg-white rounded-[24px] p-8 max-w-[420px] w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={R.title(target.targetName)}
      >
        {done ? (
          <>
            <h2 className="font-display font-bold text-[22px] m-0 mb-3">{R.title(target.targetName)}</h2>
            <div className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: 'rgba(76,175,80,0.1)', color: 'var(--ok)' }}>
              {R.sent}
            </div>
            <button onClick={onClose} className="btn btn-primary w-full justify-center">{R.close}</button>
          </>
        ) : (
          <form onSubmit={send}>
            <h2 className="font-display font-bold text-[22px] m-0 mb-4">{R.title(target.targetName)}</h2>
            <div className="text-[11px] tracking-[0.08em] uppercase text-muted font-semibold mb-2">{R.reasonLabel}</div>
            <div className="flex flex-col gap-1.5 mb-4">
              {REPORT_REASONS.map((r) => (
                <label key={r} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer text-sm ${reason === r ? 'border-coral font-medium' : 'border-line hover:bg-ivory'}`} style={reason === r ? { background: 'rgba(255,20,147,0.05)' } : {}}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--coral)]" />
                  {labels[r]}
                </label>
              ))}
            </div>
            <div className="field mb-4">
              <label>{R.detailsLabel}</label>
              <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            {err && <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: 'rgba(255,20,147,0.08)', color: 'var(--coral)' }}>{err}</div>}
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} className="btn btn-ghost" disabled={busy}>{R.cancel}</button>
              <button type="submit" className="btn btn-primary flex-1 justify-center disabled:opacity-60" disabled={busy}>
                {busy ? R.submitting : R.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
