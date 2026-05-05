'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  PageHeader, Card, CardHeader, CardBody, Badge, Btn, PeriodSelector, StatCard,
} from '../../../components/ui';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package, FileText,
  Download, ChevronRight, PieChart, Users, Truck,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function InsightLabPage() {
  const [period, setPeriod] = useState('this_month');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');

  const { data: pnl }   = useQuery({ queryKey: ['pnl', period, from, to],  queryFn: () => reportsApi.pnl({ period, from, to }) });
  const { data: chart } = useQuery({ queryKey: ['chart', period],           queryFn: () => reportsApi.salesByPeriod({ period, groupBy: 'day' }) });
  const { data: tax }   = useQuery({ queryKey: ['tax', period, from, to],   queryFn: () => reportsApi.tax({ period, from, to }) });

  const p = pnl   as any;
  const chartData = ((chart as any[]) ?? []).map(r => ({
    label: new Date(r.period).toLocaleDateString('en-KW', { timeZone: 'Asia/Kuwait', day: '2-digit', month: 'short' }),
    revenue: Number(r.total), count: Number(r.count),
  }));

  const PIE_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const reportLinks = [
    { href: '/insight-lab/best-selling', label: 'Best Selling Products', icon: <TrendingUp size={18} />, desc: 'Top products by qty, revenue, profit', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' },
    { href: '/insight-lab/stock',        label: 'Stock Report',          icon: <Package size={18} />,     desc: 'Inventory levels and valuation',   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' },
    { href: '/insight-lab/expiry',       label: 'Expiry Report',         icon: <FileText size={18} />,    desc: 'Products expiring by date',        color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' },
    { href: '/insight-lab/pnl',          label: 'P&L Report',            icon: <DollarSign size={18} />,  desc: 'Profit & loss by period',          color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' },
    { href: '/insight-lab/tax',          label: 'Tax Report',            icon: <BarChart3 size={18} />,   desc: 'Tax collected by rate',            color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' },
    { href: '/insight-lab/shifts',       label: 'Shift Reports',         icon: <PieChart size={18} />,    desc: 'Daily shift summaries',            color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600' },
    { href: '/insight-lab/customers',    label: 'Customer Ledger',       icon: <Users size={18} />,       desc: 'Credit & purchase history',        color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' },
    { href: '/insight-lab/suppliers',    label: 'Supplier Ledger',       icon: <Truck size={18} />,       desc: 'Purchases by supplier',            color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600' },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Insight Lab" subtitle="Business analytics, financial reports, and performance metrics" />
        <PeriodSelector value={period} onChange={setPeriod} showCustom={{ from, to, onFromChange: setFrom, onToChange: setTo }} />
      </div>

      {/* P&L KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Gross Revenue"  value={fmt.kd(p?.grossRevenue)}  icon={<TrendingUp   size={18}/>} color="emerald" change={`After ${fmt.kd(p?.totalReturns)} returns`} />
        <StatCard label="Total Purchases"value={fmt.kd(p?.totalPurchases)} icon={<TrendingDown size={18}/>} color="amber"   />
        <StatCard label="Gross Profit"   value={fmt.kd(p?.grossProfit)}   icon={<DollarSign   size={18}/>} color="blue"    />
        <StatCard label="Net Profit"     value={fmt.kd(p?.netProfit)}     icon={<BarChart3    size={18}/>} color="purple"
          change={p?.margin ? `${p.margin}% margin` : undefined} positive={Number(p?.margin) > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Revenue Trend</h3>
              <Btn size="sm" icon={<Download size={13} />} onClick={() => toast.success('Chart exported')}>Export</Btn>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `KD${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: '12px' }} formatter={(v: any) => [fmt.kd(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* P&L Summary */}
        <Card>
          <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">P&L Summary</h3></CardHeader>
          <CardBody className="space-y-3">
            {[
              { label: 'Gross Revenue',   value: p?.grossRevenue,   positive: true  },
              { label: 'Returns',         value: p?.totalReturns,   positive: false },
              { label: 'Net Revenue',     value: p?.netRevenue,     positive: true  },
              { label: '− Purchases',     value: p?.totalPurchases, positive: false },
              { label: '= Gross Profit',  value: p?.grossProfit,    positive: true,  bold: true },
              { label: '− Expenses',      value: p?.totalExpenses,  positive: false },
              { label: '= Net Profit',    value: p?.netProfit,      positive: true,  bold: true, highlight: true },
            ].map((r, i) => (
              <div key={i} className={`flex justify-between text-sm ${r.highlight ? 'pt-2 border-t-2 border-gray-200 dark:border-gray-700' : ''}`}>
                <span className={`${r.bold ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}>{r.label}</span>
                <span className={`font-mono ${r.bold ? 'font-black text-base' : 'font-semibold'} ${r.positive ? 'text-emerald-600' : 'text-red-500'}`}>{fmt.kd(r.value)}</span>
              </div>
            ))}
            {p?.margin && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                <p className="text-xs text-gray-500">Net Margin</p>
                <p className={`text-2xl font-black ${Number(p.margin) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.margin}%</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Report shortcuts grid */}
      <div>
        <h2 className="font-black text-gray-900 dark:text-white text-lg mb-4">All Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportLinks.map(r => (
            <Link key={r.href} href={r.href}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all group">
              <div className={`w-10 h-10 ${r.color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white text-sm">{r.label}</p>
                <p className="text-xs text-gray-500 truncate">{r.desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
