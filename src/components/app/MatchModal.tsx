import React from 'react';
import { Icon } from '../icons';
import type { Dict } from '../../i18n';

export type MatchInfo = { name: string; photo?: string; myPhoto?: string };

export default function MatchModal({ match, d, onClose }: { match: MatchInfo; d: Dict; onClose: () => void }) {
  const M = d.app.match;
  const avatar = (url: string | undefined, initial: string) => (
    <div
      className="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center font-display font-bold text-3xl text-ink bg-cover bg-center"
      style={url ? { backgroundImage: `url(${url})` } : { background: 'var(--blush)' }}
    >
      {!url && initial}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(31,20,25,0.7)' }} onClick={onClose}>
      <div
        className="bg-white rounded-[28px] p-10 max-w-[400px] w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={M.title}
      >
        <div className="flex justify-center -space-x-5 mb-6">
          {avatar(match.myPhoto, '♥')}
          <div className="w-12 h-12 rounded-full self-center z-10 flex items-center justify-center text-white shadow-lg" style={{ background: 'var(--coral)' }}>
            <Icon.Heart size={20} filled />
          </div>
          {avatar(match.photo, match.name[0] || '?')}
        </div>
        <h2 className="font-display font-bold text-[32px] m-0 mb-2 text-coral">{M.title}</h2>
        <p className="text-[15px] text-ink-soft mb-7">{M.body(match.name)}</p>
        <div className="flex flex-col gap-2.5">
          <a href="/app/messages" className="btn btn-primary justify-center">
            <Icon.Send size={15} /> {M.send}
          </a>
          <button onClick={onClose} className="btn btn-ghost justify-center">{M.keep}</button>
        </div>
      </div>
    </div>
  );
}
