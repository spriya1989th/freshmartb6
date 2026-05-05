'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi, suppliersApi, productsApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  PageHeader, Card, CardHeader, CardBody, Badge, Btn, Input, Select,
  Modal, Alert, SearchInput, Pagination, Confirm,
} from '../../../components/ui';
import {
  TrendingDown, Plus, Eye, CheckCircle2, X, Package, Truck,
  Download, RotateCcw, Search, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

type PurchaseTab = 'list' | 'new' | 'receive';

export default function BuyFlowPage() {
  const qc = useQueryClient();
  const [tab,       setTab]      = useState<PurchaseTab>('list');
  const [viewId,    setViewId]   = useState<string | null>(null);
  const [page,      setPage]     = useState(1);
  const [status,    setStatus]   = useState('');
  const [search,    setSearch]   = useState('');

  // New purchase form
  const [supplierId,  setSupplierId]  = useState('');
  const [orderDate,   setOrderDate]   = useState(new Date().toISOString().slice(0, 10));
  const [supplierRef, setSupplierRef] = useState('');
  const [purchItems,  setPurchItems]  = useState<any[]>([]);
  const [prodSearch,  setProdSearch]  = useState('');

  // Receive
  const [receiveId,   setReceiveId]   = useState<string | null>(null);
  const [receiveItems,setReceiveItems]= useState<any[]>([]);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases', page, status, search],
    queryFn:  () => purchasesApi.list({ page, perPage: 20, status: status || undefined, search }),
    placeholderData: (prev) => prev,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn:  () => suppliersApi.list({ perPage: 100 }),
  });

  const { data: viewPurchase } = useQuery({
    queryKey: ['purchase', viewId],
    queryFn:  () => viewId ? purchasesApi.get(viewId) : null,
    enabled:  !!viewId,
  });

  const { data: productSearch } = useQuery({
    queryKey: ['prod-search-buy', prodSearch],
    queryFn:  () => prodSearch.length > 1 ? productsApi.list({ search: prodSearch, perPage: 10 }) : null,
    enabled:  prodSearch.length > 1,
  });

  const createMut = useMutation({
    mutationFn: () => purchasesApi.create({
      supplierId: supplierId || undefined,
      orderDate, supplierRef,
      items: purchItems.map(i => ({
        productId: i.productId, unitId: i.unitId,
        orderedQty: i.orderedQty, costPerUnit: i.costPerUnit,
        expiryDate: i.expiryDate || undefined, batchNumber: i.batchNumber || undefined,
      })),
    }),
    onSuccess: () => {
      toast.success('Purchase order created');
      setSupplierId(''); setSupplierRef(''); setPurchItems([]);
      qc.invalidateQueries({ queryKey: ['purchases'] });
      setTab('list');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create purchase'),
  });

  const receiveMut = useMutation({
    mutationFn: () => purchasesApi.receive(receiveId!, {
      items: receiveItems.map(i => ({
        purchaseItemId: i.id,
        receivedQty: Number(i.receivedQty),
        expiryDate:  i.expiryDate || undefined,
        batchNumber: i.batchNumber || undefined,
      })),
    }),
    onSuccess: () => {
      toast.success('Stock received and inventory updated');
      setReceiveId(null); setReceiveItems([]);
      qc.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Receive failed'),
  });

  function addItemToPurchase(product: any) {
    if (purchItems.find(i => i.productId === product.id)) { toast.error('Already in order'); return; }
    setPurchItems(prev => [...prev, {
      productId: product.id, name: product.name, sku: product.sku,
      unitId: product.purchaseUnitId ?? product.baseUnitId,
      unitName: product.purchaseUnit?.abbreviation ?? product.baseUnit?.abbreviation ?? 'pcs',
      orderedQty: 1, costPerUnit: Number(product.purchasePrice),
      batchNumber: '', expiryDate: '',
    }]);
    setProdSearch('');
  }

  function updateItem(idx: number, field: string, value: any) {
    setPurchItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  const subtotal = purchItems.reduce((s, i) => s + Number(i.orderedQty) * Number(i.costPerUnit), 0);
  const pd = purchases as any;
  const suppList = (suppliers as any)?.items ?? [];

  const statusBadge = (s: string) => ({
    DRAFT:            <Badge variant="gray">Draft</Badge>,
    ORDERED:          <Badge variant="info">Ordered</Badge>,
    PARTIAL_RECEIVED: <Badge variant="warning">Partial</Badge>,
    RECEIVED:         <Badge variant="success">Received</Badge>,
    CANCELLED:        <Badge variant="danger">Cancelled</Badge>,
  }[s] ?? <Badge>{s}</Badge>);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="BuyFlow" subtitle="Purchase orders, receive stock, and manage supplier orders"
        actions={
          <div className="flex gap-2">
            <Btn icon={<Download size={15} />} onClick={() => toast.success('Exported')}>Export</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setTab('new')}>New Purchase Order</Btn>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {[
          { k: 'list',    label: 'Purchase Orders' },
          { k: 'new',     label: '+ New Order' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as PurchaseTab)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === t.k ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PURCHASE LIST ── */}
      {tab === 'list' && (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search ref, supplier…" className="w-72" />
            <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'All Status' }, { value: 'DRAFT', label: 'Draft' }, { value: 'ORDERED', label: 'Ordered' }, { value: 'PARTIAL_RECEIVED', label: 'Partial' }, { value: 'RECEIVED', label: 'Received' }, { value: 'CANCELLED', label: 'Cancelled' }]}
              className="w-40" />
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {['Ref #','Order Date','Supplier','Items','Total','Paid','Status','Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded" /></td>)}</tr>)
                    : (pd?.items ?? []).map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{p.docNumber}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{fmt.date(p.orderDate)}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-800 dark:text-gray-200">{p.supplier?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{p._count?.items ?? p.items?.length ?? '—'}</td>
                          <td className="px-4 py-3 font-bold font-mono text-sm text-gray-900 dark:text-white">{fmt.kd(p.totalAmount)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-emerald-600">{fmt.kd(p.paidAmount)}</td>
                          <td className="px-4 py-3">{statusBadge(p.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => setViewId(p.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600" title="View"><Eye size={14} /></button>
                              {(p.status === 'ORDERED' || p.status === 'PARTIAL_RECEIVED' || p.status === 'DRAFT') && (
                                <button onClick={() => { setReceiveId(p.id); setReceiveItems(p.items?.map((i: any) => ({ ...i, receivedQty: Number(i.orderedQty) - Number(i.receivedQty) })) ?? []); }}
                                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 hover:bg-emerald-100 transition-colors">
                                  Receive
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={pd?.totalPages ?? 1} total={pd?.total ?? 0} perPage={20} onPage={setPage} />
          </Card>
        </>
      )}

      {/* ── NEW PURCHASE ORDER ── */}
      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Order Details</h3></CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select label="Supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)}
                    options={[{ value: '', label: 'Select supplier…' }, ...suppList.map((s: any) => ({ value: s.id, label: s.name }))]} />
                  <Input label="Order Date" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                  <Input label="Supplier Invoice Ref" value={supplierRef} onChange={e => setSupplierRef(e.target.value)} placeholder="Supplier's ref number" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white">Order Items</h3>
                  <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search product to add…"
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-emerald-500" />
                    {prodSearch.length > 1 && (
                      <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto mt-1">
                        {(productSearch as any)?.items?.map((p: any) => (
                          <button key={p.id} onClick={() => addItemToPurchase(p)}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 text-xs">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{p.name}</span>
                            <span className="text-gray-400 ml-2">{p.sku} · {fmt.kd(p.purchasePrice)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <div>
                {purchItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Package size={32} className="mb-2 opacity-20" />
                    <p className="text-sm">Search and add products above</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          {['Product','Unit','Qty','Cost/Unit','Batch','Expiry','Line Total',''].map(h => (
                            <th key={h} className="text-left font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 dark:bg-gray-800/50">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {purchItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2">
                              <p className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</p>
                              <p className="text-gray-400">{item.sku}</p>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{item.unitName}</td>
                            <td className="px-3 py-2 w-20">
                              <input type="number" value={item.orderedQty} min="0.01" step="0.01"
                                onChange={e => updateItem(idx, 'orderedQty', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center font-mono text-sm focus:border-emerald-500 outline-none" />
                            </td>
                            <td className="px-3 py-2 w-28">
                              <input type="number" value={item.costPerUnit} min="0" step="0.001"
                                onChange={e => updateItem(idx, 'costPerUnit', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-sm focus:border-emerald-500 outline-none" />
                            </td>
                            <td className="px-3 py-2 w-28">
                              <input type="text" value={item.batchNumber} placeholder="Batch#"
                                onChange={e => updateItem(idx, 'batchNumber', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-emerald-500 outline-none" />
                            </td>
                            <td className="px-3 py-2 w-32">
                              <input type="date" value={item.expiryDate}
                                onChange={e => updateItem(idx, 'expiryDate', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-emerald-500 outline-none" />
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {fmt.kd(Number(item.orderedQty) * Number(item.costPerUnit))}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => setPurchItems(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Order Summary</h3></CardHeader>
              <CardBody className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Items</span><span className="font-semibold">{purchItems.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Supplier</span><span className="font-semibold">{suppList.find((s: any) => s.id === supplierId)?.name ?? '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Order Date</span><span className="font-semibold">{orderDate}</span></div>
                <div className="border-t border-gray-200 dark:border-gray-800 pt-3 flex justify-between text-base font-black">
                  <span>Total</span><span className="text-emerald-600">{fmt.kd(subtotal)}</span>
                </div>
                <div className="space-y-2 pt-2">
                  <Btn variant="primary" className="w-full" loading={createMut.isPending} disabled={purchItems.length === 0}
                    onClick={() => createMut.mutate()} icon={<CheckCircle2 size={15} />}>
                    Create Purchase Order
                  </Btn>
                  <Btn className="w-full" onClick={() => setTab('list')}>Cancel</Btn>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* ── VIEW PURCHASE MODAL ── */}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title={`Purchase — ${(viewPurchase as any)?.docNumber ?? ''}`} size="lg">
        {viewPurchase && (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
              {[['Supplier', (viewPurchase as any).supplier?.name ?? '—'], ['Order Date', fmt.date((viewPurchase as any).orderDate)], ['Status', (viewPurchase as any).status], ['Total', fmt.kd((viewPurchase as any).totalAmount)]].map(([l, v]) => (
                <div key={l} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3"><p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{l}</p><p className="font-bold text-gray-900 dark:text-white">{v}</p></div>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800">{['Product','Ordered','Received','Unit','Cost','Total','Expiry'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 dark:bg-gray-800/50">{h}</th>)}</tr></thead>
              <tbody>
                {(viewPurchase as any).items?.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2.5"><p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{item.product?.name}</p><p className="text-[10px] text-gray-400">{item.product?.sku}</p></td>
                    <td className="px-3 py-2.5 font-mono text-sm font-bold">{Number(item.orderedQty).toFixed(0)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm text-emerald-600 font-bold">{Number(item.receivedQty).toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{item.unit?.abbreviation}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{fmt.kd(item.costPerUnit)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm font-bold text-emerald-600">{fmt.kd(item.lineTotal)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{item.expiryDate ? fmt.date(item.expiryDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ── RECEIVE STOCK MODAL ── */}
      <Modal open={!!receiveId} onClose={() => { setReceiveId(null); setReceiveItems([]); }} title="Receive Stock" size="lg">
        <div className="p-6 space-y-4">
          <Alert type="info" message="Verify quantities received, enter batch/expiry details, then confirm to update inventory." />
          {receiveItems.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800">{['Product','Ordered','Receive Qty','Batch#','Expiry Date'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 dark:bg-gray-800/50">{h}</th>)}</tr></thead>
              <tbody>
                {receiveItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2.5"><p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{item.product?.name}</p></td>
                    <td className="px-3 py-2.5 font-mono text-sm text-gray-500">{Number(item.orderedQty).toFixed(0)}</td>
                    <td className="px-3 py-2.5 w-24">
                      <input type="number" value={item.receivedQty} min="0" step="0.01"
                        onChange={e => setReceiveItems(prev => prev.map((r, i) => i === idx ? { ...r, receivedQty: e.target.value } : r))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-center text-sm focus:border-emerald-500 outline-none" />
                    </td>
                    <td className="px-3 py-2.5 w-28">
                      <input type="text" value={item.batchNumber ?? ''} placeholder="Batch#"
                        onChange={e => setReceiveItems(prev => prev.map((r, i) => i === idx ? { ...r, batchNumber: e.target.value } : r))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:border-emerald-500 outline-none" />
                    </td>
                    <td className="px-3 py-2.5 w-36">
                      <input type="date" value={item.expiryDate ?? ''}
                        onChange={e => setReceiveItems(prev => prev.map((r, i) => i === idx ? { ...r, expiryDate: e.target.value } : r))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:border-emerald-500 outline-none" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-gray-400 text-center py-8">No items to receive</p>}
          <div className="flex gap-3">
            <Btn onClick={() => { setReceiveId(null); setReceiveItems([]); }} className="flex-1">Cancel</Btn>
            <Btn variant="primary" loading={receiveMut.isPending} onClick={() => receiveMut.mutate()} className="flex-1" icon={<CheckCircle2 size={15} />}>
              Confirm Receipt & Update Stock
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
