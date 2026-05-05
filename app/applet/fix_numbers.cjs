const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/e\.target\.value as any/g, "e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) as any");

fs.writeFileSync('src/App.tsx', content);
console.log('done');
