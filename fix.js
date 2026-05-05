import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/e\.target\.value as any/g, "e.target.value === '' ? '' : (parseFloat(e.target.value) || '') as any");
content = content.replace(/parseFloat\(e\.target\.value\) \|\| 0/g, "parseFloat(e.target.value) || ''");

fs.writeFileSync('src/App.tsx', content);
console.log('done');
