import fs from 'fs';

const printPreviewContent = `
function PrintPreview({ booking, settings, payments = [], onClose }: { booking: Booking, settings: AppSettings | null, payments?: Payment[], onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const { paidAmount, balance, status } = useMemo(() => 
    getBillPaymentInfo(booking.id, booking.grandTotal, payments),
    [booking.id, booking.grandTotal, payments]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto"
    >
      <div className="bg-white w-full max-w-4xl min-h-[A4] shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden"
        >
          <ChevronLeft size={24} />
        </button>

        <div ref={printRef} className="print-container bg-white p-8 print:p-0">
          <div className="border border-black">
            
            {/* Header section (if contact is needed) */}
            <div className="p-2 text-[10px] font-bold uppercase border-b border-black flex justify-between">
              <span>CONTACT: {settings?.mobile || booking.consigneeMobile || ''}</span>
              <span>INVOICE #{booking.billNumber} | DATE: {new Date(booking.date).toLocaleDateString()}</span>
            </div>

            {/* Table */}
            <table className="w-full text-xs font-bold text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase">
                  <th className="border-r border-black p-2 text-left w-2/5">ITEM NAME</th>
                  <th className="border-r border-black p-2">HSN</th>
                  <th className="border-r border-black p-2">QTY</th>
                  <th className="border-r border-black p-2">RATE</th>
                  <th className="p-2 text-right">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                {booking.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b border-black">
                    <td className="border-r border-black p-2 text-left uppercase">
                      {item.name}
                      {item.color && <div className="text-[9px] mt-1">{item.color}</div>}
                    </td>
                    <td className="border-r border-black p-2">{item.hsnCode}</td>
                    <td className="border-r border-black p-2 uppercase">{item.quantity} {item.unit}</td>
                    <td className="border-r border-black p-2">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-2 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {/* Empty rows to stretch */}
                {Array.from({ length: Math.max(0, 5 - booking.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="border-b border-black h-10">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom calculation Section */}
            <div className="grid grid-cols-2 border-t border-black">
              {/* Left Side: Bank Details */}
              <div className="border-r border-black p-4">
                {settings?.bankName ? (
                  <div className="text-[10px]">
                    <div className="font-bold flex items-center gap-1 mb-2">
                      <span>🏦</span> BANK DETAILS
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-y-1 font-bold">
                      <span>BANK:</span>
                      <span className="uppercase">{settings.bankName}</span>
                      <span>A/C NO:</span>
                      <span>{settings.accountNumber}</span>
                      <span>IFSC:</span>
                      <span>{settings.ifsc}</span>
                      <span>BRANCH:</span>
                      <span className="uppercase">{settings.branch}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 italic">No bank details added</div>
                )}
              </div>

              {/* Right Side: Totals */}
              <div className="text-xs font-bold flex flex-col justify-between">
                <div className="p-2 px-4 space-y-1">
                  <div className="flex justify-between">
                    <span>BASIC AMOUNT:</span>
                    <span>₹{Number(booking.basicAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  {booking.globalDiscount > 0 && (
                     <div className="flex justify-between">
                       <span>DISCOUNT:</span>
                       <span>- ₹{Number(booking.globalDiscount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST TOTAL:</span>
                    <span>₹{Number(booking.taxAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                <div className="border-y border-black p-2 px-4 flex justify-between text-base font-black">
                  <span>Grand Total:</span>
                  <span>₹{Number(booking.grandTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>

                <div className="p-2 px-4 space-y-1 mt-1 pb-2">
                  <div className="flex justify-between text-[10px]">
                    <span>PAID:</span>
                    <span>₹{Number(paidAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black">
                    <span>BALANCE:</span>
                    <span>₹{Number(balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Footer */}
            <div className="border-t border-black p-4 flex justify-between items-end h-32">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">
                SALE ENTRY LOGGED !
              </div>
              <div className="text-center">
                <div className="text-[9px] text-gray-400 mb-6 font-bold uppercase">SIGN / STAMP</div>
                <div className="w-48 h-px bg-black opacity-30 mb-1 mx-auto"></div>
                <div className="text-[9px] font-black uppercase">AUTHORIZED ENTRY</div>
                <div className="text-[8px] text-gray-500 uppercase">{settings?.companyName || "PRO BILLER SALE"}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
`;

const purchasePrintPreviewContent = `
function PurchasePrintPreview({ purchase, settings, payments = [], onClose }: { purchase: Purchase, settings: AppSettings | null, payments?: Payment[], onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const { paidAmount, balance, status } = useMemo(() => 
    getBillPaymentInfo(purchase.id, purchase.grandTotal, payments),
    [purchase.id, purchase.grandTotal, payments]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto"
    >
      <div className="bg-white w-full max-w-4xl min-h-[A4] shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden"
        >
          <ChevronLeft size={24} />
        </button>

        <div ref={printRef} className="print-container bg-white p-8 print:p-0">
          <div className="border border-black">
            
            {/* Header section (if contact is needed) */}
            <div className="p-2 text-[10px] font-bold uppercase border-b border-black flex justify-between">
              <span>CONTACT: {purchase.partyMobile || ''}</span>
              <span>PURCHASE REF #{purchase.billNumber} | DATE: {new Date(purchase.date).toLocaleDateString()}</span>
            </div>

            {/* Table */}
            <table className="w-full text-xs font-bold text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase">
                  <th className="border-r border-black p-2 text-left w-2/5">ITEM NAME</th>
                  <th className="border-r border-black p-2">HSN</th>
                  <th className="border-r border-black p-2">QTY</th>
                  <th className="border-r border-black p-2">RATE</th>
                  <th className="p-2 text-right">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b border-black">
                    <td className="border-r border-black p-2 text-left uppercase">
                      {item.name}
                      {item.color && <div className="text-[9px] mt-1">{item.color}</div>}
                    </td>
                    <td className="border-r border-black p-2">{item.hsnCode}</td>
                    <td className="border-r border-black p-2 uppercase">{item.quantity} {item.unit}</td>
                    <td className="border-r border-black p-2">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-2 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {/* Empty rows to stretch */}
                {Array.from({ length: Math.max(0, 5 - purchase.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="border-b border-black h-10">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom calculation Section */}
            <div className="grid grid-cols-2 border-t border-black">
              {/* Left Side: Bank Details */}
              <div className="border-r border-black p-4">
                {settings?.bankName ? (
                  <div className="text-[10px]">
                    <div className="font-bold flex items-center gap-1 mb-2">
                      <span>🏦</span> BANK DETAILS
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-y-1 font-bold">
                      <span>BANK:</span>
                      <span className="uppercase">{settings.bankName}</span>
                      <span>A/C NO:</span>
                      <span>{settings.accountNumber}</span>
                      <span>IFSC:</span>
                      <span>{settings.ifsc}</span>
                      <span>BRANCH:</span>
                      <span className="uppercase">{settings.branch}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 italic">No bank details added</div>
                )}
              </div>

              {/* Right Side: Totals */}
              <div className="text-xs font-bold flex flex-col justify-between">
                <div className="p-2 px-4 space-y-1">
                  <div className="flex justify-between">
                    <span>BASIC AMOUNT:</span>
                    <span>₹{Number(purchase.basicAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  {purchase.globalDiscount > 0 && (
                     <div className="flex justify-between">
                       <span>DISCOUNT:</span>
                       <span>- ₹{Number(purchase.globalDiscount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST TOTAL:</span>
                    <span>₹{Number(purchase.taxAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                <div className="border-y border-black p-2 px-4 flex justify-between text-base font-black">
                  <span>Grand Total:</span>
                  <span>₹{Number(purchase.grandTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>

                <div className="p-2 px-4 space-y-1 mt-1 pb-2">
                  <div className="flex justify-between text-[10px]">
                    <span>PAID:</span>
                    <span>₹{Number(paidAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black">
                    <span>BALANCE:</span>
                    <span>₹{Number(balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Footer */}
            <div className="border-t border-black p-4 flex justify-between items-end h-32">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">
                PURCHASE ENTRY LOGGED !
              </div>
              <div className="text-center">
                <div className="text-[9px] text-gray-400 mb-6 font-bold uppercase">SIGN / STAMP</div>
                <div className="w-48 h-px bg-black opacity-30 mb-1 mx-auto"></div>
                <div className="text-[9px] font-black uppercase">AUTHORIZED ENTRY</div>
                <div className="text-[8px] text-gray-500 uppercase">PRO BILLER PURCHASE</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
`;

let content = fs.readFileSync('src/App.tsx', 'utf8');

const printPreviewRegex = /function PrintPreview\(.*?\) \{[\s\S]*?(?=^function \w+|^export)/m;
const purchasePrintPreviewRegex = /function PurchasePrintPreview\(.*?\) \{[\s\S]*?(?=^function \w+|^export)/m;

content = content.replace(printPreviewRegex, printPreviewContent);
content = content.replace(purchasePrintPreviewRegex, purchasePrintPreviewContent);

fs.writeFileSync('src/App.tsx', content);
console.log('done');
