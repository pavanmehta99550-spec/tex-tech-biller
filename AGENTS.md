# Project Specific Instructions

## Print & Billing Layout
- **Mantra**: Every bill/invoice header must start with `|| HAR HAR MAHADEV ||` centered and bold.
- **Table Height**: The item table must NOT have manual empty spacer rows. It should use `height: auto` so that the footer (Bank Details/Signatory) starts immediately after the last item.
- **Printing**: Always use `@media print` rules to hide buttons and ensure the container fits A4 width (210mm).
- **Alignment**: Bank Details and Terms must be on the left, and "Authorised Signatory" must be on the right in the footer.

## Calculation Logic
- **Parsing**: Always use `parseFloat(value?.toString() || "0")` for Quantity, Rate, and Discount to prevent `NaN` (Not a Number) errors.
- **Taxable Value**: Ensure Taxable Value is calculated as `(Gross Total - Item Discount) - Global Discount`.

## UI Consistency
- **Buttons**: The 'Print' and 'Download' buttons should only be visible on screen and must be hidden in the actual printout using the `.no-print` class or `@media print`.
