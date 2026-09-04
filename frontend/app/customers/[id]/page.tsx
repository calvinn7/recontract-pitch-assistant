'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCustomer, generatePitch, fetchDraftHistory, updateDraftStatus } from '@/lib/api';
import { Customer, PitchDraft } from '@/types';
import { CustomerCard } from '@/components/CustomerCard';
import { PitchCard } from '@/components/PitchCard';
import { PitchHistory } from '@/components/PitchHistory';

export default function CustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<PitchDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cust, hist] = await Promise.all([
        fetchCustomer(customerId),
        fetchDraftHistory(customerId),
      ]);
      setCustomer(cust);
      setHistory(hist);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const newPitch = await generatePitch(customerId);
      setHistory(prev => [newPitch, ...prev]);
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate pitch');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (draftId: string, status: 'used' | 'dismissed') => {
    try {
      const updated = await updateDraftStatus(draftId, status);
      setHistory(prev =>
        prev.map(d => d.draft_id === draftId ? updated : d)
      );
    } catch {
      // Non-critical — pitch is still usable even if status update fails
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error || 'Customer not found'}
        <button onClick={() => router.push('/')} className="ml-2 underline">Back to list</button>
      </div>
    );
  }

  const latestPitch = history[0] || null;

  return (
    <div className="space-y-6">
      {/* Back button + customer header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{customer.name}</h2>
          <p className="text-sm text-gray-500">{customer.area} · {customer.customer_id} · {customer.tenure_months} months tenure</p>
        </div>
        <div className="ml-auto">
          {customer.days_to_contract_end < 0
            ? <span className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700">Contract expired {Math.abs(customer.days_to_contract_end)}d ago</span>
            : customer.days_to_contract_end <= 14
            ? <span className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700">{customer.days_to_contract_end}d remaining</span>
            : customer.days_to_contract_end <= 30
            ? <span className="px-3 py-1 rounded-full text-sm bg-amber-100 text-amber-700">{customer.days_to_contract_end}d remaining</span>
            : <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">{customer.days_to_contract_end}d remaining</span>
          }
        </div>
      </div>

      {/* Customer data */}
      <CustomerCard customer={customer} />

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating pitch...
            </>
          ) : latestPitch ? (
            '↻ Regenerate Pitch'
          ) : (
            '✦ Generate Pitch'
          )}
        </button>
        {latestPitch && !generating && (
          <span className="text-sm text-gray-400">{history.length} pitch{history.length !== 1 ? 'es' : ''} generated</span>
        )}
      </div>

      {/* Generation error */}
      {genError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠ {genError}
        </div>
      )}

      {/* Latest pitch */}
      {latestPitch && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Current Pitch</h3>
          <PitchCard pitch={latestPitch} isLatest onStatusUpdate={handleStatusUpdate} />
        </div>
      )}

      {/* Pitch history */}
      <PitchHistory history={history} onStatusUpdate={handleStatusUpdate} />
    </div>
  );
}
