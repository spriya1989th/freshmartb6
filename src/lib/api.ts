import axios, { AxiosInstance } from 'axios';
import toast from 'react-hot-toast';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function createClient(): AxiosInstance {
  const client = axios.create({ baseURL: BASE, timeout: 15000 });

  client.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('fm_token') : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const status  = err.response?.status;
      const message = err.response?.data?.message ?? err.message;
      if (status === 401) {
        localStorage.removeItem('fm_token');
        window.location.href = '/login';
        return Promise.reject(err);
      }
      if (status === 403) toast.error(`Access denied: ${message}`);
      else if (status >= 500) toast.error('Server error — please try again');
      return Promise.reject(err);
    },
  );
  return client;
}

export const api = createClient();

// ── AUTH ──────────────────────────────────────────────────────────
export const authApi = {
  login:          (username: string, password: string) => api.post('/auth/login', { username, password }).then(r => r.data),
  me:             () => api.get('/auth/me').then(r => r.data),
  changePassword: (current: string, newPwd: string) => api.post('/auth/change-password', { currentPassword: current, newPassword: newPwd }),
};

// ── PRODUCTS ─────────────────────────────────────────────────────
export const productsApi = {
  list:        (params: Record<string, any>) => api.get('/products',          { params }).then(r => r.data),
  get:         (id: string)                  => api.get(`/products/${id}`)            .then(r => r.data),
  byBarcode:   (barcode: string)             => api.get(`/products/barcode/${barcode}`).then(r => r.data),
  create:      (data: any)                   => api.post('/products',          data).then(r => r.data),
  update:      (id: string, data: any)       => api.patch(`/products/${id}`,   data).then(r => r.data),
  delete:      (id: string)                  => api.delete(`/products/${id}`)        .then(r => r.data),
  duplicate:   (id: string, data: any)       => api.post(`/products/${id}/duplicate`, data).then(r => r.data),
  priceHistory:(id: string)                  => api.get(`/products/${id}/price-history`).then(r => r.data),
  costHistory: (id: string)                  => api.get(`/products/${id}/cost-history`).then(r => r.data),
  movements:   (id: string, params: any)     => api.get(`/products/${id}/movements`, { params }).then(r => r.data),
  addBarcode:  (id: string, barcode: string) => api.post(`/products/${id}/barcodes`, { barcode }).then(r => r.data),
  kwLookup:    (barcode: string)             => api.get(`/products/kw-lookup/${barcode}`).then(r => r.data),
};

// ── SALES ─────────────────────────────────────────────────────────
export const salesApi = {
  list:   (params: Record<string, any>) => api.get('/sales',         { params }).then(r => r.data),
  get:    (id: string)                  => api.get(`/sales/${id}`)           .then(r => r.data),
  create: (data: any)                   => api.post('/sales',         data).then(r => r.data),
  void:   (id: string, reason: string)  => api.post(`/sales/${id}/void`, { reason }).then(r => r.data),
  return: (id: string, data: any)       => api.post(`/sales/${id}/return`,   data).then(r => r.data),
};

// ── PURCHASES ─────────────────────────────────────────────────────
export const purchasesApi = {
  list:    (params: Record<string, any>) => api.get('/purchases',             { params }).then(r => r.data),
  get:     (id: string)                  => api.get(`/purchases/${id}`)               .then(r => r.data),
  create:  (data: any)                   => api.post('/purchases',             data).then(r => r.data),
  receive: (id: string, data: any)       => api.post(`/purchases/${id}/receive`, data).then(r => r.data),
  update:  (id: string, data: any)       => api.patch(`/purchases/${id}`,        data).then(r => r.data),
};

// ── CUSTOMERS ─────────────────────────────────────────────────────
export const customersApi = {
  list:   (params: Record<string, any>) => api.get('/customers',       { params }).then(r => r.data),
  get:    (id: string)                  => api.get(`/customers/${id}`)           .then(r => r.data),
  create: (data: any)                   => api.post('/customers',       data).then(r => r.data),
  update: (id: string, data: any)       => api.patch(`/customers/${id}`, data).then(r => r.data),
  ledger: (id: string, params: any)     => api.get(`/customers/${id}/ledger`, { params }).then(r => r.data),
  recordPayment: (id: string, data: any) => api.post(`/customers/${id}/payment`, data).then(r => r.data),
};

// ── SUPPLIERS ─────────────────────────────────────────────────────
export const suppliersApi = {
  list:   (params: Record<string, any>) => api.get('/suppliers',       { params }).then(r => r.data),
  get:    (id: string)                  => api.get(`/suppliers/${id}`)           .then(r => r.data),
  create: (data: any)                   => api.post('/suppliers',       data).then(r => r.data),
  update: (id: string, data: any)       => api.patch(`/suppliers/${id}`, data).then(r => r.data),
};

// ── CATEGORIES / BRANDS / UNITS ───────────────────────────────────
export const catalogApi = {
  categories: { list: () => api.get('/categories').then(r => r.data), create: (d: any) => api.post('/categories', d).then(r => r.data), update: (id: string, d: any) => api.patch(`/categories/${id}`, d).then(r => r.data), delete: (id: string) => api.delete(`/categories/${id}`) },
  brands:     { list: () => api.get('/brands').then(r => r.data),     create: (d: any) => api.post('/brands',     d).then(r => r.data), update: (id: string, d: any) => api.patch(`/brands/${id}`,     d).then(r => r.data), delete: (id: string) => api.delete(`/brands/${id}`) },
  units:      { list: () => api.get('/units').then(r => r.data),      create: (d: any) => api.post('/units',      d).then(r => r.data), update: (id: string, d: any) => api.patch(`/units/${id}`,      d).then(r => r.data) },
  conversions:{ list: () => api.get('/units/conversions').then(r => r.data), create: (d: any) => api.post('/units/conversions', d).then(r => r.data) },
};

// ── SHIFTS ────────────────────────────────────────────────────────
export const shiftsApi = {
  open:        (data: any) => api.post('/shifts/open',          data).then(r => r.data),
  close:       (id: string, data: any) => api.post(`/shifts/${id}/close`, data).then(r => r.data),
  active:      ()          => api.get('/shifts/active')               .then(r => r.data),
  get:         (id: string) => api.get(`/shifts/${id}`)               .then(r => r.data),
  cashMovement:(id: string, data: any) => api.post(`/shifts/${id}/cash-movement`, data).then(r => r.data),
  list:        (params: any) => api.get('/shifts', { params })         .then(r => r.data),
};

// ── REPORTS ───────────────────────────────────────────────────────
export const reportsApi = {
  dashboard:    (params: any) => api.get('/reports/dashboard',     { params }).then(r => r.data),
  salesByPeriod:(params: any) => api.get('/reports/sales-chart',   { params }).then(r => r.data),
  bestSelling:  (params: any) => api.get('/reports/best-selling',  { params }).then(r => r.data),
  stock:        (params: any) => api.get('/reports/stock',         { params }).then(r => r.data),
  expiry:       (params: any) => api.get('/reports/expiry',        { params }).then(r => r.data),
  pnl:          (params: any) => api.get('/reports/pnl',           { params }).then(r => r.data),
  shift:        (id: string)  => api.get(`/reports/shift/${id}`)             .then(r => r.data),
  tax:          (params: any) => api.get('/reports/tax',           { params }).then(r => r.data),
  customerLedger:(id: string, params: any) => api.get(`/reports/customer-ledger/${id}`, { params }).then(r => r.data),
  supplierLedger:(id: string, params: any) => api.get(`/reports/supplier-ledger/${id}`, { params }).then(r => r.data),
};

// ── SETTINGS ─────────────────────────────────────────────────────
export const settingsApi = {
  get:    (group?: string) => api.get('/settings',       { params: { group } }).then(r => r.data),
  update: (data: Record<string, string>) => api.put('/settings', data).then(r => r.data),
  backup: ()               => api.get('/settings/backup', { responseType: 'blob' }).then(r => r.data),
  restore:(file: File)     => { const fd = new FormData(); fd.append('file', file); return api.post('/settings/restore', fd); },
};

// ── APPROVALS ─────────────────────────────────────────────────────
export const approvalsApi = {
  list:    (params: any) => api.get('/approvals',                  { params }).then(r => r.data),
  status:  (id: string)  => api.get(`/approvals/${id}/status`)             .then(r => r.data),
  approve: (id: string, notes?: string) => api.post(`/approvals/${id}/approve`, { notes }).then(r => r.data),
  reject:  (id: string, notes?: string) => api.post(`/approvals/${id}/reject`,  { notes }).then(r => r.data),
};

// ── IMPORT ────────────────────────────────────────────────────────
export const importApi = {
  uploadProducts:  (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/import/products', fd).then(r => r.data); },
  uploadCustomers: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/import/customers', fd).then(r => r.data); },
  getJob:          (id: string) => api.get(`/import/jobs/${id}`).then(r => r.data),
  listJobs:        ()           => api.get('/import/jobs').then(r => r.data),
};
