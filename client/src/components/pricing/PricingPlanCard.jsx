import {
  FEATURE_ROWS,
  displayPrice,
  featureDisplay,
  planHasFeature
} from '../../constants/plans';
import { useLocale, useT } from '../../i18n/LanguageContext';

/**
 * Single plan column on the pricing page (Free / Professional / etc.).
 */
export default function PricingPlanCard({
  plan,
  interval = 'month',
  trialDays = 0,
  isCurrent = false,
  isBusy = false,
  canManageStores = false,
  buttonLabel,
  onChoose
}) {
  const t = useT();
  const locale = useLocale();
  const price = displayPrice(plan, interval, t);
  const isPopular = plan.popular;

  return (
    <article
      data-testid={`pricing-card-${plan.id}`}
      className={`pricing-card${isPopular ? ' pricing-card-popular' : ''}${isCurrent ? ' pricing-card-current' : ''}`}
    >
      {isPopular && <div className="pricing-popular-tag">{t('Most Popular')}</div>}
      <h2>{t(plan.name)}</h2>
      <p className="pricing-card-tagline">{t(plan.tagline)}</p>
      <div className="pricing-card-price">
        {price.amount === 0 ? (
          <span className="pricing-amount">{t('Free')}</span>
        ) : (
          <>
            <span className="pricing-currency">$</span>
            <span className="pricing-amount">{price.amount.toFixed(price.amount % 1 ? 1 : 0)}</span>
            <span className="pricing-suffix">{price.suffix}</span>
          </>
        )}
      </div>
      {price.billed && <p className="pricing-billed">{price.billed}</p>}
      {plan.id !== 'free' && trialDays > 0 && (
        <p className="pricing-trial-note">
          <i className="fas fa-gift" aria-hidden />{' '}
          {t('{days}-day free trial for new subscribers', { days: trialDays })}
        </p>
      )}

      <ul className="pricing-feature-list">
        {FEATURE_ROWS.map((row) => {
          const val = featureDisplay(plan, row, t, locale);
          const included = row.type === 'boolean' ? planHasFeature(plan, row.key) : true;
          const highlightLimit =
            row.key === 'inventoryItems' ||
            row.key === 'warehouses' ||
            row.key === 'pos' ||
            row.key === 'purchaseAiFill';
          return (
            <li key={row.key} className={included ? '' : 'muted'} data-feature={row.key}>
              <i className={`fas ${included ? 'fa-check' : 'fa-minus'}`} />
              <span>
                {highlightLimit ? (
                  <>
                    <strong>{t(row.label)}:</strong> {val}
                  </>
                ) : (
                  <>
                    <strong>{t(row.label)}</strong>
                    {typeof val === 'string' && val !== t('Included') && val !== '—' && (
                      <em>{val}</em>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={`btn ${isPopular && !isCurrent ? 'btn-primary' : 'btn-secondary'} pricing-choose-btn`}
        disabled={isCurrent || isBusy || !canManageStores}
        onClick={() => onChoose?.(plan.id)}
      >
        {isBusy ? (
          <>
            <i className="fas fa-spinner fa-spin" /> {t('Processing…')}
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </article>
  );
}
