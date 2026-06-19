import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend,
} from 'recharts';
import { api } from '../api/client';
import { PageHeader, StatCard, Card, Spinner } from '../components/ui';
import { formatPaise } from '../lib/money';
import { useAuth } from '../store/auth';

const DONUT_COLORS = ['#10b981', '#f59e0b', '#f97316', '#3b82f6', '#ef4444'];

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => (await api.get('/dashboard/kpis')).data,
  });

  if (isLoading) return <Spinner />;
  const k = data ?? {};

  const inventory = [
    { name: 'Available', value: k.inventory?.available ?? 0 },
    { name: 'Blocked', value: k.inventory?.blocked ?? 0 },
    { name: 'Booked', value: k.inventory?.booked ?? 0 },
    { name: 'Registered', value: k.inventory?.registered ?? 0 },
  ];
  const pipeline = (k.pipelineByStage ?? []).map((p: any) => ({
    stage: String(p.stage).replace(/_/g, ' '),
    value: Number(p.valuePaise ?? 0) / 100,
    count: p.count,
  }));

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] ?? ''}`} subtitle="Your real-time CRM overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Leads" value={k.totalLeads ?? 0} hint={`${k.conversionRate ?? 0}% conversion`} />
        <StatCard label="Site Visits" value={`${k.siteVisitsCompleted ?? 0}/${k.siteVisitsScheduled ?? 0}`} hint="completed / scheduled" />
        <StatCard label="Collections (MTD)" value={formatPaise(k.collectionsThisMonthPaise ?? '0')} hint={`Target ${formatPaise(k.collectionsTargetPaise ?? '0')}`} />
        <StatCard label="Overdue Demands" value={k.overdueDemandsCount ?? 0} hint={formatPaise(k.overdueValuePaise ?? '0')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 font-semibold text-slate-800">Pipeline value by stage</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipeline}>
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Inventory status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={inventory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {inventory.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Revenue booked vs target</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Booked</span>
              <span className="font-semibold">{formatPaise(k.revenueBookedPaise ?? '0')}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{
                  width: `${Math.min(100, k.revenueTargetPaise && Number(k.revenueTargetPaise) > 0
                    ? (Number(k.revenueBookedPaise ?? 0) / Number(k.revenueTargetPaise)) * 100
                    : 0)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Target</span>
              <span>{formatPaise(k.revenueTargetPaise ?? '0')}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold text-slate-800">Top performing agents</h3>
          <div className="space-y-2">
            {(k.topAgents ?? []).length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
            {(k.topAgents ?? []).map((a: any, i: number) => (
              <div key={a.id ?? i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{a.name ?? a.agentName ?? 'Agent'}</span>
                <span className="text-sm text-slate-500">{a.bookings ?? a.count ?? 0} bookings</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
