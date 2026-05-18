import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// For PurchaseView
// Around 3324:
const purchaseSaveRegex = /onSave\(\{\s*\.\.\.formData,\s*taxAmount:\s*calc\.tax,\s*grandTotal:\s*calc\.total\s*\}\);/g;
content = content.replace(purchaseSaveRegex, `onSave({ 
            ...formData, 
            taxAmount: calc.tax, 
            grandTotal: calc.total,
            taxableValue: calc.taxableValue,
            cgstAmount: calc.cgst,
            sgstAmount: calc.sgst,
            igstAmount: calc.igst,
            isInterstate: calc.isInterstate
          });`);

// For DebitNoteView & CreditNoteView
// Let's modify their calculation logic directly.
// In DebitNoteView
const debitNoteCalcRegex = /const calc = useMemo\(\(\) => \{\s*const basicAmount = Math\.round\(formData\.items\.reduce\(\(sum, item\) => sum \+ \(Number\(item\.amount\) \|\| 0\), 0\)\);\s*const taxableValue = Math\.round\(Math\.max\(0, basicAmount - \(Number\(formData\.globalDiscount\) \|\| 0\)\)\);\s*const tax = Math\.round\(taxableValue \* \(Number\(formData\.taxRate\) \/ 100\)\);\s*return \{ basicAmount, taxableValue, tax, total: Math\.round\(taxableValue \+ tax\) \};\s*\}, \[formData\.items, formData\.globalDiscount, formData\.taxRate\]\);/g;

content = content.replace(debitNoteCalcRegex, `const calc = useMemo(() => {
    const basicAmount = Math.round(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    const taxableValue = Math.round(Math.max(0, basicAmount - (Number(formData.globalDiscount) || 0)));
    const tax = taxableValue * (Number(formData.taxRate) / 100);
    
    // Determine CGST/SGST vs IGST
    const buyerStateCode = settings?.gstin?.substring(0, 2) || formData.consigneeGstin?.substring(0, 2);
    const supplierStateCode = formData.partyGstin?.substring(0, 2);
    const isInterstate = buyerStateCode && supplierStateCode && buyerStateCode !== supplierStateCode;
    
    const cgst = isInterstate ? 0 : tax / 2;
    const sgst = isInterstate ? 0 : tax / 2;
    const igst = isInterstate ? tax : 0;
    
    return { 
        basicAmount, 
        taxableValue, 
        tax, 
        total: Math.round(taxableValue + tax),
        cgst,
        sgst,
        igst,
        isInterstate
    };
  }, [formData.items, formData.globalDiscount, formData.taxRate, formData.partyGstin, settings?.gstin, formData.consigneeGstin]);`);

fs.writeFileSync('src/App.tsx', content);

console.log("Replaced calculations and saves.");
