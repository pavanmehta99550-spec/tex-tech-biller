import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{\/\* Right Side: Totals \*\/\}\s*<div className="flex flex-col font-bold text-\[11px\] uppercase">\s*<div className="p-2 space-y-1 flex-grow">([\s\S]*?)<\/div>\s*<div className="border-t border-black p-2 bg-black text-white flex justify-between font-black text-lg">/g;

content = content.replace(regex, (match, p1) => {
    return `{/* Right Side: Totals */}
              <div className="flex flex-col font-bold text-[11px] uppercase">
                <div className="p-2 space-y-1 flex-grow">
                  <div className="flex justify-between"><span>TAXABLE VALUE:</span><span>{parseFloat(data.taxableValue?.toString() || data.basicAmount?.toString() || "0").toFixed(2)}</span></div>
                  {isInterstate ? (
                    <div className="flex justify-between"><span>IGST:</span><span>{parseFloat(data.igstAmount?.toString() || data.taxAmount?.toString() || "0").toFixed(2)}</span></div>
                  ) : (
                    <>
                      <div className="flex justify-between"><span>CGST:</span><span>{parseFloat(data.cgstAmount?.toString() || (Number(data.taxAmount || 0)/2).toString()).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>SGST:</span><span>{parseFloat(data.sgstAmount?.toString() || (Number(data.taxAmount || 0)/2).toString()).toFixed(2)}</span></div>
                    </>
                  )}
                  {parseFloat(data.globalDiscount?.toString() || "0") > 0 && (
                    <div className="flex justify-between text-red-600"><span>DISCOUNT:</span><span>-{parseFloat(data.globalDiscount?.toString() || "0").toFixed(2)}</span></div>
                  )}
                </div>
                <div className="border-t border-black p-2 bg-black text-white flex justify-between font-black text-lg">`;
});

// We should also replace the data.isInterstate for CreditNote and DebitNote.
// Let's replace `const data = creditNote;` with `const data = creditNote;\n  const isInterstate = data.isInterstate || false;`
content = content.replace(/const data = creditNote;/g, 'const data = creditNote;\n  const isInterstate = data.isInterstate || false;');
content = content.replace(/const data = debitNote;/g, 'const data = debitNote;\n  const isInterstate = data.isInterstate || false;');

fs.writeFileSync('src/App.tsx', content);

console.log("Updated correctly.");
