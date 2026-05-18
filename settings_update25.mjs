import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Update Debit Note Entry UI (starts around 4277)
const debitNoteUIRegex = /<div className="bg-red-50\/50 p-8 rounded-3xl border-2 border-dashed border-red-200 text-right space-y-2">\s*<div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹\{Number\(calc\.taxableValue\)\.toFixed\(2\)\}<\/span><\/div>\s*<div className="text-slate-500 font-bold text-sm">GST \(\{formData\.taxRate\}%\): <span className="text-slate-900">₹\{Number\(calc\.tax\)\.toFixed\(2\)\}<\/span><\/div>\s*<div className="text-4xl font-black text-slate-900 tracking-tighter">Debit Amount: <span className="text-red-700">₹\{Number\(calc\.total\)\.toFixed\(2\)\}<\/span><\/div>\s*<\/div>/g;

content = content.replace(debitNoteUIRegex, `<div className="bg-red-50/50 p-8 rounded-3xl border-2 border-dashed border-red-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{Number(calc.taxableValue).toFixed(2)}</span></div>
          {calc.isInterstate ? (
            <div className="text-slate-500 font-bold text-sm">IGST ({formData.taxRate}%): <span className="text-slate-900">₹{Number(calc.igst).toFixed(2)}</span></div>
          ) : (
            <>
              <div className="text-slate-500 font-bold text-sm">CGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.cgst).toFixed(2)}</span></div>
              <div className="text-slate-500 font-bold text-sm">SGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.sgst).toFixed(2)}</span></div>
            </>
          )}
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Debit Amount: <span className="text-red-700">₹{Number(calc.total).toFixed(2)}</span></div>
        </div>`);

// Update Credit Note Entry UI (starts around 5993)
const creditNoteUIRegex = /<div className="bg-green-50\/50 p-8 rounded-3xl border-2 border-dashed border-green-200 text-right space-y-2">\s*<div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹\{Number\(calc\.taxableValue\)\.toFixed\(2\)\}<\/span><\/div>\s*<div className="text-slate-500 font-bold text-sm">GST \(\{formData\.taxRate\}%\): <span className="text-slate-900">₹\{Number\(calc\.tax\)\.toFixed\(2\)\}<\/span><\/div>\s*<div className="text-4xl font-black text-slate-900 tracking-tighter">Credit Amount: <span className="text-green-700">₹\{Number\(calc\.total\)\.toFixed\(2\)\}<\/span><\/div>\s*<\/div>/g;

content = content.replace(creditNoteUIRegex, `<div className="bg-green-50/50 p-8 rounded-3xl border-2 border-dashed border-green-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{Number(calc.taxableValue).toFixed(2)}</span></div>
          {calc.isInterstate ? (
            <div className="text-slate-500 font-bold text-sm">IGST ({formData.taxRate}%): <span className="text-slate-900">₹{Number(calc.igst).toFixed(2)}</span></div>
          ) : (
            <>
              <div className="text-slate-500 font-bold text-sm">CGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.cgst).toFixed(2)}</span></div>
              <div className="text-slate-500 font-bold text-sm">SGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.sgst).toFixed(2)}</span></div>
            </>
          )}
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Credit Amount: <span className="text-green-700">₹{Number(calc.total).toFixed(2)}</span></div>
        </div>`);

// Also fix Debit/Credit save logic to save all parameters. Use regex matching exact code.
const debitNoteSaveRegex = /onSave\(\{\.\.\.formData,\s*taxAmount:\s*calc\.tax,\s*grandTotal:\s*calc\.total\}\);/g;
content = content.replace(debitNoteSaveRegex, `onSave({
            ...formData, 
            taxAmount: calc.tax, 
            grandTotal: calc.total,
            taxableValue: calc.taxableValue,
            cgstAmount: calc.cgst,
            sgstAmount: calc.sgst,
            igstAmount: calc.igst,
            isInterstate: calc.isInterstate
          });`);

fs.writeFileSync('src/App.tsx', content);

console.log("Updated CN DN UI and save calls.");
