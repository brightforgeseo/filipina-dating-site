import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firebase } from './firebase';

// Canonical reason values stored in Firestore; labels are translated in the UI.
export const REPORT_REASONS = ['fake', 'money', 'abusive', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export async function submitReport(input: {
  reporterId: string;
  targetId: string;
  reason: ReportReason;
  details?: string;
  matchId?: string;
  messageId?: string;
  messageText?: string;
}) {
  const { db } = firebase();
  const payload: Record<string, any> = {
    reporterId: input.reporterId,
    targetId: input.targetId,
    reason: input.reason,
    status: 'open',
    createdAt: serverTimestamp(),
  };
  if (input.details?.trim()) payload.details = input.details.trim();
  if (input.matchId) payload.matchId = input.matchId;
  if (input.messageId) payload.messageId = input.messageId;
  if (input.messageText) payload.messageText = input.messageText.slice(0, 500);
  await addDoc(collection(db, 'reports'), payload);
}
