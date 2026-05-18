import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexPreview = /function PrintPreview\([\s\S]*?<\/motion\.div>\s*\);\s*\}/g;
const matchPrintPreview = content.match(regexPreview);

if (matchPrintPreview) {
    // I can't easily parse out sections without risking breaking the logic.
    // However, I can redefine PrintPreview by writing it here using raw string.
}
