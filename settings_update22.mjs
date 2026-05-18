import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const sectionMapStr = "(settings?.layoutSettings?.sectionOrder || ['religious', 'header', 'metadata', 'table', 'footer'])";

// 1. Religious
content = content.replace(
  /<div className="text-center text-\[9px\] font-bold tracking-widest uppercase border-b border-black py-1">([\s\S]*?)\|\| SHREE GANESHAY NAMAH \|\|([\s\S]*?)<\/div>/g,
  `<div className="text-center text-[9px] font-bold tracking-widest uppercase border-b border-black py-1" style={{ order: ${sectionMapStr}.indexOf('religious') }}>$1|| SHREE GANESHAY NAMAH ||$2</div>`
);

// 2. Header
content = content.replace(
  /<div className="flex flex-col items-center justify-center py-4 border-b border-black">([\s\S]*?)<h1 className="font-black/g,
  `<div className="flex flex-col items-center justify-center py-4 border-b border-black" style={{ order: ${sectionMapStr}.indexOf('header') }}>$1<h1 className="font-black`
);

// 3. Metadata (Wrap it in a flex col div)
content = content.replace(
  /(<div className="text-center font-black text-xl tracking-\[0\.2em\] uppercase bg-black text-white py-1 border-b border-black">[\s\S]*?)<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">/g,
  `<div style={{ order: ${sectionMapStr}.indexOf('metadata'), display: 'flex', flexDirection: 'column' }}>\n$1</div>\n<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black">`
);

// 4. Table 
content = content.replace(
  /<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">/g,
  `<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black" style={{ order: ${sectionMapStr}.indexOf('table') }}>`
);

// 5. Footer - match sign/bank variant
content = content.replace(
  /<div className="border-t border-black p-2 h-\[80px\] flex items-end justify-between font-bold text-\[11px\] uppercase">/g,
  `<div style={{ order: ${sectionMapStr}.indexOf('footer'), marginTop: 'auto' }} className="border-t border-black p-2 h-[80px] flex items-end justify-between font-bold text-[11px] uppercase">`
);

content = content.replace(
  /<div className="mt-auto border-t border-black w-full">/g,
  `<div style={{ order: ${sectionMapStr}.indexOf('footer'), marginTop: 'auto' }} className="mt-auto border-t border-black w-full">`
);

// 6. Magic flex display: contents wrapper trick
content = content.replace(
  /<div className="flex-grow flex flex-col justify-between">\s*<div className="flex flex-col">/g,
  `<div className="flex-grow flex flex-col">\n<div className="flex flex-col" style={{ display: 'contents' }}>`
);

// And we make the inner wrapper display contents! THIS SAVES US FROM BREAKING CLOSING DIVS!

fs.writeFileSync('src/App.tsx', content);
