'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCustomers } from '@/lib/api';
import { Customer } from '@/types';

function urgencyBadge(days: number) {
  if (days < 0) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Expired</span>;
  }
  if (days <= 14) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{days}d</span>;
  }
  if (days <= 30) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{days}d</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{days}d</span>;
}

export default function HomePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortByDate, setSortByDate] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(sortByDate ? 'days_to_contract_end' : undefined);
      setCustomers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [sortByDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.area.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer List</h2>
          <p className="text-sm text-gray-500 mt-0.5">Select a customer to generate a recontract pitch</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name, area, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
          <button
            onClick={() => setSortByDate(s => !s)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              sortByDate
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Sort by contract end
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-gray-500">Loading customers...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error} — <button onClick={load} className="underline">retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bill</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contract End</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(customer => (
                <tr
                  key={customer.customer_id}
                  onClick={() => router.push(`/customers/${customer.customer_id}`)}
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-xs text-gray-400">{customer.customer_id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{customer.area}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{customer.current_plan}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">RM {customer.monthly_bill_rm}/mo</td>
                  <td className="px-4 py-3">{urgencyBadge(customer.days_to_contract_end)}</td>
                  <td className="px-4 py-3">
                    {customer.auto_renew_declined && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Churn risk</span>
                    )}
                    {customer.complaints_last_12m >= 3 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">{customer.complaints_last_12m} complaints</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400">No customers match your search</div>
          )}
        </div>
      )}
    </div>
  );
}
