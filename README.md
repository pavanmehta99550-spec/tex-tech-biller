# Vyapaar Pro GST

**Vyapaar Pro GST** is a professional, lightweight GST billing and accounting solution designed for small businesses and shopkeepers. It provides a robust set of tools to manage sales, purchases, returns, and ledgers—all with the convenience of local data storage and automated backup reminders.

## 🚀 Key Features

- **GST Billing:** Create professional Sale and Purchase bills with automatic GST calculations (CGST/SGST/IGST).
- **Return Management:** Generate Credit Notes (Sales Return) and Debit Notes (Purchase Return) linked to original invoices.
- **Party Master:** Manage customer and supplier profiles with GSTIN tracking.
- **Item Master:** Pre-configure HSN codes and units for quick billing.
- **Ledger System:** Track full payment histories and outstanding balances for every party.
- **Financial Year Tracking:** View data according to the current working year.
- **Automated Backups:** Never lose data with periodic backup warnings (every 7 days) and easy Export/Import (JSON) functionality.
- **Security:** Password-protected login to keep your business data private.
- **Privacy:** All data is stored locally in your browser/PC; no sensitive data is sent to a cloud server.

## 🛠️ Tech Stack

- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Motion (Framer Motion)
- **Icons:** Lucide React
- **Build Tool:** Vite

## 💻 Local Development

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd vyapaar-pro-gst
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## 🌐 Deploying to GitHub Pages (Free Hosting)

To host this app for free on GitHub:

1. **Go to your Repository Settings** on GitHub.
2. Navigate to **Pages** (on the left sidebar).
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. GitHub will suggest a "Static Site" workflow. Click **Configure** for "Static HTML" or better, create a new workflow file at `.github/workflows/deploy.yml` with a Vite deployment script.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
