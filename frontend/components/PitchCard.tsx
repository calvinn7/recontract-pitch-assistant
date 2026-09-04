'use client';

import { PitchDraft, PitchStatus } from '@/types';

interface Props {
  pitch: PitchDraft;
  isLatest?: boolean;
  onStatusUpdate?: (draftId: string, status: 'used' | 'dismissed') => void;
}

const PLAN_COLORS: Record<string, string> = {
  'Fibre 100': 'bg-gray-100 text-gray-700',
  'Fibre 500': 'bg-blue-100 text-blue-700',
  'Fibre 1Gbps': 'bg-purple-100 text-purple-700',
  'Fibre 2Gbps': 'bg-indigo-100 text-indigo-700',
  'stay on current plan': 'bg-green-100 text-green-700',
};

const STATUS_BADGE: Record<PitchStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-500' },
  used: { label: '✓ Used on call', className: 'bg-green-100 text-green-700' },
  dismissed: { label: '✗ Dismissed', className: 'bg-orange-100 text-orange-700' },
};

export function PitchCard({ pitch, isLatest = false, onStatusUpdate }: Props) {
  const planColor = PLAN_COLORS[pitch.recommended_plan] || 'bg-gray-100 text-gray-700';
  const statusBadge = STATUS_BADGE[pitch.status ?? 'pending'];

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${
      isLatest ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-gray-400 mb-1">Recommended Plan</div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${planColor}`}>
            {pitch.recommended_plan}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLatest && (
            <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">Latest</span>
          )}
          {/* Status badge */}
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Offer hook */}
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Offer / Hook</div>
        <p className="text-gray-800 font-medium italic">&ldquo;{pitch.offer_hook}&rdquo;</p>
      </div>

      {/* Talking points */}
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Talking Points</div>
        <ol className="space-y-2">
          {pitch.talking_points.map((point, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="text-gray-700">{point}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Rationale */}
      <div className="pt-3 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Why this recommendation</div>
        <p className="text-gray-600 text-sm">{pitch.rationale}</p>
      </div>

      {/* Footer: metadata + feedback buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-gray-400 flex gap-3">
          <span>Model: {pitch.model_used}</span>
          <span>·</span>
          <span>{new Date(pitch.created_at).toLocaleString()}</span>
        </div>

        {/* Feedback buttons — only show if a callback is provided and status is still pending */}
        {onStatusUpdate && pitch.status === 'pending' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Did you use this?</span>
            <button
              onClick={() => onStatusUpdate(pitch.draft_id, 'used')}
              title="Mark as used on call"
              className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors text-sm"
            >
              👍 Used
            </button>
            <button
              onClick={() => onStatusUpdate(pitch.draft_id, 'dismissed')}
              title="Mark as dismissed"
              className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 transition-colors text-sm"
            >
              👎 Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
