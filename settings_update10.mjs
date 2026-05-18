import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexReligious = /<div className="text-center text-\[9px\] font-bold tracking-widest uppercase border-b border-black py-1">([\s\S]*?)\|\| SHREE GANESHAY NAMAH \|\|([\s\S]*?)<\/div>/g;
content = content.replace(regexReligious, \`<div className="text-center text-[9px] font-bold tracking-widest uppercase border-b border-black py-1" style={{ order: (settings?.layoutSettings?.sectionOrder || ['religious', 'header', 'metadata', 'table', 'footer']).indexOf('religious') }}>$1|| SHREE GANESHAY NAMAH ||$2</div>\`);

const regexHeader = /<div className="flex flex-col items-center justify-center py-4 border-b border-black">([\s\S]*?)<h1 className="font-black/g;
content = content.replace(regexHeader, \`<div className="flex flex-col items-center justify-center py-4 border-b border-black" style={{ order: (settings?.layoutSettings?.sectionOrder || ['religious', 'header', 'metadata', 'table', 'footer']).indexOf('header') }}>$1<h1 className="font-black\`);

// Metadata has Title + Grid. Wrap them in a div? 
// In the current layout, there's a title <div> and a grid <div>.
const regexMeta = /<div className="text-center font-black text-xl tracking-\[0\.2em\] uppercase bg-black text-white py-1 border-b border-black">([\s\S]*?)<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">/g;
content = content.replace(regexMeta, (match, p1) => {
    return \`<div style={{ order: (settings?.layoutSettings?.sectionOrder || ['religious', 'header', 'metadata', 'table', 'footer']).indexOf('metadata'), display: 'flex', flexDirection: 'column' }}>
              <div className="text-center font-black text-xl tracking-[0.2em] uppercase bg-black text-white py-1 border-b border-black">\${p1}</div>
            <table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black">\`;
});

// Table
const regexTable = /<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">([\s\S]*?)<\/table>/g;
content = content.replace(regexTable, \`<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black" style={{ order: (settings?.layoutSettings?.sectionOrder || ['religious', 'header', 'metadata', 'table', 'footer']).indexOf('table') }}>$1</table>\`);

// Footer
const regexFooter = /<div className="mt-auto border-t border-black">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/motion\.div>/g;
content = content.replace(regexFooter, \`<div className="mt-auto border-t border-black w-full" style={{ order: (settings?.layoutSettings?.sectionOrder || ['religious', 'header', 'metadata', 'table', 'footer']).indexOf('footer') }}>$1</div>
        </div>
      </div>
    </motion.div>\`);

// Fix flex wrappers
const regexWrapper = /<div className="flex-grow flex flex-col justify-between">\s*<div className="flex flex-col">/g;
content = content.replace(regexWrapper, \`<div className="flex-grow flex flex-col">
          <div className="flex flex-col flex-grow"\`);

fs.writeFileSync('src/App.tsx', content);
