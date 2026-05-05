'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import { PageHeader, Card, CardHeader, CardBody, Badge, Btn, Input, Modal, Alert } from '../../../components/ui';
import { DollarSign, Clock, CheckCircle2, AlertTriangle, ArrowUp, ArrowDown, Printer, BarChart3, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CashRoomPage() {
  const qc = useQueryClient();
  const [openModal,  setOpenModal]  = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [cashModal,  setCashModal]  = useState(false);
  const [cashType,   setCashType]   = useState<'IN' | 'OUT'>('IN');
  const [openAmt,    setOpenAmt]    = useState('');
  const [closeAmt,   setCloseAmt]   = useState('');
  const [cashAmt,    setCashAmt]    = useState('');
  const [cashReason, setCashReason] = useState('');

  const { data: shift, isLoading } = useQuery({
    queryKey: ['active-shift'],
    queryFn:  () => shiftsApi.active().catch(() => null),
    refetchInterval: 30_000,
  });

  const { data: shiftHistory } = useQuery({
    queryKey: ['shift-history'],
    queryFn:  () => shiftsApi.list({ status: 'CLOSED', perPage: 10 }),
  });

  const s = shift as any;

  const openMut = useMutation({
    mutationFn: () => shiftsApi.open({ openingCash: Number(openAmt) }),
    onSuccess: () => { toast.success('Shift opened'); setOpenModal(false); setOpenAmt(''); qc.invalidateQueries({ queryKey: ['active-shift'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to open shift'),
  });

  const closeMut = useMutation({
    mutationFn: () => shiftsApi.close(s?.id, { closingCash: Number(closeAmt) }),
    onSuccess: () => { toast.success('Shift closed successfully'); setCloseModal(false); qc.invalidateQueries({ queryKey: ['active-shift'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to close shift'),
  });

  const cashMut = useMutation({
    mutationFn: () => shiftsApi.cashMovement(s?.id, { type: cashType, amount: Number(cashAmt), reason: cashReason }),
    onSuccess: () => { toast.success(`Cash ${cashType} recorded`); setCashModal(false); setCashAmt(''); setCashReason(''); qc.invalidateQueries({ queryKey: ['active-shift'] }); },
  });

  const expectedCash = s ? Number(s.openingCash) + Number(s.totalCash) - (s.cashMovements?.filter((m: any) => m.type === 'OUT').reduce((s: number, m: any) => s + Number(m.amount), 0) ?? 0) : 0;
  const variance = s ? Number(closeAmt || 0) - expectedCash : 0;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <PageHeader title="Cash Room" subtitle="Manage cashier shifts, opening/closing balances, and cash movements" />

      {/* No active shift */}
      {!isLoading && !s && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-5">
            <Clock size={36} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Active Shift</h2>
          <p className="text-gray-500 mb-6">Open a shift to start accepting sales</p>
          <Btn variant="primary" size="lg" icon={<DollarSign size={18} />} onClick={() => setOpenModal(true)}>Open Shift</Btn>
        </div>
      )}

      {/* Active shift dashboard */}
      {s && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-400">Shift Active — {s.docNumber}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Opened: {fmt.datetime(s.openedAt)} · Cashier: {s.cashier?.firstName} {s.cashier?.lastName}</p>
            </div>
            <div className="flex gap-2">
              <Btn size="sm" icon={<ArrowUp size={13} />}   onClick={() => { setCashType('IN');  setCashModal(true); }}>Cash In</Btn>
              <Btn size="sm" icon={<ArrowDown size={13} />} onClick={() => { setCashType('OUT'); setCashModal(true); }}>Cash Out</Btn>
              <Btn size="sm" icon={<Printer size={13} />}   onClick={() => window.print()}>Print Report</Btn>
              <Btn variant="danger" size="sm" onClick={() => setCloseModal(true)}>Close Shift</Btn>
            </div>
          </div>

          {/* Shift Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales',      value: fmt.kd(s.totalSales),   color: 'text-emerald-600', icon: <BarChart3 size={20} />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Cash Sales',       value: fmt.kd(s.totalCash),    color: 'text-blue-600',    icon: <DollarSign size={20} />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Card / KNET',      value: fmt.kd(Number(s.totalCard) + Number(s.totalKnet)), color: 'text-purple-600', icon: <Wallet size={20} />, bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { label: 'Returns',          value: fmt.kd(s.totalReturns), color: 'text-red-600',     icon: <AlertTriangle size={20} />, bg: 'bg-red-50 dark:bg-red-900/20' },
            ].map(stat => (
              <Card key={stat.label}>
                <CardBody className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>{stat.icon}</div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{stat.label}</p>
                    <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* Payment breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Payment Breakdown</h3></CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {[
                    { label: 'Cash',         value: Number(s.totalCash),   color: 'bg-emerald-500' },
                    { label: 'KNET',          value: Number(s.totalKnet),   color: 'bg-blue-500' },
                    { label: 'Card',          value: Number(s.totalCard),   color: 'bg-purple-500' },
                    { label: 'Credit',        value: Number(s.totalCredit), color: 'bg-amber-500' },
                  ].map(p => {
                    const total = Number(s.totalSales) || 1;
                    const pct   = (p.value / total * 100).toFixed(0);
                    return (
                      <div key={p.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">{p.label}</span>
                          <span className="font-bold text-gray-900 dark:text-white">{fmt.kd(p.value)} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Cash Position</h3></CardHeader>
              <CardBody>
                <div className="space-y-3 text-sm">
                  {[
                    ['Opening Float', fmt.kd(s.openingCash), ''],
                    ['+ Cash Sales',  fmt.kd(s.totalCash),   'text-emerald-600'],
                    ['− Returns',     fmt.kd(s.totalReturns),'text-red-500'],
                    ['Expected Cash', fmt.kd(expectedCash),  'font-black text-gray-900 dark:text-white'],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className={`flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0 ${cls as string}`}>
                      <span className={`${cls ? '' : 'text-gray-600 dark:text-gray-400'}`}>{label as string}</span>
                      <span className="font-mono">{value as string}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Recent cash movements */}
          {s.cashMovements?.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Cash Movements</h3></CardHeader>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {s.cashMovements.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {m.type === 'IN' ? '+' : '−'}
                    </div>
                    <div className="flex-1"><p className="font-medium text-gray-800 dark:text-gray-200">{m.reason}</p></div>
                    <div className={`font-black ${m.type === 'IN' ? 'text-emerald-600' : 'text-red-500'}`}>{m.type === 'IN' ? '+' : '−'}{fmt.kd(m.amount)}</div>
                    <div className="text-xs text-gray-400">{fmt.datetime(m.createdAt)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Open Shift Modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Open New Shift" size="sm">
        <div className="p-6 space-y-5">
          <Alert type="info" message="Count the cash in the till and enter the opening float amount." />
          <Input label="Opening Cash (KD)" type="number" value={openAmt} onChange={e => setOpenAmt(e.target.value)} placeholder="0.000" step="0.001" icon={<DollarSign size={14} />} />
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Opening Float</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt.kd(Number(openAmt || 0))}</p>
          </div>
          <div className="flex gap-3">
            <Btn onClick={() => setOpenModal(false)} className="flex-1">Cancel</Btn>
            <Btn variant="primary" loading={openMut.isPending} onClick={() => openMut.mutate()} className="flex-1" icon={<CheckCircle2 size={15} />}>Open Shift</Btn>
          </div>
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Close Shift" size="sm">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Expected Cash</p><p className="text-lg font-black text-gray-900 dark:text-white">{fmt.kd(expectedCash)}</p></div>
            <div className={`rounded-xl p-3 text-center ${Math.abs(variance) < 1 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}><p className="text-xs text-gray-500">Variance</p><p className={`text-lg font-black ${Math.abs(variance) < 1 ? 'text-emerald-600' : 'text-amber-600'}`}>{variance >= 0 ? '+' : ''}{fmt.kd(variance)}</p></div>
          </div>
          <Input label="Actual Cash in Till (KD)" type="number" value={closeAmt} onChange={e => setCloseAmt(e.target.value)} placeholder="0.000" step="0.001" />
          {Math.abs(variance) > 5 && <Alert type="warning" title="Cash Variance Detected" message={`Variance of ${fmt.kd(Math.abs(variance))} — please verify count before closing.`} />}
          <div className="flex gap-3">
            <Btn onClick={() => setCloseModal(false)} className="flex-1">Cancel</Btn>
            <Btn variant="danger" loading={closeMut.isPending} onClick={() => closeMut.mutate()} className="flex-1">Close Shift</Btn>
          </div>
        </div>
      </Modal>

      {/* Cash Movement Modal */}
      <Modal open={cashModal} onClose={() => setCashModal(false)} title={`Cash ${cashType}`} size="sm">
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setCashType('IN')}  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${cashType === 'IN'  ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}><ArrowUp size={14} /> Cash In</button>
            <button onClick={() => setCashType('OUT')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${cashType === 'OUT' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}><ArrowDown size={14} /> Cash Out</button>
          </div>
          <Input label="Amount (KD)" type="number" value={cashAmt} onChange={e => setCashAmt(e.target.value)} placeholder="0.000" step="0.001" />
          <Input label="Reason" value={cashReason} onChange={e => setCashReason(e.target.value)} placeholder="e.g. Petty cash for supplies" />
          <div className="flex gap-3">
            <Btn onClick={() => setCashModal(false)} className="flex-1">Cancel</Btn>
            <Btn variant={cashType === 'IN' ? 'primary' : 'danger'} loading={cashMut.isPending} onClick={() => cashMut.mutate()} className="flex-1" disabled={!cashAmt || !cashReason}>Record</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
