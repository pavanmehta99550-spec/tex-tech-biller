import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<td className="p-2 text-right align-top">\{parseFloat\(item\.amount\?\.toString\(\) \|\| "0"\)\.toFixed\(2\)\}<\/td>\s*<\/tr>\s*\)\)\}[ \t\n]*(\/\* Dynamic Placeholder Rows \*\/)?\s*<\/tbody>/g;

const replacement = `<td className="p-2 text-right align-top">{parseFloat(item.amount?.toString() || "0").toFixed(2)}</td>
                  </tr>
                ))}
                {/* Dynamic Placeholder Rows */}
                {Array.from({ length: Math.max(0, (settings?.layoutSettings?.styles?.tableRowsCount || 12) - (data.items?.length || 0)) }).map((_, i) => (
                  <tr key={'empty'+i} className="border-b border-black/20" style={{ height: '24px' }}>
                    <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
                  </tr>
                ))}
              </tbody>`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
