import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const defaultLayoutSettings = {
  styles: {
    tableRowsCount: 12,
    paddingTop: 0,
    paddingBottom: 0,
    headerFontSize: 30
  },
  sectionOrder: ["religious", "header", "metadata", "table", "footer"]
};

// I will insert `DEFAULT_INVOICE_LAYOUT` before SettingsView.
const settingsViewRegex = /function SettingsView\(\{\s*settings,\s*onSave\s*\}\s*:\s*any\)\s*\{/;

content = content.replace(settingsViewRegex, `const DEFAULT_INVOICE_LAYOUT = {
  styles: {
    tableRowsCount: 12,
    paddingTop: 0,
    paddingBottom: 0,
    headerFontSize: 30
  },
  sectionOrder: ["religious", "header", "metadata", "table", "footer"]
};

function SettingsView({ settings, onSave }: any) {`);

fs.writeFileSync('src/App.tsx', content);
