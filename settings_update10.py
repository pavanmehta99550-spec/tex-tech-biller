import re

with open('src/App.tsx', 'r') as f:
    text = f.read()

# 1. Religious
text = re.sub(
    r'<div className="text-center text-\[9px\] font-bold tracking-widest uppercase border-b border-black py-1">([\s\S]*?)\|\| SHREE GANESHAY NAMAH \|\|([\s\S]*?)</div>',
    r'<div className="text-center text-[9px] font-bold tracking-widest uppercase border-b border-black py-1" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'religious\') }}>\1|| SHREE GANESHAY NAMAH ||\2</div>',
    text
)

# 2. Header
text = re.sub(
    r'<div className="flex flex-col items-center justify-center py-4 border-b border-black">([\s\S]*?)<h1 className="font-black',
    r'<div className="flex flex-col items-center justify-center py-4 border-b border-black" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'header\') }}>\1<h1 className="font-black',
    text
)

# 3. Metadata
text = re.sub(
    r'(<div className="text-center font-black text-xl tracking-\[0\.2em\] uppercase bg-black text-white py-1 border-b border-black">[\s\S]*?)<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">',
    r'<div style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'metadata\'), display: \'flex\', flexDirection: \'column\' }}>\n\1</div>\n<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black">',
    text
)

# 4. Table
text = re.sub(
    r'<table className="w-full text-\[11px\] font-bold text-center border-collapse border-b border-black">',
    r'<table className="w-full text-[11px] font-bold text-center border-collapse border-b border-black" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'table\') }}>',
    text
)

# 5. Footer
text = re.sub(
    r'<div className="mt-auto border-t border-black">',
    r'<div className="mt-auto border-t border-black w-full" style={{ order: (settings?.layoutSettings?.sectionOrder || [\'religious\', \'header\', \'metadata\', \'table\', \'footer\']).indexOf(\'footer\') }}>',
    text
)

# 6. Wrapper structure
text = re.sub(
    r'<div className="flex-grow flex flex-col justify-between">\s*<div className="flex flex-col">',
    r'<div className="flex-grow flex flex-col">\n          <div className="flex flex-col flex-grow">',
    text
)

# 7. Close wrapping properly
text = re.sub(
    r'</div>\s*<div className="mt-auto border-t border-black w-full"',
    r'<div className="mt-auto border-t border-black w-full"',
    text
)

with open('src/App.tsx', 'w') as f:
    f.write(text)
