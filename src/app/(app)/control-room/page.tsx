'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { settingsApi } from '../../../lib/api';
import { PageHeader, Card, CardHeader, CardBody, Btn, Input, Select, Alert } from '../../../components/ui';
import { Settings, Store, FileText, Printer, Shield, Database, Bell, Palette, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'business' | 'receipt' | 'pos' | 'tax' | 'printer' | 'labels' | 'notifications' | 'backup';

export default function ControlRoomPage() {
  const [tab, setTab] = useState<Tab>('business');
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.get(),
  });

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      (settings as any[]).forEach((s: any) => { map[s.key] = s.value; });
      setForm(map);
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess:  () => toast.success('Settings saved'),
    onError:    () => toast.error('Failed to save settings'),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const f = (key: string, def = '') => form[key] ?? def;

  const tabs: Array<{ k: Tab; label: string; icon: React.ReactNode }> = [
    { k: 'business',      label: 'Business',     icon: <Store size={16} /> },
    { k: 'receipt',       label: 'Receipt',      icon: <FileText size={16} /> },
    { k: 'pos',           label: 'POS Settings', icon: <Settings size={16} /> },
    { k: 'tax',           label: 'Tax',          icon: <Palette size={16} /> },
    { k: 'printer',       label: 'Printer',      icon: <Printer size={16} /> },
    { k: 'labels',        label: 'Barcode Labels', icon: <Tag size={16} /> },
    { k: 'notifications', label: 'Alerts',       icon: <Bell size={16} /> },
    { k: 'backup',        label: 'Backup',       icon: <Database size={16} /> },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader title="Control Room" subtitle="System configuration, business settings, and administration" />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="lg:w-52 flex-shrink-0">
          <Card>
            <nav className="p-2">
              {tabs.map(t => (
                <button key={t.k} onClick={() => setTab(t.k)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${tab === t.k ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {tab === 'business' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Business Information</h3></CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Business Name" value={f('business_name', 'FreshMart')} onChange={set('business_name')} />
                  <Input label="Branch Name"   value={f('branch_name', 'Main Branch')} onChange={set('branch_name')} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Phone Number"     value={f('phone')}     onChange={set('phone')}     placeholder="+965 XXXX XXXX" />
                  <Input label="WhatsApp Number"  value={f('whatsapp')}  onChange={set('whatsapp')}  placeholder="+965 XXXX XXXX" />
                </div>
                <Input label="Email Address" type="email" value={f('email')} onChange={set('email')} placeholder="info@freshmart.com.kw" />
                <div><label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Address</label>
                  <textarea value={f('address')} onChange={set('address')} rows={2} placeholder="Full business address" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Currency" value={f('currency', 'KWD')} onChange={set('currency')} options={[{ value: 'KWD', label: 'KWD — Kuwaiti Dinar' }, { value: 'USD', label: 'USD — US Dollar' }]} />
                  <Select label="Language" value={f('language', 'en')} onChange={set('language')} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
                </div>
                <Select label="Timezone" value={f('timezone', 'Asia/Kuwait')} onChange={set('timezone')}
                  options={[{ value: 'Asia/Kuwait', label: 'Asia/Kuwait (UTC+3)' }, { value: 'UTC', label: 'UTC' }]} />
                <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save Business Settings</Btn>
              </CardBody>
            </Card>
          )}

          {tab === 'receipt' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Receipt Configuration</h3></CardHeader>
              <CardBody className="space-y-4">
                <Input label="Receipt Header Line 1" value={f('receipt_header1')} onChange={set('receipt_header1')} placeholder="Business name or slogan" />
                <Input label="Receipt Header Line 2" value={f('receipt_header2')} onChange={set('receipt_header2')} placeholder="Address or phone" />
                <div><label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Footer Message</label>
                  <textarea value={f('receipt_footer')} onChange={set('receipt_footer')} rows={2} placeholder="Thank you message or return policy" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Paper Width" value={f('receipt_paper', '80mm')} onChange={set('receipt_paper')}
                    options={[{ value: '58mm', label: '58mm (Small)' }, { value: '80mm', label: '80mm (Standard)' }, { value: 'A4', label: 'A4 Paper' }]} />
                  <Select label="Print Copies" value={f('receipt_copies', '1')} onChange={set('receipt_copies')}
                    options={[{ value: '1', label: '1 copy' }, { value: '2', label: '2 copies' }, { value: '3', label: '3 copies' }]} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Show Tax on Receipt" value={f('receipt_show_tax', 'yes')} onChange={set('receipt_show_tax')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                  <Select label="Show Barcode" value={f('receipt_show_barcode', 'yes')} onChange={set('receipt_show_barcode')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                </div>
                <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save Receipt Settings</Btn>
              </CardBody>
            </Card>
          )}

          {tab === 'pos' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">POS / QuickSell Settings</h3></CardHeader>
              <CardBody className="space-y-4">
                <Select label="Default Payment Method" value={f('pos_default_payment', 'CASH')} onChange={set('pos_default_payment')}
                  options={[{ value: 'CASH', label: 'Cash' }, { value: 'KNET', label: 'KNET' }, { value: 'CARD', label: 'Card' }]} />
                <Select label="Default Customer Type" value={f('pos_default_cust_type', 'WALKIN')} onChange={set('pos_default_cust_type')}
                  options={[{ value: 'WALKIN', label: 'Walk-in' }, { value: 'REGULAR', label: 'Regular' }]} />
                <Input label="Max Discount % (Cashier)" type="number" value={f('pos_max_discount_cashier', '10')} onChange={set('pos_max_discount_cashier')} placeholder="10" />
                <Input label="Discount Approval Threshold %" type="number" value={f('discount_approval_threshold', '20')} onChange={set('discount_approval_threshold')} placeholder="20" />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Allow Sale Without Stock" value={f('pos_allow_negative_stock', 'no')} onChange={set('pos_allow_negative_stock')} options={[{ value: 'no', label: 'No — Block sale' }, { value: 'yes', label: 'Yes — Allow' }]} />
                  <Select label="Auto-print Receipt" value={f('pos_auto_print', 'ask')} onChange={set('pos_auto_print')} options={[{ value: 'ask', label: 'Ask each time' }, { value: 'yes', label: 'Always print' }, { value: 'no', label: 'Never print' }]} />
                </div>
                <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save POS Settings</Btn>
              </CardBody>
            </Card>
          )}

          {tab === 'tax' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Tax Configuration</h3></CardHeader>
              <CardBody className="space-y-4">
                <Alert type="info" message="Kuwait VAT is currently 0%. Configure if your region requires tax reporting." />
                <Select label="Default Tax Type" value={f('default_tax_type', 'NONE')} onChange={set('default_tax_type')}
                  options={[{ value: 'NONE', label: 'No Tax (0%)' }, { value: 'INCLUSIVE', label: 'Tax Inclusive' }, { value: 'EXCLUSIVE', label: 'Tax Exclusive' }]} />
                <Input label="Default Tax Rate %" type="number" value={f('default_tax_rate', '0')} onChange={set('default_tax_rate')} placeholder="0" />
                <Input label="Tax Registration Number" value={f('tax_reg_number')} onChange={set('tax_reg_number')} placeholder="Optional" />
                <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save Tax Settings</Btn>
              </CardBody>
            </Card>
          )}

          {tab === 'printer' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Printer Configuration</h3></CardHeader>
              <CardBody className="space-y-4">
                <Alert type="info" title="Browser Printing" message="FreshMart uses browser print by default. For direct thermal printing, configure the printer agent below." />
                <Select label="Printer Type" value={f('printer_type', 'browser')} onChange={set('printer_type')}
                  options={[{ value: 'browser', label: 'Browser Print (Default)' }, { value: 'epson', label: 'Epson TM Series' }, { value: 'star', label: 'Star Micronics' }, { value: 'custom', label: 'Custom TCP Printer' }]} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Printer IP Address" value={f('printer_ip')} onChange={set('printer_ip')} placeholder="192.168.1.100" />
                  <Input label="Port" type="number" value={f('printer_port', '9100')} onChange={set('printer_port')} placeholder="9100" />
                </div>
                <div className="flex gap-3">
                  <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Btn>
                  <Btn onClick={() => { window.print(); toast.success('Test print sent'); }}>🖨 Test Print</Btn>
                </div>
              </CardBody>
            </Card>
          )}

          {tab === 'labels' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Barcode Label Settings</h3></CardHeader>
              <CardBody className="space-y-4">
                <Select label="Default Label Size" value={f('label_default_size', '58x30')} onChange={set('label_default_size')}
                  options={[{ value: '58x30', label: '58×30mm — Small sticker' }, { value: '100x50', label: '100×50mm — Shelf label' }, { value: 'A4-24', label: 'A4 — 24 labels/sheet' }]} />
                <Select label="Barcode Format" value={f('label_barcode_format', 'CODE128')} onChange={set('label_barcode_format')}
                  options={[{ value: 'CODE128', label: 'Code 128 (Universal)' }, { value: 'EAN13', label: 'EAN-13' }, { value: 'EAN8', label: 'EAN-8' }, { value: 'UPCA', label: 'UPC-A' }, { value: 'QR', label: 'QR Code' }]} />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Show Product Name" value={f('label_show_name', 'yes')} onChange={set('label_show_name')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                  <Select label="Show Price" value={f('label_show_price', 'yes')} onChange={set('label_show_price')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Show Brand" value={f('label_show_brand', 'no')} onChange={set('label_show_brand')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                  <Select label="Show SKU" value={f('label_show_sku', 'no')} onChange={set('label_show_sku')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                </div>
                <Input label="Label Header Text" value={f('label_header', 'FreshMart')} onChange={set('label_header')} placeholder="e.g. FreshMart Kuwait" />
                <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save Label Settings</Btn>
              </CardBody>
            </Card>
          )}

          {tab === 'notifications' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Alert & Notification Settings</h3></CardHeader>
              <CardBody className="space-y-4">
                <Input label="Low Stock Alert Threshold (days supply)" type="number" value={f('alert_low_stock_days', '7')} onChange={set('alert_low_stock_days')} />
                <Input label="Expiry Alert — Days Before Expiry" type="number" value={f('alert_expiry_days', '30')} onChange={set('alert_expiry_days')} />
                <Input label="WhatsApp Alert Number" value={f('alert_whatsapp')} onChange={set('alert_whatsapp')} placeholder="+965 XXXX XXXX" />
                <Input label="Email Alert Address" type="email" value={f('alert_email')} onChange={set('alert_email')} />
                <Select label="Dashboard Alert Refresh" value={f('alert_refresh_mins', '5')} onChange={set('alert_refresh_mins')}
                  options={[{ value: '1', label: 'Every 1 minute' }, { value: '5', label: 'Every 5 minutes' }, { value: '15', label: 'Every 15 minutes' }, { value: '30', label: 'Every 30 minutes' }]} />
                <Btn variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save Notification Settings</Btn>
              </CardBody>
            </Card>
          )}

          {tab === 'backup' && (
            <Card>
              <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Backup & Restore</h3></CardHeader>
              <CardBody className="space-y-5">
                <Alert type="info" title="Data Backup" message="Export a full backup of your business data including products, customers, suppliers, and settings. Transaction history is not included in the standard backup." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Export Backup</h4>
                    <p className="text-xs text-gray-500 mb-4">Download all business data as JSON</p>
                    <Btn variant="primary" icon={<Database size={14} />}
                      onClick={() => settingsApi.backup().then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `freshmart-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); toast.success('Backup downloaded'); }).catch(() => toast.error('Backup failed'))}>
                      Download Backup
                    </Btn>
                  </div>
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Restore Backup</h4>
                    <p className="text-xs text-gray-500 mb-4">Upload a previously exported backup file</p>
                    <Alert type="warning" message="Restore will merge data. Existing records are not overwritten." />
                    <label className="mt-3 flex items-center gap-2 cursor-pointer">
                      <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        if (!confirm('Restore backup? This will merge with existing data.')) return;
                        try { await settingsApi.restore(file); toast.success('Backup restored successfully'); } catch { toast.error('Restore failed — invalid backup file'); }
                      }} />
                      <Btn>Choose Backup File</Btn>
                    </label>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
