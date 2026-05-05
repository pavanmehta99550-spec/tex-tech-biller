const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
// This regex will replace 6 spaces, </div>, newline, 4 spaces, </motion.div>
// with 4 spaces, </motion.div>
content = content.replace(/      <\/div>\n    <\/motion.div>/g, '    </motion.div>');
fs.writeFileSync('src/App.tsx', content);
