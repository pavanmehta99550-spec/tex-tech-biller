import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<div id="bill-print-area" className="w-full max-w-\[210mm\] min-h-\[297mm\] flex flex-col justify-between bg-white text-black font-sans shadow-2xl relative print:shadow-none print:m-0 print:p-0 print:bg-white rounded-none border border-black">/g;

// To output \${...} in output
const replacement = '<div id="bill-print-area" className="w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between bg-white text-black font-sans shadow-2xl relative print:shadow-none print:m-0 print:p-0 print:bg-white rounded-none border border-black" style={{ paddingTop: `${settings?.layoutSettings?.styles?.paddingTop || 0}px`, paddingBottom: `${settings?.layoutSettings?.styles?.paddingBottom || 0}px` }}>';

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
