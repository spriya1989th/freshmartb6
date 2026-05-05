'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, salesApi, shiftsApi, customersApi } from '../../../lib/api';
import { useCart, CartItem } from '../../../store/cart.store';
import { fmt, debounce } from '../../../lib/utils';
import { Modal, Badge, Btn, Input, Alert } from '../../../components/ui';
import {
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus, User, CreditCard,
  Banknote, Smartphone, Building2, Percent, X, CheckCircle2, Printer, Tag,
  Package, AlertTriangle, RefreshCw, ChevronDown, Wifi, WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

type PayMethod = 'CASH' | 'KNET' | 'CARD' | 'CREDIT' | 'SPLIT';
type CustType  = 'WALKIN' | 'REGULAR' | 'CREDIT' | 'DELIVERY';

export default function POSPage() {
  const qc = useQueryClient();
  const cart = useCart();

  const [search,        setSearch]        = useState('');
  const [debouncedQ,    setDebouncedQ]    = useState('');
  const [category,      setCategory]      = useState('');
  const [payModal,      setPayModal]       = useState(false);
  const [receiptModal,  setReceiptModal]   = useState(false);
  const [lastInvoice,   setLastInvoice]    = useState<any>(null);
  const [cashReceived,  setCashReceived]   = useState('');
  const [custSearch,    setCustSearch]     = useState('');
  const [custModal,     setCustModal]      = useState(false);
  const [discModal,     setDiscModal]      = useState(false);
  const [discType,      setDiscType]       = useState<'pct' | 'flat'>('pct');
  const [discValue,     setDiscValue]      = useState('');
  const [isOnline,      setIsOnline]       = useState(true);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer  = useRef<NodeJS.Timeout>();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Online/offline detection
  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Global barcode scanner (USB HID sends keystrokes ending with Enter)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      clearTimeout(barcodeTimer.current);
      if (e.key === 'Enter') {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        if (code.length > 3) handleBarcodeScanned(code);
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Active shift
  const { data: shift } = useQuery({ queryKey: ['active-shift'], queryFn: () => shiftsApi.active().catch(() => null) });

  // Products (paginated)
  const { data: productsData, isLoading: prodsLoading } = useQuery({
    queryKey: ['pos-products', debouncedQ, category],
    queryFn:  () => productsApi.list({ search: debouncedQ, categoryId: category, status: 'ACTIVE', perPage: 60 }),
    staleTime: 60_000,
  });

  // Categories for filter chips
  const { data: cats } = useQuery({
    queryKey: ['categories-pos'],
    queryFn:  () => fetch('/api/categories').then(r => r.json()).catch(() => ({ items: [] })),
    staleTime: 300_000,
  });

  // Customer search
  const { data: custResults } = useQuery({
    queryKey: ['cust-search-pos', custSearch],
    queryFn:  () => custSearch.length > 1 ? customersApi.list({ search: custSearch, perPage: 10 }) : null,
    enabled:  custSearch.length > 1,
  });

  async function handleBarcodeScanned(code: string) {
    try {
      const product = await productsApi.byBarcode(code);
      if (product) {
        addProductToCart(product);
        toast.success(`Added: ${product.name}`, { icon: '🛒', duration: 1500 });
      } else {
        toast.error(`Barcode not found: ${code}`);
      }
    } catch {
      toast.error(`Product not found for barcode: ${code}`);
    }
  }

  function addProductToCart(product: any) {
    const item: Omit<CartItem, 'lineTotal' | 'taxAmount'> = {
      id:            product.id,
      productId:     product.id,
      name:          product.name,
      nameAr:        product.nameAr,
      sku:           product.sku,
      barcode:       product.barcodes?.[0]?.barcode,
      image:         product.images?.[0]?.url ?? product.primaryImage,
      unitId:        product.saleUnitId ?? product.baseUnitId,
      unitName:      product.saleUnit?.abbreviation ?? product.baseUnit?.abbreviation ?? 'pcs',
      quantity:      1,
      unitPrice:     Number(product.sellingPrice),
      originalPrice: Number(product.sellingPrice),
      discountAmount: 0, discountPercent: 0,
      taxRate:       product.taxRate ? Number(product.taxRate.rate) : 0,
      priceOverridden: false,
      costAtSale:    Number(product.purchasePrice),
    };
    cart.addItem(item);
  }

  // Totals
  const subtotal    = cart.subtotal();
  const taxTotal    = cart.taxTotal();
  const cartDisc    = cart.discountAmount > 0 ? cart.discountAmount : (subtotal * cart.discountPercent / 100);
  const total       = cart.totalAmount();
  const change      = Math.max(0, Number(cashReceived || 0) - total);

  // Checkout mutation
  const checkoutMut = useMutation({
    mutationFn: () => salesApi.create({
      customerId:     cart.customerId,
      shiftId:        cart.shiftId ?? (shift as any)?.id,
      warehouseId:    cart.warehouseId || (shift as any)?.branch?.warehouses?.[0]?.id || 'default',
      customerType:   cart.customerType,
      paymentMethod:  cart.paymentMethod,
      deliveryAddress: undefined,
      discountAmount: cartDisc,
      discountPercent: cart.discountPercent,
      paidAmount:     cart.paymentMethod === 'CASH' ? Number(cashReceived) : total,
      notes:          cart.notes,
      items: cart.items.map(i => ({
        productId: i.productId, unitId: i.unitId, quantity: i.quantity,
        unitPrice: i.unitPrice, discountAmount: i.discountAmount,
        priceOverridden: i.priceOverridden,
      })),
    }),
    onSuccess: (data) => {
      setLastInvoice(data);
      cart.clearCart();
      setPayModal(false);
      setCashReceived('');
      setReceiptModal(true);
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Sale completed!', { icon: '✅' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Sale failed'),
  });

  function applyDiscount() {
    const val = Number(discValue);
    if (discType === 'pct') cart.setDiscount(0, val);
    else                    cart.setDiscount(val, 0);
    setDiscModal(false); setDiscValue('');
  }

  const products = (productsData as any)?.items ?? [];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-100 dark:bg-gray-950 overflow-hidden">
      {/* ── LEFT PANEL: Products ──────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + status bar */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={barcodeRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search product name or scan barcode…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          {shift && <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium"><CheckCircle2 size={12} />Shift Open</div>}
        </div>

        {/* Category chips */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {[{ id: '', name: 'All' }, ...((cats as any)?.items ?? [])].map((c: any) => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                category === c.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {prodsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl h-36 shimmer" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Package size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {products.map((p: any) => {
                const stock = Number(p.currentStock ?? 0);
                const inCart = cart.items.find(i => i.productId === p.id);
                return (
                  <button key={p.id}
                    onClick={() => stock > 0 && addProductToCart(p)}
                    disabled={stock <= 0}
                    className={`relative flex flex-col items-center p-3 bg-white dark:bg-gray-900 rounded-xl border transition-all text-left
                      ${stock <= 0 ? 'opacity-40 cursor-not-allowed border-gray-100 dark:border-gray-800'
                        : inCart ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                        : 'border-gray-100 dark:border-gray-800 hover:border-emerald-300 hover:shadow-md active:scale-95'}`}>
                    {/* Image / Emoji */}
                    <div className="w-full aspect-square rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-2 overflow-hidden">
                      {p.primaryImage ? (
                        <img src={p.primaryImage} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={28} className="text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 text-center line-clamp-2 leading-tight w-full">{p.name}</p>
                    <p className="text-sm font-black text-emerald-600 mt-1">{fmt.kd(p.sellingPrice)}</p>
                    <p className={`text-[10px] mt-0.5 font-medium ${stock <= 0 ? 'text-red-500' : stock <= (p.reorderLevel ?? 10) ? 'text-amber-500' : 'text-gray-400'}`}>
                      {stock <= 0 ? 'Out of stock' : `${stock} in stock`}
                    </p>
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Cart ─────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-emerald-600" />
              <span className="font-bold text-gray-900 dark:text-white">Cart</span>
              {cart.items.length > 0 && <Badge variant="info">{cart.items.reduce((s, i) => s + i.quantity, 0)} items</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setDiscModal(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Discount"><Percent size={15} /></button>
              <button onClick={() => setCustModal(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Customer"><User size={15} /></button>
              <button onClick={() => { if (confirm('Clear cart?')) cart.clearCart(); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400" title="Clear"><Trash2 size={15} /></button>
            </div>
          </div>

          {/* Customer / Type */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['WALKIN', 'REGULAR', 'CREDIT', 'DELIVERY'] as CustType[]).map(t => (
                <button key={t} onClick={() => cart.setCustomer(cart.customerId, cart.customerName, t)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${cart.customerType === t ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}>
                  {t === 'WALKIN' ? '🚶' : t === 'REGULAR' ? '⭐' : t === 'CREDIT' ? '💳' : '🚚'} {t}
                </button>
              ))}
            </div>
          </div>
          {cart.customerName && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs">
              <User size={12} className="text-blue-600" />
              <span className="font-semibold text-blue-700 dark:text-blue-400">{cart.customerName}</span>
              <button onClick={() => cart.setCustomer(null, null, 'WALKIN')} className="ml-auto text-blue-400 hover:text-blue-600"><X size={12} /></button>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <ShoppingCart size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs mt-1">Click products or scan barcode</p>
            </div>
          ) : (
            cart.items.map(item => (
              <div key={item.productId} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package size={16} className="text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{fmt.kd(item.unitPrice)} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => cart.updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center"><Minus size={11} /></button>
                  <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                  <button onClick={() => cart.updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center"><Plus size={11} /></button>
                </div>
                <div className="text-right min-w-[52px]">
                  <p className="text-xs font-black text-gray-900 dark:text-white">{fmt.kd(item.lineTotal)}</p>
                  {item.discountAmount > 0 && <p className="text-[10px] text-red-500">−{fmt.kd(item.discountAmount)}</p>}
                </div>
                <button onClick={() => cart.removeItem(item.productId)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
              </div>
            ))
          )}
        </div>

        {/* Totals + checkout */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Subtotal</span><span>{fmt.kd(subtotal)}</span>
          </div>
          {cartDisc > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Discount</span><span>−{fmt.kd(cartDisc)}</span>
            </div>
          )}
          {taxTotal > 0 && (
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Tax</span><span>{fmt.kd(taxTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-black text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
            <span>Total</span><span className="text-emerald-600">{fmt.kd(total)}</span>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-4 gap-1 pt-1">
            {([
              { m: 'CASH' as PayMethod,  icon: <Banknote size={14} />,   label: 'Cash' },
              { m: 'KNET' as PayMethod,  icon: <Smartphone size={14} />, label: 'KNET' },
              { m: 'CARD' as PayMethod,  icon: <CreditCard size={14} />, label: 'Card' },
              { m: 'CREDIT' as PayMethod,icon: <Building2 size={14} />,  label: 'Credit' },
            ]).map(({ m, icon, label }) => (
              <button key={m} onClick={() => cart.setPaymentMethod(m)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-bold transition-all ${
                  cart.paymentMethod === m ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          <button
            onClick={() => cart.items.length > 0 && setPayModal(true)}
            disabled={cart.items.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]">
            <CheckCircle2 size={18} />
            Checkout · {fmt.kd(total)}
          </button>
        </div>
      </div>

      {/* ── PAYMENT MODAL ─────────────────────────── */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Complete Payment" size="sm">
        <div className="p-6 space-y-5">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Amount Due</p>
            <p className="text-4xl font-black text-emerald-600">{fmt.kd(total)}</p>
            <p className="text-xs text-gray-400 mt-1">{cart.paymentMethod} · {cart.customerType}</p>
          </div>

          {cart.paymentMethod === 'CASH' && (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Cash Received</p>
                {/* Numpad */}
                <div className="font-mono text-2xl font-bold text-center py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 min-h-[56px]">
                  {cashReceived ? fmt.kd(Number(cashReceived)) : 'KD 0.000'}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
                    <button key={k} className="numpad-btn h-12"
                      onClick={() => {
                        if (k === '⌫') setCashReceived(p => p.slice(0, -1));
                        else if (k === '.' && cashReceived.includes('.')) return;
                        else setCashReceived(p => p + k);
                      }}>
                      {k}
                    </button>
                  ))}
                </div>
                {/* Quick amounts */}
                <div className="grid grid-cols-3 gap-2">
                  {[total, Math.ceil(total), Math.ceil(total / 5) * 5].filter((v, i, a) => a.indexOf(v) === i).map(amt => (
                    <button key={amt} onClick={() => setCashReceived(amt.toFixed(3))}
                      className="py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100">
                      {fmt.kd(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {cashReceived && Number(cashReceived) >= total && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Change to Return</p>
                  <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{fmt.kd(change)}</p>
                </div>
              )}
            </>
          )}

          {cart.paymentMethod === 'CREDIT' && (
            <Alert type="warning" title="Credit Sale" message="This sale will be recorded on the customer's credit account. Ensure customer has sufficient credit limit." />
          )}

          <div className="flex gap-3">
            <Btn onClick={() => setPayModal(false)} className="flex-1">Cancel</Btn>
            <Btn variant="primary" className="flex-2"
              loading={checkoutMut.isPending}
              onClick={() => checkoutMut.mutate()}
              icon={<CheckCircle2 size={16} />}
              disabled={cart.paymentMethod === 'CASH' && Number(cashReceived) < total}>
              Confirm Sale
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── RECEIPT MODAL ─────────────────────────── */}
      <Modal open={receiptModal} onClose={() => setReceiptModal(false)} title="Sale Complete" size="sm">
        <div className="p-6">
          <div className="text-center mb-6">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-black text-gray-900 dark:text-white">Sale Complete!</p>
            <p className="text-sm text-gray-500">{lastInvoice?.docNumber}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-black">{fmt.kd(lastInvoice?.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-semibold">{fmt.kd(lastInvoice?.paidAmount)}</span></div>
            {Number(lastInvoice?.changeAmount) > 0 && <div className="flex justify-between text-blue-600"><span>Change</span><span className="font-black">{fmt.kd(lastInvoice?.changeAmount)}</span></div>}
          </div>
          <div className="flex gap-3">
            <Btn onClick={() => setReceiptModal(false)} className="flex-1">Done</Btn>
            <Btn variant="primary" icon={<Printer size={15} />} className="flex-1" onClick={() => window.print()}>Print Receipt</Btn>
          </div>
        </div>
      </Modal>

      {/* ── DISCOUNT MODAL ────────────────────────── */}
      <Modal open={discModal} onClose={() => setDiscModal(false)} title="Apply Discount" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setDiscType('pct')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${discType === 'pct' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>Percentage %</button>
            <button onClick={() => setDiscType('flat')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${discType === 'flat' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>Flat Amount KD</button>
          </div>
          <Input type="number" label={discType === 'pct' ? 'Discount Percentage' : 'Discount Amount (KD)'} value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder={discType === 'pct' ? '0 – 100' : '0.000'} min="0" />
          {discType === 'pct' && Number(discValue) > 20 && (
            <Alert type="warning" message="Discount over 20% may require manager approval." />
          )}
          <div className="flex gap-3">
            <Btn onClick={() => { cart.setDiscount(0, 0); setDiscModal(false); }}>Remove Discount</Btn>
            <Btn variant="primary" onClick={applyDiscount} className="flex-1">Apply</Btn>
          </div>
        </div>
      </Modal>

      {/* ── CUSTOMER MODAL ────────────────────────── */}
      <Modal open={custModal} onClose={() => setCustModal(false)} title="Select Customer" size="sm">
        <div className="p-5 space-y-4">
          <Input placeholder="Search by name or phone…" value={custSearch} onChange={e => setCustSearch(e.target.value)} icon={<Search size={14} />} />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <button onClick={() => { cart.setCustomer(null, null, 'WALKIN'); setCustModal(false); }}
              className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">🚶 Walk-in Customer</p>
              <p className="text-xs text-gray-500">No account required</p>
            </button>
            {(custResults as any)?.items?.map((c: any) => (
              <button key={c.id} onClick={() => { cart.setCustomer(c.id, c.name, c.customerType); setCustModal(false); }}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone} {c.whatsapp && `· WA: ${c.whatsapp}`}</p>
                  </div>
                  {c.customerType === 'CREDIT' && (
                    <div className="text-right">
                      <Badge variant="purple">Credit</Badge>
                      <p className="text-xs text-gray-400 mt-0.5">Avail: {fmt.kd(Number(c.creditLimit) - Number(c.creditBalance))}</p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
