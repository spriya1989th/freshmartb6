'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importApi } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { PageHeader, Card, CardHeader, CardBody, Badge, Btn, Alert } from '../../../../components/ui';
import {
  Upload, Download, FileText, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TEMPLATE_COLS = [
  { num: 1,  name: 'Product Name',       req: true,  note: 'Name of the product' },
  { num: 2,  name: 'Brand',              req: false, note: 'If not found, new brand created' },
  { num: 3,  name: 'Unit',               req: true,  note: 'Name of the unit (e.g. Piece, Kg, Box)' },
  { num: 4,  name: 'Category',           req: false, note: 'If not found, new category created' },
  { num: 5,  name: 'SKU',                req: false, note: 'Auto-generated if blank' },
  { num: 6,  name: 'Barcode',            req: false, note: 'Must be globally unique' },
  { num: 7,  name: 'Purchase Price',     req: true,  note: 'Cost price (numbers only, e.g. 0.500)' },
  { num: 8,  name: 'Selling Price',      req: true,  note: 'Retail price (numbers only)' },
  { num: 9,  name: 'Opening Stock',      req: false, note: 'Initial stock quantity' },
  { num: 10, name: 'Reorder Level',      req: false, note: 'Alert when stock drops below this' },
  { num: 11, name: 'Expiry Date',        req: false, note: 'Format: YYYY-MM-DD' },
  { num: 12, name: 'Track Expiry',       req: false, note: '1 = Yes, 0 = No' },
  { num: 13, name: 'Selling Price Tax',  req: true,  note: 'inclusive or exclusive' },
  { num: 14, name: 'Product Type',       req: true,  note: 'single or variable' },
  { num: 15, name: 'Notes',              req: false, note: 'Any product notes' },
];

export default function ImportProductsPage() {
  const qc = useQueryClient();
  const [dragOver,    setDragOver]   = useState(false);
  const [file,        setFile]       = useState<File | null>(null);
  const [jobId,       setJobId]      = useState<string | null>(null);
  const [showCols,    setShowCols]   = useState(false);

  const { data: jobs } = useQuery({
    queryKey: ['import-jobs'],
    queryFn:  () => importApi.listJobs(),
    refetchInterval: jobId ? 3000 : false,
  });

  const { data: activeJob } = useQuery({
    queryKey: ['import-job', jobId],
    queryFn:  () => jobId ? importApi.getJob(jobId) : null,
    enabled:  !!jobId,
    refetchInterval: (data) => {
      const d = data as any;
      return d?.status === 'PROCESSING' || d?.status === 'PENDING' ? 2000 : false;
    },
  });

  const uploadMut = useMutation({
    mutationFn: () => importApi.uploadProducts(file!),
    onSuccess: (data: any) => {
      setJobId(data.jobId);
      setFile(null);
      toast.success('File uploaded — processing started');
      qc.invalidateQueries({ queryKey: ['import-jobs'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Upload failed'),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
    else toast.error('Please upload a CSV or Excel file');
  }, []);

  function downloadTemplate() {
    const header = TEMPLATE_COLS.map(c => c.name).join(',');
    const sample = ['Almarai Fresh Milk 1L','AlMarai','Piece','Dairy & Chilled','DAI-001','6281000000001','0.280','0.500','100','20','','0','exclusive','single','Fresh milk'].join(',');
    const csv = header + '\n' + sample;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'freshmart-product-import-template.csv';
    a.click();
    toast.success('Template downloaded');
  }

  const aj = activeJob as any;
  const jobList = (jobs as any[]) ?? [];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <PageHeader title="Import Products"
        subtitle="Bulk import products from CSV or Excel. Download the template first."
        actions={<Btn icon={<Download size={15} />} onClick={downloadTemplate}>Download Template</Btn>}
      />

      {/* Upload area */}
      <Card>
        <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Upload File</h3></CardHeader>
        <CardBody className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('import-file-input')?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            <input id="import-file-input" type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
            <Upload size={36} className={`mx-auto mb-3 ${dragOver ? 'text-emerald-500' : 'text-gray-300'}`} />
            <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">{file ? file.name : 'Drop CSV or Excel file here'}</p>
            <p className="text-xs text-gray-400">or click to browse · .csv, .xlsx, .xls</p>
            {file && <Badge variant="success" className="mt-2">{(file.size / 1024).toFixed(0)} KB ready</Badge>}
          </div>

          {file && (
            <div className="flex gap-3">
              <Btn onClick={() => setFile(null)} className="flex-1">Remove File</Btn>
              <Btn variant="primary" loading={uploadMut.isPending} onClick={() => uploadMut.mutate()} className="flex-1" icon={<Upload size={15} />}>
                Upload & Import
              </Btn>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Active job progress */}
      {aj && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Import Progress</h3>
              <Badge variant={aj.status === 'COMPLETED' ? 'success' : aj.status === 'FAILED' ? 'danger' : aj.status === 'PARTIAL' ? 'warning' : 'info'}>
                {aj.status}
              </Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Rows</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{aj.totalRows}</p>
              </div>
              <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                <p className="text-xs text-emerald-600 uppercase tracking-wide">Success</p>
                <p className="text-2xl font-black text-emerald-600">{aj.successRows}</p>
              </div>
              <div className="text-center bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                <p className="text-xs text-red-600 uppercase tracking-wide">Failed</p>
                <p className="text-2xl font-black text-red-600">{aj.failedRows}</p>
              </div>
            </div>

            {aj.status === 'PROCESSING' && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Processing…</span>
                  <span>{aj.totalRows > 0 ? Math.round(((aj.successRows + aj.failedRows) / aj.totalRows) * 100) : 0}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all animate-pulse"
                    style={{ width: `${aj.totalRows > 0 ? Math.round(((aj.successRows + aj.failedRows) / aj.totalRows) * 100) : 0}%` }} />
                </div>
              </div>
            )}

            {aj.status === 'COMPLETED' && (
              <Alert type="success" title="Import Complete!" message={`Successfully imported ${aj.successRows} products.${aj.failedRows > 0 ? ` ${aj.failedRows} rows had errors.` : ''}`} />
            )}

            {aj.errorSummary && (
              <Alert type="warning" title="Some rows had errors" message={aj.errorSummary} />
            )}

            {/* Row errors */}
            {aj.rows && aj.rows.filter((r: any) => r.status === 'failed').length > 0 && (
              <div className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-xs font-bold text-red-700 dark:text-red-400">
                  Error Details ({aj.rows.filter((r: any) => r.status === 'failed').length} failed rows)
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-red-100 dark:divide-red-900/30">
                  {aj.rows.filter((r: any) => r.status === 'failed').map((row: any) => (
                    <div key={row.rowNumber} className="px-4 py-2.5 text-xs">
                      <span className="font-bold text-red-600">Row {row.rowNumber}:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{JSON.stringify(row.errors)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Column reference */}
      <Card>
        <button onClick={() => setShowCols(!showCols)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <h3 className="font-bold text-gray-900 dark:text-white">Column Reference Guide</h3>
          {showCols ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        </button>
        {showCols && (
          <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['#','Column Name','Required','Description'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_COLS.map(col => (
                  <tr key={col.num} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 font-bold">{col.num}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200 text-xs">{col.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={col.req ? 'danger' : 'gray'}>{col.req ? 'Required' : 'Optional'}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{col.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Import history */}
      {jobList.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-bold text-gray-900 dark:text-white">Import History</h3></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['File','Date','Total','Success','Failed','Status'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-50 dark:bg-gray-800/50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobList.slice(0, 10).map((j: any) => (
                  <tr key={j.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => setJobId(j.id)}>
                    <td className="px-4 py-3 text-xs font-medium text-blue-600 truncate max-w-[200px]">{j.fileName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt.datetime(j.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{j.totalRows}</td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-600 font-bold">{j.successRows}</td>
                    <td className="px-4 py-3 font-mono text-xs text-red-500 font-bold">{j.failedRows}</td>
                    <td className="px-4 py-3">
                      <Badge variant={j.status === 'COMPLETED' ? 'success' : j.status === 'FAILED' ? 'danger' : j.status === 'PARTIAL' ? 'warning' : 'info'}>
                        {j.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
