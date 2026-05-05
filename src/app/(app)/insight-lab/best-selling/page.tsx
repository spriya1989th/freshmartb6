'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { PageHeader, Card, Badge, Btn, Select, PeriodSelector, Pagination } from '../../../../components/ui';
import { TrendingUp, Download, Filter, Package, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';

type SortBy = 'quantity' | 'revenue' | 'profit';

export default function BestSellingPage() {
  const [period, setPeriod]   = useState('this_month');
  const [from,   setFrom]     = useState('');
  const [to,     setTo]       = useState('');
  const [sortBy, setSortBy]   = useState<SortBy>('quantity');
  const [topN,   setTopN]     = useState(25);
  const [page,   setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['best-selling', period, from, to, sortBy, topN, page],
    queryFn:  () => reportsApi.bestSelling({ period, from, to, sortBy, topN, page, perPage: 25 }),
  });

  const items = (data as any)?.items ?? [];
  const top10 = items.slice(0, 10);

  const COLORS = ['#059669','#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#10b981','#34d399','#6ee7b7','#a7f3d0'];

  function exportReport() {
    const csv = [
      ['Rank','Product','SKU','Category','Brand','Qty Sold','Invoices','Gross Sales','Discount','Net Sales','Cost','Profit','Margin%','Current Stock'],
      ...items.map((r: any) => [r.rank, r.name, r.sku, r.categoryName, r.brandName, r.qtySold, r.invoiceCount, Number(r.grossSales).toFixed(3), Number(r.totalDiscount).toFixed(3), Number(r.netSales).toFixed(3), Number(r.costTotal).toFixed(3), Number(r.profit).toFixed(3), Number(r.profitMargin).toFixed(1)+'%', r.currentStock]),
    ].map(row => row.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `best-selling-${period}.csv`;
    a.click();
    toast.success('Report exported');
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="Best Selling Products" subtitle="Top performing products by quantity, revenue, and profit"
        actions={<Btn icon={<Download size={15} />} onClick={exportReport}>Export CSV</Btn>}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector value={period} onChange={v => { setPeriod(v); setPage(1); }}
          showCustom={{ from, to, onFromChange: setFrom, onToChange: setTo }} />
        <Select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
          options={[{ value: 'quantity', label: '📦 By Quantity' }, { value: 'revenue', label: '💰 By Revenue' }, { value: 'profit', label: '📈 By Profit' }]}
          className="w-40" />
        <Select value={String(topN)} onChange={e => setTopN(Number(e.target.value))}
          options={[{ value: '10', label: 'Top 10' }, { value: '25', label: 'Top 25' }, { value: '50', label: 'Top 50' }, { value: '100', label: 'Top 100' }]}
          className="w-28" />
      </div>

      {/* Chart */}
      {top10.length > 0 && (
        <Card>
          <div className="p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Top 10 — {sortBy === 'quantity' ? 'Units Sold' : sortBy === 'revenue' ? 'Revenue' : 'Profit'}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={top10} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  tickFormatter={v => sortBy === 'quantity' ? String(v) : `KD${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(v: any) => sortBy === 'quantity' ? [v + ' units', 'Sold'] : [fmt.kd(v), sortBy === 'revenue' ? 'Revenue' : 'Profit']} />
                <Bar dataKey={sortBy === 'quantity' ? 'qtySold' : sortBy === 'revenue' ? 'netSales' : 'profit'} radius={[6, 6, 0, 0]}>
                  {top10.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {[
                  ['#',       'w-10',   false],
                  ['Product', 'min-w-[200px]', false],
                  ['SKU',     'hidden lg:table-cell', false],
                  ['Category','hidden xl:table-cell', false],
                  ['Qty Sold','text-right', true, 'qtySold'],
                  ['Invoices','text-right hidden sm:table-cell', false],
                  ['Gross Sales','text-right hidden md:table-cell', false],
                  ['Discount', 'text-right hidden lg:table-cell', false],
                  ['Net Sales', 'text-right', true, 'revenue'],
                  ['Cost',     'text-right hidden md:table-cell', false],
                  ['Profit',   'text-right', true, 'profit'],
                  ['Margin%',  'text-right hidden sm:table-cell', false],
                  ['Stock',    'text-right hidden sm:table-cell', false],
                ].map(([h, cls, sortable, key]) => (
                  <th key={h as string} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50 ${cls as string}`}>
                    {sortable ? (
                      <button onClick={() => setSortBy(key as SortBy)} className="flex items-center gap-1 ml-auto">
                        {h as string} {sortBy === key ? <ArrowUp size={11} /> : <ArrowUpDown size={11} />}
                      </button>
                    ) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 13 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 shimmer rounded" /></td>)}</tr>)
                : items.map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-3 text-gray-400 font-mono text-xs w-10 text-center">{r.rank}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <Package size={14} className="text-gray-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-xs truncate max-w-[180px]">{r.name}</p>
                            <p className="text-[10px] text-gray-400">{r.brandName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell font-mono text-xs text-gray-500">{r.sku}</td>
                      <td className="px-3 py-3 hidden xl:table-cell text-xs text-gray-500">{r.categoryName}</td>
                      <td className="px-3 py-3 text-right font-black text-gray-900 dark:text-white">{Number(r.qtySold).toFixed(0)}</td>
                      <td className="px-3 py-3 text-right hidden sm:table-cell text-gray-600 dark:text-gray-400 text-xs">{r.invoiceCount}</td>
                      <td className="px-3 py-3 text-right hidden md:table-cell text-xs font-mono text-gray-600 dark:text-gray-400">{fmt.kd(r.grossSales)}</td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell text-xs font-mono text-red-500">−{fmt.kd(r.totalDiscount)}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600">{fmt.kd(r.netSales)}</td>
                      <td className="px-3 py-3 text-right hidden md:table-cell text-xs font-mono text-gray-500">{fmt.kd(r.costTotal)}</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-600">{fmt.kd(r.profit)}</td>
                      <td className="px-3 py-3 text-right hidden sm:table-cell">
                        <Badge variant={Number(r.profitMargin) > 30 ? 'success' : Number(r.profitMargin) > 15 ? 'warning' : 'danger'}>
                          {Number(r.profitMargin).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right hidden sm:table-cell">
                        <span className={`font-mono text-xs font-bold ${Number(r.currentStock) <= 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {Number(r.currentStock).toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.ceil(topN / 25)} total={topN} perPage={25} onPage={setPage} />
      </Card>
    </div>
  );
}
