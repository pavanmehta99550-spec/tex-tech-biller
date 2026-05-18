import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexPreview = /(<\/div>\s*)(<\/div>\s*)(<\/div>\s*)(<\/motion\.div>\s*\)\s*;\s*\}\s*function)/g;
content = content.replace(regexPreview, '$1$2$3</div>\n    $4');

fs.writeFileSync('src/App.tsx', content);
