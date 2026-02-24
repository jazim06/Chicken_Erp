import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Weight, IndianRupee, Hash, Users,
  CalendarDays, Loader2,
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { getAnalytics } from '../utils/apiAdapter';

// ── colour palette (matches CSS chart vars) ──────────────────────────
const CHART_COLORS = [
  'hsl(27, 94%, 55%)',   // orange primary
  'hsl(200, 70%, 50%)',  // blue
  'hsl(150, 60%, 45%)',  // green
  'hsl(280, 65%, 55%)',  // purple
  'hsl(340, 65%, 55%)',  // rose
  'hsl(45, 85%, 50%)',   // amber
  'hsl(170, 55%, 45%)',  // teal
  'hsl(220, 60%, 55%)',  // indigo
];

// ── helper: format numbers with commas ───────────────────────────────
const fmt = (n, decimals = 2) =>
  Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

// ── time-range presets ───────────────────────────────────────────────
const RANGES = [
  { key: '7d',  label: 'Last 7 days',  start: () => subDays(new Date(), 6) },
  { key: '30d', label: 'Last 30 days', start: () => subDays(new Date(), 29) },
  { key: 'mtd', label: 'This Month',   start: () => startOfMonth(new Date()) },
  { key: '3m',  label: 'Last 3 months', start: () => subMonths(new Date(), 3) },
  { key: '6m',  label: 'Last 6 months', start: () => subMonths(new Date(), 6) },
  { key: '1y',  label: 'Last 1 year',  start: () => subMonths(new Date(), 12) },
];

// ── granularity tabs ────────────────────────────────────────────────
const GRANULARITY = ['daily', 'weekly', 'monthly'];

// ── custom tooltip ──────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-card-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.name === 'Revenue' ? `₹${fmt(p.value)}` : fmt(p.value, 3)}
        </p>
      ))}
    </div>
  );
};

// ── KPI card ────────────────────────────────────────────────────────
const KpiCard = ({ title, value, subtitle, icon: Icon, color }) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color }}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [gran, setGran] = useState('daily');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch analytics whenever range changes
  useEffect(() => {
    const preset = RANGES.find((r) => r.key === range);
    const startDate = format(preset.start(), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');

    setLoading(true);
    getAnalytics(startDate, endDate)
      .then((res) => setData(res))
      .catch((err) => console.error('Analytics fetch failed', err))
      .finally(() => setLoading(false));
  }, [range]);

  // Pick the right series for the chosen granularity
  const series = useMemo(() => {
    if (!data) return [];
    if (gran === 'weekly') return data.weekly;
    if (gran === 'monthly') return data.monthly;
    return data.daily;
  }, [data, gran]);

  // Label key varies by granularity
  const labelKey = gran === 'weekly' ? 'week' : gran === 'monthly' ? 'month' : 'date';

  // Top 8 suppliers and parties for charts
  const topSuppliers = useMemo(
    () => (data?.supplierBreakdown || []).slice(0, 8),
    [data],
  );
  const topParties = useMemo(
    () => (data?.partyBreakdown || []).slice(0, 10),
    [data],
  );

  // ── loading state ─────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── header + range selector ─────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Revenue &amp; weight trends at a glance
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Weight"
          value={`${fmt(data?.totalWeight ?? 0, 3)} kg`}
          subtitle={`${fmt(data?.totalEntries ?? 0, 0)} entries`}
          icon={Weight}
          color="hsl(200, 70%, 50%)"
        />
        <KpiCard
          title="Revenue"
          value={`₹${fmt(data?.totalRevenue ?? 0)}`}
          subtitle="Based on effective rate"
          icon={IndianRupee}
          color="hsl(150, 60%, 45%)"
        />
        <KpiCard
          title="Total Entries"
          value={fmt(data?.totalEntries ?? 0, 0)}
          subtitle={`${gran} view`}
          icon={Hash}
          color="hsl(27, 94%, 55%)"
        />
        <KpiCard
          title="Suppliers"
          value={data?.totalSuppliers ?? 0}
          subtitle="Active in period"
          icon={Users}
          color="hsl(280, 65%, 55%)"
        />
      </div>

      {/* ── granularity tabs ────────────────────────────────────── */}
      <div className="flex gap-1.5">
        {GRANULARITY.map((g) => (
          <button
            key={g}
            onClick={() => setGran(g)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              gran === g
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* ── revenue + weight area chart ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Revenue &amp; Weight Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No data for this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 20%)" />
                <XAxis
                  dataKey={labelKey}
                  tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                  tickFormatter={(v) =>
                    gran === 'monthly' ? v : v.length > 7 ? v.slice(5) : v
                  }
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                  tickFormatter={(v) => `${v}kg`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="circle"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={CHART_COLORS[2]}
                  fill="url(#gradRevenue)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="weight"
                  name="Weight"
                  stroke={CHART_COLORS[1]}
                  fill="url(#gradWeight)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── supplier donut + top parties bar (side by side) ──────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Supplier distribution pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Supplier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {topSuppliers.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No supplier data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topSuppliers}
                    dataKey="weight"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={3}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    style={{ fontSize: 11 }}
                  >
                    {topSuppliers.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => `${fmt(val, 3)} kg`}
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 12,
                      backgroundColor: 'hsl(210, 35%, 10%)',
                      border: '1px solid hsl(210, 30%, 18%)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top parties bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Parties by Weight</CardTitle>
          </CardHeader>
          <CardContent>
            {topParties.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No party data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={topParties}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 20%)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                    tickFormatter={(v) => `${v} kg`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                    width={55}
                  />
                  <Tooltip
                    formatter={(val) => `${fmt(val, 3)} kg`}
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 12,
                      backgroundColor: 'hsl(210, 35%, 10%)',
                      border: '1px solid hsl(210, 30%, 18%)',
                    }}
                  />
                  <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                    {topParties.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── weekly / monthly revenue bar chart ──────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            {gran === 'daily' ? 'Daily' : gran === 'weekly' ? 'Weekly' : 'Monthly'} Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No data for this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 20%)" />
                <XAxis
                  dataKey={labelKey}
                  tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                  tickFormatter={(v) =>
                    gran === 'monthly' ? v : v.length > 7 ? v.slice(5) : v
                  }
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(210, 15%, 55%)' }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill={CHART_COLORS[0]}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── monthly summary table ───────────────────────────────── */}
      {(data?.monthly?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Summary</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Month</th>
                  <th className="py-2 pr-4 font-medium text-right">Weight (kg)</th>
                  <th className="py-2 pr-4 font-medium text-right">Revenue (₹)</th>
                  <th className="py-2 font-medium text-right">Entries</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{m.month}</td>
                    <td className="py-2 pr-4 text-right">{fmt(m.weight, 3)}</td>
                    <td className="py-2 pr-4 text-right">₹{fmt(m.revenue)}</td>
                    <td className="py-2 text-right">{m.count}</td>
                  </tr>
                ))}
                {/* totals row */}
                <tr className="font-semibold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right">{fmt(data.totalWeight, 3)}</td>
                  <td className="pt-2 text-right">₹{fmt(data.totalRevenue)}</td>
                  <td className="pt-2 text-right">{data.totalEntries}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
