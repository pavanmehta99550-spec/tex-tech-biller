import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexToReplace = /<p className="text-\[10px\] text-slate-400 font-bold ml-1 uppercase">Default: admin \/ 1234\. Change these for security\.<\/p>\s*<\/div>\s*<div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">\s*<AlertCircle className="text-blue-600 flex-shrink-0 mt-0\.5" size=\{20\} \/>\s*<p className="text-blue-800 text-xs font-semibold leading-relaxed">\s*Note: Saving this information will automatically set you as the "Consignor" for all new bills and lock those fields to prevent editing\.\s*<\/p>\s*<\/div>\s*<div className="flex gap-4">\s*<button \s*type="submit"\s*className="flex-1 bg-\[#00cec9\] hover:bg-\[#00b8b4\] text-\[#1e272e\] font-black py-5 rounded-2xl text-xl shadow-xl shadow-\[#00cec9\]\/10 transition-all active:scale-\[0\.98\]"\s*>\s*Save & Lock Profile\s*<\/button>([\s\S]*?)<\/form>/;

const newContent = `<p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Default: admin / 1234. Change these for security.</p>
          </div>

          {/* Invoice Layout Details */}
          <div className="p-8 border-t-2 border-dashed border-slate-200 space-y-6 bg-slate-50">
            <h3 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">LT</span>
              Invoice Layout Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Table Rows Count <span className="text-purple-500 lowercase">(prevent footer shift)</span></label>
                <input 
                  type="number" 
                  value={formData.layoutSettings?.styles.tableRowsCount || 12}
                  onChange={e => setFormData({ ...formData, layoutSettings: { ...formData.layoutSettings!, styles: { ...formData.layoutSettings!.styles, tableRowsCount: parseInt(e.target.value) || 12 } } })}
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-purple-500 transition-all"
                  placeholder="12"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Top Padding (px)</label>
                <input 
                  type="number" 
                  value={formData.layoutSettings?.styles.paddingTop || 0}
                  onChange={e => setFormData({ ...formData, layoutSettings: { ...formData.layoutSettings!, styles: { ...formData.layoutSettings!.styles, paddingTop: parseInt(e.target.value) || 0 } } })}
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-purple-500 transition-all"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Company Header Font Size (px)</label>
                <input 
                  type="number" 
                  value={formData.layoutSettings?.styles.headerFontSize || 30}
                  onChange={e => setFormData({ ...formData, layoutSettings: { ...formData.layoutSettings!, styles: { ...formData.layoutSettings!.styles, headerFontSize: parseInt(e.target.value) || 30 } } })}
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-purple-500 transition-all"
                  placeholder="30"
                />
              </div>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
              <p className="text-purple-800 text-xs font-bold uppercase mb-2">Section Sequence</p>
              <div className="flex flex-wrap gap-2">
                {(formData.layoutSettings?.sectionOrder || DEFAULT_INVOICE_LAYOUT.sectionOrder).map((section: string, idx: number) => (
                  <span key={section} className="px-3 py-1 bg-white border border-purple-200 rounded-lg text-xs font-bold uppercase text-purple-700 shadow-sm flex items-center gap-1">
                    <span className="text-purple-400">{idx + 1}.</span> {section}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-purple-500 font-bold uppercase mt-2">To reorder, please contact database administrator</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 flex items-start gap-4">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-blue-800 text-xs font-semibold leading-relaxed">
              Note: Saving this information will automatically set you as the "Consignor" for all new bills and lock those fields to prevent editing.
            </p>
          </div>

          <div className="flex flex-col gap-4 p-8 pt-4">
            <div className="flex gap-4">
              <button 
                type="submit"
                className="flex-1 bg-[#00cec9] hover:bg-[#00b8b4] text-[#1e272e] font-black py-5 rounded-2xl text-xl shadow-xl shadow-[#00cec9]/10 transition-all active:scale-[0.98]"
              >
                Save & Lock Profile
              </button>
              {settings && (
                <button 
                  type="button"
                  onClick={() => setIsLocked(true)}
                  className="px-8 bg-slate-100 text-slate-400 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to restore the invoice layout to factory default?")) {
                  setFormData(prev => ({ ...prev, layoutSettings: DEFAULT_INVOICE_LAYOUT }));
                  alert("Layout restored. Click 'Save & Lock Profile' to apply changes.");
                }
              }}
              className="text-red-500 font-bold text-xs uppercase tracking-widest hover:text-red-700 transition-all mx-auto py-2"
            >
              Reset Layout to Factory Default
            </button>
          </div>
        </form>`;

content = content.replace(regexToReplace, newContent);

fs.writeFileSync('src/App.tsx', content);
