'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, productsApi } from '../../../lib/api';
import { fmt, debounce } from '../../../lib/utils';
import {
  PageHeader, Card, CardHeader, CardBody, Badge, Btn, Input, Select,
  Modal, Alert, SearchInput, Pagination, PeriodSelector,
} from '../../../components/ui';
import {
  Warehouse, Package, TrendingUp, TrendingDown, AlertTriangle, Calendar,
  ArrowUpDown, Download, Filter, Plus, Edit2, Eye, RefreshCw,
  ArrowUp, ArrowDown, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

type StockTab = 'overview' | 'movements' | 'adjustments' | 'expiry';

export default function StockFlowPage() {
  const [tab,         setTab]         = useState<StockTab>('overview');
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('');
  const [lowOnly,     setLowOnly]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [adjModal,    setAdjModal]    = useState(false);
  const [adjProduct,  setAdjProduct]  = useState<any>(null);
  const [adjQty,      setAdjQty]      = useState('');
  const [adjType,     setAdjType]     = useState<'increase' | 'decrease'>('increase');
  const [adjReason,   setAdjReason]   = useState('');
  const [adjNote,     setAdjNote]     = useState('');
  const qc = useQueryClient();

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-report', search, category, lowOnly, page],
    queryFn:  () => reportsApi.stock({ search, categoryId: category, lowStockOnly: lowOnly, page, perPage: 25 }),
    placeholderData: (prev) => prev,
  });

  const { data: expiryData } = useQuery({
    queryKey: ['expiry-report'],
    queryFn:  () => reportsApi.expiry({ daysAhead: 90 }),
  });

  const { data: summaryStats } = useQuery({
    queryKey: ['stock-summary'],
    queryFn:  () => reportsApi.stock({ perPage: 1000 }).then((d: any) => {
      const items = d.items ?? [];
      return {
        totalProducts: d.total,
        totalValue:    items.reduce((s: number, i: any) => s + i.stockValue, 0),
        outOfStock:    items.filter((i: any) => i.currentStock <= 0).length,
        lowStock:      items.filter((i: any) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length,
      };
    }),
  });

  const adjMut = useMutation({
    mutationFn: async () => {
      // POST /inventory/adjust
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fm_token')}` },
        body: JSON.stringify({
          productId:  adjProduct.id,
          movementType: adjType === 'increase' ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE',
          quantity:   Number(adjQty),
          reason:     adjReason,
          notes:      adjNote,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Stock ${adjType}d by ${adjQty} units`);
      setAdjModal(false); setAdjProduct(null); setAdjQty(''); setAdjReason(''); setAdjNote('');
      qc.invalidateQueries({ queryKey: ['stock-report'] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Adjustment failed'),
  });

  const s  = summaryStats as any;
  const sd = stockData   as any;
  const items = sd?.items ?? [];

  const TABS: Array<{ k: StockTab; label: string; icon: React.ReactNode }> = [
    { k: 'overview',    label: 'Stock Overview',  icon: <Warehouse size={15} />   },
    { k: 'expiry',      label: 'Expiry Watch',    icon: <Calendar size={15} />    },
    { k: 'movements',   label: 'Movements',       icon: <ArrowUpDown size={15} /> },
    { k: 'adjustments', label: 'Adjustments',     icon: <Edit2 size={15} />       },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="StockFlow" subtitle="Real-time inventory overview, expiry tracking, and stock adjustments"
        actions={
          <div className="flex gap-2">
            <Btn icon={<Download size={15} />} onClick={() => toast.success('Stock report exported')}>Export</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setAdjModal(true)}>Adjust Stock</Btn>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: s?.totalProducts ?? '—', icon: <Package size={18} />,        color: 'blue',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Stock Value',    value: fmt.kd(s?.totalValue), icon: <TrendingUp size={18} />,       color: 'emerald',bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Low Stock',      value: s?.lowStock ?? '—',    icon: <AlertTriangle size={18} />,    color: 'amber',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Out of Stock',   value: s?.outOfStock ?? '—',  icon: <TrendingDown size={18} />,     color: 'red',    bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-3">
              <div className={`w-10 h-10 ${stat.bg} text-${stat.color}-600 rounded-xl flex items-center justify-center flex-shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{stat.label}</p>
                <p className={`text-xl font-black text-${stat.color}-600`}>{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-1">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.k ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── STOCK OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search product…" className="w-72" />
            <Select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'All Categories' }]} className="w-44" />
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-400">
              <input type="checkbox" checked={lowOnly} onChange={e => { setLowOnly(e.target.checked); setPage(1); }} className="accent-amber-500" />
              Low stock only
            </label>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {['Product','SKU','Category','Current Stock','Reorder','Max Stock','Stock Value','Status','Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded" /></td>)}
                        </tr>
                      ))
                    : items.map((item: any) => {
                        const pct = item.reorderLevel > 0 ? Math.min(100, (item.currentStock / item.reorderLevel) * 50) : 50;
                        return (
                          <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package size={14} className="text-gray-300 flex-shrink-0" />
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white text-xs truncate max-w-[180px]">{item.name}</p>
                                  <p className="text-[10px] text-gray-400">{item.brand}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{item.category ?? '—'}</td>
                            <td className="px-4 py-3">
                              <div>
                                <span className={`font-black text-sm ${item.currentStock <= 0 ? 'text-red-600' : item.currentStock <= item.reorderLevel ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                                  {Number(item.currentStock).toFixed(0)}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                                <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                  <div className={`h-full rounded-full ${item.currentStock <= 0 ? 'bg-red-500' : item.currentStock <= item.reorderLevel ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{item.reorderLevel}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{item.maxStock ?? '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">{fmt.kd(item.stockValue)}</td>
                            <td className="px-4 py-3">
                              {item.status === 'OUT_OF_STOCK' ? <Badge variant="danger">Out</Badge>
                               : item.status === 'LOW' ? <Badge variant="warning">Low</Badge>
                               : <Badge variant="success">OK</Badge>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setAdjProduct(item); setAdjModal(true); }}
                                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors">
                                  Adjust
                                </button>
                                <Link href={`/catalog/${item.id}`}
                                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 hover:bg-gray-100 transition-colors">
                                  View
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={sd?.totalPages ?? 1} total={sd?.total ?? 0} perPage={25} onPage={setPage} />
          </Card>
        </>
      )}

      {/* ── EXPIRY WATCH ── */}
      {tab === 'expiry' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Expiry Watch — Next 90 Days</h3>
                <p className="text-xs text-gray-500 mt-0.5">Products with stock that expires within 90 days</p>
              </div>
              <Btn icon={<Download size={14} />} size="sm" onClick={() => toast.success('Exported')}>Export</Btn>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Product','SKU','Batch','Stock Left','Expiry Date','Days Left','Selling Price','Status'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(expiryData as any[])?.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <Calendar size={32} className="mx-auto mb-2 opacity-20" />
                    <p>No items expiring within 90 days</p>
                  </td></tr>
                )}
                {(expiryData as any[])?.map((item: any, i: number) => {
                  const days = Math.floor(Number(item.daysUntilExpiry));
                  return (
                    <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 ${days <= 0 ? 'bg-red-50/50 dark:bg-red-900/10' : days <= 7 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-xs">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.batchNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-bold font-mono text-sm text-gray-800 dark:text-gray-200">{Number(item.currentStock).toFixed(0)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt.date(item.expiryDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-black text-sm ${days <= 0 ? 'text-red-600' : days <= 7 ? 'text-red-500' : days <= 30 ? 'text-amber-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {days <= 0 ? 'EXPIRED' : `${days}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-600">{fmt.kd(item.sellingPrice)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={days <= 0 ? 'danger' : days <= 7 ? 'danger' : days <= 30 ? 'warning' : 'info'}>
                          {days <= 0 ? 'Expired' : days <= 7 ? 'Critical' : days <= 30 ? 'Warning' : 'Monitor'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── MOVEMENTS ── */}
      {tab === 'movements' && (
        <Card>
          <CardHeader>
            <h3 className="font-bold text-gray-900 dark:text-white">Stock Movements Log</h3>
          </CardHeader>
          <CardBody>
            <Alert type="info" message="Select a product from the Stock Overview tab to view its movement history, or use the filter below." />
          </CardBody>
        </Card>
      )}

      {/* ── ADJUSTMENTS ── */}
      {tab === 'adjustments' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Stock Adjustments</h3>
              <Btn variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setAdjModal(true)}>New Adjustment</Btn>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-500">Recent stock adjustments will appear here. Use the "Adjust Stock" button to record a new adjustment.</p>
          </CardBody>
        </Card>
      )}

      {/* ── ADJUST MODAL ── */}
      <Modal open={adjModal} onClose={() => { setAdjModal(false); setAdjProduct(null); }} title="Stock Adjustment" size="sm">
        <div className="p-6 space-y-4">
          {!adjProduct && (
            <div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search product to adjust…" />
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {items.slice(0, 8).map((item: any) => (
                  <button key={item.id} onClick={() => setAdjProduct(item)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800 transition-all text-sm">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">Stock: {Number(item.currentStock).toFixed(0)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {adjProduct && (
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <Package size={20} className="text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{adjProduct.name}</p>
                  <p className="text-xs text-gray-400">Current stock: <strong>{Number(adjProduct.currentStock).toFixed(0)}</strong></p>
                </div>
                <button onClick={() => setAdjProduct(null)} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAdjType('increase')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adjType === 'increase' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
                  <ArrowUp size={14} /> Increase
                </button>
                <button onClick={() => setAdjType('decrease')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${adjType === 'decrease' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
                  <ArrowDown size={14} /> Decrease
                </button>
              </div>

              <Input label="Quantity" type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="0" min="0.01" step="0.01" />

              <Select label="Reason" value={adjReason} onChange={e => setAdjReason(e.target.value)}
                options={[
                  { value: '', label: 'Select reason…' },
                  { value: 'DAMAGED',             label: 'Damaged goods' },
                  { value: 'EXPIRED',             label: 'Expired stock removal' },
                  { value: 'STOCK_TAKE',          label: 'Stock take reconciliation' },
                  { value: 'INTERNAL_ADJUSTMENT', label: 'Internal correction' },
                  { value: 'SPOILED_GOODS',       label: 'Spoiled goods' },
                  { value: 'LOST_ITEM',           label: 'Lost item' },
                  { value: 'MANUAL_CORRECTION',   label: 'Manual correction' },
                ]}
              />

              <Input label="Notes (optional)" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="Additional notes…" />

              {adjQty && adjReason && (
                <div className={`p-3 rounded-xl text-sm font-medium text-center ${adjType === 'increase' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700'}`}>
                  New stock: {Number(adjProduct.currentStock) + (adjType === 'increase' ? Number(adjQty) : -Number(adjQty))} units
                </div>
              )}

              <div className="flex gap-3">
                <Btn onClick={() => { setAdjModal(false); setAdjProduct(null); }} className="flex-1">Cancel</Btn>
                <Btn variant={adjType === 'increase' ? 'primary' : 'danger'} onClick={() => adjMut.mutate()} loading={adjMut.isPending}
                  disabled={!adjQty || !adjReason} className="flex-1">
                  Confirm Adjustment
                </Btn>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
