export interface Customer {
  customer_id: string;
  name: string;
  area: string;
  current_plan: string;
  speed_mbps: number;
  monthly_bill_rm: number;
  tenure_months: number;
  days_to_contract_end: number;
  avg_monthly_usage_gb: number;
  usage_profile: string;
  peak_hours: string;
  connected_devices: number;
  addons: string[];
  complaints_last_12m: number;
  last_complaint_type: string | null;
  payment_history: string;
  auto_renew_declined: boolean;
}

export type PitchStatus = 'pending' | 'used' | 'dismissed';

export interface PitchDraft {
  draft_id: string;
  customer_id: string;
  recommended_plan: string;
  offer_hook: string;
  talking_points: string[];
  rationale: string;
  model_used: string;
  status: PitchStatus;
  created_at: string;
}
