import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix mistake in LedgerView's select
content = content.replace(
  /onChange=\{\(e\) => setBillFilter\(e.target.value === '' \? '' : \(parseFloat\(e.target.value\) \|\| ''\) as any\)\}/g,
  "onChange={(e) => setBillFilter(e.target.value as any)}"
);

content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, paymentMode: e.target.value === '' \? '' : \(parseFloat\(e.target.value\) \|\| ''\) as any \}\)\}/g,
  "onChange={e => setFormData({ ...formData, paymentMode: e.target.value as any })}"
);

content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, unit: e.target.value === '' \? '' : \(parseFloat\(e.target.value\) \|\| ''\) as any \}\)\}/g,
  "onChange={e => setFormData({ ...formData, unit: e.target.value as any })}"
);

content = content.replace(
  /onChange=\{e => updateItem\(item.id, 'unit', e.target.value === '' \? '' : \(parseFloat\(e.target.value\) \|\| ''\) as any\)\}/g,
  "onChange={e => updateItem(item.id, 'unit', e.target.value as any)}"
);

fs.writeFileSync('src/App.tsx', content);
console.log('done select fix');
