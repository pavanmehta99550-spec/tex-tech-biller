import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `          </div>

        </div>
      </div>
    </div>
    </motion.div>`;

const replacementStr = `          </div>

        </div>
      </div>
    </motion.div>`;

content = content.replace(new RegExp(targetStr.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replacementStr);

fs.writeFileSync('src/App.tsx', content);
