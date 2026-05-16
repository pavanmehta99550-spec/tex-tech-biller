import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /function PrintPreview\([\s\S]*?getBillPaymentInfo\(data\.id, data\.grandTotal, payments\),\s+\[data\.id, data\.grandTotal, payments\]\s+\);/m,
  `function PrintPreview({ booking, settings, payments = [], creditNotes = [], onClose }: { booking: any, settings: any | null, payments?: any[], creditNotes?: any[], onClose: () => void }) {
  const data = booking;
  const printRef = React.useRef<HTMLDivElement>(null);
  const { paidAmount, balance } = React.useMemo(() => 
    getBillPaymentInfo(data.id, data.grandTotal, payments, creditNotes, booking.billNumber),
    [data.id, data.grandTotal, payments, creditNotes, booking.billNumber]
  );`
);
fs.writeFileSync('src/App.tsx', content);
