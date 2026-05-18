import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Reverse regexWrapperClose
content = content.replace(/<div className="mt-auto border-t border-black w-full"(.*?)>/g, '</div>\n<div className="mt-auto border-t border-black w-full"$1>');

// Reverse regexWrapper
content = content.replace(/<div className="flex-grow flex flex-col">\s*<div className="flex flex-col flex-grow">/g, '<div className="flex-grow flex flex-col justify-between">\n          <div className="flex flex-col">');

// Remove the inline style orders
content = content.replace(/ style=\{\{ order: \(settings\?\.layoutSettings\?\.sectionOrder \|\| \['religious', 'header', 'metadata', 'table', 'footer'\]\)\.indexOf\('[^']+'\)(, display: 'flex', flexDirection: 'column')? \}\}/g, '');

// Reverse metadata split
content = content.replace(/<div( style=\{\{.*?\}\})?>\s*<div className="text-center font-black text-xl tracking-\[0\.2em\] uppercase bg-black text-white py-1 border-b border-black">([\s\S]*?)<\/div>\s*<table/g, '<div className="text-center font-black text-xl tracking-[0.2em] uppercase bg-black text-white py-1 border-b border-black">$2</div>\n<table');

fs.writeFileSync('src/App.tsx', content);
