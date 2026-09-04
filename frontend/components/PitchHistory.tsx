'use client';

import { useState } from 'react';
import { PitchDraft } from '@/types';
import { PitchCard } from './PitchCard';

interface Props {
  history: PitchDraft[];
  onStatusUpdate?: (draftId: string, status: 'used' | 'dismissed') => void;
}

export function PitchHistory({ history, onStatusUpdate }: Props) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  // history[0] is newest (already sorted by backend); show only older ones here
  const previous = history.slice(1);
  if (previous.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {open ? 'Hide' : 'Show'} previous pitches ({previous.length})
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {previous.map(draft => (
            <PitchCard
              key={draft.draft_id}
              pitch={draft}
              isLatest={false}
              onStatusUpdate={onStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
