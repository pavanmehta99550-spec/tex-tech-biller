import fs from 'fs';

const helperFunction = `

const numberToWords = (num: number) => {
    if (!num || num === 0) return 'Zero Only';
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    
    let n = ('000000000' + Math.floor(Math.abs(num))).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != '00') ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += (n[2] != '00') ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += (n[3] != '00') ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += (n[4] != '00') ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
    return str + 'Only';
};

`;

const createTemplate = (componentName, dataPropName, title) => `
function ${componentName}({ ${dataPropName}, settings, payments = [], onClose }: any) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const p = ${dataPropName};
  
  const consigneeName = p.consigneeName || p.partyName || '';
  const consigneeAddress = p.consigneeAddress || p.partyAddress || '';
  const consigneeGstin = p.consigneeGstin || p.partyGstin || '';
  const consigneeMobile = p.consigneeMobile || p.partyMobile || '';
  const consignorName = p.consignorName || settings?.companyName || "K.K. FABRICS";
  
  const taxableValue = p.basicAmount - (p.globalDiscount || 0);
  const tr = p.taxRate || 5;
  const tax = taxableValue * (tr / 100);
  // Safely fallback cgst, sgst, igst values
  const cgst = p.cgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const sgst = p.sgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const igst = p.igstAmount ?? (p.isInterstate ? tax : 0);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-container');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(\`\${p.billNumber || 'document'}.pdf\`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto"
    >
      <div className="bg-white w-full max-w-4xl min-h-[A4] shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden">
          <ChevronLeft size={24} />
        </button>
        
        <div className="absolute top-6 right-20 flex gap-2 print:hidden z-10">
          <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold rounded-lg shadow-lg flex items-center gap-2">
            <Printer size={16} /> Print
          </button>
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 transition-colors text-white font-bold rounded-lg shadow-lg flex items-center gap-2">
            <Download size={16} /> PDF
          </button>
        </div>

        <div id="print-container" className="print-container bg-white p-8 print:p-0 md:text-[11px] text-[10px]">
          <div className="border border-black">
            
            {/* Header */}
            <div className="text-center p-2 border-b border-black">
              <div className="font-bold text-xs" style={{ fontFamily: 'Georgia, serif' }}>||| SHREE GANESHAY NAMAH |||</div>
              <h1 className="text-3xl font-black mt-1 uppercase tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>{settings?.companyName || "K.K. FABRICS"}</h1>
              <div className="font-bold uppercase mt-1 tracking-wide">{settings?.address || "SURAT, GUJARAT"}</div>
            </div>

            <div className="flex justify-between items-center p-2 border-b border-black font-bold uppercase">
              <div className="w-1/3 text-left">
                <div>GSTIN: {settings?.gstin || ""}</div>
              </div>
              <div className="w-1/3 text-center text-xl font-black tracking-widest uppercase">
                ${title}
              </div>
              <div className="w-1/3 text-right">
                <div>Mo: {settings?.mobile || ""}</div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-[60%_40%] border-b border-black">
              <div className="border-r border-black p-2 space-y-1">
                <div className="flex"><span className="w-32 font-bold">From:</span> <span className="uppercase">{consignorName}</span></div>
                <div className="flex"><span className="w-32 font-bold">Transport:</span> <span className="uppercase">{p.transportName || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">LR No:</span> <span className="uppercase">{p.lrNumber || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">Remittance:</span> <span></span></div>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex justify-between"><span className="font-bold">Invoice No:</span> <span className="uppercase font-bold">{p.billNumber}</span></div>
                <div className="flex justify-between"><span className="font-bold">Date:</span> <span>{new Date(p.date).toLocaleDateString('en-GB')}</span></div>
                {p.ewbNumber ? (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">EWAY BILL:</span> <span className="uppercase font-black text-black tracking-widest">{p.ewbNumber}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="font-bold">Challan No:</span> <span className="uppercase">-</span></div>
                )}
                {p.parcels && (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">PARCELS/BAILS:</span> <span className="uppercase font-black text-black tracking-widest">{p.parcels}</span></div>
                )}
                <div className="flex justify-between"><span className="font-bold">Broker:</span> <span>-</span></div>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 border-b border-black">
              <div className="border-r border-black p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Receiver (Billed To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                {consigneeMobile && <div className="mt-1">Contact: {consigneeMobile}</div>}
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                  {p.consigneeStateCode && <div><span className="font-bold">State Code:</span> {p.consigneeStateCode}</div>}
                </div>
              </div>
              <div className="p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Consignee (Shipped To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase text-[10px] font-bold h-8">
                  <th className="border-r border-black p-1.5 min-w-[30px]">No</th>
                  <th className="border-r border-black p-1.5 text-left w-[40%]">Description of Goods</th>
                  <th className="border-r border-black p-1.5">HSN No</th>
                  <th className="border-r border-black p-1.5">Taka / Box</th>
                  <th className="border-r border-black p-1.5">Qty</th>
                  <th className="border-r border-black p-1.5">Rate</th>
                  <th className="p-1.5 text-right w-[15%]">Taxable Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b-0 text-[11px] align-top">
                    <td className="border-r border-black p-1">{idx + 1}</td>
                    <td className="border-r border-black p-1 text-left font-bold uppercase">
                      {item.name} {item.color && <span className="font-normal ml-1">({item.color})</span>}
                    </td>
                    <td className="border-r border-black p-1">{item.hsnCode}</td>
                    <td className="border-r border-black p-1">{item.taka || '-'}</td>
                    <td className="border-r border-black p-1 uppercase font-bold">{item.quantity} <span className="font-normal text-[9px]">{item.unit}</span></td>
                    <td className="border-r border-black p-1">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-1 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 10 - p.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="align-top h-6">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-y border-black font-bold uppercase text-[11px] h-6 bg-slate-50">
                  <td className="border-r border-black p-1.5" colSpan={3}>Total</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.taka) || 0), 0) || '-'}</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.quantity) || 0), 0).toFixed(2)}</td>
                  <td className="border-r border-black p-1.5"></td>
                  <td className="p-1.5 text-right tracking-wider">{Number(p.basicAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer sections */}
            <div className="grid grid-cols-[60%_40%]">
              {/* Left Footer */}
              <div className="border-r border-black p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Amount in Words:</div>
                  <div className="font-bold italic uppercase indent-2 text-[11px]">{numberToWords(p.grandTotal)}</div>
                </div>
                
                <div className="mt-4 pb-2 border-b border-black border-dashed">
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Bank Details</div>
                  <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[10px] uppercase">
                    <span className="font-bold">Bank:</span> <span>{settings?.bankName || ''}</span>
                    <span className="font-bold">Branch:</span> <span>{settings?.branch || ''}</span>
                    <span className="font-bold">A/c No:</span> <span className="font-black tracking-widest">{settings?.accountNumber || ''}</span>
                    <span className="font-bold">IFSC:</span> <span className="font-black tracking-widest">{settings?.ifsc || ''}</span>
                  </div>
                </div>

                <div className="mt-2 text-[9px] leading-snug">
                  <div className="font-bold underline mb-1 uppercase">Terms of Sales</div>
                  <ol className="list-decimal pl-4 space-y-0.5 m-0 uppercase font-bold text-slate-800">
                    <li>Goods once sold will not be taken back.</li>
                    <li>Interest @ 24% p.a. will be charged if not paid within 30 days.</li>
                    <li>We are not responsible for any damage in transit.</li>
                    <li>Subject to Surat Jurisdiction only.</li>
                  </ol>
                </div>
              </div>

              {/* Right Footer */}
              <div className="flex flex-col">
                <div className="p-2 space-y-1 bg-white flex-1 text-[11px]">
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Gross Amount</span> <span className="font-bold">{Number(p.basicAmount).toFixed(2)}</span></div>
                  {p.globalDiscount > 0 && (
                     <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Less Discount</span> <span className="font-bold">- {Number(p.globalDiscount).toFixed(2)}</span></div>
                  )}
                  
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">SGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(sgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">CGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(cgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">IGST @ {p.isInterstate ? tr.toFixed(2) : '0.00'}%</span> <span>{Number(igst).toFixed(2)}</span></div>
                </div>

                <div className="border-y border-black p-3 flex justify-between font-black text-sm uppercase items-center pb-2 pt-2 bg-slate-50">
                  <span>Net Amount</span>
                  <span className="text-base tracking-wider">₹ {Number(p.grandTotal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </div>

                <div className="p-2 pt-6 text-center flex-1 flex flex-col justify-end">
                  <div className="font-black uppercase text-[10px] mb-8 text-right tracking-widest leading-none">For {settings?.companyName || "K.K. FABRICS"}</div>
                  <div className="text-[9px] font-bold uppercase text-right opacity-60 leading-none">Authorized Signatory</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
`

const printPreviewContent = createTemplate('PrintPreview', 'booking', 'TAX INVOICE');
const purchasePrintPreviewContent = createTemplate('PurchasePrintPreview', 'purchase', 'PURCHASE BILL');
const creditNoteContent = createTemplate('CreditNotePrintPreview', 'creditNote', 'CREDIT NOTE');
const debitNoteContent = createTemplate('DebitNotePrintPreview', 'debitNote', 'DEBIT NOTE');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure numberToWords exists
if (!content.includes('numberToWords(')) {
    // Inject at the top level
    content = content.replace('function App() {', helperFunction + '\nfunction App() {');
} else {
    // If it exists replace it
    content = content.replace(/const numberToWords.*Only';\n};\n/s, helperFunction);
}

const printPreviewRegex = /function PrintPreview\(.*?\) \{[\s\S]*?(?=^function \w+|^export)/m;
const purchasePrintPreviewRegex = /function PurchasePrintPreview\(.*?\) \{[\s\S]*?(?=^function \w+|^export)/m;
const cnPreviewRegex = /function CreditNotePrintPreview\(.*?\) \{[\s\S]*?(?=^function \w+|^export)/m;
const dnPreviewRegex = /function DebitNotePrintPreview\(.*?\) \{[\s\S]*?(?=^function \w+|^export)/m;

content = content.replace(printPreviewRegex, printPreviewContent);
content = content.replace(purchasePrintPreviewRegex, purchasePrintPreviewContent);
content = content.replace(cnPreviewRegex, creditNoteContent);
content = content.replace(dnPreviewRegex, debitNoteContent);

fs.writeFileSync('src/App.tsx', content);
console.log('done ALL PRINTS');
