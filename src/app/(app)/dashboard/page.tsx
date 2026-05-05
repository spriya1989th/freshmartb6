'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, productsApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  StatCard, Card, CardHeader, CardBody, Badge, PageHeader, PeriodSelector, DataTable, Alert,
} from '../../../components/ui';
import {
  ShoppingCart, TrendingUp, Package, Users, AlertTriangle, ArrowUpRight,
  BarChart3, DollarSign, RefreshCw, Clock, TrendingDown, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import Link from 'next/link';

export default function DashboardPage() {
  const [period, setPeriod]   = useState('today');
  const [from,   setFrom]     = useState('');
  const [to,     setTo]       = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', period, from, to],
    queryFn:  () => reportsApi.dashboard({ period, from, to }),
    refetchInterval: 60_000,
  });

  const { data: chartData } = useQuery({
    queryKey: ['sales-chart', period],
    queryFn:  () => reportsApi.salesByPeriod({ period: period === 'today' ? 'this_month' : period, groupBy: period === 'this_year' ? 'month' : period === 'this_week' ? 'day' : 'day' }),
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn:  () => reportsApi.stock({ lowStockOnly: true, perPage: 8 }),
    refetchInterval: 300_000,
  });

  const { data: expiryData } = useQuery({
    queryKey: ['expiry-dash'],
    queryFn:  () => reportsApi.expiry({ daysAhead: 30 }),
  });

  const chartFormatted = (chartData as any[])?.map((r: any) => ({
    label: new Date(r.period).toLocaleDateString('en-KW', { timeZone: 'Asia/Kuwait', day: '2-digit', month: 'short' }),
    sales: Number(r.total),
    count: Number(r.count),
  })) ?? [];

  const s = stats as any;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Command Center"
          subtitle={`Live business overview · Kuwait time ${new Date().toLocaleTimeString('en-KW', { timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit' })}`}
        />
        <PeriodSelector
          value={period} onChange={setPeriod}
          showCustom={{ from, to, onFromChange: setFrom, onToChange: setTo }}
        />
      </div>

      {/* Critical Alerts */}
      {(s?.lowStockCount > 0 || s?.expiringCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {s?.lowStockCount > 0 && (
            <Alert type="warning" title={`${s.lowStockCount} products at or below reorder level`}
              message="Review stock levels and place purchase orders to avoid stockouts." />
          )}
          {s?.expiringCount > 0 && (
            <Alert type="danger" title={`${s.expiringCount} products expiring within 30 days`}
              message="Check expiry report and clear or return affected stock." />
          )}
        </div>
      )}

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales" icon={<ShoppingCart size={20} />} color="emerald"
          value={statsLoading ? '—' : fmt.kd(s?.totalSales)}
          change={s?.salesChange} positive={s?.salesChange?.startsWith('+')}
          sub={`${s?.totalTransactions ?? 0} transactions`}
        />
        <StatCard
          label="Net Revenue" icon={<DollarSign size={20} />} color="blue"
          value={statsLoading ? '—' : fmt.kd(s?.netProfit)}
          sub={`After ${fmt.kd(s?.totalReturns)} returns`}
        />
        <StatCard
          label="Purchases" icon={<TrendingDown size={20} />} color="amber"
          value={statsLoading ? '—' : fmt.kd(s?.totalPurchases)}
          sub="Received this period"
        />
        <StatCard
          label="New Customers" icon={<Users size={20} />} color="purple"
          value={statsLoading ? '—' : s?.newCustomers ?? 0}
          sub="Registered this period"
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Discounts Given" icon={<TrendingDown size={20} />} color="red"    value={fmt.kd(s?.totalDiscount)} />
        <StatCard label="Tax Collected"   icon={<BarChart3    size={20} />} color="blue"   value={fmt.kd(s?.totalTax)} />
        <StatCard label="Returns"         icon={<RefreshCw    size={20} />} color="amber"  value={fmt.kd(s?.totalReturns)} />
        <StatCard label="Low Stock Items" icon={<AlertTriangle size={20} />} color="red"
          value={s?.lowStockCount ?? 0}
          sub={`${s?.expiringCount ?? 0} expiring soon`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Sales Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Revenue over selected period</p>
              </div>
              <Link href="/insight-lab" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                Full report <ArrowUpRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartFormatted} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `KD${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(v: any) => [fmt.kd(v), 'Revenue']} />
                <Area type="monotone" dataKey="sales" stroke="#059669" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: '#059669' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Quick Actions</h3></CardHeader>
          <CardBody className="p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Sale',      href: '/pos',                icon: <ShoppingCart size={20} />, color: 'bg-emerald-500' },
                { label: 'Add Product',   href: '/catalog?new=1',      icon: <Package size={20} />,      color: 'bg-blue-500' },
                { label: 'Receive Stock', href: '/buyflow/receive',     icon: <TrendingUp size={20} />,   color: 'bg-amber-500' },
                { label: 'Stock Check',   href: '/stockflow',           icon: <BarChart3 size={20} />,    color: 'bg-purple-500' },
                { label: 'Best Sellers',  href: '/insight-lab/best-selling', icon: <Zap size={20} />,   color: 'bg-rose-500' },
                { label: 'Open Shift',    href: '/cash-room',           icon: <Clock size={20} />,        color: 'bg-teal-500' },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group border border-gray-100 dark:border-gray-800">
                  <div className={`w-10 h-10 ${a.color} rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-transform`}>
                    {a.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Low Stock + Expiry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-bold text-gray-900 dark:text-white">Stock Alert</h3>
                {s?.lowStockCount > 0 && <Badge variant="warning">{s.lowStockCount} items</Badge>}
              </div>
              <Link href="/stockflow" className="text-xs text-emerald-600 hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Product</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Stock</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Min</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Status</th>
                </tr>
              </thead>
              <tbody>
                {(lowStock as any)?.items?.slice(0, 8).map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[180px]">{p.name}</div>
                      <div className="text-gray-400 text-[10px] font-mono">{p.sku}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold font-mono text-sm text-red-600">{Number(p.currentStock).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{p.reorderLevel}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant={Number(p.currentStock) <= 0 ? 'danger' : 'warning'}>
                        {Number(p.currentStock) <= 0 ? 'Out' : 'Low'}
                      </Badge>
                    </td>
                  </tr>
                )) ?? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">All stock levels OK ✓</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="font-bold text-gray-900 dark:text-white">Expiry Watch</h3>
                {(expiryData as any[])?.length > 0 && <Badge variant="danger">{(expiryData as any[]).length} items</Badge>}
              </div>
              <Link href="/stockflow/expiry" className="text-xs text-emerald-600 hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Product</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Expires</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">Days</th>
                </tr>
              </thead>
              <tbody>
                {(expiryData as any[])?.slice(0, 8).map((p: any, i: number) => {
                  const days = Number(p.daysUntilExpiry);
                  return (
                    <tr key={`${p.id}-${i}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[180px]">{p.name}</div>
                        {p.batchNumber && <div className="text-gray-400 text-[10px] font-mono">Batch: {p.batchNumber}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500 font-mono">{fmt.date(p.expiryDate)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={days <= 0 ? 'danger' : days <= 7 ? 'danger' : days <= 30 ? 'warning' : 'info'}>
                          {days <= 0 ? 'Expired' : `${days}d`}
                        </Badge>
                      </td>
                    </tr>
                  );
                }) ?? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-xs">No expiring items ✓</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
