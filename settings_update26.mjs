import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const debitNoteSaveRegex = /grandTotal: data.grandTotal \|\| 0,\s*date: data.date \|\| new Date\(\)\.toISOString\(\),/g;
content = content.replace(debitNoteSaveRegex, `grandTotal: data.grandTotal || 0,
      taxableValue: data.taxableValue || 0,
      cgstAmount: data.cgstAmount || 0,
      sgstAmount: data.sgstAmount || 0,
      igstAmount: data.igstAmount || 0,
      isInterstate: data.isInterstate || false,
      date: data.date || new Date().toISOString(),`);
      
// This should match both Debit Note and Credit Note since they share the same structure!
fs.writeFileSync('src/App.tsx', content);

console.log("Updated handleSave functions safely.");
