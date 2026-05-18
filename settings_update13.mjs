import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Reverse settings_update12.mjs
const regex12 = /<\/div>\n        <\/div>\n      <\/div>\n    <\/motion\.div>/g;
content = content.replace(regex12, '</div>\n      </div>\n    </motion.div>');

fs.writeFileSync('src/App.tsx', content);
