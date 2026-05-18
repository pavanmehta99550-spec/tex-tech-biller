import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexReligious = /<div className="text-center text-\[9px\] font-bold tracking-widest uppercase border-b border-black py-1">([\s\S]*?)\|\| SHREE GANESHAY NAMAH \|\|([\s\S]*?)<\/div>/g;
content = content.replace(regexReligious, '<div className="text-center text-[9px] font-bold tracking-widest uppercase border-b border-black py-1" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'religious\') }}>$1|| SHREE GANESHAY NAMAH ||$2</div>');

const regexHeader = /<div className="flex flex-col items-center justify-center py-4 border-b border-black">([\s\S]*?)<h1 className="font-black/g;
content = content.replace(regexHeader, '<div className="flex flex-col items-center justify-center py-4 border-b border-black" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'header\') }}>$1<h1 className="font-black');

const regexMeta = /(<div className="text-center font-black text-xl tracking-\[0\.2em\] uppercase bg-black text-white py-1 border-b border-black">[\s\S]*?)<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">/g;
content = content.replace(regexMeta, '<div style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'metadata\'), display: \'flex\', flexDirection: \'column\' }}>\n$1</div>\n<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black">');

const regexTable = /<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">/g;
content = content.replace(regexTable, '<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'table\') }}>');

const regexFooter = /<div className="mt-auto border-t border-black">/g;
content = content.replace(regexFooter, '<div className="mt-auto border-t border-black w-full" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'footer\') }}>');

const regexWrapper = /<div className="flex-grow flex flex-col justify-between">\s*<div className="flex flex-col">/g;
content = content.replace(regexWrapper, '<div className="flex-grow flex flex-col">\n          <div className="flex flex-col flex-grow">');

const regexWrapperClose = /<\/div>\s*<div className="mt-auto border-t border-black w-full"/g;
content = content.replace(regexWrapperClose, '<div className="mt-auto border-t border-black w-full"');

fs.writeFileSync('src/App.tsx', content);
