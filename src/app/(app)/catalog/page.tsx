'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, catalogApi } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import {
  PageHeader, Card, Badge, Btn, SearchInput, Select, Confirm, Modal, DataTable, Pagination, Alert,
} from '../../../components/ui';
import { Plus, Upload, Download, Eye, Edit2, Trash2, Copy, Barcode, Tag, Image as ImageIcon, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CatalogPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const [search,    setSearch]    = useState('');
  const [category,  setCategory]  = useState('');
  const [brand,     setBrand]     = useState('');
  const [status,    setStatus]    = useState('ACTIVE');
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState<string[]>([]);
  const [delId,     setDelId]     = useState<string | null>(null);
  const [bulkDel,   setBulkDel]   = useState(false);
  const [viewId,    setViewId]    = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search, category, brand, status, page],
    queryFn:  () => productsApi.list({ search, categoryId: category, brandId: brand, status: status || undefined, page, perPage: 25 }),
    placeholderData: (prev) => prev,
  });
  const { data: cats }   = useQuery({ queryKey: ['categories'], queryFn: () => catalogApi.categories.list() });
  const { data: brands } = useQuery({ queryKey: ['brands'],     queryFn: () => catalogApi.brands.list() });
  const { data: viewProduct } = useQuery({
    queryKey: ['product-detail', viewId],
    queryFn:  () => viewId ? productsApi.get(viewId) : null,
    enabled:  !!viewId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => { toast.success('Product deleted'); setDelId(null); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Delete failed'),
  });

  const bulkDelMut = useMutation({
    mutationFn: () => Promise.all(selected.map(id => productsApi.delete(id))),
    onSuccess: () => { toast.success(`${selected.length} products deleted`); setSelected([]); setBulkDel(false); qc.invalidateQueries({ queryKey: ['products'] }); },
  });

  const p = products as any;
  const items = p?.items ?? [];

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }
  function toggleAll() {
    setSelected(prev => prev.length === items.length ? [] : items.map((i: any) => i.id));
  }

  const statusBadge = (s: string) => ({ ACTIVE: <Badge variant="success">Active</Badge>, INACTIVE: <Badge variant="warning">Inactive</Badge>, DISCONTINUED: <Badge variant="danger">Discontinued</Badge> }[s] ?? <Badge>{s}</Badge>);

  const stockBadge = (qty: number, min: number) => {
    if (qty <= 0)   return <Badge variant="danger">Out</Badge>;
    if (qty <= min) return <Badge variant="warning">Low</Badge>;
    return <Badge variant="success">OK</Badge>;
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Catalog Hub" subtitle="Manage all products, barcodes, pricing, and inventory"
        actions={
          <div className="flex items-center gap-2">
            <Btn icon={<Download size={15} />} onClick={() => toast.success('Exporting…')}>Export</Btn>
            <Btn icon={<Upload size={15} />} onClick={() => router.push('/catalog/import')}>Import</Btn>
            <Btn variant="primary" icon={<Plus size={15} />} onClick={() => router.push('/catalog/new')}>Add Product</Btn>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, SKU, barcode…" className="w-72" />
        <Select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} options={[{ value: '', label: 'All Categories' }, ...((cats as any)?.items ?? []).map((c: any) => ({ value: c.id, label: c.name }))]} className="w-44" />
        <Select value={brand} onChange={e => { setBrand(e.target.value); setPage(1); }}    options={[{ value: '', label: 'All Brands' },     ...((brands as any)?.items ?? []).map((b: any) => ({ value: b.id, label: b.name }))]} className="w-40" />
        <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} options={[{ value: '', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }, { value: 'DISCONTINUED', label: 'Discontinued' }]} className="w-36" />
        {selected.length > 0 && (
          <Btn variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>
            Delete {selected.length}
          </Btn>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="pl-4 py-3 bg-gray-50 dark:bg-gray-800/50 w-8">
                  <input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50">Product</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50 hidden md:table-cell">SKU / Barcode</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50 hidden lg:table-cell">Category</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50">Cost</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50">Price</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50 hidden sm:table-cell">Stock</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50">Status</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 bg-gray-50 dark:bg-gray-800/50 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 shimmer rounded" /></td>)}
                    </tr>
                  ))
                : items.length === 0
                ? <tr><td colSpan={9} className="text-center py-16 text-gray-400"><Package size={36} className="mx-auto mb-2 opacity-20" /><p>No products found</p></td></tr>
                : items.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="pl-4 py-2.5">
                        <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.primaryImage ? <img src={item.primaryImage} alt={item.name} className="w-full h-full object-cover" /> : <Package size={16} className="text-gray-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[200px]">{item.name}</p>
                            {item.nameAr && <p className="text-xs text-gray-400 truncate max-w-[200px]" dir="rtl">{item.nameAr}</p>}
                            <p className="text-[10px] text-gray-400">{item.brand?.name ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <p className="font-mono text-xs text-gray-700 dark:text-gray-300">{item.sku}</p>
                        <p className="font-mono text-[10px] text-gray-400">{item.primaryBarcode ?? '—'}</p>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-600 dark:text-gray-400">{item.category?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-500">{fmt.kd(item.purchasePrice)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-black text-sm text-emerald-600">{fmt.kd(item.sellingPrice)}</span>
                        {item.margin && <p className="text-[10px] text-gray-400">{item.margin}% margin</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`font-bold font-mono text-sm ${Number(item.currentStock) <= 0 ? 'text-red-600' : Number(item.currentStock) <= item.reorderLevel ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                            {Number(item.currentStock).toFixed(0)}
                          </span>
                          {stockBadge(Number(item.currentStock), item.reorderLevel)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">{statusBadge(item.status)}</td>
                      <td className="px-3 py-2.5 pr-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewId(item.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600" title="View"><Eye size={14} /></button>
                          <Link href={`/catalog/${item.id}/edit`} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 hover:text-amber-600" title="Edit"><Edit2 size={14} /></Link>
                          <button onClick={() => setDelId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={p?.totalPages ?? 1} total={p?.total ?? 0} perPage={25} onPage={setPage} />
      </Card>

      {/* Confirm delete */}
      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={() => delId && deleteMut.mutate(delId)} loading={deleteMut.isPending} danger
        title="Delete Product?" message="This product will be deactivated. Historical data is preserved." />
      <Confirm open={bulkDel} onClose={() => setBulkDel(false)} onConfirm={() => bulkDelMut.mutate()} loading={bulkDelMut.isPending} danger
        title={`Delete ${selected.length} products?`} message="All selected products will be deactivated. This cannot be undone." />

      {/* Product detail modal */}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title={viewProduct?.name ?? 'Product Detail'} size="xl">
        {viewProduct && <ProductDetailView product={viewProduct} onClose={() => setViewId(null)} />}
      </Modal>
    </div>
  );
}

function ProductDetailView({ product, onClose }: { product: any; onClose: () => void }) {
  const [tab, setTab] = useState<'info' | 'price' | 'cost' | 'stock'>('info');
  const { data: priceHistory } = useQuery({ queryKey: ['price-history', product.id], queryFn: () => productsApi.priceHistory(product.id) });
  const { data: costHistory  } = useQuery({ queryKey: ['cost-history',  product.id], queryFn: () => productsApi.costHistory(product.id)  });
  const { data: movements    } = useQuery({ queryKey: ['movements',     product.id], queryFn: () => productsApi.movements(product.id, { perPage: 20 }) });

  const tabs = [{ k: 'info', l: 'Info' }, { k: 'price', l: 'Price History' }, { k: 'cost', l: 'Cost History' }, { k: 'stock', l: 'Stock Movements' }];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex gap-5 p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
          {product.images?.[0]?.url ? <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" /> : <Package size={32} className="text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">{product.name}</h2>
          {product.nameAr && <p className="text-sm text-gray-400" dir="rtl">{product.nameAr}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{product.sku}</span>
            {product.barcodes?.map((b: any) => <span key={b.barcode} className="font-mono text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">{b.barcode}{b.isPrimary ? ' ★' : ''}</span>)}
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div><span className="text-gray-400">Cost: </span><span className="font-bold">{fmt.kd(product.purchasePrice)}</span></div>
            <div><span className="text-gray-400">Price: </span><span className="font-black text-emerald-600 text-base">{fmt.kd(product.sellingPrice)}</span></div>
            <div><span className="text-gray-400">Margin: </span><span className="font-bold text-blue-600">{product.margin}%</span></div>
            <div><span className="text-gray-400">Stock: </span><span className={`font-black ${Number(product.currentStock) <= 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{Number(product.currentStock).toFixed(0)}</span></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 px-6">
        {tabs.map(t => <button key={t.k} onClick={() => setTab(t.k as any)} className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${tab === t.k ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.l}</button>)}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'info' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Category', product.category?.name], ['Brand', product.brand?.name], ['Base Unit', product.baseUnit?.name],
              ['Purchase Unit', product.purchaseUnit?.name], ['Sale Unit', product.saleUnit?.name], ['Tax Rate', product.taxRate?.name],
              ['Reorder Level', product.reorderLevel], ['Max Stock', product.maxStock ?? '—'], ['Shelf Location', product.shelfLocation ?? '—'],
              ['Track Expiry', product.trackExpiry ? 'Yes' : 'No'], ['Status', product.status], ['For Sale', product.isForSale ? 'Yes' : 'No'],
            ].map(([l, v]) => (
              <div key={l} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">{l}</p>
                <p className="font-semibold text-gray-900 dark:text-white">{v ?? '—'}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'price' && (
          <div className="space-y-2">
            {(priceHistory as any[])?.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${h.priceType === 'SELLING' ? 'bg-emerald-100 text-emerald-700' : h.priceType === 'WHOLESALE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{h.priceType}</div>
                <div className="flex items-center gap-2"><span className="text-gray-400 line-through">{fmt.kd(h.oldPrice)}</span><span>→</span><span className="font-bold text-emerald-600">{fmt.kd(h.newPrice)}</span></div>
                <div className="ml-auto text-right text-xs text-gray-400"><p>{h.changedBy?.firstName} {h.changedBy?.lastName}</p><p>{fmt.datetime(h.createdAt)}</p>{h.reason && <p className="text-gray-500 italic">{h.reason}</p>}</div>
              </div>
            )) ?? <p className="text-gray-400 text-center py-8">No price history</p>}
          </div>
        )}

        {tab === 'cost' && (
          <div className="space-y-2">
            {(costHistory as any[])?.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
                <div className="flex items-center gap-2"><span className="text-gray-400 line-through">{fmt.kd(h.oldCost)}</span><span>→</span><span className="font-bold text-amber-600">{fmt.kd(h.newCost)}</span></div>
                {h.supplier && <Badge variant="gray">{h.supplier.name}</Badge>}
                {h.purchaseRef && <span className="font-mono text-xs text-gray-400">{h.purchaseRef}</span>}
                <div className="ml-auto text-right text-xs text-gray-400"><p>{h.changedBy?.firstName} {h.changedBy?.lastName}</p><p>{fmt.datetime(h.createdAt)}</p></div>
              </div>
            )) ?? <p className="text-gray-400 text-center py-8">No cost history</p>}
          </div>
        )}

        {tab === 'stock' && (
          <div className="space-y-2">
            {(movements as any)?.items?.map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${m.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.direction === 'IN' ? '+' : '−'}</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{m.movementType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{m.referenceNum ?? m.sourceModule} · {m.warehouse?.name}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black ${m.direction === 'IN' ? 'text-emerald-600' : 'text-red-500'}`}>{m.direction === 'IN' ? '+' : '−'}{Number(m.baseQuantity).toFixed(0)} {m.unit?.abbreviation}</p>
                  <p className="text-xs text-gray-400">{fmt.datetime(m.createdAt)}</p>
                </div>
              </div>
            )) ?? <p className="text-gray-400 text-center py-8">No stock movements</p>}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-3 justify-end">
        <Btn onClick={onClose}>Close</Btn>
        <Link href={`/catalog/${product.id}/edit`}><Btn variant="primary" icon={<Edit2 size={14} />}>Edit Product</Btn></Link>
      </div>
    </div>
  );
}
