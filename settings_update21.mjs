import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /(<\/div>\s*)(<\/div>\s*)(<\/motion\.div>\s*\)\s*;\s*\}\s*function TransportMasterView)/g;
content = content.replace(regex, '$1$2  </div>\n    $3');

fs.writeFileSync('src/App.tsx', content);
