'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  PageHeader, Card, Badge, Btn, Input, Select,
  Modal, SearchInput, Pagination,
} from '../../../components/ui';
import { Truck, Plus, Eye, MessageCircle, Phone, CheckCircle2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

export default function VendorDeskPage() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [addModal, setAddModal] = useState(false);
  const [viewId,   setViewId]   = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', search, page],
    queryFn:  () => suppliersApi.list({ search, page, perPage: 25 }),
    placeholderData: (prev) => prev,
  });

  const { data: viewSupplier } = useQuery({
    queryKey: ['supplier', viewId],
    queryFn:  () => viewId ? suppliersApi.get(viewId) : null,
    enabled:  !!viewId,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => suppliersApi.create(data),
    onSuccess:  () => { toast.success('Supplier added'); setAddModal(false); reset(); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
    onError:    (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  });

  const sd  = suppliers    as any;
  const vs  = viewSupplier as any;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="Vendor Desk" subtitle="Supplier management, contacts, and purchase history"
        actions={
          <div className="flex gap-2">
            <Btn icon={<Download size={15} />} onClick={() => toast.success('Exported')}>Export</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setAddModal(true)}>Add Supplier</Btn>
          </div>
        }
      />

      <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search supplier name, phone…" className="w-72" />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Supplier','Contact','Phone / WhatsApp','Email','Credit Days','Balance','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 shimmer rounded" /></td>)}</tr>)
                : (sd?.items ?? []).map((s: any) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {s.name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{s.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{s.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{s.contactName ?? '—'}</td>
                      <td className="px-4 py-3">
                        {s.phone    && <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{s.phone}</p>}
                        {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"><MessageCircle size={10}/>{s.whatsapp}</a>}
                      </td>
                      <td className="px-4 py-3 text-xs text-blue-600">{s.email ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-center font-semibold">{s.creditDays ?? 0} days</td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-amber-600">{fmt.kd(s.balance)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setViewId(s.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600"><Eye size={14} /></button>
                          {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-400 hover:text-emerald-600"><MessageCircle size={14} /></a>}
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

      {/* Add Supplier */}
      <Modal open={addModal} onClose={() => { setAddModal(false); reset(); }} title="Add Supplier" size="md">
        <form onSubmit={handleSubmit(data => createMut.mutate(data))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Supplier Name *" {...register('name', { required: true })} error={errors.name ? 'Required' : ''} placeholder="Supplier company name" />
            <Input label="Contact Person"  {...register('contactName')} placeholder="Contact name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone"     {...register('phone')}    placeholder="+965 XXXX XXXX" />
            <Input label="WhatsApp"  {...register('whatsapp')} placeholder="+965 XXXX XXXX" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email"      {...register('email')} type="email" placeholder="orders@supplier.com" />
            <Input label="Tax Number" {...register('taxNumber')} placeholder="VAT/Tax registration" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Credit Days" {...register('creditDays')} type="number" placeholder="0" />
            <Input label="Address"     {...register('address')}    placeholder="Supplier address" />
          </div>
          <Input label="Notes" {...register('notes')} placeholder="Any notes about this supplier" />
          <div className="flex gap-3 pt-2">
            <Btn type="button" onClick={() => { setAddModal(false); reset(); }} className="flex-1">Cancel</Btn>
            <Btn type="submit" variant="primary" loading={createMut.isPending} className="flex-1" icon={<CheckCircle2 size={15} />}>Add Supplier</Btn>
          </div>
        </form>
      </Modal>

      {/* View Supplier */}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title={vs?.name ?? 'Supplier'} size="lg">
        {vs && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                ['Code',        vs.code],
                ['Contact',     vs.contactName ?? '—'],
                ['Phone',       vs.phone       ?? '—'],
                ['WhatsApp',    vs.whatsapp    ?? '—'],
                ['Email',       vs.email       ?? '—'],
                ['Tax Number',  vs.taxNumber   ?? '—'],
                ['Credit Days', `${vs.creditDays ?? 0} days`],
                ['Balance Due', fmt.kd(vs.balance)],
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">{l}</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{v}</p>
                </div>
              ))}
            </div>
            {vs.notes && <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">{vs.notes}</p>}
            <div className="flex justify-end gap-3">
              <Btn onClick={() => setViewId(null)}>Close</Btn>
              {vs.whatsapp && <a href={`https://wa.me/${vs.whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"><Btn variant="primary" icon={<MessageCircle size={14} />}>WhatsApp</Btn></a>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
