import { STATIC_PLANS, formatBillingDate } from '../../constants/plans';

function formatDate(value) {
  if (!value) return 'the end of your billing period';
  return formatBillingDate(value);
}

export default function DowngradeConfirmModal({
  open,
  currentPlan,
  targetPlan,
  onClose,
  onConfirm,
  loading
}) {
  if (!open || !targetPlan) return null;

  const currentName = currentPlan?.name || 'your current plan';
  const targetName = targetPlan.name || STATIC_PLANS[targetPlan.id]?.name || 'the selected plan';
  const periodEnd = formatDate(currentPlan?.currentPeriodEnd);

  return (
    <div className="inv-modal-overlay open elevated" onClick={onClose} role="presentation">
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="downgrade-title">
        <div className="inv-modal-header">
          <div>
            <div className="inv-modal-title" id="downgrade-title">
              Downgrade to {targetName}?
            </div>
            <div className="inv-modal-sub pricing-downgrade-copy">
              You will keep full <strong>{currentName}</strong> access until <strong>{periodEnd}</strong>.
              After that, your subscription changes to <strong>{targetName}</strong> and billing adjusts
              automatically.
            </div>
          </div>
          <button type="button" className="inv-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pricing-downgrade-note">
          <i className="fas fa-info-circle" aria-hidden />
          <span>
            <strong>Your existing data is kept</strong> (inventory, warehouses, stores, users).
            If you are over the new plan&apos;s limits, you can still use what you have — you just
            cannot add more until you upgrade or remove some. Nothing is archived or deleted
            automatically.
          </span>
        </div>
        <div className="pricing-downgrade-note">
          <i className="fas fa-credit-card" aria-hidden />
          You can also manage cancellation in the Stripe billing portal under Manage billing.
        </div>
        <div className="inv-modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Keep {currentName}
          </button>
          <button type="button" className="btn-primary pricing-downgrade-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" aria-hidden /> Scheduling…
              </>
            ) : (
              <>Confirm downgrade</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
