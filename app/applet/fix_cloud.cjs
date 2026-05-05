const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "{currentView !== 'dash' && (",
  "{currentView !== 'dash' && currentView !== 'ledger' && ("
);

fs.writeFileSync('src/App.tsx', content);
console.log('done');
