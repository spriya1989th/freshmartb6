'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { PageHeader, Card, CardHeader, CardBody, Btn, Input, Select, Badge, SearchInput } from '../../../../components/ui';
import { Printer, Plus, Minus, Tag, Eye, Package, X } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

type LabelSize = '58x30' | '100x50' | 'A4-24';

interface LabelProduct { id: string; name: string; sku: string; barcode: string; price: number; brand?: string; copies: number; }

export default function PrintLabelsPage() {
  const [search,       setSearch]       = useState('');
  const [selectedProds,setSelectedProds]= useState<LabelProduct[]>([]);
  const [labelSize,    setLabelSize]    = useState<LabelSize>('58x30');
  const [showName,     setShowName]     = useState(true);
  const [showPrice,    setShowPrice]    = useState(true);
  const [showSku,      setShowSku]      = useState(false);
  const [showBrand,    setShowBrand]    = useState(false);
  const [headerText,   setHeaderText]   = useState('FreshMart');
  const previewRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useQuery({
    queryKey: ['prod-search-labels', search],
    queryFn:  () => search.length > 1 ? productsApi.list({ search, perPage: 10 }) : null,
    enabled:  search.length > 1,
  });

  function addProduct(product: any) {
    if (selectedProds.find(p => p.id === product.id)) return;
    setSelectedProds(prev => [...prev, {
      id:      product.id,
      name:    product.name,
      sku:     product.sku,
      barcode: product.primaryBarcode ?? product.barcodes?.[0]?.barcode ?? product.sku,
      price:   Number(product.sellingPrice),
      brand:   product.brand?.name,
      copies:  1,
    }]);
    setSearch('');
  }

  function setCopies(id: string, copies: number) {
    setSelectedProds(prev => prev.map(p => p.id === id ? { ...p, copies: Math.max(1, copies) } : p));
  }

  const sizeDims: Record<LabelSize, { w: string; h: string; cols: number; fontSize: string }> = {
    '58x30':  { w: '58mm',  h: '30mm',  cols: 1, fontSize: '11px' },
    '100x50': { w: '100mm', h: '50mm',  cols: 1, fontSize: '14px' },
    'A4-24':  { w: '63mm',  h: '38mm',  cols: 3, fontSize: '11px' },
  };
  const dim = sizeDims[labelSize];

  // Generate barcode SVG for a code
  function renderBarcode(code: string, containerId: string) {
    const el = document.getElementById(containerId);
    if (!el || !code) return;
    try {
      JsBarcode(`#${containerId}`, code, {
        format: 'CODE128', width: 1.5, height: 40, displayValue: true,
        fontSize: 10, margin: 2, background: 'transparent',
      });
    } catch {}
  }

  useEffect(() => {
    selectedProds.forEach(p => {
      renderBarcode(p.barcode, `barcode-prev-${p.id}`);
    });
  }, [selectedProds]);

  function printLabels() {
    const html = generatePrintHtml();
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups.'); return; }
    win.document.write(`<html><head><title>Barcode Labels</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      .label-grid { display: grid; grid-template-columns: repeat(${dim.cols}, ${dim.w}); gap: 2mm; padding: 5mm; }
      .label { width: ${dim.w}; height: ${dim.h}; border: 0.5pt solid #ccc; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; overflow: hidden; page-break-inside: avoid; }
      .lh  { font-size: 8pt; color: #666; }
      .ln  { font-size: 9pt; font-weight: bold; text-align: center; line-height: 1.2; max-width: 100%; overflow: hidden; }
      .lp  { font-size: 12pt; font-weight: 900; }
      .ls  { font-size: 7pt; color: #666; font-family: monospace; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style></head><body><div class="label-grid">${html}</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  function generatePrintHtml(): string {
    const rows: string[] = [];
    for (const p of selectedProds) {
      for (let i = 0; i < p.copies; i++) {
        rows.push(`<div class="label">
          ${headerText ? `<div class="lh">${headerText}</div>` : ''}
          ${showName  ? `<div class="ln">${p.name}</div>` : ''}
          <svg id="bc-print-${p.id}-${i}" style="max-width:100%"></svg>
          ${showPrice ? `<div class="lp">KD ${p.price.toFixed(3)}</div>` : ''}
          ${showSku   ? `<div class="ls">${p.sku}</div>` : ''}
          ${showBrand && p.brand ? `<div class="ls">${p.brand}</div>` : ''}
        </div>`);
      }
    }
    return rows.join('');
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader title="Print Barcode Labels" subtitle="Generate and print barcode labels for any label size"
        actions={
          <Btn variant="primary" icon={<Printer size={15} />} onClick={printLabels} disabled={selectedProds.length === 0}>
            Print {selectedProds.reduce((s, p) => s + p.copies, 0)} Labels
          </Btn>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Label Settings</h3></CardHeader>
            <CardBody className="space-y-4">
              {/* Size */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Label Size</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { k: '58x30'  as LabelSize, label: '58×30mm', sub: 'POS printer' },
                    { k: '100x50' as LabelSize, label: '100×50mm',sub: 'Standard'    },
                    { k: 'A4-24'  as LabelSize, label: 'A4 Sheet', sub: '24/sheet'   },
                  ].map(s => (
                    <button key={s.k} onClick={() => setLabelSize(s.k)}
                      className={`py-2 px-2 rounded-xl text-center text-xs font-bold border-2 transition-all ${labelSize === s.k ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'}`}>
                      {s.label}<br/><span className="font-normal opacity-70">{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Show/Hide fields */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Show on Label</p>
                <div className="space-y-2">
                  {[
                    { label: 'Product Name', value: showName,  set: setShowName  },
                    { label: 'Price',        value: showPrice, set: setShowPrice },
                    { label: 'SKU Code',     value: showSku,   set: setShowSku   },
                    { label: 'Brand',        value: showBrand, set: setShowBrand },
                  ].map(f => (
                    <label key={f.label} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                      <div onClick={() => f.set(!f.value)}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${f.value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${f.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Input label="Header Text" value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="e.g. FreshMart Kuwait" />
            </CardBody>
          </Card>

          {/* Product selector */}
          <Card>
            <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Add Products</h3></CardHeader>
            <CardBody>
              <div className="relative">
                <SearchInput value={search} onChange={setSearch} placeholder="Search product…" />
                {search.length > 1 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto mt-1">
                    {(searchResults as any)?.items?.map((p: any) => (
                      <button key={p.id} onClick={() => addProduct(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 text-xs">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{p.name}</span>
                        <span className="text-gray-400 ml-2 font-mono">{p.sku}</span>
                      </button>
                    ))}
                    {(searchResults as any)?.items?.length === 0 && (
                      <div className="px-3 py-4 text-center text-gray-400 text-xs">No products found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected list */}
              <div className="mt-3 space-y-2">
                {selectedProds.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs">
                    <Package size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                      <p className="text-gray-400 font-mono">{p.barcode || p.sku}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCopies(p.id, p.copies - 1)} className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-red-50"><Minus size={10} /></button>
                      <span className="w-6 text-center font-bold">{p.copies}</span>
                      <button onClick={() => setCopies(p.id, p.copies + 1)} className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-emerald-50"><Plus size={10} /></button>
                    </div>
                    <button onClick={() => setSelectedProds(prev => prev.filter(x => x.id !== p.id))} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                  </div>
                ))}
                {selectedProds.length === 0 && (
                  <p className="text-center text-gray-400 text-xs py-4">Search and add products above</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Label Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">Preview</h3>
                <Badge variant="info">{dim.w} × {dim.h}</Badge>
              </div>
            </CardHeader>
            <CardBody>
              {selectedProds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Tag size={40} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">No products selected</p>
                  <p className="text-xs mt-1">Add products on the left to preview labels</p>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 overflow-auto">
                  <div className={`grid gap-3 ${labelSize === 'A4-24' ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'}`}>
                    {selectedProds.map(p =>
                      Array.from({ length: Math.min(p.copies, 3) }).map((_, ci) => (
                        <div key={`${p.id}-${ci}`}
                          className="bg-white rounded-lg border border-gray-300 flex flex-col items-center justify-center p-2 text-center overflow-hidden"
                          style={{ width: '100%', aspectRatio: labelSize === '58x30' ? '58/30' : labelSize === '100x50' ? '100/50' : '63/38' }}>
                          {headerText && <p style={{ fontSize: '8px', color: '#666' }}>{headerText}</p>}
                          {showName  && <p style={{ fontSize: '9px', fontWeight: 700, lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden' }} className="line-clamp-2">{p.name}</p>}
                          {/* Barcode placeholder */}
                          <div className="my-1 w-full flex items-center justify-center">
                            <div style={{ fontFamily: 'monospace', fontSize: '7px', letterSpacing: '-1px', lineHeight: 1 }}>
                              {'|'.repeat(40).split('').map((_, i) => (
                                <span key={i} style={{ display: 'inline-block', width: i % 3 === 0 ? '2px' : '1px', height: labelSize === '58x30' ? '20px' : '28px', background: '#000', margin: '0 0.3px' }} />
                              ))}
                            </div>
                          </div>
                          <p style={{ fontSize: '7px', fontFamily: 'monospace', color: '#555' }}>{p.barcode || p.sku}</p>
                          {showPrice && <p style={{ fontSize: '11px', fontWeight: 900, marginTop: '2px' }}>KD {p.price.toFixed(3)}</p>}
                          {showSku   && <p style={{ fontSize: '7px', color: '#888', fontFamily: 'monospace' }}>{p.sku}</p>}
                          {showBrand && p.brand && <p style={{ fontSize: '7px', color: '#888' }}>{p.brand}</p>}
                        </div>
                      ))
                    )}
                  </div>
                  {selectedProds.some(p => p.copies > 3) && (
                    <p className="text-center text-xs text-gray-400 mt-3">Preview shows max 3 copies. All {selectedProds.reduce((s, p) => s + p.copies, 0)} labels will print.</p>
                  )}
                </div>
              )}

              {selectedProds.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <Btn variant="primary" icon={<Printer size={15} />} onClick={printLabels}>
                    Print {selectedProds.reduce((s, p) => s + p.copies, 0)} Labels
                  </Btn>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
