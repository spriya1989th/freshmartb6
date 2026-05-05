'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  PageHeader, Card, Badge, Btn, Select, Modal, Alert, SearchInput, Pagination, Confirm,
} from '../../../components/ui';
import { Eye, RotateCcw, XCircle, Download, Printer, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RETURN_REASONS = [
  { value: 'DAMAGED',             label: 'Damaged goods'      },
  { value: 'EXPIRED',             label: 'Expired product'    },
  { value: 'CUSTOMER_RETURN',     label: 'Customer return'    },
  { value: 'WRONG_ITEM',          label: 'Wrong item supplied'},
  { value: 'PRICING_ERROR',       label: 'Pricing error'      },
  { value: 'INTERNAL_ADJUSTMENT', label: 'Internal adjustment'},
];

export default function AllSalesPage() {
  const qc = useQueryClient();
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [period,      setPeriod]      = useState('');
  const [viewId,      setViewId]      = useState<string | null>(null);
  const [voidId,      setVoidId]      = useState<string | null>(null);
  const [voidReason,  setVoidReason]  = useState('');
  const [returnModal, setReturnModal] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnReason,setReturnReason]= useState('CUSTOMER_RETURN');

  const { data: sales, isLoading } = useQuery({
    queryKey: ['all-sales', page, search, status, period],
    queryFn:  () => salesApi.list({ page, perPage: 25, search, status: status || undefined, period: period || undefined }),
    placeholderData: (prev) => prev,
  });

  const { data: viewSale } = useQuery({
    queryKey: ['sale-detail', viewId],
    queryFn:  () => viewId ? salesApi.get(viewId) : null,
    enabled:  !!viewId,
  });

  const voidMut = useMutation({
    mutationFn: () => salesApi.void(voidId!, voidReason),
    onSuccess: () => { toast.success('Sale voided'); setVoidId(null); setVoidReason(''); qc.invalidateQueries({ queryKey: ['all-sales'] }); },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Void failed'),
  });

  const returnMut = useMutation({
    mutationFn: () => salesApi.return(returnModal!, {
      items: returnItems.filter(i => Number(i.returnQty) > 0).map(i => ({
        productId: i.productId, quantity: Number(i.returnQty), reason: returnReason,
      })),
    }),
    onSuccess: (data: any) => {
      toast.success(`Return ${data.docNumber} processed — ${fmt.kd(data.totalAmount)} refunded`);
      setReturnModal(null); setReturnItems([]);
      qc.invalidateQueries({ queryKey: ['all-sales'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Return failed'),
  });

  function openReturnModal(id: string) {
    const sale = (sales as any)?.items?.find((s: any) => s.id === id);
    if (!sale) return;
    setReturnModal(id);
    // Fetch items when needed
  }

  const sd  = sales    as any;
  const vs  = viewSale as any;

  const statusBadge = (s: string) => ({
    COMPLETED:       <Badge variant="success">Completed</Badge>,
    VOIDED:          <Badge variant="danger">Voided</Badge>,
    RETURNED:        <Badge variant="warning">Returned</Badge>,
    PARTIAL_RETURNED:<Badge variant="warning">Part-Returned</Badge>,
    DRAFT:           <Badge variant="gray">Draft</Badge>,
  }[s] ?? <Badge>{s}</Badge>);

  const payBadge = (m: string) => ({
    CASH:   <Badge variant="info">Cash</Badge>,
    KNET:   <Badge variant="purple">KNET</Badge>,
    CARD:   <Badge variant="blue" className="bg-blue-100 text-blue-700">Card</Badge>,
    CREDIT: <Badge variant="warning">Credit</Badge>,
    SPLIT:  <Badge variant="gray">Split</Badge>,
  }[m] ?? <Badge>{m}</Badge>);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="All Sales" subtitle="Complete sales history with void and return capabilities"
        actions={<Btn icon={<Download size={15} />} onClick={() => toast.success('Exported')}>Export</Btn>}
      />

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Invoice #, customer name…" className="w-72" />
        <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'All Status' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'VOIDED', label: 'Voided' }, { value: 'RETURNED', label: 'Returned' }, { value: 'PARTIAL_RETURNED', label: 'Part-Returned' }]}
          className="w-40" />
        <Select value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'All Time' }, { value: 'today', label: 'Today' }, { value: 'this_week', label: 'This Week' }, { value: 'this_month', label: 'This Month' }]}
          className="w-36" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Invoice #','Date/Time','Customer','Type','Items','Total','Payment','Status','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded" /></td>)}</tr>)
                : (sd?.items ?? []).map((s: any) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">{s.docNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt.datetime(s.saleDate)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-800 dark:text-gray-200">{s.customer?.name ?? 'Walk-in'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{s.customerType?.toLowerCase().replace('_', '-')}</td>
                      <td className="px-4 py-3 text-xs text-center font-semibold">{s._count?.items ?? '—'}</td>
                      <td className="px-4 py-3 font-mono font-black text-sm text-emerald-600 whitespace-nowrap">{fmt.kd(s.totalAmount)}</td>
                      <td className="px-4 py-3">{payBadge(s.paymentMethod)}</td>
                      <td className="px-4 py-3">{statusBadge(s.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewId(s.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600" title="View invoice"><Eye size={14} /></button>
                          {s.status === 'COMPLETED' && (
                            <>
                              <button onClick={() => { setReturnModal(s.id); }} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 hover:text-amber-600" title="Process return"><RotateCcw size={14} /></button>
                              <button onClick={() => setVoidId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600" title="Void sale"><XCircle size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={sd?.totalPages ?? 1} total={sd?.total ?? 0} perPage={25} onPage={setPage} />
      </Card>

      {/* View Invoice Modal */}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title={`Invoice — ${vs?.docNumber ?? ''}`} size="lg">
        {vs && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[['Customer', vs.customer?.name ?? 'Walk-in'], ['Date', fmt.datetime(vs.saleDate)], ['Cashier', `${vs.createdBy?.firstName} ${vs.createdBy?.lastName}`], ['Payment', vs.paymentMethod]].map(([l, v]) => (
                <div key={l} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3"><p className="text-xs text-gray-500 uppercase mb-1">{l}</p><p className="font-bold text-gray-900 dark:text-white">{v}</p></div>
              ))}
            </div>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-200 dark:border-gray-800">{['Product','Qty','Unit Price','Discount','Line Total'].map(h => <th key={h} className="text-left font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 dark:bg-gray-800/50">{h}</th>)}</tr></thead>
                <tbody>
                  {vs.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2.5"><p className="font-semibold text-gray-800 dark:text-gray-200">{item.product?.name}</p><p className="text-gray-400 font-mono">{item.product?.sku}</p></td>
                      <td className="px-3 py-2.5 font-mono font-bold">{Number(item.quantity).toFixed(0)} {item.unit?.abbreviation}</td>
                      <td className="px-3 py-2.5 font-mono">{fmt.kd(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 font-mono text-red-500">{Number(item.discountAmount) > 0 ? `-${fmt.kd(item.discountAmount)}` : '—'}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-600">{fmt.kd(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex justify-between w-48"><span className="text-gray-500">Subtotal</span><span className="font-mono">{fmt.kd(vs.subtotal)}</span></div>
              {Number(vs.discountAmount) > 0 && <div className="flex justify-between w-48 text-red-500"><span>Discount</span><span className="font-mono">−{fmt.kd(vs.discountAmount)}</span></div>}
              {Number(vs.taxAmount) > 0 && <div className="flex justify-between w-48"><span className="text-gray-500">Tax</span><span className="font-mono">{fmt.kd(vs.taxAmount)}</span></div>}
              <div className="flex justify-between w-48 text-base font-black border-t border-gray-200 dark:border-gray-800 pt-2 mt-1"><span>Total</span><span className="text-emerald-600">{fmt.kd(vs.totalAmount)}</span></div>
              <div className="flex justify-between w-48"><span className="text-gray-500">Paid</span><span className="font-mono">{fmt.kd(vs.paidAmount)}</span></div>
              {Number(vs.changeAmount) > 0 && <div className="flex justify-between w-48 text-blue-600"><span>Change</span><span className="font-mono">{fmt.kd(vs.changeAmount)}</span></div>}
            </div>
            <div className="flex justify-end gap-3">
              <Btn onClick={() => setViewId(null)}>Close</Btn>
              <Btn icon={<Printer size={14} />} onClick={() => window.print()}>Print Receipt</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Void Modal */}
      <Modal open={!!voidId} onClose={() => { setVoidId(null); setVoidReason(''); }} title="Void Sale" size="sm">
        <div className="p-6 space-y-4">
          <Alert type="danger" title="Warning" message="Voiding a sale will reverse all stock deductions. This action is audited and cannot be undone." />
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Reason for Void *</label>
            <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" placeholder="Explain why this sale is being voided…" />
          </div>
          <div className="flex gap-3">
            <Btn onClick={() => { setVoidId(null); setVoidReason(''); }} className="flex-1">Cancel</Btn>
            <Btn variant="danger" loading={voidMut.isPending} disabled={!voidReason.trim()} onClick={() => voidMut.mutate()} className="flex-1" icon={<XCircle size={14} />}>Void Sale</Btn>
          </div>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal open={!!returnModal} onClose={() => { setReturnModal(null); setReturnItems([]); }} title="Process Return" size="md">
        <div className="p-6 space-y-4">
          <Alert type="info" message="Stock will be re-added to inventory when the return is confirmed." />
          <Select label="Return Reason" value={returnReason} onChange={e => setReturnReason(e.target.value)} options={RETURN_REASONS} />
          {returnItems.length > 0 ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800">{['Product','Sold','Return Qty'].map(h => <th key={h} className="text-left font-semibold text-gray-500 uppercase px-3 py-2 bg-gray-50 dark:bg-gray-800/50">{h}</th>)}</tr></thead>
              <tbody>
                {returnItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{item.name}</td>
                    <td className="px-3 py-2.5 font-mono">{item.quantity}</td>
                    <td className="px-3 py-2.5 w-20">
                      <input type="number" value={item.returnQty ?? 0} min="0" max={item.quantity} step="1"
                        onChange={e => setReturnItems(prev => prev.map((r, i) => i === idx ? { ...r, returnQty: e.target.value } : r))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center font-mono text-sm focus:border-emerald-500 outline-none" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Alert type="warning" message="Select the invoice first to load its items." />
          )}
          <div className="flex gap-3">
            <Btn onClick={() => { setReturnModal(null); setReturnItems([]); }} className="flex-1">Cancel</Btn>
            <Btn variant="warning" loading={returnMut.isPending} onClick={() => returnMut.mutate()}
              disabled={returnItems.filter(i => Number(i.returnQty) > 0).length === 0} className="flex-1" icon={<CheckCircle2 size={14} />}>
              Process Return
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
