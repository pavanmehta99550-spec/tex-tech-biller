import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexPreview = /function PrintPreview([\s\S]*?)<\/motion\.div>\s*\);\s*\}/g;
const regexPurchasePreview = /function PurchasePrintPreview([\s\S]*?)<\/motion\.div>\s*\);\s*\}/g;
const regexDebit = /function DebitNotePrintPreview([\s\S]*?)<\/motion\.div>\s*\);\s*\}/g;
const regexCredit = /function CreditNotePrintPreview([\s\S]*?)<\/motion\.div>\s*\);\s*\}/g;

const genReplacement = (funcName, isSales, titleStr) => {
  return \`function \${funcName}({ \${isSales ? 'booking' : (titleStr === 'PURCHASE VOUCHER' ? 'purchase' : (titleStr === 'DEBIT NOTE' ? 'debitNote' : 'creditNote'))}, settings, payments = [], creditNotes = [], onClose }: any) {
  const data = \${isSales ? 'booking' : (titleStr === 'PURCHASE VOUCHER' ? 'purchase' : (titleStr === 'DEBIT NOTE' ? 'debitNote' : 'creditNote'))};
  const printRef = React.useRef<HTMLDivElement>(null);
  const { paidAmount, balance } = React.useMemo(() => 
    getBillPaymentInfo(data.id, data.grandTotal, payments, creditNotes || [], data.billNumber),
    [data.id, data.grandTotal, payments, creditNotes, data.billNumber]
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const consigneeName = data.\${isSales ? 'consigneeName || data.partyName' : 'partyName'} || '';
  const consigneeAddress = data.\${isSales ? 'consigneeAddress || data.partyAddress' : 'partyAddress'} || '';
  const isInterstate = data.isInterstate || false;

  const layout = settings?.layoutSettings || DEFAULT_INVOICE_LAYOUT;

  const sections: Record<string, React.ReactNode> = {
    religious: (
      <div key="religious" className="text-center text-[9px] font-bold tracking-widest uppercase border-b border-black py-1">
        || SHREE GANESHAY NAMAH ||
      </div>
    ),
    header: (
      <div key="header" className="flex flex-col items-center justify-center py-4 border-b border-black">
        <h1 className="font-black uppercase tracking-tight" style={{ fontFamily: 'Georgia, serif', fontSize: layout.styles.headerFontSize + 'px', lineHeight: 1.1 }}>
          {settings?.companyName || "ANGAD SILK MILLS"}
        </h1>
        <div className="text-[11px] font-bold uppercase mt-1">
          {settings?.address || "SURAT, GUJARAT"}
        </div>
        <div className="text-[11px] font-bold uppercase mt-1">
          MO: {settings?.mobile || "9988776655"} | GSTIN: {settings?.gstin || "24AAAAA0000A1Z1"}
        </div>
      </div>
    ),
    metadata: (
      <div key="metadata" className="flex flex-col">
        <div className="text-center font-black text-xl tracking-[0.2em] uppercase bg-black text-white py-1 border-b border-black">
          \${titleStr}
        </div>
        <div className="grid grid-cols-[60%_40%] border-b border-black">
          <div className="p-2 border-r border-black font-bold text-[11px] uppercase flex flex-col">
            <span className="text-slate-500 italic underline text-[10px] mb-1">\${isSales ? 'BILLED TO (BUYER):' : (titleStr === 'PURCHASE VOUCHER' ? 'RECEIVED FROM (SELLER):' : 'PARTY DETAILS:')}</span>
            <span className="text-[13px] font-black">{consigneeName}</span>
            <span>{consigneeAddress}</span>
            <span className="mt-1 flex gap-2"><span>GSTIN:</span> <span>{data.\${isSales ? 'consigneeGstin || data.partyGstin' : 'partyGstin'} || "-"}</span></span>
          </div>
          <div className="p-2 font-bold text-[11px] uppercase flex flex-col gap-1">
            <div className="flex justify-between"><span>\${titleStr === 'TAX INVOICE' ? 'INVOICE NO' : (titleStr === 'PURCHASE VOUCHER' ? 'VOUCHER NO' : (titleStr === 'DEBIT NOTE' ? 'DN NO' : 'CN NO'))}:</span> <span># {data.billNumber}</span></div>
            <div className="flex justify-between"><span>DATE:</span> <span>{new Date(data.date).toLocaleDateString('en-GB')}</span></div>
            \${isSales || titleStr === 'PURCHASE VOUCHER' ? \`
            <div className="flex justify-between"><span>\${isSales ? 'EWB NO:' : ''}</span> <span>\${isSales ? '{data.ewayBill || data.ewbNumber || "-"}' : ''}</span></div>
            <div className="flex justify-between"><span>TRANSPORT:</span> <span>{data.transportName || "-"}</span></div>\` : ''}
            {data.parcels ? <div className="flex justify-between"><span>PARCELS:</span> <span>{data.parcels}</span></div> : null}
          </div>
        </div>
      </div>
    ),
    table: (
      <table key="table" className="w-full text-[11px] font-bold text-center border-collapse border-b border-black">
        <thead>
          <tr className="border-b border-black uppercase">
            <th className="border-r border-black p-2 w-[40px]">NO</th>
            <th className="border-r border-black p-2 text-left">DESCRIPTION OF GOODS</th>
            <th className="border-r border-black p-2 w-[60px]">HSN</th>
            <th className="border-r border-black p-2 w-[70px]">QTY</th>
            <th className="border-r border-black p-2 w-[70px]">RATE</th>
            <th className="p-2 w-[90px] text-right">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {(data.items || []).map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-black/20">
              <td className="border-r border-black p-2 align-top">{idx + 1}</td>
              <td className="border-r border-black p-2 uppercase text-left align-top flex justify-between">
                <span>{item.name}</span>
                {item.color && <span className="text-[10px]">({item.color})</span>}
              </td>
              <td className="border-r border-black p-2 align-top">{item.hsnCode}</td>
              <td className="border-r border-black p-2 uppercase align-top">{parseFloat(item.quantity?.toString() || "0").toFixed(2)} {item.unit}</td>
              <td className="border-r border-black p-2 align-top">{parseFloat(item.rate?.toString() || "0").toFixed(2)}</td>
              <td className="p-2 text-right align-top">{parseFloat(item.amount?.toString() || "0").toFixed(2)}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, (layout.styles.tableRowsCount || 12) - (data.items?.length || 0)) }).map((_, i) => (
            <tr key={'empty'+i} className="border-b border-black/20" style={{ height: '24px' }}>
              <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    footer: (
      <div key="footer" className="mt-auto flex flex-col">
        <div className="grid grid-cols-[60%_40%]">
          <div className="p-2 border-r border-black flex flex-col justify-between font-bold text-[11px] uppercase">
            \${isSales ? \`
            <div className="mb-2">
              <div className="underline italic text-slate-500 text-[10px] mb-1">BANK TRANSFER DETAILS:</div>
              <div className="grid grid-cols-[60px_1fr] gap-x-2">
                <span>BANK:</span> <span>{settings?.bankName || "-"}</span>
                <span>A/C NO:</span> <span className="tracking-widest">{settings?.accountNumber || "-"}</span>
                <span>IFSC:</span> <span>{settings?.ifscCode || settings?.ifsc || "-"}</span>
              </div>
            </div>
            <div>
               <span className="underline italic text-slate-500 text-[10px]">AMOUNT IN WORDS:</span>
               <div className="mt-0.5 leading-tight">{numberToWords(parseFloat(data.grandTotal?.toString() || "0"))} RUPEES ONLY</div>
            </div>
            \` : \`
            <div className="flex items-center justify-center h-full text-slate-500 italic">
              \${titleStr === 'PURCHASE VOUCHER' ? 'VERIFICATION COPY FOR ACCOUNTS' : (titleStr === 'DEBIT NOTE' ? 'SALES RETURN / DIFFERENCE IN VALUE' : 'PURCHASE RETURN / DIFFERENCE IN VALUE')}
            </div>
            \`}
          </div>
          
          <div className="flex flex-col font-bold text-[11px] uppercase">
            <div className="p-2 space-y-1 flex-grow">
              <div className="flex justify-between">
                <span>\${isSales || titleStr === 'DEBIT NOTE' || titleStr === 'CREDIT NOTE' ? 'TAXABLE VALUE' : 'BASE VALUE'}:</span>
                <span>{parseFloat(data.taxableValue?.toString() || data.basicAmount?.toString() || "0").toFixed(2)}</span>
              </div>
              \${isSales || titleStr === 'DEBIT NOTE' || titleStr === 'CREDIT NOTE' ? \`
              {isInterstate ? (
                <div className="flex justify-between"><span>IGST:</span><span>{parseFloat(data.igstAmount?.toString() || data.taxAmount?.toString() || "0").toFixed(2)}</span></div>
              ) : (
                <>
                  <div className="flex justify-between"><span>CGST:</span><span>{parseFloat(data.cgstAmount?.toString() || (Number(data.taxAmount || 0)/2).toString()).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>SGST:</span><span>{parseFloat(data.sgstAmount?.toString() || (Number(data.taxAmount || 0)/2).toString()).toFixed(2)}</span></div>
                </>
              )}
              \` : \`
              <div className="flex justify-between"><span>TAX TOTAL:</span><span>{parseFloat(data.taxAmount?.toString() || "0").toFixed(2)}</span></div>
              \`}
              {parseFloat(data.globalDiscount?.toString() || "0") > 0 && (
                <div className="flex justify-between text-red-600"><span>DISCOUNT:</span><span>-{parseFloat(data.globalDiscount?.toString() || "0").toFixed(2)}</span></div>
              )}
            </div>
            <div className="border-t border-black p-2 bg-black text-white flex justify-between font-black text-lg">
              <span>NET AMOUNT</span>
              <span>₹ {parseFloat(data.grandTotal?.toString() || "0").toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>
        
        <div className="border-t border-black p-2 h-[80px] flex items-end justify-between font-bold text-[11px] uppercase">
          <div className="flex flex-col justify-end h-full">
            \${isSales ? \`
            <div className="text-[9px] italic text-slate-500">TERMS & CONDITIONS:</div>
            <div className="text-[9px]">1. GOODS ONCE SOLD WILL NOT BE TAKEN BACK.</div>
            <div className="text-[9px]">2. SUBJECT TO SURAT JURISDICTION.</div>
            \` : \`
            <div className="text-[9px] italic text-slate-500">\${titleStr === 'PURCHASE VOUCHER' ? 'INPUT TAX CREDIT VERIFIED' : ''}</div>
            \`}
          </div>
          <div className="text-center w-[180px] flex flex-col justify-between h-full">
            <div className="text-[10px] font-black">
              \${titleStr === 'PURCHASE VOUCHER' ? '' : 'FOR '}{(settings?.companyName || "ANGAD SILK MILLS")}
            </div>
            <div className="border-t border-black pt-1 mt-auto">
              \${titleStr === 'PURCHASE VOUCHER' ? 'AUTHORISED RECEIVER' : 'AUTHORISED SIGNATORY'}
            </div>
          </div>
        </div>
      </div>
    )
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-[9999] flex items-start justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white"
    >
      <div id="bill-print-area" className="w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between bg-white text-black font-sans shadow-2xl relative print:shadow-none print:m-0 print:p-0 print:bg-white rounded-none border border-black" style={{ paddingTop: layout.styles.paddingTop + 'px', paddingBottom: layout.styles.paddingBottom + 'px' }}>
        
        <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
          <button onClick={() => window.print()} className="bg-[#00cec9] text-black px-4 py-2 font-black tracking-widest rounded uppercase shadow-xl hover:bg-[#00b8b4]">Print (Enter)</button>
          <button onClick={onClose} className="bg-slate-200 text-slate-600 px-4 py-2 font-bold rounded uppercase hover:bg-slate-300">Close (Esc)</button>
        </div>

        <div className="flex-grow flex flex-col justify-between">
          <div className="flex flex-col flex-grow">
            {layout.sectionOrder.map((section: string) => sections[section])}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
\`
}

content = content.replace(regexPreview, genReplacement('PrintPreview', true, 'TAX INVOICE'));
content = content.replace(regexPurchasePreview, genReplacement('PurchasePrintPreview', false, 'PURCHASE VOUCHER'));
content = content.replace(regexDebit, genReplacement('DebitNotePrintPreview', false, 'DEBIT NOTE'));
content = content.replace(regexCredit, genReplacement('CreditNotePrintPreview', false, 'CREDIT NOTE'));

fs.writeFileSync('src/App.tsx', content);
