import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const fmt = {
  kd:       (n: number | string | null | undefined) => `KD ${Number(n ?? 0).toFixed(3)}`,
  pct:      (n: number | string | null | undefined) => `${Number(n ?? 0).toFixed(1)}%`,
  qty:      (n: number | string | null | undefined, unit = '') => `${Number(n ?? 0).toFixed(0)}${unit ? ' ' + unit : ''}`,
  date:     (d: string | Date | null | undefined) => {
    if (!d) return '—';
    return new Intl.DateTimeFormat('en-KW', { timeZone: 'Asia/Kuwait', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
  },
  datetime: (d: string | Date | null | undefined) => {
    if (!d) return '—';
    return new Intl.DateTimeFormat('en-KW', { timeZone: 'Asia/Kuwait', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  },
  change:   (pct: string | number) => {
    const n = Number(pct);
    return { text: `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`, positive: n >= 0 };
  },
};

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }) as T;
}

export function paginate(total: number, page: number, perPage: number) {
  return { from: (page - 1) * perPage + 1, to: Math.min(page * perPage, total), totalPages: Math.ceil(total / perPage) };
}
