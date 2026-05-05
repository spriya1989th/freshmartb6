import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  id: string; productId: string; name: string; nameAr?: string;
  sku: string; barcode?: string; image?: string;
  unitId: string; unitName: string;
  quantity: number; unitPrice: number; originalPrice: number;
  discountAmount: number; discountPercent: number;
  taxRate: number; taxAmount: number; lineTotal: number;
  batchNumber?: string; expiryDate?: string;
  priceOverridden: boolean; costAtSale?: number;
}

export type CustomerType = 'WALKIN' | 'REGULAR' | 'CREDIT' | 'DELIVERY';
export type PaymentMethod = 'CASH' | 'CARD' | 'KNET' | 'BANK_TRANSFER' | 'CREDIT' | 'SPLIT';

interface CartState {
  items:           CartItem[];
  customerId:      string | null;
  customerName:    string | null;
  customerType:    CustomerType;
  paymentMethod:   PaymentMethod;
  paidAmount:      number;
  discountAmount:  number;
  discountPercent: number;
  notes:           string;
  warehouseId:     string;
  shiftId:         string | null;
  splitPayments:   Array<{ method: PaymentMethod; amount: number }>;

  addItem:         (item: Omit<CartItem, 'lineTotal' | 'taxAmount'>) => void;
  removeItem:      (productId: string) => void;
  updateQty:       (productId: string, qty: number) => void;
  updatePrice:     (productId: string, price: number) => void;
  applyItemDiscount:(productId: string, amount: number, percent: number) => void;
  setCustomer:     (id: string | null, name: string | null, type: CustomerType) => void;
  setPaymentMethod:(m: PaymentMethod) => void;
  setPaidAmount:   (n: number) => void;
  setDiscount:     (amount: number, percent: number) => void;
  setNotes:        (n: string) => void;
  setShift:        (id: string) => void;
  setWarehouse:    (id: string) => void;
  clearCart:       () => void;

  // Computed
  subtotal:    () => number;
  taxTotal:    () => number;
  totalAmount: () => number;
  changeAmount:() => number;
}

function computeLine(item: Omit<CartItem, 'lineTotal' | 'taxAmount'> & { lineTotal?: number; taxAmount?: number }): { lineTotal: number; taxAmount: number } {
  const gross      = item.unitPrice * item.quantity;
  const afterDisc  = gross - item.discountAmount;
  const taxAmount  = afterDisc * (item.taxRate / 100);
  return { lineTotal: afterDisc + taxAmount, taxAmount };
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [], customerId: null, customerName: null, customerType: 'WALKIN',
      paymentMethod: 'CASH', paidAmount: 0, discountAmount: 0, discountPercent: 0,
      notes: '', warehouseId: '', shiftId: null, splitPayments: [],

      addItem: (item) => set((s) => {
        const existing = s.items.find(i => i.productId === item.productId);
        if (existing) {
          return {
            items: s.items.map(i => i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity, ...computeLine({ ...i, quantity: i.quantity + item.quantity }) }
              : i),
          };
        }
        const { lineTotal, taxAmount } = computeLine(item);
        return { items: [...s.items, { ...item, lineTotal, taxAmount }] };
      }),

      removeItem: (productId) => set(s => ({ items: s.items.filter(i => i.productId !== productId) })),

      updateQty: (productId, qty) => set(s => ({
        items: qty <= 0
          ? s.items.filter(i => i.productId !== productId)
          : s.items.map(i => i.productId === productId ? { ...i, quantity: qty, ...computeLine({ ...i, quantity: qty }) } : i),
      })),

      updatePrice: (productId, price) => set(s => ({
        items: s.items.map(i => i.productId === productId ? { ...i, unitPrice: price, priceOverridden: true, ...computeLine({ ...i, unitPrice: price }) } : i),
      })),

      applyItemDiscount: (productId, amount, percent) => set(s => ({
        items: s.items.map(i => {
          if (i.productId !== productId) return i;
          const disc = amount > 0 ? amount : (i.unitPrice * i.quantity * percent / 100);
          return { ...i, discountAmount: disc, discountPercent: percent, ...computeLine({ ...i, discountAmount: disc }) };
        }),
      })),

      setCustomer:     (id, name, type) => set({ customerId: id, customerName: name, customerType: type }),
      setPaymentMethod:(m)               => set({ paymentMethod: m }),
      setPaidAmount:   (n)               => set({ paidAmount: n }),
      setDiscount:     (amount, percent) => set({ discountAmount: amount, discountPercent: percent }),
      setNotes:        (n)               => set({ notes: n }),
      setShift:        (id)              => set({ shiftId: id }),
      setWarehouse:    (id)              => set({ warehouseId: id }),
      clearCart: () => set({ items: [], customerId: null, customerName: null, customerType: 'WALKIN', paymentMethod: 'CASH', paidAmount: 0, discountAmount: 0, discountPercent: 0, notes: '', splitPayments: [] }),

      subtotal:     () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity - i.discountAmount, 0),
      taxTotal:     () => get().items.reduce((s, i) => s + i.taxAmount, 0),
      totalAmount:  () => {
        const s = get();
        const sub = s.subtotal();
        const cartDisc = s.discountAmount > 0 ? s.discountAmount : (sub * s.discountPercent / 100);
        return sub - cartDisc + s.taxTotal();
      },
      changeAmount: () => Math.max(0, get().paidAmount - get().totalAmount()),
    }),
    {
      name: 'fm-cart',   // survives page refresh — offline resilience
      partialize: (s) => ({
        items: s.items, customerId: s.customerId, customerName: s.customerName,
        customerType: s.customerType, paymentMethod: s.paymentMethod,
        discountAmount: s.discountAmount, discountPercent: s.discountPercent,
        notes: s.notes, warehouseId: s.warehouseId, shiftId: s.shiftId,
      }),
    },
  ),
);
