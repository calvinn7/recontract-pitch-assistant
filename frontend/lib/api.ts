import { Customer, PitchDraft, PitchStatus } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchCustomers(sort?: 'days_to_contract_end'): Promise<Customer[]> {
  const url = sort
    ? `${API_URL}/api/v1/customers?sort=${sort}&order=asc`
    : `${API_URL}/api/v1/customers`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch customers: ${res.statusText}`);
  return res.json();
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const res = await fetch(`${API_URL}/api/v1/customers/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Customer not found: ${res.statusText}`);
  return res.json();
}

export async function generatePitch(customerId: string): Promise<PitchDraft> {
  const res = await fetch(`${API_URL}/api/v1/retention/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to generate pitch: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDraftHistory(customerId: string): Promise<PitchDraft[]> {
  const res = await fetch(`${API_URL}/api/v1/retention/drafts/${customerId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);
  return res.json();
}

export async function updateDraftStatus(
  draftId: string,
  status: PitchStatus
): Promise<PitchDraft> {
  const res = await fetch(`${API_URL}/api/v1/retention/drafts/${draftId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update status: ${res.statusText}`);
  }
  return res.json();
}
