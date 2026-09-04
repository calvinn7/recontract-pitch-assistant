import { Customer } from '@/types';

interface Props { customer: Customer; }

export function CustomerCard({ customer }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Plan</div>
        <div className="font-semibold text-gray-900">{customer.current_plan}</div>
        <div className="text-gray-500">{customer.speed_mbps} Mbps · RM {customer.monthly_bill_rm}/mo</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Usage</div>
        <div className="font-semibold text-gray-900">{customer.avg_monthly_usage_gb} GB/mo</div>
        <div className="text-gray-500">{customer.usage_profile} · {customer.connected_devices} devices</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Support</div>
        <div className="font-semibold text-gray-900">{customer.complaints_last_12m} complaint{customer.complaints_last_12m !== 1 ? 's' : ''} (12mo)</div>
        <div className="text-gray-500">{customer.last_complaint_type || 'None'}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Payment</div>
        <div className="font-semibold text-gray-900">{customer.payment_history}</div>
        <div className="text-gray-500">
          {customer.auto_renew_declined
            ? <span className="text-orange-600 font-medium">⚠ Auto-renew declined</span>
            : 'Auto-renew OK'}
        </div>
      </div>
      {customer.addons.length > 0 && (
        <div className="col-span-2 md:col-span-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Add-ons</div>
          <div className="flex gap-2 flex-wrap">
            {customer.addons.map(a => (
              <span key={a} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
