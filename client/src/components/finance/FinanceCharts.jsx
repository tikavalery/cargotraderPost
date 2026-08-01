import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { DONUT_COLORS } from '../../constants/financeConstants';
import { groupDigits } from '../../utils/numberFormat';

export function FinanceDonutChart({ data, centerLabel }) {
  if (!data?.length) return <div className="fin-empty">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((entry, i) => <Cell key={entry.name} fill={entry.color || DONUT_COLORS[i % DONUT_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => groupDigits(v)} />
        <Legend />
        {centerLabel && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="recharts-text" style={{ fontSize: 14, fontWeight: 800 }}>
            {centerLabel}
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FinanceLineChart({ data, lines }) {
  if (!data?.length) return <div className="fin-empty">No trend data</div>;
  const colors = { pos: '#E85D26', marketplace: '#16A085', commissions: '#F5A623', purchases: '#1A3C5E', shipping: '#16A085', operating: '#F5A623' };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => groupDigits(v)} />
        <Tooltip formatter={(v) => groupDigits(v)} />
        {(lines || []).map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={colors[l.key] || '#E85D26'} strokeWidth={2} dot={false} strokeDasharray={l.dashed ? '5 5' : undefined} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FinanceBarChart({ data }) {
  if (!data?.length) return <div className="fin-empty">No categories</div>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <XAxis type="number" hide tickFormatter={(v) => groupDigits(v)} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => groupDigits(v)} />
        <Bar dataKey="value" fill="#E85D26" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
