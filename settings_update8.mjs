import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<h1 className="font-black text-3xl uppercase tracking-tight" style=\{\{ fontFamily: 'Georgia, serif' \}\}>/g;
const replacement = '<h1 className="font-black text-3xl uppercase tracking-tight" style={{ fontFamily: \'Georgia, serif\', fontSize: `${settings?.layoutSettings?.styles?.headerFontSize || 30}px` }}>';

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
