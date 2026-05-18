import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// For the 4 extra divs, they are right before </motion.div>
const regexExtraDiv = /(<\/div>\s*)(<\/div>\s*)(<\/div>\s*)(<\/div>\s*)(<\/motion\.div>\s*\)\s*;\s*\})/g;
content = content.replace(regexExtraDiv, '$1$2$3$5');

// For the missing div in PartyMasterView
// The error is at 9547 in the current lint output.
fs.writeFileSync('src/App.tsx', content);
