import { DateTime } from 'luxon';

const KW = 'Asia/Kuwait';

export class BusinessDate {
  static now(): DateTime { return DateTime.now().setZone(KW); }

  static dayRange(d: string) {
    const s = DateTime.fromISO(d, { zone: KW }).startOf('day');
    return { gte: s.toUTC().toJSDate(), lte: s.endOf('day').toUTC().toJSDate() };
  }

  static today() { return this.dayRange(DateTime.now().setZone(KW).toISODate()!); }

  static thisWeek() {
    const n = DateTime.now().setZone(KW);
    return { gte: n.startOf('week').toUTC().toJSDate(), lte: n.endOf('week').toUTC().toJSDate() };
  }

  static thisMonth() {
    const n = DateTime.now().setZone(KW);
    return { gte: n.startOf('month').toUTC().toJSDate(), lte: n.endOf('month').toUTC().toJSDate() };
  }

  static lastMonth() {
    const n = DateTime.now().setZone(KW).minus({ months: 1 });
    return { gte: n.startOf('month').toUTC().toJSDate(), lte: n.endOf('month').toUTC().toJSDate() };
  }

  static thisYear() {
    const n = DateTime.now().setZone(KW);
    return { gte: n.startOf('year').toUTC().toJSDate(), lte: n.endOf('year').toUTC().toJSDate() };
  }

  static lastNMonths(n: number) {
    const now = DateTime.now().setZone(KW);
    return { gte: now.minus({ months: n - 1 }).startOf('month').toUTC().toJSDate(), lte: now.endOf('month').toUTC().toJSDate() };
  }

  static customRange(from: string, to: string) {
    const s = DateTime.fromISO(from, { zone: KW }).startOf('day');
    const e = DateTime.fromISO(to,   { zone: KW }).endOf('day');
    if (!s.isValid || !e.isValid || s > e) throw new Error(`Invalid date range: ${from} to ${to}`);
    return { gte: s.toUTC().toJSDate(), lte: e.toUTC().toJSDate() };
  }

  static resolvePeriod(period: string, from?: string, to?: string) {
    switch (period) {
      case 'today':         return this.today();
      case 'this_week':     return this.thisWeek();
      case 'this_month':    return this.thisMonth();
      case 'last_month':    return this.lastMonth();
      case 'this_year':     return this.thisYear();
      case 'last_3_months': return this.lastNMonths(3);
      case 'custom':        return this.customRange(from!, to!);
      default:              return this.today();
    }
  }

  static display(date: Date): string {
    return DateTime.fromJSDate(date).setZone(KW).toFormat('dd/MM/yyyy HH:mm');
  }

  static isActive(startDate: Date | null, endDate: Date | null): boolean {
    const now = DateTime.now().setZone(KW);
    if (startDate && DateTime.fromJSDate(startDate).setZone(KW) > now) return false;
    if (endDate   && DateTime.fromJSDate(endDate  ).setZone(KW) < now) return false;
    return true;
  }
}
