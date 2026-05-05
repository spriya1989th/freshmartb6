'use client';
import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2, ChevronLeft, ChevronRight, X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

// ── BUTTON ────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}
export function Btn({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...p }: BtnProps) {
  const v = {
    primary:   'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    secondary: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700',
    danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost:     'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
    outline:   'border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    success:   'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
  }[variant];
  const s = { xs: 'px-2 py-1 text-xs gap-1', sm: 'px-3 py-1.5 text-sm gap-1.5', md: 'px-4 py-2 text-sm gap-2', lg: 'px-5 py-2.5 text-base gap-2' }[size];
  return (
    <button {...p} disabled={disabled || loading} className={cn('inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed', v, s, className)}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── CARD ──────────────────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm', className)}>{children}</div>;
}
export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4 border-b border-gray-200 dark:border-gray-800', className)}>{children}</div>;
}
export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

// ── STAT CARD ─────────────────────────────────────────────────────
interface StatProps { label: string; value: string | number; change?: string; positive?: boolean; icon?: React.ReactNode; color?: string; sub?: string; }
export function StatCard({ label, value, change, positive, icon, color = 'emerald', sub }: StatProps) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    blue:    'bg-blue-50    dark:bg-blue-900/20    text-blue-600',
    amber:   'bg-amber-50   dark:bg-amber-900/20   text-amber-600',
    red:     'bg-red-50     dark:bg-red-900/20     text-red-600',
    purple:  'bg-purple-50  dark:bg-purple-900/20  text-purple-600',
  };
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            {change && <p className={cn('text-xs font-semibold mt-1', positive ? 'text-emerald-600' : 'text-red-500')}>{change}</p>}
          </div>
          {icon && <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colors[color] ?? colors.emerald)}>{icon}</div>}
        </div>
      </div>
    </Card>
  );
}

// ── BADGE ─────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'purple';
export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const v = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400',
    danger:  'bg-red-100     text-red-700     dark:bg-red-900/30     dark:text-red-400',
    info:    'bg-blue-100    text-blue-700    dark:bg-blue-900/30    dark:text-blue-400',
    gray:    'bg-gray-100    text-gray-700    dark:bg-gray-800       dark:text-gray-400',
    purple:  'bg-purple-100  text-purple-700  dark:bg-purple-900/30  dark:text-purple-400',
  }[variant];
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold', v)}>{children}</span>;
}

// ── INPUT ─────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; icon?: React.ReactNode; }
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, icon, className, ...p }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
      <input ref={ref} {...p} className={cn(
        'w-full rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 transition-colors outline-none',
        'border-gray-300 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
        icon && 'pl-9', className,
      )} />
    </div>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Input.displayName = 'Input';

// ── SELECT ────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string; options: Array<{ value: string; label: string }>; placeholder?: string; }
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ label, error, options, placeholder, className, ...p }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">{label}</label>}
    <select ref={ref} {...p} className={cn('w-full rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 outline-none transition-colors', 'border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20', error && 'border-red-500', className)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Select.displayName = 'Select';

// ── DATA TABLE ────────────────────────────────────────────────────
interface Column<T> { key: string; header: string; render?: (row: T) => React.ReactNode; className?: string; }
interface TableProps<T> { columns: Column<T>[]; data: T[]; loading?: boolean; emptyText?: string; onRowClick?: (row: T) => void; }
export function DataTable<T extends Record<string, any>>({ columns, data, loading, emptyText = 'No data found', onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            {columns.map(col => (
              <th key={col.key} className={cn('text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {columns.map(col => <td key={col.key} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>)}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">{emptyText}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)} className={cn('border-b border-gray-100 dark:border-gray-800 transition-colors', onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50')}>
                {columns.map(col => (
                  <td key={col.key} className={cn('px-4 py-3 text-gray-700 dark:text-gray-300', col.className)}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── PAGINATION ────────────────────────────────────────────────────
interface PaginationProps { page: number; totalPages: number; total: number; perPage: number; onPage: (p: number) => void; }
export function Pagination({ page, totalPages, total, perPage, onPage }: PaginationProps) {
  const from = (page - 1) * perPage + 1, to = Math.min(page * perPage, total);
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (i === 0) return 1;
    if (i === 6) return totalPages;
    return Math.max(2, Math.min(totalPages - 1, page - 2 + i));
  }).filter((p, i, a) => a.indexOf(p) === i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of <span className="font-medium">{total}</span></p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"><ChevronLeft size={16} /></button>
        {pages.map(p => <button key={p} onClick={() => onPage(p)} className={cn('w-8 h-8 rounded-lg text-sm font-medium', p === page ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400')}>{p}</button>)}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

// ── MODAL ─────────────────────────────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; }
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const w = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-7xl' }[size];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={cn('relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh]', w)} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── ALERT ─────────────────────────────────────────────────────────
type AlertType = 'info' | 'warning' | 'success' | 'danger';
export function Alert({ type = 'info', title, message }: { type?: AlertType; title?: string; message: string }) {
  const styles: Record<AlertType, { bg: string; icon: React.ReactNode }> = {
    info:    { bg: 'bg-blue-50   border-blue-200   text-blue-800   dark:bg-blue-900/20   dark:border-blue-700   dark:text-blue-300', icon: <Info size={16} /> },
    warning: { bg: 'bg-amber-50  border-amber-200  text-amber-800  dark:bg-amber-900/20  dark:border-amber-700  dark:text-amber-300', icon: <AlertTriangle size={16} /> },
    success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300', icon: <CheckCircle2 size={16} /> },
    danger:  { bg: 'bg-red-50    border-red-200    text-red-800    dark:bg-red-900/20    dark:border-red-700    dark:text-red-300', icon: <AlertTriangle size={16} /> },
  };
  const s = styles[type];
  return (
    <div className={cn('flex gap-3 p-4 rounded-xl border text-sm', s.bg)}>
      <span className="flex-shrink-0 mt-0.5">{s.icon}</span>
      <div>{title && <p className="font-semibold mb-0.5">{title}</p>}<p>{message}</p></div>
    </div>
  );
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────
interface ConfirmProps { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; danger?: boolean; loading?: boolean; }
export function Confirm({ open, onClose, onConfirm, title, message, danger, loading }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Btn onClick={onClose} disabled={loading}>Cancel</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>Confirm</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── PAGE HEADER ───────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ── SEARCH INPUT ─────────────────────────────────────────────────
import { Search } from 'lucide-react';
export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
    </div>
  );
}

// ── PERIOD SELECTOR ───────────────────────────────────────────────
const PERIODS = [
  { value: 'today',         label: 'Today' },
  { value: 'this_week',     label: 'This Week' },
  { value: 'this_month',    label: 'This Month' },
  { value: 'last_month',    label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'this_year',     label: 'This Year' },
  { value: 'custom',        label: 'Custom' },
];

export function PeriodSelector({ value, onChange, showCustom, onCustomChange }: { value: string; onChange: (v: string) => void; showCustom?: { from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void }; }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
        {PERIODS.filter(p => p.value !== 'custom').map(p => (
          <button key={p.value} onClick={() => onChange(p.value)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', value === p.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            {p.label}
          </button>
        ))}
        <button onClick={() => onChange('custom')} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', value === 'custom' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
          Custom
        </button>
      </div>
      {value === 'custom' && showCustom && (
        <div className="flex items-center gap-2">
          <input type="date" value={showCustom.from} onChange={e => showCustom.onFromChange(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-emerald-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={showCustom.to}   onChange={e => showCustom.onToChange(e.target.value)}   className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-emerald-500" />
        </div>
      )}
    </div>
  );
}
