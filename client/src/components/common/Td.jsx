/** Table cell with mobile card label (shown via CSS ::before on small screens). */
import { useT } from '../../i18n/LanguageContext';

export default function Td({ label, children, className = '', hideLabel = false, ...props }) {
  const t = useT();
  const translatedLabel = label ? t(label) : undefined;

  return (
    <td
      data-label={translatedLabel || undefined}
      className={`${className}${hideLabel ? ' at-card-hide-label' : ''}`.trim()}
      {...props}
    >
      {children}
    </td>
  );
}
