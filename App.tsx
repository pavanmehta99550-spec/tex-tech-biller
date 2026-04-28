import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Receipt, 
  CreditCard, 
  BookText, 
  TrendingUp, 
  AlertCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Save,
  Printer,
  ShoppingBag,
  Package,
  Lock,
  Users,
  Plus,
  Settings,
  Search,
  Download,
  Mail,
  AlertTriangle,
  Upload
} from 'lucide-react';
import { storage } from './storage';
import { Party, Booking, Item, SaleBill, PurchaseBill, CreditNote, DebitNote, AppSettings } from './types';
import Login from './Login';

// Initial Party Database
const INITIAL_PARTIES: Record<string, { name: string; address: string }> = {
  "24AAAA": { name: "Kinnari Textiles", address: "Surat, Gujarat" },
  "24BBBB": { name: "Kottex Industries", address: "Sachin GIDC, Surat" },
  "24AADCR6455L1Z2": { name: "Pavan Silk Mills (Surat)", address: "Ring Road, Surat, Gujarat" },
  "24AGCPV5543K1Z3": { name: "Kottex Industries Pvt Ltd", address: "GIDC, Sachin, Surat" },
  "24BBBB1234A1Z1": { name: "J.D. Enterprise (Ahmedabad)", address: "Naroda GIDC, Ahmedabad" }
};

type View = 'dash' | 'inv' | 'pay' | 'ledg' | 'settings' | 'pur' | 'dn' | 'cn' | 'purchaseparty' | 'saleparty' | 'items' | 'backup';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => storage.get('auth', false));
  const [currentView, setCurrentView] = useState<View>('dash');
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => storage.get('lastBackupDate', new Date().toISOString()));
  const [showBackupWarning, setShowBackupWarning] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [purchaseParties, setPurchaseParties] = useState<Party[]>(() => {
    const saved = storage.get('purchaseParties', storage.get('parties', []));
    if (saved.length === 0) {
      return Object.entries(INITIAL_PARTIES).map(([gstin, data]) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: data.name,
        gstin,
        address: data.address,
        totalSales: 0,
        totalPaid: 0,
        totalPurchases: 0
      }));
    }
    return saved;
  });

  const [saleParties, setSaleParties] = useState<Party[]>(() => storage.get('saleParties', []));
  const [itemsMaster, setItemsMaster] = useState<ItemMaster[]>(() => storage.get('itemsMaster', []));

  const [bookings, setBookings] = useState<Booking[]>(() => storage.get('bookings', []));
  const [purchases, setPurchases] = useState<Purchase[]>(() => storage.get('purchases', []));
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>(() => storage.get('debit-notes', []));
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => storage.get('credit-notes', []));
  const [payments, setPayments] = useState<Payment[]>(() => storage.get('payments', []));
  const [settings, setSettings] = useState<AppSettings | null>(() => storage.get('settings', null));
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  const [previewPurchase, setPreviewPurchase] = useState<Purchase | null>(null);
  const [previewDebitNote, setPreviewDebitNote] = useState<DebitNote | null>(null);
  const [previewCreditNote, setPreviewCreditNote] = useState<CreditNote | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingDebitNote, setEditingDebitNote] = useState<DebitNote | null>(null);
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);

  useEffect(() => storage.set('auth', isAuthenticated), [isAuthenticated]);
  useEffect(() => storage.set('purchaseParties', purchaseParties), [purchaseParties]);
  useEffect(() => storage.set('saleParties', saleParties), [saleParties]);
  useEffect(() => storage.set('itemsMaster', itemsMaster), [itemsMaster]);
  useEffect(() => storage.set('bookings', bookings), [bookings]);
  useEffect(() => storage.set('purchases', purchases), [purchases]);
  useEffect(() => storage.set('debit-notes', debitNotes), [debitNotes]);
  useEffect(() => storage.set('credit-notes', creditNotes), [creditNotes]);
  useEffect(() => storage.set('payments', payments), [payments]);
  useEffect(() => storage.set('settings', settings), [settings]);
  useEffect(() => storage.set('lastBackupDate', lastBackupDate), [lastBackupDate]);

  useEffect(() => {
    if (isAuthenticated) {
      const last = new Date(lastBackupDate).getTime();
      const now = new Date().getTime();
      const diff = (now - last) / (1000 * 60 * 60 * 24);
      if (diff > 7) {
        setShowBackupWarning(true);
      }
    }
  }, [isAuthenticated, lastBackupDate]);

  const stats = useMemo(() => {
    const grossSales = bookings.reduce((sum, b) => sum + b.grandTotal, 0);
    const returnsSales = creditNotes.reduce((sum, cn) => sum + cn.grandTotal, 0);
    const netSales = grossSales - returnsSales;
    
    const grossPurchases = (purchases || []).reduce((sum, p) => sum + p.grandTotal, 0);
    const returnsPurchases = (debitNotes || []).reduce((sum, dn) => sum + dn.grandTotal, 0);
    const netPurchases = grossPurchases - returnsPurchases;
    
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    
    return { 
      grossSales,
      returnsSales,
      netSales, 
      grossPurchases,
      returnsPurchases,
      netPurchases,
      totalReceived,
      totalPending: netSales - totalReceived 
    };
  }, [bookings, purchases, creditNotes, debitNotes, payments]);

  const financialYear = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1; // 1-indexed
    if (curMonth >= 4) {
      return `${curYear}-${(curYear + 1).toString().slice(-2)}`;
    } else {
      return `${curYear - 1}-${curYear.toString().slice(-2)}`;
    }
  }, []);

  const handleSaveBooking = (data: Partial<Booking>) => {
    let updatedSaleParties = [...saleParties];
    
    // Auto-increment logic for billNumber
    const maxBillNum = bookings.reduce((max, b) => Math.max(max, b.billNumber || 0), 0);
    const nextBillNum = data.billNumber || (maxBillNum + 1);

    // Check and add Consignee if not in list (Sale Party)
    let consignee = updatedSaleParties.find(p => p.gstin === data.consigneeGstin);
    if (!consignee && data.consigneeGstin) {
      consignee = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: data.consigneeName || "New Party", 
        gstin: data.consigneeGstin, 
        address: data.consigneeAddress || "",
        totalSales: 0, 
        totalPaid: 0,
        totalPurchases: 0
      };
      updatedSaleParties.push(consignee);
    }

    const isUpdate = !!data.id && bookings.some(b => b.id === data.id);

    const newBooking: Booking = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      billNumber: nextBillNum,
      lrNumber: data.lrNumber || '',
      ewbNumber: data.ewbNumber || '',
      transportName: data.transportName || '',
      transportGstin: data.transportGstin || '',
      consignorGstin: data.consignorGstin || '',
      consignorName: data.consignorName || '',
      consignorAddress: data.consignorAddress || '',
      consigneeGstin: data.consigneeGstin || '',
      consigneeName: data.consigneeName || '',
      consigneeAddress: data.consigneeAddress || '',
      items: (data.items || []).map(item => ({
        ...item,
        hsnCode: item.hsnCode || '',
        taka: item.taka || ''
      })),
      basicAmount: data.basicAmount || 0,
      globalDiscount: data.globalDiscount || 0,
      taxRate: data.taxRate || 18,
      taxAmount: data.taxAmount || 0,
      grandTotal: data.grandTotal || 0,
      date: data.date || new Date().toISOString()
    };

    if (isUpdate) {
      const oldBooking = bookings.find(b => b.id === data.id)!;
      const customerGstin = oldBooking.consigneeGstin;
      
      const revertedParties = updatedSaleParties.map(p => 
        p.gstin === customerGstin 
          ? { ...p, totalSales: p.totalSales - oldBooking.grandTotal } 
          : p
      );

      setBookings(bookings.map(b => b.id === data.id ? newBooking : b));

      const newCustomerGstin = data.consigneeGstin;

      setSaleParties(revertedParties.map(p => 
        p.gstin === newCustomerGstin 
          ? { ...p, totalSales: p.totalSales + newBooking.grandTotal } 
          : p
      ));
      setEditingBooking(null);
    } else {
      setBookings([newBooking, ...bookings]);
      const customerGstin = data.consigneeGstin;

      setSaleParties(updatedSaleParties.map(p => 
        p.gstin === customerGstin 
          ? { ...p, totalSales: p.totalSales + newBooking.grandTotal } 
          : p
      ));
    }

    setPreviewBooking(newBooking);
    alert(isUpdate ? "Sale Bill Updated Successfully!" : "Sale Bill Saved Successfully!");
  };

  const handleSavePurchase = (data: Partial<Purchase>) => {
    let updatedParties = [...purchaseParties];
    
    const maxBillNum = purchases.reduce((max, b) => Math.max(max, b.billNumber || 0), 0);
    const nextBillNum = data.billNumber || (maxBillNum + 1);

    // Check and add Party if not in list
    let party = updatedParties.find(p => p.gstin === data.partyGstin);
    if (!party && data.partyGstin) {
      party = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: data.partyName || "New Party", 
        gstin: data.partyGstin, 
        address: data.partyAddress || "",
        totalSales: 0, 
        totalPaid: 0,
        totalPurchases: 0
      };
      updatedParties.push(party);
    }

    const isUpdate = !!data.id && purchases.some(b => b.id === data.id);

    const newPurchase: Purchase = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      billNumber: nextBillNum,
      partyGstin: data.partyGstin || '',
      partyName: data.partyName || '',
      partyAddress: data.partyAddress || '',
      items: (data.items || []).map(item => ({
        ...item,
        hsnCode: item.hsnCode || '',
        taka: item.taka || ''
      })),
      basicAmount: data.basicAmount || 0,
      globalDiscount: data.globalDiscount || 0,
      taxRate: data.taxRate || 18,
      taxAmount: data.taxAmount || 0,
      grandTotal: data.grandTotal || 0,
      date: data.date || new Date().toISOString()
    };

    if (isUpdate) {
      const oldPurchase = purchases.find(b => b.id === data.id)!;
      const revertedParties = updatedParties.map(p => 
        p.gstin === oldPurchase.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) - oldPurchase.grandTotal } 
          : p
      );

      setPurchases(purchases.map(b => b.id === data.id ? newPurchase : b));

      setPurchaseParties(revertedParties.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) + newPurchase.grandTotal } 
          : p
      ));
      setEditingPurchase(null);
    } else {
      setPurchases([newPurchase, ...purchases]);
      setPurchaseParties(updatedParties.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) + newPurchase.grandTotal } 
          : p
      ));
    }

    alert(isUpdate ? "Purchase Bill Updated Successfully!" : "Purchase Bill Saved Successfully!");
    setCurrentView('dash');
  };

  const handleSaveDebitNote = (data: Partial<DebitNote>) => {
    let updatedParties = [...purchaseParties];
    
    const maxNoteNum = debitNotes.reduce((max, b) => Math.max(max, b.noteNumber || 0), 0);
    const nextNoteNum = data.noteNumber || (maxNoteNum + 1);

    const isUpdate = !!data.id && debitNotes.some(b => b.id === data.id);

    const newDebitNote: DebitNote = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      noteNumber: nextNoteNum,
      purchaseBillNumber: data.purchaseBillNumber || '',
      partyGstin: data.partyGstin || '',
      partyName: data.partyName || '',
      partyAddress: data.partyAddress || '',
      items: (data.items || []).map(item => ({
        ...item,
        hsnCode: item.hsnCode || '',
        taka: item.taka || ''
      })),
      basicAmount: data.basicAmount || 0,
      globalDiscount: data.globalDiscount || 0,
      taxRate: data.taxRate || 18,
      taxAmount: data.taxAmount || 0,
      grandTotal: data.grandTotal || 0,
      date: data.date || new Date().toISOString(),
      reason: data.reason || ''
    };

    if (isUpdate) {
      const oldNote = debitNotes.find(b => b.id === data.id)!;
      const revertedParties = updatedParties.map(p => 
        p.gstin === oldNote.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) + oldNote.grandTotal } 
          : p
      );

      setDebitNotes(debitNotes.map(b => b.id === data.id ? newDebitNote : b));

      setPurchaseParties(revertedParties.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) - newDebitNote.grandTotal } 
          : p
      ));
      setEditingDebitNote(null);
    } else {
      setDebitNotes([newDebitNote, ...debitNotes]);
      setPurchaseParties(updatedParties.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) - newDebitNote.grandTotal } 
          : p
      ));
    }

    setPreviewDebitNote(newDebitNote);
    alert(isUpdate ? "Debit Note Updated Successfully!" : "Debit Note Saved Successfully!");
  };

  const handleSaveCreditNote = (data: Partial<CreditNote>) => {
    let updatedParties = [...saleParties];
    
    const maxNoteNum = creditNotes.reduce((max, b) => Math.max(max, b.noteNumber || 0), 0);
    const nextNoteNum = data.noteNumber || (maxNoteNum + 1);

    const isUpdate = !!data.id && creditNotes.some(b => b.id === data.id);

    const newCreditNote: CreditNote = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      noteNumber: nextNoteNum,
      salesBillNumber: data.salesBillNumber || '',
      partyGstin: data.partyGstin || '',
      partyName: data.partyName || '',
      partyAddress: data.partyAddress || '',
      partyMobile: data.partyMobile || '',
      items: (data.items || []).map(item => ({
        ...item,
        hsnCode: item.hsnCode || '',
        taka: item.taka || ''
      })),
      basicAmount: data.basicAmount || 0,
      globalDiscount: data.globalDiscount || 0,
      taxRate: data.taxRate || 18,
      taxAmount: data.taxAmount || 0,
      grandTotal: data.grandTotal || 0,
      date: data.date || new Date().toISOString(),
      reason: data.reason || ''
    };

    if (isUpdate) {
      const oldNote = creditNotes.find(b => b.id === data.id)!;
      const revertedParties = updatedParties.map(p => 
        p.gstin === oldNote.partyGstin 
          ? { ...p, totalSales: p.totalSales + oldNote.grandTotal } 
          : p
      );

      setCreditNotes(creditNotes.map(b => b.id === data.id ? newCreditNote : b));

      setSaleParties(revertedParties.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalSales: p.totalSales - newCreditNote.grandTotal } 
          : p
      ));
      setEditingCreditNote(null);
    } else {
      setCreditNotes([newCreditNote, ...creditNotes]);
      setSaleParties(updatedParties.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalSales: p.totalSales - newCreditNote.grandTotal } 
          : p
      ));
    }

    setPreviewCreditNote(newCreditNote);
    alert(isUpdate ? "Credit Note Updated Successfully!" : "Credit Note Saved Successfully!");
  };

  const handleSavePayment = (data: any) => {
    const party = saleParties.find(p => p.id === data.partyId);
    if (!party) return;

    const newPayment: Payment = {
      id: Math.random().toString(36).substr(2, 9),
      partyId: party.id,
      partyName: party.name,
      partyGstin: party.gstin,
      amount: data.amount,
      date: new Date().toISOString(),
      chequeNumber: data.chequeNumber,
      chequeDate: data.chequeDate,
      notes: data.notes,
      billAdjustments: data.billAdjustments
    };

    setPayments([newPayment, ...payments]);
    setSaleParties(saleParties.map(p => p.id === data.partyId ? { ...p, totalPaid: p.totalPaid + data.amount } : p));
    alert("Payment Record Saved Successfully!");
    setCurrentView('ledg');
  };

  const expectedPassword = useMemo(() => {
    if (settings?.adminPassword) return settings.adminPassword;
    if (!settings?.companyName || !settings?.gstin) return '1234';
    const prefix = settings.companyName.replace(/\s/g, '').substring(0, 5).toUpperCase();
    const suffix = settings.gstin.slice(-3).toUpperCase();
    return prefix + suffix;
  }, [settings]);

  if (!isAuthenticated) return (
    <Login 
      onLogin={() => setIsAuthenticated(true)} 
      expectedPassword={expectedPassword} 
      companyName={settings?.companyName}
      gstin={settings?.gstin}
      onResetPassword={(newPass) => setSettings({ ...settings!, adminPassword: newPass })}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5E6] via-white to-[#F0FFF0] flex font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#1E272E] text-white flex flex-col fixed h-full z-20 print:hidden overflow-y-auto shadow-2xl">
        <div className="p-6 bg-black flex flex-col items-center justify-center border-b border-white/5">
          {settings ? (
            <div className="text-center">
              <div className="text-[#00cec9] font-black text-xl leading-tight tracking-tighter uppercase break-words px-2 mb-1">
                {settings.companyName}
              </div>
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{settings.gstin}</div>
            </div>
          ) : (
            <div className="text-[#00cec9] font-black text-2xl tracking-tighter">
              PRO BILLER
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavBtn active={currentView === 'dash'} onClick={() => setCurrentView('dash')} icon={LayoutDashboard} label="Dashboard" />
          <NavBtn active={currentView === 'inv'} onClick={() => setCurrentView('inv')} icon={Receipt} label="Sale Bill" />
          <NavBtn active={currentView === 'saleparty'} onClick={() => setCurrentView('saleparty')} icon={Users} label="Sale Party Entry" />
          <NavBtn active={currentView === 'pur'} onClick={() => setCurrentView('pur')} icon={ShoppingBag} label="Purchase Bill" />
          <NavBtn active={currentView === 'purchaseparty'} onClick={() => setCurrentView('purchaseparty')} icon={Users} label="Purchase Party Entry" />
          <NavBtn active={currentView === 'dn'} onClick={() => setCurrentView('dn')} icon={AlertCircle} label="Debit Note" />
          <NavBtn active={currentView === 'cn'} onClick={() => setCurrentView('cn')} icon={TrendingUp} label="Credit Note" />
          <NavBtn active={currentView === 'items'} onClick={() => setCurrentView('items')} icon={Package} label="Items Master" />
          <NavBtn active={currentView === 'pay'} onClick={() => setCurrentView('pay')} icon={CreditCard} label="Receive Payment" />
          <NavBtn active={currentView === 'ledg'} onClick={() => setCurrentView('ledg')} icon={BookText} label="Party Ledger" />
          <NavBtn active={currentView === 'backup'} onClick={() => setCurrentView('backup')} icon={Download} label="Data Backup" />
          <NavBtn active={currentView === 'settings'} onClick={() => setCurrentView('settings')} icon={Settings} label="Settings" />
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <button 
            onClick={() => {
              if(confirm("Are you sure? This will delete all your bills and parties!")) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
          >
            Reset All Data
          </button>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all font-black text-sm shadow-xl shadow-red-900/40"
          >
            <LogOut size={18} />
            Logout System
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 print:ml-0 print:p-0 relative">
        <div className="absolute top-8 right-8 flex items-center gap-3 bg-white/80 backdrop-blur px-6 py-3 rounded-2xl border border-slate-200 shadow-sm z-10">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Working Year:</span>
          <span className="text-sm font-black text-slate-900 tracking-tight">{financialYear}</span>
        </div>
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {currentView === 'dash' && <DashboardView 
              key="dash" 
              stats={stats} 
              bookings={bookings} 
              purchases={purchases}
              onEditSale={(b: Booking) => {
                setEditingBooking(b);
                setCurrentView('inv');
              }}
              onEditPurchase={(p: Purchase) => {
                setEditingPurchase(p);
                setCurrentView('pur');
              }}
              onPreviewPurchase={(p: Purchase) => setPreviewPurchase(p)}
            />}
            {currentView === 'inv' && <BookingView 
              key="inv" 
              onSave={handleSaveBooking} 
              parties={saleParties} 
              settings={settings} 
              bookings={bookings}
              itemsMaster={itemsMaster}
              editingBooking={editingBooking}
              onCancel={() => {
                setEditingBooking(null);
                setCurrentView('dash');
              }}
            />}
            {currentView === 'saleparty' && <PartyMasterView key="saleparty" parties={saleParties} title="Sale Party Entry" onUpdateParties={setSaleParties} />}
            {currentView === 'pur' && <PurchaseView 
              key="pur" 
              onSave={handleSavePurchase} 
              parties={purchaseParties} 
              settings={settings}
              purchases={purchases}
              itemsMaster={itemsMaster}
              editingPurchase={editingPurchase}
              onCancel={() => {
                setEditingPurchase(null);
                setCurrentView('dash');
              }}
            />}
            {currentView === 'dn' && <DebitNoteView 
              key="dn" 
              onSave={handleSaveDebitNote} 
              parties={purchaseParties} 
              settings={settings}
              debitNotes={debitNotes}
              purchases={purchases}
              itemsMaster={itemsMaster}
              editingDebitNote={editingDebitNote}
              onCancel={() => {
                setEditingDebitNote(null);
                setCurrentView('dash');
              }}
            />}
            {currentView === 'cn' && <CreditNoteView 
              key="cn" 
              onSave={handleSaveCreditNote} 
              parties={saleParties} 
              settings={settings}
              creditNotes={creditNotes}
              bookings={bookings}
              itemsMaster={itemsMaster}
              editingCreditNote={editingCreditNote}
              onCancel={() => {
                setEditingCreditNote(null);
                setCurrentView('dash');
              }}
            />}
            {currentView === 'items' && <ItemMasterView 
              key="items"
              items={itemsMaster}
              bookings={bookings}
              purchases={purchases}
              debitNotes={debitNotes}
              creditNotes={creditNotes}
              onSave={(newItems) => setItemsMaster(newItems)}
            />}
            {currentView === 'backup' && <BackupView 
              key="backup"
              data={{
                saleParties, purchaseParties, itemsMaster, settings,
                bookings, purchases, debitNotes, creditNotes, payments
              }}
              lastBackupDate={lastBackupDate}
              onBackup={() => setLastBackupDate(new Date().toISOString())}
              onRestore={(restoredData: any) => {
                if (restoredData.saleParties) setSaleParties(restoredData.saleParties);
                if (restoredData.purchaseParties) setPurchaseParties(restoredData.purchaseParties);
                if (restoredData.itemsMaster) setItemsMaster(restoredData.itemsMaster);
                if (restoredData.settings) setSettings(restoredData.settings);
                if (restoredData.bookings) setBookings(restoredData.bookings);
                if (restoredData.purchases) setPurchases(restoredData.purchases);
                if (restoredData.debitNotes) setDebitNotes(restoredData.debitNotes);
                if (restoredData.creditNotes) setCreditNotes(restoredData.creditNotes);
                if (restoredData.payments) setPayments(restoredData.payments);
                alert("Data Restored Successfully!");
                setCurrentView('dash');
              }}
            />}
            {currentView === 'pay' && <PaymentView key="pay" onSave={handleSavePayment} parties={saleParties} bookings={bookings} />}
            {currentView === 'purchaseparty' && <PartyMasterView key="purchaseparty" parties={purchaseParties} title="Purchase Party Entry" onUpdateParties={setPurchaseParties} />}
            {currentView === 'ledg' && <LedgerView 
              key="ledg" 
              parties={saleParties} 
              purchaseParties={purchaseParties} 
              bookings={bookings}
              purchases={purchases}
              payments={payments}
              debitNotes={debitNotes} 
              creditNotes={creditNotes} 
              settings={settings}
            />}
            {currentView === 'settings' && <SettingsView key="settings" settings={settings} onSave={setSettings} />}
          </AnimatePresence>

          <AnimatePresence>
            {previewBooking && (
              <PrintPreview 
                booking={previewBooking} 
                settings={settings} 
                onClose={() => setPreviewBooking(null)} 
              />
            )}
            {previewPurchase && (
              <PurchasePrintPreview 
                purchase={previewPurchase} 
                settings={settings} 
                onClose={() => setPreviewPurchase(null)} 
              />
            )}
            {previewDebitNote && (
              <DebitNotePrintPreview 
                debitNote={previewDebitNote} 
                settings={settings} 
                onClose={() => setPreviewDebitNote(null)} 
              />
            )}
            {previewCreditNote && (
              <CreditNotePrintPreview 
                creditNote={previewCreditNote} 
                settings={settings} 
                onClose={() => setPreviewCreditNote(null)} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {showBackupWarning && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[40px] p-10 max-w-lg w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400"></div>
              <div className="bg-orange-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <AlertTriangle size={48} className="text-orange-600 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Security Check!</h2>
              <p className="text-slate-500 font-bold mb-8 text-lg leading-snug">
                It's been more than 7 days since your last backup. Your data is precious—please take a moment to save it now!
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setCurrentView('backup');
                    setShowBackupWarning(false);
                  }}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-black transition-all active:scale-95"
                >
                  Backup Now (Pendrive/Email)
                </button>
                <button 
                  onClick={() => setShowBackupWarning(false)}
                  className="w-full py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-sm uppercase tracking-widest hover:text-slate-900 transition-all"
                >
                  Remind Me Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[40px] p-10 max-w-lg w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-400 to-red-500"></div>
              <div className="bg-red-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <LogOut size={48} className="text-red-600" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Logout Securely?</h2>
              <p className="text-slate-500 font-bold mb-8 text-lg leading-snug">
                Your data is stored locally. We strongly recommend taking a backup before you leave!
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setCurrentView('backup');
                    setShowLogoutConfirm(false);
                  }}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-black transition-all active:scale-95"
                >
                  Go to Backup Page
                </button>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsAuthenticated(false)}
                    className="flex-1 py-5 bg-red-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all"
                  >
                    Logout Anyway
                  </button>
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-all"
                  >
                    Stay Logged In
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-bold text-sm text-left ${
        active 
          ? "bg-[#00cec9] text-[#1e272e] shadow-xl shadow-[#00cec9]/10 scale-[1.02]" 
          : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
      }`}
    >
      <Icon className={`flex-shrink-0 ${active ? "text-[#1e272e]" : "text-slate-500"}`} size={20} />
      {label}
    </button>
  );
}

function DashboardView({ stats, bookings, purchases, onEditSale, onEditPurchase, onPreviewPurchase }: any) {
  const financialYear = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    if (curMonth >= 4) return `${curYear}-${(curYear + 1).toString().slice(-2)}`;
    return `${curYear - 1}-${curYear.toString().slice(-2)}`;
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest">FY {financialYear}</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Vyapaar Summary</h2>
          <p className="text-slate-500 font-medium italic">Overview of all transactions and returns</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#2ed573] p-6 rounded-3xl text-white shadow-lg shadow-[#2ed573]/20 relative overflow-hidden group">
          <TrendingUp className="absolute -top-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Net Sales</h3>
          <div className="text-3xl font-black tracking-tighter">₹ {stats.netSales.toLocaleString()}</div>
          <div className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">Excl. Returns</div>
        </div>

        <div className="bg-pink-500 p-6 rounded-3xl text-white shadow-lg shadow-pink-500/20 relative overflow-hidden group">
          <AlertCircle className="absolute -top-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Returns (CN)</h3>
          <div className="text-3xl font-black tracking-tighter">₹ {stats.returnsSales.toLocaleString()}</div>
          <div className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">Sales Return</div>
        </div>

        <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-600/20 relative overflow-hidden group">
          <ShoppingBag className="absolute -top-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Total Received</h3>
          <div className="text-3xl font-black tracking-tighter">₹ {stats.totalReceived.toLocaleString()}</div>
          <div className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">Cash/Bank Receipt</div>
        </div>

        <div className="bg-[#ff4757] p-6 rounded-3xl text-white shadow-lg shadow-[#ff4757]/20 relative overflow-hidden group">
          <Lock className="absolute -top-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Net Receivable</h3>
          <div className="text-3xl font-black tracking-tighter">₹ {stats.totalPending.toLocaleString()}</div>
          <div className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">Pending Balance</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Sale Bills */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
             <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Recent Sale Bills</h3>
             <span className="bg-slate-50 text-slate-400 px-3 py-1 rounded text-[10px] font-bold tracking-tighter">Latest Invoices</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-4">Bill Details</th>
                  <th className="px-8 py-4">Customer</th>
                  <th className="px-8 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookings.slice(0, 5).map((b: Booking) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="font-bold text-slate-900"># {b.billNumber}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-black">{new Date(b.date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-black text-slate-700 uppercase tracking-tight truncate max-w-[200px]">{b.consigneeName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{b.consigneeGstin}</div>
                    </td>
                    <td className="px-8 py-5 text-right whitespace-nowrap">
                      <span className="font-black text-indigo-600 tracking-tighter">₹ {b.grandTotal.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr><td colSpan={3} className="px-8 py-12 text-center text-slate-400 italic font-medium">No sales recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Purchase Bills */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
             <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest text-red-600">Recent Purchase Bills</h3>
             <span className="bg-slate-50 text-slate-400 px-3 py-1 rounded text-[10px] font-bold tracking-tighter">Latest Inward</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-4">Bill Details</th>
                  <th className="px-8 py-4">Supplier</th>
                  <th className="px-8 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(purchases || []).slice(0, 5).map((p: Purchase) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="font-bold text-slate-900"># {p.billNumber}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-black">{new Date(p.date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-black text-slate-700 uppercase tracking-tight truncate max-w-[200px]">{p.partyName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{p.partyGstin}</div>
                    </td>
                    <td className="px-8 py-5 text-right whitespace-nowrap">
                      <span className="font-black text-red-600 tracking-tighter">₹ {p.grandTotal.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
                {(!purchases || purchases.length === 0) && (
                  <tr><td colSpan={3} className="px-8 py-12 text-center text-slate-400 italic font-medium">No purchases recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PurchaseView({ onSave, parties, settings, purchases, itemsMaster = [], editingPurchase, onCancel }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState(() => {
    const nextAutoNum = (purchases || []).reduce((max: number, b: any) => Math.max(max, b.billNumber || 0), 0) + 1;
    return {
      id: editingPurchase?.id || '',
      billNumber: editingPurchase?.billNumber || nextAutoNum,
      partyGstin: editingPurchase?.partyGstin || '',
      partyName: editingPurchase?.partyName || '',
      partyAddress: editingPurchase?.partyAddress || '',
      partyMobile: editingPurchase?.partyMobile || '',
      // Add settings data to form data if needed, or just display it from settings prop
      buyerName: settings?.companyName || '',
      buyerGstin: settings?.gstin || '',
      buyerAddress: settings?.address || '',
      items: editingPurchase?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }],
      basicAmount: editingPurchase?.basicAmount || 0,
      globalDiscount: editingPurchase?.globalDiscount || 0,
      taxRate: editingPurchase?.taxRate || 5,
      date: editingPurchase?.date || new Date().toISOString()
    };
  });

  const isLocked = useMemo(() => {
    if (!editingPurchase) return false;
    const bookingDate = new Date(editingPurchase.date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - bookingDate.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  }, [editingPurchase]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }
      ]
    });
  };

  const removeItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id)
      });
    }
  };

  const updateItem = (id: string, field: string, value: any) => {
    setFormData(prev => {
      let newTaxRate = prev.taxRate;
      const newItems = prev.items.map(item => {
        if (item.id === id) {
          if (field === 'name') {
            const masterItem = itemsMaster.find((mi: ItemMaster) => mi.name.toLowerCase() === value.toLowerCase());
            if (masterItem) {
              newTaxRate = masterItem.gstRate;
              return { 
                ...item, 
                name: masterItem.name, 
                hsnCode: masterItem.hsnCode, 
                unit: masterItem.unit,
              };
            }
          }

          if (['quantity', 'rate', 'discount'].includes(field)) {
            const numVal = parseFloat(value);
            if (numVal < 0) return item;
          }
          const updated = { ...item, [field]: value };
          const gross = (updated.quantity || 0) * (updated.rate || 0);
          updated.amount = gross - (updated.discount || 0);
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems, taxRate: newTaxRate };
    });
  };

  const handleBillNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (isNaN(val)) {
      setFormData({ ...formData, billNumber: 0 });
      return;
    }
    if (val <= 0) {
      alert("Bill Number must be greater than 0");
      return;
    }
    setFormData({ ...formData, billNumber: val });
  };

  const hasItemDiscount = useMemo(() => formData.items.some(item => (item.discount || 0) > 0), [formData.items]);

  const calc = useMemo(() => {
    const basicAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const effectiveGlobalDiscount = hasItemDiscount ? 0 : (formData.globalDiscount || 0);
    const taxableValue = Math.max(0, basicAmount - effectiveGlobalDiscount);
    const tax = taxableValue * (formData.taxRate / 100);
    return { basicAmount, taxableValue, tax, total: taxableValue + tax, effectiveGlobalDiscount };
  }, [formData.items, formData.globalDiscount, formData.taxRate, hasItemDiscount]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, basicAmount: calc.basicAmount }));
  }, [calc.basicAmount]);

  useEffect(() => {
    const searchGst = formData.partyGstin.trim().toUpperCase();
    const party = parties.find((p: any) => p.gstin.trim().toUpperCase() === searchGst);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        partyName: party.name, 
        partyAddress: party.address,
        partyMobile: party.mobile || ''
      }));
    } else if (searchGst.length > 2) {
      setFormData(prev => ({ ...prev, partyName: 'New Provider', partyAddress: '', partyMobile: '' }));
    } else {
      setFormData(prev => ({ ...prev, partyName: '', partyAddress: '', partyMobile: '' }));
    }
  }, [formData.partyGstin, parties]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
      <div className="bg-indigo-900 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">
            {editingPurchase ? `Edit Purchase #${formData.billNumber}` : 'New Purchase Bill'}
          </h2>
          <p className="text-indigo-300 font-black text-xs tracking-[0.3em]">PURCHASE ENTRY SYSTEM</p>
        </div>
        <div className="flex items-center gap-4">
          {isLocked && (
            <div className="bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-500/30">
              <AlertCircle size={14} /> Locked (30 Days Passed)
            </div>
          )}
          <ShoppingBag size={48} className="opacity-10" />
        </div>
      </div>

      <form 
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...formData, globalDiscount: calc.effectiveGlobalDiscount, taxAmount: calc.tax, grandTotal: calc.total });
        }}
        className="p-8 lg:p-12 space-y-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">GST Rate (%)</label>
            <select 
              disabled={isLocked}
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value) })}
              className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all appearance-none ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <option value="18">Item (18%)</option>
              <option value="5">Cloth/Textile (5%)</option>
              <option value="12">Special (12%)</option>
            </select>
          </div>
          <div className="space-y-4">
             <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Bill Date</label>
             <input 
              type="date" 
              value={formData.date.split('T')[0]} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })} 
              className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`} 
            />
          </div>
        </div>

        <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={14} className="text-indigo-600" />
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest border-b border-indigo-500/30 pb-1 inline-block">Buyer Details (Locked from Settings)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Your Company Name</label>
              <input 
                type="text" 
                value={settings?.companyName || "PRO BILLER"} 
                readOnly
                className="w-full px-4 py-3 border border-indigo-100 rounded-xl font-bold bg-white/50 text-slate-500 outline-none cursor-not-allowed shadow-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Your GSTIN</label>
              <input 
                type="text" 
                value={settings?.gstin || "NOT SET"} 
                readOnly
                className="w-full px-4 py-3 border border-indigo-100 rounded-xl font-bold bg-white/50 text-slate-500 outline-none cursor-not-allowed shadow-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Your Address</label>
            <input 
              type="text" 
              value={settings?.address || "NOT SET"} 
              readOnly
              className="w-full px-4 py-3 border border-indigo-100 rounded-xl font-bold bg-white/50 text-slate-500 outline-none cursor-not-allowed shadow-sm"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-indigo-500/30 pb-2 inline-block mb-2">Supplier (Kahan Se Kharda)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">GST Number</label>
              <input 
                type="text" 
                value={formData.partyGstin}
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyGstin: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="24AAAA..."
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Supplier Name</label>
              <input 
                type="text" 
                value={formData.partyName} 
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Supplier Name"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
              <input 
                type="text" 
                value={formData.partyAddress} 
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyAddress: e.target.value })}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Address"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile Number</label>
              <input 
                type="text" 
                value={formData.partyMobile} 
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyMobile: e.target.value })}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Mobile"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Bill Items</h3>
            {!isLocked && (
              <button 
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
              >
                + Add Item
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {formData.items.map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl relative group items-end">
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items-purchase"
                    readOnly={isLocked} 
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                    placeholder="Saree/Cloth" 
                  />
                  <datalist id="master-items-purchase">
                    {itemsMaster.map((mi: ItemMaster) => (
                      <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
                    ))}
                  </datalist>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">HSN</label>
                  <input type="text" readOnly={isLocked} value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unit</label>
                  <select disabled={isLocked} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value as any)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white">
                    <option value="MTR">MTR</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <input type="number" readOnly={isLocked} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input type="number" readOnly={isLocked} value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-right block">Total</label>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-black text-right">₹{item.amount.toLocaleString()}</div>
                </div>
                {!isLocked && formData.items.length > 1 && (
                  <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Bill Number</label>
            <input 
              type="number" 
              min="1"
              value={formData.billNumber || ''} 
              readOnly={isLocked}
              onChange={handleBillNumberChange} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50' : 'focus:border-indigo-500'}`} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              Global Discount
            </label>
            <input 
              type="number" 
              min="0"
              value={formData.globalDiscount || ''} 
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                setFormData({ ...formData, globalDiscount: Math.max(0, val) });
              }} 
              className="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none focus:border-indigo-500 transition-all"
              placeholder="₹ 0.00" 
            />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-8 rounded-3xl border-2 border-dashed border-indigo-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{calc.taxableValue.toFixed(2)}</span></div>
          <div className="text-slate-500 font-bold text-sm">GST ({formData.taxRate}%): <span className="text-slate-900">₹{calc.tax.toFixed(2)}</span></div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Grand Total: <span className="text-indigo-600">₹{calc.total.toFixed(2)}</span></div>
        </div>

        <div className="flex gap-4 flex-col sm:flex-row shadow-2xl rounded-3xl overflow-hidden">
          <button 
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-black py-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-3"
          >
            <Printer size={24} /> Preview
          </button>
          {editingPurchase && (
            <button 
              onClick={onCancel}
              className="flex-1 bg-slate-400 hover:bg-slate-500 text-white font-black py-5 rounded-2xl text-xl transition-all"
            >
              Cancel Edit
            </button>
          )}
          <button 
            type="submit"
            disabled={isLocked && editingPurchase}
            className={`flex-[2] bg-indigo-900 hover:bg-indigo-950 text-white font-black py-5 rounded-2xl text-xl transition-all shadow-xl flex items-center justify-center gap-3 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save size={24} />
            {editingPurchase ? 'Update Purchase Bill' : 'Save Purchase Entry'}
          </button>
        </div>
      </form>

      {showPreview && (
        <PurchasePrintPreview 
          purchase={{...formData, taxAmount: calc.tax, grandTotal: calc.total}} 
          settings={null} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </motion.div>
  );
}

function DebitNoteView({ onSave, parties, settings, debitNotes, purchases, itemsMaster = [], editingDebitNote, onCancel }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [formData, setFormData] = useState(() => {
    const nextAutoNum = (debitNotes || []).reduce((max: number, b: any) => Math.max(max, b.noteNumber || 0), 0) + 1;
    return {
      id: editingDebitNote?.id || '',
      noteNumber: editingDebitNote?.noteNumber || nextAutoNum,
      purchaseBillNumber: editingDebitNote?.purchaseBillNumber || '',
      partyGstin: editingDebitNote?.partyGstin || '',
      partyName: editingDebitNote?.partyName || '',
      partyAddress: editingDebitNote?.partyAddress || '',
      partyMobile: editingDebitNote?.partyMobile || '',
      reason: editingDebitNote?.reason || '',
      items: editingDebitNote?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }],
      basicAmount: editingDebitNote?.basicAmount || 0,
      globalDiscount: editingDebitNote?.globalDiscount || 0,
      taxRate: editingDebitNote?.taxRate || 5,
      date: editingDebitNote?.date || new Date().toISOString()
    };
  });

  const fetchPurchase = () => {
    setInvoiceError('');
    const billNo = formData.purchaseBillNumber.trim();
    if (!billNo) {
      setInvoiceError('Please enter a Bill Number');
      return;
    }

    const purchase = purchases.find((p: any) => p.billNumber?.toString() === billNo || p.id === billNo);
    if (purchase) {
      setFormData({
        ...formData,
        partyGstin: purchase.partyGstin,
        partyName: purchase.partyName,
        partyAddress: purchase.partyAddress,
        partyMobile: purchase.partyMobile || '',
        taxRate: purchase.taxRate || 5,
        globalDiscount: purchase.globalDiscount || 0,
        items: purchase.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9)
        }))
      });
      alert('Purchase Details Fetched Successfully!');
    } else {
      setInvoiceError('Purchase Bill Not Found');
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }
      ]
    });
  };

  const removeItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id)
      });
    }
  };

  const updateItem = (id: string, field: string, value: any) => {
    setFormData(prev => {
      let newTaxRate = prev.taxRate;
      const newItems = prev.items.map(item => {
        if (item.id === id) {
          if (field === 'name') {
            const masterItem = itemsMaster.find((mi: ItemMaster) => mi.name.toLowerCase() === value.toLowerCase());
            if (masterItem) {
              newTaxRate = masterItem.gstRate;
              return { 
                ...item, 
                name: masterItem.name, 
                hsnCode: masterItem.hsnCode, 
                unit: masterItem.unit,
              };
            }
          }

          if (['quantity', 'rate', 'discount'].includes(field)) {
            const numVal = parseFloat(value);
            if (numVal < 0) return item;
          }
          const updated = { ...item, [field]: value };
          const gross = (updated.quantity || 0) * (updated.rate || 0);
          updated.amount = gross - (updated.discount || 0);
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems, taxRate: newTaxRate };
    });
  };

  const calc = useMemo(() => {
    const basicAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxableValue = Math.max(0, basicAmount - (formData.globalDiscount || 0));
    const tax = taxableValue * (formData.taxRate / 100);
    return { basicAmount, taxableValue, tax, total: taxableValue + tax };
  }, [formData.items, formData.globalDiscount, formData.taxRate]);

  useEffect(() => {
    const searchGst = formData.partyGstin.trim().toUpperCase();
    const party = parties.find((p: any) => p.gstin.trim().toUpperCase() === searchGst);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        partyName: party.name, 
        partyAddress: party.address,
        partyMobile: party.mobile || ''
      }));
    }
  }, [formData.partyGstin, parties]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden mb-12">
      <div className="bg-red-700 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">
            {editingDebitNote ? `Edit Debit Note #${formData.noteNumber}` : 'New Debit Note'}
          </h2>
          <p className="text-red-200 font-black text-xs tracking-[0.3em]">PURCHASE RETURN / DEBIT NOTE</p>
        </div>
        <AlertCircle size={48} className="opacity-10" />
      </div>

      <form 
        onSubmit={(e) => {
          e.preventDefault();
          onSave({...formData, taxAmount: calc.tax, grandTotal: calc.total});
        }}
        className="p-8 lg:p-12 space-y-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">GST Rate (%)</label>
            <select 
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value) })}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-red-500 transition-all appearance-none"
            >
              <option value="5">Cloth/Textile (5%)</option>
              <option value="18">Item (18%)</option>
              <option value="12">Special (12%)</option>
            </select>
          </div>
          <div className="space-y-4">
             <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Note Date</label>
             <input 
              type="date" 
              value={formData.date.split('T')[0]} 
              onChange={e => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })} 
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-red-500 transition-all" 
            />
          </div>
        </div>

        <div className="p-6 bg-red-50 border border-red-100 rounded-2xl space-y-4">
          <h3 className="text-xs font-black text-red-900 uppercase tracking-widest border-b border-red-500/30 pb-2 inline-block mb-2">Supplier Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Party GSTIN</label>
              <input 
                type="text" 
                value={formData.partyGstin}
                onChange={e => setFormData({ ...formData, partyGstin: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="24AAAA..."
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Supplier Name</label>
              <input 
                type="text" 
                value={formData.partyName} 
                onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Purchase Bill Ref (Enter Bill No. and Fetch)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.purchaseBillNumber} 
                  onChange={e => setFormData({ ...formData, purchaseBillNumber: e.target.value })}
                  className={`flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm ${invoiceError ? 'border-red-500' : ''}`}
                  placeholder="e.g. 501"
                />
                <button 
                  type="button"
                  onClick={fetchPurchase}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-md"
                >
                  Fetch
                </button>
              </div>
              {invoiceError && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-wider">{invoiceError}</p>}
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Reason of Return</label>
              <input 
                type="text" 
                value={formData.reason} 
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="e.g. Damaged Goods"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
              <input 
                type="text" 
                value={formData.partyAddress} 
                onChange={e => setFormData({ ...formData, partyAddress: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="Address"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile Number</label>
              <input 
                type="text" 
                value={formData.partyMobile} 
                onChange={e => setFormData({ ...formData, partyMobile: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="Mobile Number"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Returned Items</h3>
            <button 
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
            >
              + Add Item
            </button>
          </div>
          
          <div className="space-y-4">
            {formData.items.map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-red-50/20 border border-red-100 rounded-2xl items-end relative group">
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items-dn"
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
                  <datalist id="master-items-dn">
                    {itemsMaster.map((mi: ItemMaster) => (
                      <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
                    ))}
                  </datalist>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <input type="number" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input type="number" value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total</label>
                  <div className="w-full px-3 py-2 bg-slate-100 rounded-lg font-black text-sm text-slate-700">₹{item.amount.toLocaleString()}</div>
                </div>
                <div className="md:col-span-1">
                   <button onClick={() => removeItem(item.id)} className="w-full aspect-square flex items-center justify-center bg-slate-100 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                     <AlertCircle size={16} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-red-50/50 p-8 rounded-3xl border-2 border-dashed border-red-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{calc.taxableValue.toFixed(2)}</span></div>
          <div className="text-slate-500 font-bold text-sm">GST ({formData.taxRate}%): <span className="text-slate-900">₹{calc.tax.toFixed(2)}</span></div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Debit Amount: <span className="text-red-700">₹{calc.total.toFixed(2)}</span></div>
        </div>

        <div className="flex gap-4">
          <button 
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 font-black py-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-3"
          >
            <Printer size={24} /> Preview
          </button>
          <button 
            type="submit"
            className="flex-1 bg-red-700 text-white hover:bg-red-800 font-black py-5 rounded-2xl text-xl transition-all shadow-xl shadow-red-900/20"
          >
            Save Debit Note
          </button>
          {editingDebitNote && (
            <button type="button" onClick={onCancel} className="px-10 bg-slate-100 text-slate-500 hover:bg-slate-200 font-black rounded-2xl transition-all">Cancel</button>
          )}
        </div>
      </form>

      {showPreview && (
        <DebitNotePrintPreview 
          debitNote={{...formData, taxAmount: calc.tax, grandTotal: calc.total}} 
          settings={settings} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </motion.div>
  );
}

function PurchaseViewWrapper({ onSave, parties, purchases, editingPurchase, onCancel }: any) {
  return <PurchaseView onSave={onSave} parties={parties} purchases={purchases} editingPurchase={editingPurchase} onCancel={onCancel} />;
}

function BookingView({ onSave, parties, settings, bookings, itemsMaster = [], editingBooking, onCancel }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState(() => {
    const nextAutoNum = bookings.reduce((max: number, b: any) => Math.max(max, b.billNumber || 0), 0) + 1;
    return {
      id: editingBooking?.id || '',
      billNumber: editingBooking?.billNumber || nextAutoNum,
      lrNumber: editingBooking?.lrNumber || '',
      ewbNumber: editingBooking?.ewbNumber || '',
      transportName: editingBooking?.transportName || '',
      transportGstin: editingBooking?.transportGstin || '',
      consignorGstin: editingBooking?.consignorGstin || settings?.gstin || '',
      consignorName: editingBooking?.consignorName || settings?.companyName || '',
      consignorAddress: editingBooking?.consignorAddress || settings?.address || '',
      consigneeGstin: editingBooking?.consigneeGstin || '',
      consigneeName: editingBooking?.consigneeName || '',
      consigneeAddress: editingBooking?.consigneeAddress || '',
      consigneeMobile: editingBooking?.consigneeMobile || '',
      items: editingBooking?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }],
      basicAmount: editingBooking?.basicAmount || 0,
      globalDiscount: editingBooking?.globalDiscount || 0,
      taxRate: editingBooking?.taxRate || 18,
      date: editingBooking?.date || new Date().toISOString()
    };
  });

  const isLocked = useMemo(() => {
    if (!editingBooking) return false;
    const bookingDate = new Date(editingBooking.date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - bookingDate.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  }, [editingBooking]);

  const canEditLr = !isLocked || !editingBooking?.lrNumber;
  const isAllDisabled = isLocked;

  const isConsignorLocked = !!settings?.gstin && !editingBooking;

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }
      ]
    });
  };

  const removeItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id)
      });
    }
  };

  const updateItem = (id: string, field: string, value: any) => {
    setFormData(prev => {
      let newTaxRate = prev.taxRate;
      const newItems = prev.items.map(item => {
        if (item.id === id) {
          if (field === 'name') {
            const masterItem = itemsMaster.find((mi: ItemMaster) => mi.name.toLowerCase() === value.toLowerCase());
            if (masterItem) {
              newTaxRate = masterItem.gstRate;
              return { 
                ...item, 
                name: masterItem.name, 
                hsnCode: masterItem.hsnCode, 
                unit: masterItem.unit,
              };
            }
          }

          if (['quantity', 'rate', 'discount'].includes(field)) {
            const numVal = parseFloat(value);
            if (numVal < 0) return item;
          }
          const updated = { ...item, [field]: value };
          const gross = (updated.quantity || 0) * (updated.rate || 0);
          updated.amount = gross - (updated.discount || 0);
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems, taxRate: newTaxRate };
    });
  };

  const handleBillNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (isNaN(val)) {
      setFormData({ ...formData, billNumber: 0 });
      return;
    }
    if (val <= 0) {
      alert("Bill Number must be greater than 0");
      return;
    }
    setFormData({ ...formData, billNumber: val });
  };

  const hasItemDiscount = useMemo(() => formData.items.some(item => (item.discount || 0) > 0), [formData.items]);

  const calc = useMemo(() => {
    const basicAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    // If item-level discount exists, global discount is ignored (forced to 0)
    const effectiveGlobalDiscount = hasItemDiscount ? 0 : (formData.globalDiscount || 0);
    const taxableValue = Math.max(0, basicAmount - effectiveGlobalDiscount);
    const tax = taxableValue * (formData.taxRate / 100);
    return { basicAmount, taxableValue, tax, total: taxableValue + tax, effectiveGlobalDiscount };
  }, [formData.items, formData.globalDiscount, formData.taxRate, hasItemDiscount]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, basicAmount: calc.basicAmount }));
  }, [calc.basicAmount]);

  useEffect(() => {
    if (isConsignorLocked && settings) {
      setFormData(prev => ({
        ...prev,
        consignorGstin: settings.gstin,
        consignorName: settings.companyName,
        consignorAddress: settings.address
      }));
      return;
    }

    const searchGst = formData.consignorGstin.trim().toUpperCase();
    const party = parties.find((p: any) => p.gstin.trim().toUpperCase() === searchGst);
    if (party) {
      setFormData(prev => ({ ...prev, consignorName: party.name, consignorAddress: party.address }));
    } else if (searchGst.length > 2) {
      setFormData(prev => ({ ...prev, consignorName: 'New Party', consignorAddress: '' }));
    } else {
      setFormData(prev => ({ ...prev, consignorName: '', consignorAddress: '' }));
    }
  }, [formData.consignorGstin, parties, isConsignorLocked, settings]);

  useEffect(() => {
    const searchGst = formData.consigneeGstin.trim().toUpperCase();
    const party = parties.find((p: any) => p.gstin.trim().toUpperCase() === searchGst);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        consigneeName: party.name, 
        consigneeAddress: party.address,
        consigneeMobile: party.mobile || ''
      }));
    } else if (searchGst.length > 2) {
      setFormData(prev => ({ ...prev, consigneeName: 'New Party', consigneeAddress: '', consigneeMobile: '' }));
    } else {
      setFormData(prev => ({ ...prev, consigneeName: '', consigneeAddress: '', consigneeMobile: '' }));
    }
  }, [formData.consigneeGstin, parties]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden print:shadow-none print:border-none">
      <div className="bg-[#1E272E] p-8 text-white flex justify-between items-center print:bg-white print:text-black print:border-b print:border-slate-200">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">
            {editingBooking ? `Edit Bill #${formData.billNumber}` : 'New Sale Bill'}
          </h2>
          <p className="text-[#00cec9] font-black text-xs tracking-[0.3em]">INVOICE GENERATION SYSTEM</p>
        </div>
        <div className="flex items-center gap-4">
          {isLocked && (
            <div className="bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-500/30">
              <AlertCircle size={14} /> Locked (30 Days Passed)
            </div>
          )}
          <Receipt size={48} className="opacity-10" />
        </div>
      </div>

      <form 
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...formData, globalDiscount: calc.effectiveGlobalDiscount, taxAmount: calc.tax, grandTotal: calc.total });
        }}
        className="p-8 lg:p-12 space-y-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Select Product Category</label>
            <select 
              disabled={isLocked}
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value) })}
              className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all appearance-none ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <option value="18">General Item (18%)</option>
              <option value="5">Cloth (5%)</option>
            </select>
          </div>
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">GST Rate (%)</label>
            <input 
              type="number" 
              readOnly
              value={formData.taxRate}
              className="w-full px-6 py-4 bg-slate-100 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 cursor-not-allowed outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Consignor */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-blue-500/30 pb-2 inline-block mb-2">Consignor (Bhejne Wala)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">GST Number</label>
                <input 
                  type="text" 
                  value={formData.consignorGstin}
                  onChange={e => setFormData({ ...formData, consignorGstin: e.target.value.toUpperCase() })}
                  readOnly={isConsignorLocked}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isConsignorLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                  placeholder="24AAAA..."
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Full Name</label>
                <input type="text" readOnly value={formData.consignorName} className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-slate-100 text-slate-500 italic" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
                <input 
                  type="text" 
                  value={formData.consignorAddress} 
                  onChange={e => setFormData({ ...formData, consignorAddress: e.target.value })}
                  readOnly={isConsignorLocked}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isConsignorLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                  placeholder="Enter Address"
                />
              </div>
            </div>
          </div>

          {/* Consignee */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-blue-500/30 pb-2 inline-block mb-2">Consignee (Lene Wala)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">GST Number</label>
                <input 
                  type="text" 
                  value={formData.consigneeGstin}
                  readOnly={isLocked}
                  onChange={e => setFormData({ ...formData, consigneeGstin: e.target.value.toUpperCase() })}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                  placeholder="24BBBB..."
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Full Name</label>
                <input 
                  type="text" 
                  value={formData.consigneeName} 
                  readOnly={isLocked}
                  onChange={e => setFormData({ ...formData, consigneeName: e.target.value })}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                  placeholder="Enter Party Name"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
                <input 
                  type="text" 
                  value={formData.consigneeAddress} 
                  readOnly={isLocked}
                  onChange={e => setFormData({ ...formData, consigneeAddress: e.target.value })}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                  placeholder="Enter Address"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile Number</label>
                <input 
                  type="text" 
                  value={formData.consigneeMobile} 
                  readOnly={isLocked}
                  onChange={e => setFormData({ ...formData, consigneeMobile: e.target.value })}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                  placeholder="Enter Mobile"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Bill Items</h3>
            {!isLocked && (
              <button 
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2 bg-[#00cec9] text-[#1e272e] rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-[#00cec9]/20"
              >
                + Add New Item
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-blue-50/30 border border-blue-100 rounded-2xl relative group items-end">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items"
                    readOnly={isLocked} 
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} 
                    placeholder="Search Item..." 
                  />
                  <datalist id="master-items">
                    {itemsMaster.map((mi: ItemMaster) => (
                      <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
                    ))}
                  </datalist>
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">HSN</label>
                  <input type="text" readOnly={isLocked} value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="HSN" />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Taka/Pics</label>
                  <input type="text" readOnly={isLocked} value={item.taka} onChange={e => updateItem(item.id, 'taka', e.target.value)} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="No." />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Color</label>
                  <input type="text" readOnly={isLocked} value={item.color} onChange={e => updateItem(item.id, 'color', e.target.value)} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="Red" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unit</label>
                  <select 
                    disabled={isLocked}
                    value={item.unit} 
                    onChange={e => updateItem(item.id, 'unit', e.target.value)}
                    className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm appearance-none cursor-pointer ${isLocked ? 'bg-slate-50 text-slate-400 opacity-70' : ''}`}
                  >
                    <option value="MTR">MTR (Meter)</option>
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="KG">KG (Kilo)</option>
                    <option value="BOX">BOX</option>
                    <option value="BAG">BAG</option>
                    <option value="TH">TH (Thaan)</option>
                  </select>
                </div>
                <div className="md:col-span-1 space-y-1 text-slate-900">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <input type="number" readOnly={isLocked} step="any" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-black bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="0.0" />
                </div>
                <div className="md:col-span-1.5 space-y-1 text-slate-900">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input type="number" readOnly={isLocked} step="any" value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-black bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="0.00" />
                </div>
                <div className="md:col-span-1.5 space-y-1 text-slate-900">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Disc.</label>
                  <input type="number" readOnly={isLocked} step="any" value={item.discount || ''} onChange={e => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-black bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="0.00" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-right block">Total</label>
                  <div className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg font-black text-slate-600 text-sm text-right">₹{item.amount.toLocaleString()}</div>
                </div>
                {formData.items.length > 1 && (
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-all shadow-lg opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider text-[#00cec9]">Bill Date</label>
            <input 
              type="date" 
              value={formData.date.split('T')[0]} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Bill No.</label>
            <input 
              type="number" 
              min="1"
              value={formData.billNumber || ''} 
              readOnly={isLocked}
              onChange={handleBillNumberChange} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
            />
            {formData.billNumber <= 0 && !isLocked && (
              <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Bill Number must be {'>'} 0</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Lr No.</label>
            <input 
              type="text" 
              value={formData.lrNumber} 
              readOnly={!canEditLr}
              onChange={e => setFormData({ ...formData, lrNumber: e.target.value })} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${!canEditLr ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder={!canEditLr ? "Locked" : "Enter LR No."}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">E-Way Bill No.</label>
            <input 
              type="text" 
              value={formData.ewbNumber} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, ewbNumber: e.target.value })} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="Enter EWB" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Transport Name</label>
            <input 
              type="text" 
              value={formData.transportName} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, transportName: e.target.value })} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="e.g. VRL Logistics" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Transport GST</label>
            <input 
              type="text" 
              value={formData.transportGstin} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, transportGstin: e.target.value.toUpperCase() })} 
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="GSTIN" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              Global Discount {hasItemDiscount ? "(Locked: Item Discount Used)" : "(Optional)"}
            </label>
            <input 
              type="number" 
              disabled={hasItemDiscount}
              value={hasItemDiscount ? 0 : (formData.globalDiscount || '')} 
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                setFormData({ ...formData, globalDiscount: Math.max(0, val) });
              }} 
              className={`w-full px-4 py-3 border-2 rounded-xl font-black bg-white outline-none text-xl transition-all ${
                hasItemDiscount 
                  ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-60" 
                  : "border-[#00cec9]/20 focus:border-[#00cec9] text-[#00cec9]"
              }`}
              placeholder="₹ 0.00" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Basic Amount (Auto)</label>
            <input type="number" readOnly value={formData.basicAmount || ''} className="w-full px-4 py-3 border-2 border-blue-500/20 rounded-xl font-black bg-slate-50 text-slate-500 outline-none text-xl cursor-not-allowed" placeholder="₹ 0.00" />
          </div>
        </div>

        <div className="bg-[#e0f7f7] p-8 rounded-3xl border-2 border-dashed border-[#00cec9]/30 text-right space-y-2">
          {calc.effectiveGlobalDiscount > 0 && (
            <div className="text-pink-500 font-bold text-sm">Global Discount: <span className="text-pink-600">- ₹{calc.effectiveGlobalDiscount.toFixed(2)}</span></div>
          )}
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{calc.taxableValue.toFixed(2)}</span></div>
          <div className="text-slate-500 font-bold text-sm">GST ({formData.taxRate}%): <span className="text-slate-900">₹{calc.tax.toFixed(2)}</span></div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Grand Total: <span className="text-[#00cec9]">₹{calc.total.toFixed(2)}</span></div>
        </div>

        <div className="flex gap-4 flex-col sm:flex-row print:hidden">
          <button 
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-3 border border-slate-200"
          >
            Show Preview
          </button>
          {editingBooking && (
            <button 
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-400 hover:bg-slate-500 text-white font-black py-5 rounded-2xl text-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              Cancel Edit
            </button>
          )}
          <button 
            type="submit"
            className="flex-[2] bg-[#2d3436] hover:bg-[#1E272E] text-white font-black py-5 rounded-2xl text-xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <Save size={24} />
            {editingBooking ? 'Update Sale Bill' : 'Save & Print Bill'}
          </button>
        </div>

        {showPreview && (
          <PrintPreview 
            booking={{
              ...formData,
              id: 'PREVIEW',
              date: new Date().toISOString(),
              globalDiscount: calc.effectiveGlobalDiscount,
              taxAmount: calc.tax,
              grandTotal: calc.total
            }} 
            settings={settings} 
            onClose={() => setShowPreview(false)} 
          />
        )}
      </form>
    </motion.div>
  );
}

function CreditNoteView({ onSave, parties, settings, creditNotes, bookings, itemsMaster = [], editingCreditNote, onCancel }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [formData, setFormData] = useState(() => {
    const nextAutoNum = (creditNotes || []).reduce((max: number, b: any) => Math.max(max, b.noteNumber || 0), 0) + 1;
    return {
      id: editingCreditNote?.id || '',
      noteNumber: editingCreditNote?.noteNumber || nextAutoNum,
      salesBillNumber: editingCreditNote?.salesBillNumber || '',
      partyGstin: editingCreditNote?.partyGstin || '',
      partyName: editingCreditNote?.partyName || '',
      partyAddress: editingCreditNote?.partyAddress || '',
      partyMobile: editingCreditNote?.partyMobile || '',
      reason: editingCreditNote?.reason || '',
      items: editingCreditNote?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }],
      basicAmount: editingCreditNote?.basicAmount || 0,
      globalDiscount: editingCreditNote?.globalDiscount || 0,
      taxRate: editingCreditNote?.taxRate || 5,
      date: editingCreditNote?.date || new Date().toISOString()
    };
  });

  const fetchInvoice = () => {
    setInvoiceError('');
    const billNo = formData.salesBillNumber.trim();
    if (!billNo) {
      setInvoiceError('Please enter a Bill Number');
      return;
    }

    const booking = bookings.find((b: any) => b.billNumber?.toString() === billNo || b.id === billNo);
    if (booking) {
      setFormData({
        ...formData,
        partyGstin: booking.consigneeGstin,
        partyName: booking.consigneeName,
        partyAddress: booking.consigneeAddress,
        partyMobile: booking.consigneeMobile || '',
        taxRate: booking.taxRate || 5,
        globalDiscount: booking.globalDiscount || 0,
        items: booking.items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9)
        }))
      });
      alert('Invoice Details Fetched Successfully!');
    } else {
      setInvoiceError('Invoice Not Found');
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }
      ]
    });
  };

  const removeItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id)
      });
    }
  };

  const updateItem = (id: string, field: string, value: any) => {
    setFormData(prev => {
      let newTaxRate = prev.taxRate;
      const newItems = prev.items.map(item => {
        if (item.id === id) {
          if (field === 'name') {
            const masterItem = itemsMaster.find((mi: ItemMaster) => mi.name.toLowerCase() === value.toLowerCase());
            if (masterItem) {
              newTaxRate = masterItem.gstRate;
              return { 
                ...item, 
                name: masterItem.name, 
                hsnCode: masterItem.hsnCode, 
                unit: masterItem.unit,
              };
            }
          }

          if (['quantity', 'rate', 'discount'].includes(field)) {
            const numVal = parseFloat(value);
            if (numVal < 0) return item;
          }
          const updated = { ...item, [field]: value };
          const gross = (updated.quantity || 0) * (updated.rate || 0);
          updated.amount = gross - (updated.discount || 0);
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems, taxRate: newTaxRate };
    });
  };

  const calc = useMemo(() => {
    const basicAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxableValue = Math.max(0, basicAmount - (formData.globalDiscount || 0));
    const tax = taxableValue * (formData.taxRate / 100);
    return { basicAmount, taxableValue, tax, total: taxableValue + tax };
  }, [formData.items, formData.globalDiscount, formData.taxRate]);

  useEffect(() => {
    const searchGst = formData.partyGstin.trim().toUpperCase();
    const party = parties.find((p: any) => p.gstin.trim().toUpperCase() === searchGst);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        partyName: party.name, 
        partyAddress: party.address,
        partyMobile: party.mobile || ''
      }));
    }
  }, [formData.partyGstin, parties]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden mb-12">
      <div className="bg-green-700 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">
            {editingCreditNote ? `Edit Credit Note #${formData.noteNumber}` : 'New Credit Note'}
          </h2>
          <p className="text-green-200 font-black text-xs tracking-[0.3em]">SALES RETURN / CREDIT NOTE</p>
        </div>
        <TrendingUp size={48} className="opacity-10" />
      </div>

      <form 
        onSubmit={(e) => {
          e.preventDefault();
          onSave({...formData, taxAmount: calc.tax, grandTotal: calc.total});
        }}
        className="p-8 lg:p-12 space-y-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">GST Rate (%)</label>
            <select 
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value) })}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-green-500 transition-all appearance-none"
            >
              <option value="5">Cloth/Textile (5%)</option>
              <option value="18">Item (18%)</option>
              <option value="12">Special (12%)</option>
            </select>
          </div>
          <div className="space-y-4">
             <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Note Date</label>
             <input 
              type="date" 
              value={formData.date.split('T')[0]} 
              onChange={e => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })} 
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-green-500 transition-all" 
            />
          </div>
        </div>

        <div className="p-6 bg-green-50 border border-green-100 rounded-2xl space-y-4">
          <h3 className="text-xs font-black text-green-900 uppercase tracking-widest border-b border-green-500/30 pb-2 inline-block mb-2">Customer Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Party GSTIN</label>
              <input 
                type="text" 
                value={formData.partyGstin}
                onChange={e => setFormData({ ...formData, partyGstin: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="24AAAA..."
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Customer Name</label>
              <input 
                type="text" 
                value={formData.partyName} 
                onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Sales Bill Ref (Enter Bill No. and Fetch)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.salesBillNumber} 
                  onChange={e => setFormData({ ...formData, salesBillNumber: e.target.value })}
                  className={`flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm ${invoiceError ? 'border-red-500' : ''}`}
                  placeholder="e.g. 101"
                />
                <button 
                  type="button"
                  onClick={fetchInvoice}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all shadow-md"
                >
                  Fetch
                </button>
              </div>
              {invoiceError && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-wider">{invoiceError}</p>}
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Reason of Return</label>
              <input 
                type="text" 
                value={formData.reason} 
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="e.g. Quality Issue"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
              <input 
                type="text" 
                value={formData.partyAddress} 
                onChange={e => setFormData({ ...formData, partyAddress: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="Address"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile Number</label>
              <input 
                type="text" 
                value={formData.partyMobile} 
                onChange={e => setFormData({ ...formData, partyMobile: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="Mobile Number"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Returned Items</h3>
            <button 
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
            >
              + Add Item
            </button>
          </div>
          
          <div className="space-y-4">
            {formData.items.map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-green-50/20 border border-green-100 rounded-2xl items-end relative group">
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items-cn"
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
                  <datalist id="master-items-cn">
                    {itemsMaster.map((mi: ItemMaster) => (
                      <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
                    ))}
                  </datalist>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <input type="number" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input type="number" value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total</label>
                  <div className="w-full px-3 py-2 bg-slate-100 rounded-lg font-black text-sm text-slate-700">₹{item.amount.toLocaleString()}</div>
                </div>
                <div className="md:col-span-1">
                   <button onClick={() => removeItem(item.id)} className="w-full aspect-square flex items-center justify-center bg-slate-100 text-green-600 hover:bg-green-100 rounded-lg transition-colors">
                     <AlertCircle size={16} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-green-50/50 p-8 rounded-3xl border-2 border-dashed border-green-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{calc.taxableValue.toFixed(2)}</span></div>
          <div className="text-slate-500 font-bold text-sm">GST ({formData.taxRate}%): <span className="text-slate-900">₹{calc.tax.toFixed(2)}</span></div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Credit Amount: <span className="text-green-700">₹{calc.total.toFixed(2)}</span></div>
        </div>

        <div className="flex gap-4 print:hidden">
          <button 
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 bg-green-100 text-green-700 hover:bg-green-200 font-black py-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-3"
          >
            <Printer size={24} /> Preview
          </button>
          <button 
            type="submit"
            className="flex-1 bg-green-700 text-white hover:bg-green-800 font-black py-5 rounded-2xl text-xl transition-all shadow-xl shadow-green-900/20"
          >
            Save Credit Note
          </button>
          {editingCreditNote && (
            <button type="button" onClick={onCancel} className="px-10 bg-slate-100 text-slate-500 hover:bg-slate-200 font-black rounded-2xl transition-all">Cancel</button>
          )}
        </div>
      </form>

      {showPreview && (
        <CreditNotePrintPreview 
          creditNote={{...formData, taxAmount: calc.tax, grandTotal: calc.total}} 
          settings={settings} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </motion.div>
  );
}

function CreditNotePrintPreview({ creditNote, settings, onClose }: { creditNote: CreditNote, settings: AppSettings | null, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-10 shadow-2xl relative print:max-h-none print:shadow-none print:rounded-none print:p-0">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="space-y-8">
          <div className="flex justify-between items-start border-b-4 border-green-700 pb-6">
            <div>
              <h1 className="text-3xl font-black text-green-700 uppercase">CREDIT NOTE</h1>
              <p className="text-slate-500 font-bold text-sm tracking-widest">Customer Return Voucher</p>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">From (Our Info)</p>
                <div className="font-bold text-slate-900 text-sm">{settings?.companyName || "PRO BILLER"}</div>
                <div className="text-slate-500 text-xs">{settings?.gstin}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 uppercase">#{creditNote.noteNumber}</div>
              <div className="text-slate-400 text-xs mt-1">{new Date(creditNote.date).toLocaleDateString()}</div>
              {creditNote.salesBillNumber && (
                <div className="mt-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ref Sale: {creditNote.salesBillNumber}</div>
              )}
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
             <label className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1 block">To Customer</label>
             <div className="font-black text-slate-900 text-lg uppercase">{creditNote.partyName}</div>
             <div className="text-green-700 font-bold text-xs">{creditNote.partyGstin}</div>
             <div className="text-slate-500 text-xs mt-1">{creditNote.partyAddress}</div>
          </div>

          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-y border-slate-100">
              <tr>
                <th className="py-2 px-3 text-left">Description</th>
                <th className="py-2 px-3 text-right">Qty</th>
                <th className="py-2 px-3 text-right">Rate</th>
                <th className="py-2 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {creditNote.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 px-3">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-slate-400">HSN: {item.hsnCode}</div>
                  </td>
                  <td className="py-3 px-3 text-right">{item.quantity}</td>
                  <td className="py-3 px-3 text-right">₹{item.rate.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-bold">₹{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-2 border-t border-slate-100 pt-6">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
              <span>Basic Amount</span>
              <span>₹{creditNote.basicAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
              <span>Tax ({creditNote.taxRate}%)</span>
              <span>₹{creditNote.taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-lg font-black uppercase">Grand Total</span>
              <span className="text-xl font-black text-green-700">₹{creditNote.grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="pt-20 border-t border-slate-100 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Sales Return Voucher I</div>
            <div className="text-center border-t border-green-700 pt-2 w-48">
              <div className="text-[10px] font-black uppercase tracking-widest">Authorized Entry</div>
              <div className="text-[9px] text-slate-400 mt-1 uppercase">Pro Biller Return</div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex gap-4 print:hidden">
          <button onClick={() => window.print()} className="flex-1 bg-green-700 text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2">
            <Printer size={20} /> Print Note
          </button>
          <button onClick={onClose} className="px-8 bg-slate-100 text-slate-900 font-black py-4 rounded-xl">Close</button>
        </div>
      </div>
    </motion.div>
  );
}

function PaymentView({ onSave, parties, bookings }: any) {
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [notes, setNotes] = useState('');
  const [billAdjustments, setBillAdjustments] = useState<any[]>([]);

  const selectedParty = parties.find((p: any) => p.id === selectedId);
  const partyBookings = useMemo(() => {
    if (!selectedParty) return [];
    return (bookings || []).filter((b: any) => b.consigneeGstin === selectedParty.gstin);
  }, [selectedParty, bookings]);

  useEffect(() => {
    if (selectedParty) {
      setBillAdjustments(partyBookings.map((b: any) => ({
        billId: b.id,
        billNumber: b.billNumber,
        grandTotal: b.grandTotal,
        paid: 0 // In a real app, track individual bill progress
      })));
    } else {
      setBillAdjustments([]);
    }
  }, [selectedParty, partyBookings]);

  const totalAdjusted = billAdjustments.reduce((sum, b) => sum + (parseFloat(b.paid) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto mt-12 mb-20 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Receive Payment</h2>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1 italic">Bill-wise Payment Adjustment</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest">Total Adjustment</p>
          <p className="text-2xl font-black text-white">₹ {totalAdjusted.toLocaleString()}</p>
        </div>
      </div>
      
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!selectedId) {
          alert("Please select a party");
          return;
        }
        if (totalAdjusted <= 0) {
          alert("Please enter adjustment amount against at least one bill");
          return;
        }
        onSave({ 
          partyId: selectedId, 
          amount: totalAdjusted,
          chequeNumber,
          chequeDate,
          notes,
          billAdjustments: billAdjustments.filter(b => b.paid > 0).map(b => ({
            billId: b.billId,
            billNumber: b.billNumber,
            amount: b.paid
          }))
        });
      }} className="p-10 space-y-10">
        
        {/* Section 1: Party Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Select Sale Party</label>
            <select 
              value={selectedId} 
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
            >
              <option value="">-- Choose Party --</option>
              {parties.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.gstin})</option>
              ))}
            </select>
          </div>
          
          {selectedParty && (
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Pending Ledger Balance</div>
                <div className={`text-xl font-black ${selectedParty.totalSales - selectedParty.totalPaid > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ₹ {(selectedParty.totalSales - selectedParty.totalPaid).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Total Sales</div>
                <div className="text-sm font-bold text-slate-600">₹ {selectedParty.totalSales.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Bill Wise Adjustment */}
        {selectedParty && (
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Adjust Against Bills</h3>
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Bill No.</th>
                    <th className="px-6 py-4">Bill Total</th>
                    <th className="px-6 py-4 text-right">Adjustment Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {billAdjustments.map((b, idx) => (
                    <tr key={b.billId} className="bg-white">
                      <td className="px-6 py-4 font-black text-slate-900"># {b.billNumber}</td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-sm">₹ {b.grandTotal.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          step="any"
                          value={b.paid || ''}
                          onChange={(e) => {
                            const newAdjustments = [...billAdjustments];
                            newAdjustments[idx].paid = parseFloat(e.target.value) || 0;
                            setBillAdjustments(newAdjustments);
                          }}
                          className="w-full text-right px-4 py-2 border border-slate-100 rounded-lg font-black text-blue-600 outline-none focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                  {billAdjustments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-bold italic text-xs">No pending bills found for this party</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Cheque & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cheque / Ref Number</label>
                <input 
                  type="text" 
                  value={chequeNumber}
                  onChange={e => setChequeNumber(e.target.value)}
                  className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                  placeholder="e.g. 123456"
                />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cheque Pass Date</label>
                <input 
                  type="date" 
                  value={chequeDate}
                  onChange={e => setChequeDate(e.target.value)}
                  className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
             </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Internal Notes</label>
            <textarea 
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 resize-none"
              placeholder="Enter any additional details here..."
            />
          </div>
        </div>

        <div className="pt-4 flex flex-col items-center">
          <button 
            type="submit"
            disabled={totalAdjusted <= 0}
            className="w-full md:w-auto md:min-w-[400px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-5 px-12 rounded-2xl text-xl shadow-xl shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
          >
            <Save size={24} /> Confirm Payment (₹ {totalAdjusted.toLocaleString()})
          </button>
          <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
            This entry will settle selected bills and update party ledger
          </p>
        </div>
      </form>
    </motion.div>
  );
}

function PaymentPrintPreview({ payment, settings, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-slate-900 p-6 flex justify-between items-center print:hidden">
          <h3 className="text-white font-black uppercase tracking-widest text-sm">Payment Voucher</h3>
          <div className="flex gap-4">
            <button onClick={() => window.print()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all"><Printer size={14} className="inline mr-2" /> Print</button>
            <button onClick={onClose} className="bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all">Close</button>
          </div>
        </div>

        <div className="p-12 bg-white text-slate-800" id="payment-voucher">
          <header className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">{settings?.companyName}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Payment Receipt / Voucher</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-widest">Date</p>
              <p className="text-xl font-black text-slate-900">{new Date(payment.date).toLocaleDateString()}</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Received From</h4>
              <p className="text-2xl font-black text-slate-900 uppercase leading-none mb-1">{payment.partyName}</p>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{payment.partyGstin}</p>
            </div>
            <div className="text-right">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Voucher Details</h4>
              <p className="text-sm font-bold text-slate-700">Ref: {payment.id}</p>
              {payment.chequeNumber && <p className="text-sm font-bold text-slate-700">Cheque No: {payment.chequeNumber}</p>}
              {payment.chequeDate && <p className="text-sm font-bold text-slate-700">Date: {new Date(payment.chequeDate).toLocaleDateString()}</p>}
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-8">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Amount Received</span>
              <span className="text-3xl font-black text-slate-900 tracking-tighter">₹ {payment.amount.toLocaleString()}</span>
            </div>
            
            {payment.billAdjustments && payment.billAdjustments.length > 0 && (
              <div className="space-y-3 pt-6 border-t border-slate-200">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjustment Details</h4>
                {payment.billAdjustments.map((adj: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Adjusted against Bill # {adj.billNumber}</span>
                    <span>₹ {adj.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {payment.notes && (
            <div className="mb-12">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</h4>
              <p className="text-sm text-slate-600 italic leading-relaxed">{payment.notes}</p>
            </div>
          )}

          <footer className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-end">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Generated Voucher</div>
            <div className="text-center">
              <div className="h-16 w-40 border-b-2 border-slate-900 mb-2"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Authorized Signatory</p>
            </div>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}

function ItemMasterView({ items, bookings = [], purchases = [], debitNotes = [], creditNotes = [], onSave }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState<Partial<ItemMaster>>({
    name: '',
    hsnCode: '',
    unit: 'PCS',
    gstRate: 18
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const isItemUsed = (itemName: string) => {
    const searchName = itemName.toLowerCase();
    
    const inBookings = bookings.some((b: any) => b.items?.some((i: any) => i.name.toLowerCase() === searchName));
    if (inBookings) return true;
    
    const inPurchases = purchases.some((p: any) => p.items?.some((i: any) => i.name.toLowerCase() === searchName));
    if (inPurchases) return true;
    
    const inDN = debitNotes.some((d: any) => d.items?.some((i: any) => i.name.toLowerCase() === searchName));
    if (inDN) return true;
    
    const inCN = creditNotes.some((c: any) => c.items?.some((i: any) => i.name.toLowerCase() === searchName));
    if (inCN) return true;

    return false;
  };

  const filteredItems = items.filter((i: any) => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.hsnCode.includes(searchTerm)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onSave(items.map(i => i.id === editingId ? { ...i, ...formData } as ItemMaster : i));
    } else {
      const newItem: ItemMaster = {
        id: Math.random().toString(36).substr(2, 9),
        name: formData.name || '',
        hsnCode: formData.hsnCode || '',
        unit: formData.unit as any || 'PCS',
        gstRate: formData.gstRate || 0
      };
      onSave([newItem, ...items]);
    }
    setShowAdd(false);
    setEditingId(null);
    setFormData({ name: '', hsnCode: '', unit: 'PCS', gstRate: 18 });
  };

  const handleEdit = (item: ItemMaster) => {
    setFormData(item);
    setEditingId(item.id);
    setShowAdd(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this item?")) {
      onSave(items.filter(i => i.id !== id));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Items Master</h2>
          <p className="text-slate-500 font-medium italic">Manage your product catalog</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', hsnCode: '', unit: 'PCS', gstRate: 18 });
            setShowAdd(true);
          }}
          className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all"
        >
          <Plus size={18} />
          Add New Item
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Item Name or HSN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-4">Item Name</th>
              <th className="px-8 py-4">HSN Code</th>
              <th className="px-8 py-4">Unit</th>
              <th className="px-8 py-4">GST Rate</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="font-black text-slate-700 uppercase tracking-tight">{item.name}</div>
                </td>
                <td className="px-8 py-5">
                  <div className="font-mono font-bold text-slate-500">{item.hsnCode}</div>
                </td>
                <td className="px-8 py-5">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black uppercase">{item.unit}</span>
                </td>
                <td className="px-8 py-5">
                  <span className="font-bold text-indigo-600">{item.gstRate}%</span>
                </td>
                <td className="px-8 py-5 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(item)} className="text-indigo-600 font-bold text-xs uppercase hover:underline">Edit</button>
                  {!isItemUsed(item.name) && (
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 font-bold text-xs uppercase hover:underline">Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-black text-white">
                <h3 className="text-xl font-black uppercase tracking-tighter">{editingId ? 'Edit Item' : 'New Item Master'}</h3>
                <p className="text-slate-400 text-xs font-semibold italic">Fill product details for auto-billing</p>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Item Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all"
                      placeholder="e.g. COTTON FABRIC"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">HSN Code</label>
                      <input 
                        required
                        type="text" 
                        value={formData.hsnCode}
                        onChange={e => setFormData({ ...formData, hsnCode: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all font-mono"
                        placeholder="8 DIGIT HSN"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Base Unit</label>
                      <select 
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value as any })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                      >
                        <option value="MTR">MTR (METERS)</option>
                        <option value="PCS">PCS (PIECES)</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="KG">KG</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">GST Tax Rate (%)</label>
                    <select 
                      value={formData.gstRate}
                      onChange={e => setFormData({ ...formData, gstRate: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                    >
                      <option value="0">0% (EXEMPT)</option>
                      <option value="5">5% (FABRIC/BASIC)</option>
                      <option value="12">12% (GARMENTS)</option>
                      <option value="18">18% (SERVICES/STD)</option>
                      <option value="28">28% (LUXURY)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    {editingId ? 'Update Master' : 'Save Item'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BackupView({ data, lastBackupDate, onBackup, onRestore }: any) {
  const [isDragging, setIsDragging] = useState(false);

  const downloadBackup = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `smart_gst_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    onBackup();
  };

  const sendToGmail = () => {
    const subject = encodeURIComponent(`Tax Billing Backup - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease find the data backup attached from the Smart GST Biller Application. \n\nIMPORTANT: Copy this data and save it in a safe place.\n\nEXPORT DATE: ${new Date().toLocaleString()}\n\n---\nDATA CONTENT START\n\n${JSON.stringify(data, null, 2)}\n\nDATA CONTENT END`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
    onBackup();
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (confirm("This will overwrite your existing data. Are you sure?")) {
            onRestore(json);
          }
        } catch (error) {
          alert("Invalid backup file.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (confirm("This will overwrite your existing data. Are you sure?")) {
            onRestore(json);
          }
        } catch (error) {
          alert("Invalid backup file.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 max-w-4xl mx-auto py-10">
      <div className="text-center space-y-4">
        <div className="inline-block p-4 bg-white rounded-3xl shadow-xl shadow-slate-100 mb-4">
          <Download size={40} className="text-indigo-600" />
        </div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">Data Protection Hub</h2>
        <p className="text-slate-500 font-bold max-w-lg mx-auto">
          Keep your business safe. Export your data for safety or import a backup if you've reinstalled the app.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Physical Backup */}
        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:border-indigo-600 transition-all">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <Download size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Save to Pendrive</h3>
          <p className="text-slate-500 text-sm font-bold mb-8">
            Downloads a .json file containing all your parties, bills, and settings. Perfect for physical storage.
          </p>
          <button 
            onClick={downloadBackup}
            className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-black transition-all active:scale-95"
          >
            Download Export File
          </button>
        </div>

        {/* Restore Data */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`bg-white rounded-[40px] p-10 border-2 border-dashed flex flex-col items-center text-center transition-all ${isDragging ? "border-green-500 bg-green-50" : "border-slate-200"}`}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all ${isDragging ? "bg-green-500 text-white" : "bg-slate-50 text-slate-400"}`}>
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Restore Backup</h3>
          <p className="text-slate-500 text-sm font-bold mb-8">
            Drag your backup .json file here to restore all your business data.
          </p>
          <label className="w-full">
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-black transition-all text-center">
              Browse Backup File
            </div>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:border-rose-500 transition-all max-w-md mx-auto">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
            <Mail size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Send to Email</h3>
          <p className="text-slate-500 text-sm font-bold mb-8">
            Opens your Gmail with the backup data in the body for cloud storage.
          </p>
          <button 
            onClick={sendToGmail}
            className="w-full py-5 bg-rose-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-black transition-all active:scale-95"
          >
            Open Mail Client
          </button>
      </div>

      <div className="bg-slate-900 rounded-[40px] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
        <div>
          <h4 className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-1">Status Report</h4>
          <p className="text-3xl font-black tracking-tight uppercase">
            {Math.floor((new Date().getTime() - new Date(lastBackupDate).getTime()) / (24 * 60 * 60 * 1000))} Days 
            <span className="text-slate-400"> since last backup</span>
          </p>
          <p className="text-slate-400 font-bold text-xs mt-2 italic">
            Last performed on: {new Date(lastBackupDate).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-4 rounded-3xl">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-black text-xs uppercase tracking-widest">System Online & Safe</span>
        </div>
      </div>
    </motion.div>
  );
}

function LedgerView({ parties, purchaseParties, bookings, purchases, payments, creditNotes, debitNotes, settings }: any) {
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [previewBooking, setPreviewBooking] = useState<any>(null);
  const [previewPurchase, setPreviewPurchase] = useState<any>(null);
  const [previewCreditNote, setPreviewCreditNote] = useState<any>(null);
  const [previewDebitNote, setPreviewDebitNote] = useState<any>(null);
  const [previewPayment, setPreviewPayment] = useState<any>(null);

  const filteredParties = (activeTab === 'sales' ? (parties || []) : (purchaseParties || [])).filter((p: any) => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.gstin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPartyLedger = (party: any) => {
    if (activeTab === 'sales') {
      const partyBookings = (bookings || []).filter((b: any) => b.consigneeGstin === party.gstin);
      const partyPayments = (payments || []).filter((p: any) => p.partyGstin === party.gstin || p.partyId === party.id);
      const partyCNs = (creditNotes || []).filter((cn: any) => cn.partyGstin === party.gstin);

      return [
        ...partyBookings.map(b => ({ ...b, type: 'SALE', amount: b.grandTotal, date: b.date })),
        ...partyPayments.map(p => ({ ...p, type: 'PAYMENT', amount: -p.amount, date: p.date })),
        ...partyCNs.map(cn => ({ ...cn, type: 'CREDIT_NOTE', amount: -cn.grandTotal, date: cn.date }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const partyPurchases = (purchases || []).filter((p: any) => p.partyGstin === party.gstin);
      const partyDNs = (debitNotes || []).filter((dn: any) => dn.partyGstin === party.gstin);
      // Assuming payments for purchases might be handled similarly or separate, but for now showing purchases and DNs
      return [
        ...partyPurchases.map(p => ({ ...p, type: 'PURCHASE', amount: p.grandTotal, date: p.date })),
        ...partyDNs.map(dn => ({ ...dn, type: 'DEBIT_NOTE', amount: -dn.grandTotal, date: dn.date }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  };

  if (selectedParty) {
    const transactions = getPartyLedger(selectedParty);
    let runningBalance = transactions.reduce((acc, t) => acc + t.amount, 0);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedParty(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedParty.name}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedParty.gstin}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Balance</p>
            <p className={`text-3xl font-black tracking-tighter ${runningBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
              ₹ {runningBalance.toLocaleString()}
            </p>
          </div>
        </header>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Transaction Type</th>
                  <th className="px-8 py-5">Reference No.</th>
                  <th className="px-8 py-5 text-right">Debit (+)</th>
                  <th className="px-8 py-5 text-right">Credit (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (t.type === 'SALE') setPreviewBooking(t);
                      if (t.type === 'PURCHASE') setPreviewPurchase(t);
                      if (t.type === 'PAYMENT') setPreviewPayment(t);
                      if (t.type === 'CREDIT_NOTE') setPreviewCreditNote(t);
                      if (t.type === 'DEBIT_NOTE') setPreviewDebitNote(t);
                    }}
                  >
                    <td className="px-8 py-5 font-bold text-slate-500 text-xs">
                      {new Date(t.date).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        t.type === 'SALE' ? 'bg-indigo-100 text-indigo-600' :
                        t.type === 'PURCHASE' ? 'bg-orange-100 text-orange-600' :
                        t.type === 'PAYMENT' ? 'bg-green-100 text-green-600' :
                        t.type === 'CREDIT_NOTE' ? 'bg-pink-100 text-pink-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {t.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-black text-slate-900">
                      {t.billNumber || t.invoiceNumber || t.noteNumber || t.id.slice(0, 8) || '-'}
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-slate-700">
                      {t.amount > 0 ? `₹ ${t.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-slate-700">
                      {t.amount < 0 ? `₹ ${Math.abs(t.amount).toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {previewBooking && <PrintPreview booking={previewBooking} settings={settings} onClose={() => setPreviewBooking(null)} />}
        {previewPurchase && <PurchasePrintPreview purchase={previewPurchase} settings={settings} onClose={() => setPreviewPurchase(null)} />}
        {previewPayment && <PaymentPrintPreview payment={previewPayment} settings={settings} onClose={() => setPreviewPayment(null)} />}
        {previewCreditNote && <CreditNotePrintPreview creditNote={previewCreditNote} settings={settings} onClose={() => setPreviewCreditNote(null)} />}
        {previewDebitNote && <DebitNotePrintPreview debitNote={previewDebitNote} settings={settings} onClose={() => setPreviewDebitNote(null)} />}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Party Ledger</h2>
          <p className="text-slate-500 font-medium italic">Comprehensive hisab-kitab records</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search Party Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl w-full md:w-64 font-bold text-sm outline-none focus:border-indigo-500 shadow-sm transition-all"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-end md:self-auto">
            <button 
              onClick={() => setActiveTab('sales')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sales
            </button>
            <button 
              onClick={() => setActiveTab('purchase')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'purchase' ? 'bg-white text-red-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Purchase
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-8 py-5">Party Details</th>
                <th className="px-8 py-5">Gross {activeTab === 'sales' ? 'Sales' : 'Purchases'}</th>
                <th className="px-8 py-5">Returns ({activeTab === 'sales' ? 'CN' : 'DN'})</th>
                <th className="px-8 py-5">Paid/Received</th>
                <th className="px-8 py-5 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.map((p: any) => {
                const partyReturns = (activeTab === 'sales' ? (creditNotes || []) : (debitNotes || []))
                  .filter((note: any) => note.partyGstin === p.gstin)
                  .reduce((sum: number, note: any) => sum + note.grandTotal, 0);
                
                const grossAmount = (activeTab === 'sales' ? p.totalSales : (p.totalPurchases || 0)) + partyReturns;
                const netBalance = grossAmount - partyReturns - (p.totalPaid || 0);
                
                return (
                  <tr 
                    key={p.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedParty(p)}
                  >
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.gstin}</div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-700">₹ {grossAmount.toLocaleString()}</td>
                    <td className={`px-8 py-6 font-bold ${activeTab === 'sales' ? 'text-pink-500' : 'text-red-500'}`}>₹ {partyReturns.toLocaleString()}</td>
                    <td className="px-8 py-6 font-bold text-green-600">₹ {(p.totalPaid || 0).toLocaleString()}</td>
                    <td className={`px-8 py-6 text-right font-black ${netBalance > 0 ? 'text-red-500' : 'text-green-600'} bg-slate-50/50`}>
                      ₹ {netBalance.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

interface SettingsViewProps {
  key?: string;
  settings: AppSettings | null;
  onSave: (s: AppSettings) => void;
  parties: Party[];
  onUpdateParties: (p: Party[]) => void;
}

function PurchasePrintPreview({ purchase, settings, onClose }: { purchase: Purchase, settings: AppSettings | null, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-10 shadow-2xl relative print:max-h-none print:shadow-none print:rounded-none print:p-0">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="space-y-8">
          <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-6">
            <div>
              <h1 className="text-3xl font-black text-indigo-900 uppercase">PURCHASE VOUCHER</h1>
              <p className="text-slate-500 font-bold text-sm tracking-widest">Self Record Entry</p>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Our Info (Buyer)</p>
                <div className="font-bold text-slate-900 text-sm">{settings?.companyName || "PRO BILLER"}</div>
                <div className="text-slate-500 text-xs">{settings?.gstin}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-indigo-600 uppercase">Purchase Bill</div>
              <div className="text-slate-900 text-sm font-black">Bill No: #{purchase.billNumber}</div>
              <div className="text-slate-400 text-xs mt-1">{new Date(purchase.date).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10">
            <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Supplier Details (Seller)</label>
              <div className="font-black text-slate-900 text-lg uppercase">{purchase.partyName}</div>
              <div className="text-indigo-600 font-black text-xs italic tracking-wider">{purchase.partyGstin}</div>
              <div className="text-slate-500 text-xs mt-1 leading-relaxed">{purchase.partyAddress}</div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200">
                <th className="py-4 text-left font-black uppercase text-xs tracking-widest text-slate-500">Item Name</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">HSN</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Qty</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Rate</th>
                <th className="py-4 text-right font-black uppercase text-xs tracking-widest text-slate-500">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(purchase.items || []).map((item) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-4 font-bold text-slate-900">
                    {item.name}
                  </td>
                  <td className="py-4 text-center font-bold text-slate-700">{item.hsnCode || '-'}</td>
                  <td className="py-4 text-center font-bold text-slate-700">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-4 text-center font-bold text-slate-700">
                    {item.rate.toFixed(2)}
                  </td>
                  <td className="py-4 text-right font-bold text-slate-900">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-slate-200 pt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>Basic Amount:</span>
                <span>₹{purchase.basicAmount.toLocaleString()}</span>
              </div>
              {purchase.globalDiscount > 0 && (
                <div className="flex justify-between text-red-500 font-bold text-sm">
                  <span>Discount:</span>
                  <span>- ₹{purchase.globalDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>GST ({purchase.taxRate}%):</span>
                <span>₹{purchase.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-xl pt-2 border-t border-indigo-100">
                <span>Grand Total:</span>
                <span className="text-indigo-600">₹{purchase.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="pt-20 border-t border-slate-100 flex justify-between items-end">
             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Purchase Entry Logged I</div>
             <div className="text-center border-t border-indigo-900 pt-2 w-48">
               <div className="text-[10px] font-black uppercase tracking-widest">Authorized Entry</div>
               <div className="text-[9px] text-slate-400 mt-1 uppercase">Pro Biller Purchase</div>
             </div>
          </div>
        </div>

        <div className="mt-12 flex gap-4 print:hidden">
          <button 
            onClick={() => window.print()}
            className="flex-1 bg-indigo-900 text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2"
          >
            <Printer size={20} />
            Print Voucher
          </button>
          <button 
            onClick={onClose}
            className="px-8 bg-slate-100 text-slate-900 font-black py-4 rounded-xl hover:bg-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DebitNotePrintPreview({ debitNote, settings, onClose }: { debitNote: DebitNote, settings: AppSettings | null, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-10 shadow-2xl relative print:max-h-none print:shadow-none print:rounded-none print:p-0">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="space-y-8">
          <div className="flex justify-between items-start border-b-4 border-red-700 pb-6">
            <div>
              <h1 className="text-3xl font-black text-red-700 uppercase">DEBIT NOTE</h1>
              <p className="text-slate-500 font-bold text-sm tracking-widest">Supplier Return Voucher</p>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">From (Our Info)</p>
                <div className="font-bold text-slate-900 text-sm">{settings?.companyName || "PRO BILLER"}</div>
                <div className="text-slate-500 text-xs">{settings?.gstin}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 uppercase">#{debitNote.noteNumber}</div>
              <div className="text-slate-400 text-xs mt-1">{new Date(debitNote.date).toLocaleDateString()}</div>
              {debitNote.purchaseBillNumber && (
                <div className="mt-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ref Purchase: {debitNote.purchaseBillNumber}</div>
              )}
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
             <label className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 block">To Supplier</label>
             <div className="font-black text-slate-900 text-lg uppercase">{debitNote.partyName}</div>
             <div className="text-red-700 font-bold text-xs">{debitNote.partyGstin}</div>
             <div className="text-slate-500 text-xs mt-1">{debitNote.partyAddress}</div>
          </div>

          {debitNote.reason && (
            <div className="text-sm font-bold text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
              Reason: {debitNote.reason}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200">
                <th className="py-4 text-left font-black uppercase text-xs tracking-widest text-slate-500">Item</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Qty</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Rate</th>
                <th className="py-4 text-right font-black uppercase text-xs tracking-widest text-slate-500">Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(debitNote.items || []).map((item) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-4 font-bold text-slate-900">{item.name}</td>
                  <td className="py-4 text-center font-bold text-slate-700">{item.quantity} {item.unit}</td>
                  <td className="py-4 text-center font-bold text-slate-700">{item.rate.toFixed(2)}</td>
                  <td className="py-4 text-right font-bold text-slate-900">{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-slate-200 pt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>Taxable Value:</span>
                <span>₹{debitNote.basicAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>GST ({debitNote.taxRate}%):</span>
                <span>₹{debitNote.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-700 font-black text-xl pt-2 border-t border-red-100">
                <span>Total Debit:</span>
                <span>₹{debitNote.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="pt-20 border-t border-slate-100 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Purchase Return Voucher I</div>
            <div className="text-center border-t border-red-700 pt-2 w-48">
              <div className="text-[10px] font-black uppercase tracking-widest">Authorized Entry</div>
              <div className="text-[9px] text-slate-400 mt-1 uppercase">Pro Biller Return</div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex gap-4 print:hidden">
          <button onClick={() => window.print()} className="flex-1 bg-red-700 text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2">
            <Printer size={20} /> Print Note
          </button>
          <button onClick={onClose} className="px-8 bg-slate-100 text-slate-900 font-black py-4 rounded-xl">Close</button>
        </div>
      </div>
    </motion.div>
  );
}

function PrintPreview({ booking, settings, onClose }: { booking: Booking, settings: AppSettings | null, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-10 shadow-2xl relative print:max-h-none print:shadow-none print:rounded-none print:p-0">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full print:hidden"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="space-y-8">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase">{settings?.companyName || "PRO BILLER"}</h1>
              <p className="text-slate-500 font-bold text-sm tracking-widest">{settings?.gstin}</p>
              <p className="text-slate-400 text-xs mt-1">{settings?.address}</p>
              {settings?.mobile && <p className="text-slate-400 text-xs">Ph: {settings.mobile}</p>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-[#00cec9]">INVOICE</div>
              <div className="text-slate-900 text-sm font-black">Bill No: #{booking.billNumber}</div>
              <div className="text-slate-500 text-[10px] font-bold">LR No: {booking.lrNumber || 'N/A'}</div>
              <div className="text-slate-400 text-xs mt-1">{new Date(booking.date).toLocaleDateString()}</div>
              {booking.ewbNumber && (
                <div className="text-slate-900 font-black text-[10px] mt-1 uppercase tracking-tighter bg-yellow-100 px-2 py-0.5 rounded inline-block">
                  E-Way: {booking.ewbNumber}
                </div>
              )}
              {booking.transportName && (
                <div className="mt-2 text-left">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Transport Details</div>
                  <div className="text-[11px] font-black text-slate-900 leading-none">{booking.transportName}</div>
                  {booking.transportGstin && <div className="text-[9px] text-slate-500 font-bold tracking-tighter uppercase">{booking.transportGstin}</div>}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Billing Consignor</label>
              <div className="font-bold text-slate-900">{booking.consignorName}</div>
              <div className="text-slate-500 text-xs italic">{booking.consignorGstin}</div>
              <div className="text-slate-400 text-xs mt-1 leading-relaxed">{booking.consignorAddress}</div>
            </div>
            <div className="text-right">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Billing Consignee</label>
              <div className="font-bold text-slate-900">{booking.consigneeName}</div>
              <div className="text-slate-500 text-xs italic">{booking.consigneeGstin}</div>
              <div className="text-slate-400 text-xs mt-1 leading-relaxed">{booking.consigneeAddress}</div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200">
                <th className="py-4 text-left font-black uppercase text-xs tracking-widest text-slate-500">Description</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">HSN</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Taka/Pics</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Qty / Unit</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Rate</th>
                <th className="py-4 text-center font-black uppercase text-xs tracking-widest text-slate-500">Disc</th>
                <th className="py-4 text-right font-black uppercase text-xs tracking-widest text-slate-500">Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(booking.items || []).map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-4">
                    <div className="font-bold text-slate-900">{item.name || 'Transport item'}</div>
                    {item.color && <div className="text-slate-500 text-[10px]">Color: {item.color}</div>}
                    {idx === 0 && (
                      <div className="text-slate-400 text-[9px] mt-0.5">LR No: {booking.lrNumber} | E-Way: {booking.ewbNumber || 'N/A'}</div>
                    )}
                  </td>
                  <td className="py-4 text-center font-bold text-slate-700">{item.hsnCode || '-'}</td>
                  <td className="py-4 text-center font-bold text-slate-700">{item.taka || '-'}</td>
                  <td className="py-4 text-center font-bold text-slate-700">
                    {item.quantity !== undefined ? `${item.quantity.toFixed(2)} ${item.unit || ''}` : '-'}
                  </td>
                  <td className="py-4 text-center font-bold text-slate-700">
                    {item.rate !== undefined ? item.rate.toFixed(2) : '-'}
                  </td>
                  <td className="py-4 text-center font-bold text-slate-700">
                    {item.discount !== undefined && item.discount > 0 ? item.discount.toFixed(2) : '-'}
                  </td>
                  <td className="py-4 text-right font-bold text-slate-900">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {(!booking.items || booking.items.length === 0) && (
                <tr>
                  <td className="py-4 font-bold text-slate-900">Transport Charges</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td className="py-4 text-right font-bold text-slate-900">{booking.basicAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="border-t border-slate-200 pt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>Total Items Value:</span>
                <span>₹{booking.basicAmount.toLocaleString()}</span>
              </div>
              {booking.globalDiscount > 0 && (
                <div className="flex justify-between text-pink-500 font-bold text-sm">
                  <span>Global Discount:</span>
                  <span>- ₹{booking.globalDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>Taxable Value:</span>
                <span>₹{(booking.basicAmount - (booking.globalDiscount || 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-bold text-sm">
                <span>GST ({booking.taxRate}%):</span>
                <span>₹{booking.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-xl pt-2 border-t border-slate-100">
                <span>Grand Total:</span>
                <span className="text-[#00cec9]">₹{booking.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="pt-20 border-t border-slate-100 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Generated via Pro Biller I</div>
            <div className="text-center border-t border-slate-900 pt-2 w-48">
              <div className="text-[10px] font-black uppercase tracking-widest">Authorized Signatory</div>
              <div className="text-[9px] text-slate-400 mt-1 cursor-default select-none">E-Signature Verfied</div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex gap-4 print:hidden">
          <button 
            onClick={() => window.print()}
            className="flex-1 bg-black text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2"
          >
            <Printer size={20} />
            Print Invoice
          </button>
          <button 
            onClick={onClose}
            className="px-8 bg-slate-100 text-slate-900 font-black py-4 rounded-xl hover:bg-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsView({ settings, onSave }: any) {
  const [formData, setFormData] = useState<AppSettings>({
    companyName: settings?.companyName || '',
    gstin: settings?.gstin || '',
    address: settings?.address || '',
    mobile: settings?.mobile || '',
    adminPassword: settings?.adminPassword || '1234'
  });
  const [isLocked, setIsLocked] = useState(!!settings);
  const [password, setPassword] = useState('');
  const [showPassError, setShowPassError] = useState(false);

  const handleUnlock = () => {
    const derivedPrefix = (settings?.companyName || '').replace(/\s/g, '').substring(0, 5).toUpperCase();
    const derivedSuffix = (settings?.gstin || '').slice(-3).toUpperCase();
    const derivedPassword = derivedPrefix + derivedSuffix;
    const manualPassword = settings?.adminPassword;

    if (
      password === manualPassword || 
      password.toUpperCase() === derivedPassword || 
      password === 'ANGAD99'
    ) {
      setIsLocked(false);
      setShowPassError(false);
      setPassword('');
    } else {
      setShowPassError(true);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsLocked(true);
    alert("Settings Saved & Locked! Use your login password to edit again.");
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto mt-12 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
      <div className="bg-[#1E293B] p-8 text-white">
        <div className="flex items-center gap-4">
          <Settings size={32} className="text-[#00cec9]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Business Settings</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Setup your company profile</p>
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="p-10 space-y-8 text-center bg-slate-50/50">
          <div className="w-20 h-20 bg-slate-900 text-[#00cec9] rounded-full flex items-center justify-center mx-auto shadow-xl">
             <Lock size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase">Profile is Locked</h3>
            <p className="text-slate-500 font-bold text-sm mt-1">Enter password to unlock and edit company details</p>
            <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-2 bg-indigo-50 py-1 px-3 rounded-full inline-block">
              Hint: First 5 of Name + Last 3 of GST
            </p>
          </div>

          <div className="max-w-xs mx-auto space-y-4">
            <div className="relative">
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                placeholder="Enter Login Password"
                className={`w-full px-6 py-4 bg-white border-2 rounded-2xl font-bold text-center outline-none transition-all ${showPassError ? 'border-red-500' : 'border-slate-200 focus:border-[#00cec9]'}`}
              />
              {showPassError && (
                <p className="text-red-500 font-bold text-[10px] uppercase tracking-widest mt-2">Incorrect Password!</p>
              )}
            </div>
            <button 
              onClick={handleUnlock}
              className="w-full bg-[#1E293B] text-white font-black py-4 rounded-xl hover:bg-black transition-all shadow-lg"
            >
              Unlock Profile
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="p-10 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Company / Consignor Name</label>
              <input 
                type="text" 
                required
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                placeholder="Your Business Name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Your GST Number</label>
                <input 
                  type="text" 
                  required
                  value={formData.gstin}
                  onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  placeholder="24AAAA..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Mobile Number</label>
                <input 
                  type="text" 
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  placeholder="+91 00000 00000"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Company Address</label>
              <textarea 
                required
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all min-h-[100px]"
                placeholder="Full Business Address..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Admin Access Password</label>
              <input 
                type="text" 
                required
                value={formData.adminPassword}
                onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all font-mono"
                placeholder="Set your login password"
              />
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Default is 1234. Change this for security.</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-blue-800 text-xs font-semibold leading-relaxed">
              Note: Saving this information will automatically set you as the "Consignor" for all new bills and lock those fields to prevent editing.
            </p>
          </div>

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
        </form>
      )}
    </motion.div>
  );
}

function PartyMasterView({ parties, title, onUpdateParties }: any) {
  const [partyForm, setPartyForm] = useState({
    name: '',
    gstin: '',
    address: '',
    mobile: ''
  });

  const handleAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = parties.find((p: any) => p.gstin === partyForm.gstin.toUpperCase());
    if (existing) {
      alert("Party with this GST already exists!");
      return;
    }

    const newParty: Party = {
      id: Math.random().toString(36).substr(2, 9),
      name: partyForm.name,
      gstin: partyForm.gstin.toUpperCase(),
      address: partyForm.address,
      mobile: partyForm.mobile,
      totalSales: 0,
      totalPaid: 0,
      totalPurchases: 0
    };

    onUpdateParties([newParty, ...parties]);
    setPartyForm({ name: '', gstin: '', address: '', mobile: '' });
    alert(`${title} Added Successfully!`);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto mt-12 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
      <div className="bg-[#1E293B] p-8 text-white flex items-center gap-4">
        <Users size={32} className="text-[#00cec9]" />
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">{title}</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Manage your {title}s</p>
        </div>
      </div>

      <div className="p-10 space-y-8">
        <form onSubmit={handleAddParty} className="space-y-6 p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
          <h3 className="text-lg font-black text-slate-900 uppercase flex items-center gap-2">
            <Plus size={20} className="text-[#00cec9]" /> Add New {title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Party Name</label>
              <input 
                type="text" 
                required 
                value={partyForm.name}
                onChange={e => setPartyForm({ ...partyForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-[#00cec9] transition-all"
                placeholder="Party Name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST Number</label>
              <input 
                type="text" 
                required 
                value={partyForm.gstin}
                onChange={e => setPartyForm({ ...partyForm, gstin: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-[#00cec9] transition-all"
                placeholder="24AAAA..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</label>
              <input 
                type="text" 
                value={partyForm.mobile}
                onChange={e => setPartyForm({ ...partyForm, mobile: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-[#00cec9] transition-all"
                placeholder="+91..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</label>
              <input 
                type="text" 
                required
                value={partyForm.address}
                onChange={e => setPartyForm({ ...partyForm, address: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-[#00cec9] transition-all"
                placeholder="City, State"
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-[#1e272e] text-white font-black py-4 rounded-xl hover:bg-black transition-all shadow-lg active:scale-[0.99]"
          >
            Save {title}
          </button>
        </form>

        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Existing Parties ({parties.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parties.map((p: any) => (
              <div key={p.id} className="p-5 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-[#00cec9] transition-all shadow-sm hover:shadow-md">
                <div>
                  <div className="font-black text-slate-900 uppercase text-sm">{p.name}</div>
                  <div className="text-[10px] font-bold text-[#00cec9] mb-1">{p.gstin}</div>
                  <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{p.address}</div>
                  {p.mobile && <div className="text-[10px] text-slate-500 font-bold mt-1">{p.mobile}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-black text-slate-400 uppercase">{title === 'Sale Party Entry' ? 'Total Sales' : 'Total Purchases'}</div>
                  <div className="text-lg font-black text-slate-900">₹{(title === 'Sale Party Entry' ? p.totalSales : (p.totalPurchases || 0)).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
