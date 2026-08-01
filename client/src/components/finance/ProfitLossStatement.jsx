import { groupDigits } from '../../utils/numberFormat';

export default function ProfitLossStatement({ rows = [] }) {
  if (!rows.length) {
    return (
      <div className="fin-card pl-statement-card">
        <div className="fin-empty">No financial activity in this period.</div>
      </div>
    );
  }

  return (
    <div className="fin-card pl-statement-card">
      <table className="pl-statement">
        <thead>
          <tr>
            <th>Item</th>
            <th className="pl-statement-amt-col">Amount (XAF)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.type === 'section') {
              return (
                <tr key={`${row.label}-${idx}`} className={`pl-stmt-section pl-stmt-${row.tone}${row.highlight ? ' highlight' : ''}`}>
                  <td>
                    <div className="pl-stmt-section-label">
                      {row.highlight && <i className="fas fa-star" />}
                      {row.label}
                    </div>
                    {row.sub && <div className="pl-stmt-section-sub">{row.sub}</div>}
                  </td>
                  <td className={`pl-statement-amt-col${row.negative ? ' neg' : ''}${row.amountXaf >= 0 && row.amountXaf != null ? ' pos' : ''}`}>
                    {row.amountFmt || (row.amountXaf != null ? groupDigits(row.amountXaf) : '')}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={`${row.label}-${idx}`} className={`pl-stmt-line${row.bold ? ' bold' : ''}${row.accent ? ` accent-${row.accent}` : ''}`}>
                <td className={row.negative ? 'indent' : ''}>{row.label}</td>
                <td className={`pl-statement-amt-col${row.negative ? ' neg' : ' pos'}`}>
                  {row.amountFmt}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
