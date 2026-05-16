import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexToRemove = /\{\s*Array\.from\(\{\s*length:\s*Math\.max\(0,\s*12\s*-\s*\(\s*data\.items\?\.length\s*\|\|\s*0\s*\)\s*\)\s*\}\)\.map\(\(_,\s*i\)\s*=>\s*\([\s\S]*?<\/tr>\s*\)\)\s*\}/g;

content = content.replace(regexToRemove, "");

const transportDiv = /<div className="flex justify-between"><span>TRANSPORT:<\/span> <span>\{data\.transportName \|\| "-"\}<\/span><\/div>/g;
content = content.replace(transportDiv, `<div className="flex justify-between"><span>TRANSPORT:</span> <span>{data.transportName || "-"}</span></div>
                {data.parcels ? <div className="flex justify-between"><span>PARCELS:</span> <span>{data.parcels}</span></div> : null}`);

fs.writeFileSync('src/App.tsx', content);
