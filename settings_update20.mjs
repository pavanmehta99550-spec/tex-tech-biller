import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /(<\/div>\s*)(<\/div>\s*)(<\/motion\.div>\s*\)\s*;\s*\}\s*function SignatureAndBankView)/g;
content = content.replace(regex, '$1$2  </div>\n    $3');

const regex9542 = /(<\/div>\s*)(<\/div>\s*)(<\/motion\.div>\s*\)\s*;\s*\}\s*function UserManagementView)/g;
content = content.replace(regex9542, '$1$2  </div>\n    $3');

fs.writeFileSync('src/App.tsx', content);
