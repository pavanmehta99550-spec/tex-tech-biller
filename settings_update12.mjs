import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<\/div>\s*<\/div>\s*<\/motion\.div>/g;
content = content.replace(regex, '</div>\n        </div>\n      </div>\n    </motion.div>');

fs.writeFileSync('src/App.tsx', content);
