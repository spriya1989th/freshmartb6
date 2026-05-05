'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  PageHeader, Card, Badge, Btn, Input, Select, Modal, Alert,
  SearchInput, Pagination, StatCard,
} from '../../../components/ui';
import {
  Users, Plus, Eye, Edit2, CreditCard, MessageCircle, X, CheckCircle2,
  Download, TrendingUp, AlertTriangle, Phone, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

type CustTab = 'all' | 'credit';

export default function ClientDeskPage() {
  const qc = useQueryClient();
  const [tab,      setTab]      = useState<CustTab>('all');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [addModal, setAddModal] = useState(false);
  const [viewId,   setViewId]   = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ customerId: string; name: string } | null>(null);
  const [payAmt,   setPayAmt]   = useState('');
  const [payMethod,setPayMethod]= useState('CASH');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search, page, tab],
    queryFn:  () => customersApi.list({
      search, page, perPage: 25,
      customerType: tab === 'credit' ? 'CREDIT' : undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const { data: viewCustomer } = useQuery({
    queryKey: ['customer', viewId],
    queryFn:  () => viewId ? customersApi.get(viewId) : null,
    enabled:  !!viewId,
  });

  const { data: customerLedger } = useQuery({
    queryKey: ['customer-ledger', viewId],
    queryFn:  () => viewId ? customersApi.ledger(viewId, { period: 'this_year' }) : null,
    enabled:  !!viewId,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => customersApi.create(data),
    onSuccess:  () => { toast.success('Customer added'); setAddModal(false); reset(); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Failed to add customer'),
  });

  const payMut = useMutation({
    mutationFn: () => customersApi.recordPayment(payModal!.customerId, { amount: Number(payAmt), method: payMethod }),
    onSuccess:  () => {
      toast.success(`Payment of ${fmt.kd(Number(payAmt))} recorded`);
      setPayModal(null); setPayAmt('');
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', payModal?.customerId] });
    },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Payment failed'),
  });

  const cd = customers as any;
  const vc = viewCustomer as any;
  const ledger = customerLedger as any;

  const typeBadge = (t: string) => ({
    WALKIN:   <Badge variant="gray">Walk-in</Badge>,
    REGULAR:  <Badge variant="info">Regular</Badge>,
    CREDIT:   <Badge variant="purple">Credit</Badge>,
    WHOLESALE:<Badge variant="warning">Wholesale</Badge>,
    DELIVERY: <Badge variant="success">Delivery</Badge>,
  }[t] ?? <Badge>{t}</Badge>);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="Client Desk" subtitle="Customer management, credit accounts, and purchase history"
        actions={
          <div className="flex gap-2">
            <Btn icon={<Download size={15} />} onClick={() => toast.success('Exported')}>Export</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setAddModal(true)}>Add Customer</Btn>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {[{ k: 'all', label: 'All Customers' }, { k: 'credit', label: '💳 Credit Accounts' }].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k as CustTab); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === t.k ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, phone, WhatsApp…" className="w-72" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Customer','Type','Phone / WhatsApp','Orders','Spent','Credit Limit','Outstanding','Points','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded" /></td>)}</tr>)
                : (cd?.items ?? []).map((c: any) => {
                    const creditUsed  = Number(c.creditBalance ?? 0);
                    const creditLimit = Number(c.creditLimit   ?? 0);
                    const creditPct   = creditLimit > 0 ? (creditUsed / creditLimit * 100) : 0;
                    return (
                      <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${c.customerType === 'CREDIT' ? 'bg-purple-500' : 'bg-emerald-500'}`}>
                              {c.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">{c.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{c.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{typeBadge(c.customerType)}</td>
                        <td className="px-4 py-3">
                          <div>
                            {c.phone    && <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{c.phone}</p>}
                            {c.whatsapp && (
                              <a href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
                                className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5 mt-0.5">
                                <MessageCircle size={10} /> {c.whatsapp}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{c._count?.sales ?? c.salesCount ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-600">{fmt.kd(c.totalSpent ?? 0)}</td>
                        <td className="px-4 py-3">
                          {creditLimit > 0 ? (
                            <div>
                              <p className="font-mono text-xs font-semibold">{fmt.kd(creditLimit)}</p>
                              <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full rounded-full ${creditPct > 80 ? 'bg-red-500' : creditPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, creditPct)}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {creditUsed > 0 ? (
                            <span className="font-mono text-sm font-black text-red-600">{fmt.kd(creditUsed)}</span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="purple">⭐ {c.loyaltyPoints ?? 0}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewId(c.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600" title="View"><Eye size={14} /></button>
                            {creditLimit > 0 && (
                              <button onClick={() => setPayModal({ customerId: c.id, name: c.name })}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 hover:bg-purple-100 transition-colors">
                                Pay
                              </button>
                            )}
                            {c.whatsapp && (
                              <a href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
                                className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-400 hover:text-emerald-600" title="WhatsApp">
                                <MessageCircle size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={cd?.totalPages ?? 1} total={cd?.total ?? 0} perPage={25} onPage={setPage} />
      </Card>

      {/* ── ADD CUSTOMER MODAL ── */}
      <Modal open={addModal} onClose={() => { setAddModal(false); reset(); }} title="Add New Customer" size="md">
        <form onSubmit={handleSubmit(data => createMut.mutate(data))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name *"    {...register('name',     { required: true })} error={errors.name     ? 'Required' : ''} placeholder="Customer name" />
            <Input label="Phone"          {...register('phone')}                         placeholder="+965 XXXX XXXX" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="WhatsApp"       {...register('whatsapp')}                      placeholder="+965 XXXX XXXX" />
            <Input label="Email"          {...register('email')}    type="email"         placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Customer Type" {...register('customerType')} options={[
              { value: 'WALKIN', label: 'Walk-in' }, { value: 'REGULAR', label: 'Regular' },
              { value: 'CREDIT', label: 'Credit' }, { value: 'WHOLESALE', label: 'Wholesale' },
              { value: 'DELIVERY', label: 'Delivery' },
            ]} />
            <Input label="Credit Limit (KD)" {...register('creditLimit')} type="number" step="0.001" placeholder="0.000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="City"   {...register('city')}    placeholder="e.g. Salmiya" />
            <Input label="Address"  {...register('address')} placeholder="Full address" />
          </div>
          <Input label="Notes"    {...register('notes')}   placeholder="Any notes about this customer" />
          <div className="flex gap-3 pt-2">
            <Btn type="button" onClick={() => { setAddModal(false); reset(); }} className="flex-1">Cancel</Btn>
            <Btn type="submit" variant="primary" loading={createMut.isPending} className="flex-1" icon={<CheckCircle2 size={15} />}>Add Customer</Btn>
          </div>
        </form>
      </Modal>

      {/* ── RECORD PAYMENT MODAL ── */}
      <Modal open={!!payModal} onClose={() => { setPayModal(null); setPayAmt(''); }} title={`Record Payment — ${payModal?.name}`} size="sm">
        <div className="p-6 space-y-4">
          <Alert type="info" message="Record a credit payment from the customer. This will reduce their outstanding balance." />
          <Input label="Payment Amount (KD)" type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} step="0.001" placeholder="0.000" icon={<DollarSign size={14} />} />
          <Select label="Payment Method" value={payMethod} onChange={e => setPayMethod(e.target.value)}
            options={[{ value: 'CASH', label: 'Cash' }, { value: 'KNET', label: 'KNET' }, { value: 'CARD', label: 'Card' }, { value: 'BANK_TRANSFER', label: 'Bank Transfer' }]} />
          <div className="flex gap-3">
            <Btn onClick={() => { setPayModal(null); setPayAmt(''); }} className="flex-1">Cancel</Btn>
            <Btn variant="primary" loading={payMut.isPending} onClick={() => payMut.mutate()} disabled={!payAmt || Number(payAmt) <= 0} className="flex-1">Record Payment</Btn>
          </div>
        </div>
      </Modal>

      {/* ── CUSTOMER DETAIL MODAL ── */}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title={vc?.name ?? 'Customer'} size="xl">
        {vc && (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex gap-5 items-start">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black flex-shrink-0 ${vc.customerType === 'CREDIT' ? 'bg-purple-500' : 'bg-emerald-500'}`}>
                {vc.name[0]}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-gray-900 dark:text-white">{vc.name}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {typeBadge(vc.customerType)}
                  <span className="font-mono text-xs text-gray-400">{vc.code}</span>
                  {vc.phone    && <a href={`tel:${vc.phone}`}    className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Phone size={11}/>{vc.phone}</a>}
                  {vc.whatsapp && <a href={`https://wa.me/${vc.whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline flex items-center gap-1"><MessageCircle size={11}/>{vc.whatsapp}</a>}
                </div>
              </div>
              {vc.customerType === 'CREDIT' && (
                <Btn variant="outline" size="sm" icon={<CreditCard size={13}/>} onClick={() => { setViewId(null); setPayModal({ customerId: vc.id, name: vc.name }); }}>Record Payment</Btn>
              )}
            </div>

            {/* Credit summary */}
            {vc.customerType === 'CREDIT' && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Credit Limit',  value: fmt.kd(vc.creditLimit),                                   color: 'text-gray-900 dark:text-white' },
                  { label: 'Outstanding',   value: fmt.kd(vc.creditBalance),                                  color: 'text-red-600'   },
                  { label: 'Available',     value: fmt.kd(Number(vc.creditLimit) - Number(vc.creditBalance)), color: 'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">{s.label}</p>
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Credit ledger */}
            {vc.customerType === 'CREDIT' && (
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Credit Ledger</h3>
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-gray-200 dark:border-gray-800">{['Date','Description','Debit (DR)','Credit (CR)','Balance'].map(h => <th key={h} className="text-left font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 dark:bg-gray-800/50">{h}</th>)}</tr></thead>
                    <tbody>
                      {(ledger?.entries ?? []).slice(0, 10).map((e: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-gray-400">{fmt.date(e.createdAt)}</td>
                          <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{e.description}</td>
                          <td className="px-3 py-2 font-mono text-red-600">{Number(e.debit) > 0 ? fmt.kd(e.debit) : '—'}</td>
                          <td className="px-3 py-2 font-mono text-emerald-600">{Number(e.credit) > 0 ? fmt.kd(e.credit) : '—'}</td>
                          <td className="px-3 py-2 font-mono font-bold">{fmt.kd(e.balance)}</td>
                        </tr>
                      ))}
                      {(ledger?.entries ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No credit transactions</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Btn onClick={() => setViewId(null)}>Close</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
