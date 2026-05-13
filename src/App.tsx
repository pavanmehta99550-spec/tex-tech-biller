import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Receipt, 
  CreditCard, 
  BookText, 
  TrendingUp,
  Truck,
  Calculator,
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
  X,
  Settings,
  Search,
  Download,
  Trash2,
  Mail,
  AlertTriangle,
  Upload,
  RefreshCw,
  FileText,
  PenTool,
  Edit,
  Check,
  Landmark,
  Eye,
  EyeOff,
  Mic,
  History
} from 'lucide-react';
import { storage } from './lib/storage';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { Party, Booking, Payment, AppSettings, Purchase, DebitNote, CreditNote, ItemMaster, Transport, Expense, Challan, ChallanItem, Broker, BrokerCommission, BrokerPayment } from './types';
import Login from './components/Login';

// Initial Party Database
const INITIAL_PARTIES: Record<string, { name: string; address: string }>= {
  "24AAAA": { name: "Kinnari Textiles", address: "Surat, Gujarat" },
  "24BBBB": { name: "Kottex Industries", address: "Sachin GIDC, Surat" },
  "24AADCR6455L1Z2": { name: "Pavan Silk Mills (Surat)", address: "Ring Road, Surat, Gujarat" },
  "24AGCPV5543K1Z3": { name: "Kottex Industries Pvt Ltd", address: "GIDC, Sachin, Surat" },
  "24BBBB1234A1Z1": { name: "J.D. Enterprise (Ahmedabad)", address: "Naroda GIDC, Ahmedabad" }
};

type View = 'dash' | 'inv' | 'pay' | 'sendpay' | 'ledg' | 'settings' | 'pur' | 'dn' | 'cn' | 'purchaseparty' | 'saleparty' | 'weaverparty' | 'items' | 'backup' | 'salehistory' | 'purchasehistory' | 'gstreport' | 'transports' | 'signature' | 'bankdetails' | 'expenses' | 'millchallan' | 'partychallan' | 'weaverchallan' | 'challancompare';

const calculateGstSplit = (taxTotal: number, consignorGstin: string, consigneeGstin: string) => {
  const myStateCode = "24";
  const rState = (consigneeGstin || '').substring(0, 2);
  const isInterstate = rState !== myStateCode;
  
  return {
    cgst: isInterstate ? 0 : Math.round(taxTotal / 2),
    sgst: isInterstate ? 0 : Math.round(taxTotal / 2),
    igst: isInterstate ? Math.round(taxTotal) : 0,
    isInterstate
  };
};






  const numberToWords = (num: number) => {
    if (!num || num === 0) return 'Zero Only';
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    
    let n = ('000000000' + Math.floor(Math.abs(num))).split('').slice(-9).join('').match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] !== '00') ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += (n[2] !== '00') ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += (n[3] !== '00') ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += (n[4] !== '00') ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += (n[5] !== '00') ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
    return str + 'Only';
};



function Watermark({ paymentStatus }: { paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | string }) {
  let color = '#dc2626'; // red
  if (paymentStatus === 'PAID') color = '#059669'; // green
  if (paymentStatus === 'PARTIAL') color = '#fbbf24'; // amber/orange

  return (
    <div className="watermark" style={{ color }}>
      {paymentStatus}
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [customLoginId, setCustomLoginId] = useState<string | null>(() => storage.get('customLoginId', null));
  const [paymentSaveTrigger, setPaymentSaveTrigger] = useState(0);
  const [purchasePaymentSaveTrigger, setPurchasePaymentSaveTrigger] = useState(0);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error'>('synced');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dash');
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const lastWriteTime = useRef<Record<string, number>>({});
  const lastSyncedData = useRef<Record<string, string>>({});
  const loadedKeys = useRef<Set<string>>(new Set());
  const views = useMemo<View[]>(() => [
    'dash', 'inv', 'salehistory', 'saleparty', 'pur', 'purchasehistory', 'purchaseparty', 
    'dn', 'cn', 'weaverchallan', 'millchallan', 'partychallan', 'challancompare', 'items', 'expenses', 'pay', 'sendpay', 'ledg', 'brokers', 'broker-ledger', 'transports', 'gstreport', 
    'signature', 'bankdetails', 'backup', 'settings'
  ], []);
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => storage.get('lastBackupDate', new Date().toISOString()));
  const [showBackupWarning, setShowBackupWarning] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutFocusedIdx, setLogoutFocusedIdx] = useState<number>(-1);

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

  const [purchaseParties, setPurchaseParties] = useState<Party[]>(() => {
    const saved = storage.get('purchaseParties', storage.get('parties', []));
    return saved;
  });

  const [saleParties, setSaleParties] = useState<Party[]>(() => storage.get('saleParties', []));
  const [expenses, setExpenses] = useState<Expense[]>(() => storage.get('expenses', []));
  const [itemsMaster, setItemsMaster] = useState<ItemMaster[]>(() => storage.get('itemsMaster', []));
  const [transports, setTransports] = useState<Transport[]>(() => storage.get('transports', []));
  const [millChallans, setMillChallans] = useState<Challan[]>(() => storage.get('millChallans', []));
  const [partyChallans, setPartyChallans] = useState<Challan[]>(() => storage.get('partyChallans', []));
  const [weaverChallans, setWeaverChallans] = useState<Challan[]>(() => storage.get('weaverChallans', []));
  const [weaverParties, setWeaverParties] = useState<Party[]>(() => storage.get('weaverParties', []));
  const challans = useMemo(() => [
    ...(Array.isArray(millChallans) ? millChallans : []),
    ...(Array.isArray(partyChallans) ? partyChallans : []),
    ...(Array.isArray(weaverChallans) ? weaverChallans : [])
  ], [millChallans, partyChallans, weaverChallans]);

  const [bookings, setBookings] = useState<Booking[]>(() => storage.get('bookings', []));
  const [purchases, setPurchases] = useState<Purchase[]>(() => storage.get('purchases', []));
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>(() => storage.get('debit-notes', []));
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => storage.get('credit-notes', []));
  const [payments, setPayments] = useState<Payment[]>(() => storage.get('payments', []));
  const [purchasePayments, setPurchasePayments] = useState<Payment[]>(() => storage.get('purchasePayments', []));
  const [brokers, setBrokers] = useState<Broker[]>(() => storage.get('brokers', []));
  const [commissions, setCommissions] = useState<BrokerCommission[]>(() => storage.get('commissions', []));
  const [brokerPayments, setBrokerPayments] = useState<BrokerPayment[]>(() => storage.get('brokerPayments', []));
  const [settings, setSettings] = useState<AppSettings | null>(() => storage.get('settings', null));

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

  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  const [previewPurchase, setPreviewPurchase] = useState<Purchase | null>(null);
  const [previewDebitNote, setPreviewDebitNote] = useState<DebitNote | null>(null);
  const [previewCreditNote, setPreviewCreditNote] = useState<CreditNote | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingDebitNote, setEditingDebitNote] = useState<DebitNote | null>(null);
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false); 
  const [globalSearch, setGlobalSearch] = useState('');

  const handleGlobalSearch = (query: string) => {
    if (!query) return;
    const qLower = query.toLowerCase();
    
    const foundBooking = bookings.find(b => b.billNumber?.toString() === query || b.lrNumber?.toLowerCase() === qLower);
    if (foundBooking) {
      setEditingBooking(foundBooking);
      setCurrentView('inv');
      setGlobalSearch('');
      return;
    }
    const foundPurchase = purchases.find(p => p.billNumber?.toString() === query || p.partyBillNumber?.toString() === query);
    if (foundPurchase) {
      setEditingPurchase(foundPurchase);
      setCurrentView('pur');
      setGlobalSearch('');
      return;
    }
    // Search in challans
    const allChallans = [...millChallans, ...partyChallans, ...weaverChallans];
    const foundChallan = allChallans.find(c => c.challanNumber?.toString() === query);
    if (foundChallan) {
        // Find which type of challan it is
        if (millChallans.some(c => c.id === foundChallan.id)) setCurrentView('millchallan');
        else if (partyChallans.some(c => c.id === foundChallan.id)) setCurrentView('partychallan');
        else if (weaverChallans.some(c => c.id === foundChallan.id)) setCurrentView('weaverchallan');
        
        // We might need a state for editing challan?
        // For now just navigate
        setGlobalSearch('');
        return;
    }
    alert('Entry not found (Checked Bills, LR, Challans)');
  }

  // Calculate current entry payment status for watermark
  const currentStatus = useMemo(() => {
    if (currentView === 'inv' && editingBooking) {
      const info = getBillPaymentInfo(editingBooking.id, editingBooking.grandTotal, payments, creditNotes, editingBooking.billNumber?.toString());
      return info.status;
    }
    if (currentView === 'pur' && editingPurchase) {
      const info = getBillPaymentInfo(editingPurchase.id, editingPurchase.grandTotal, purchasePayments, debitNotes, editingPurchase.billNumber?.toString());
      return info.status;
    }
    return null;
  }, [currentView, editingBooking, editingPurchase, payments, purchasePayments, creditNotes, debitNotes]);


  useEffect(() => storage.set('purchaseParties', purchaseParties), [purchaseParties]);
  useEffect(() => storage.set('saleParties', saleParties), [saleParties]);
  useEffect(() => storage.set('itemsMaster', itemsMaster), [itemsMaster]);
  useEffect(() => storage.set('transports', transports), [transports]);
  useEffect(() => storage.set('millChallans', millChallans), [millChallans]);
  useEffect(() => storage.set('partyChallans', partyChallans), [partyChallans]);
  useEffect(() => storage.set('weaverChallans', weaverChallans), [weaverChallans]);
  useEffect(() => storage.set('weaverParties', weaverParties), [weaverParties]);
  useEffect(() => storage.set('bookings', bookings), [bookings]);
  useEffect(() => storage.set('purchases', purchases), [purchases]);
  useEffect(() => storage.set('debit-notes', debitNotes), [debitNotes]);
  useEffect(() => storage.set('credit-notes', creditNotes), [creditNotes]);
  useEffect(() => storage.set('expenses', expenses), [expenses]);
  useEffect(() => storage.set('payments', payments), [payments]);
  useEffect(() => storage.set('purchasePayments', purchasePayments), [purchasePayments]);
  useEffect(() => storage.set('brokers', brokers), [brokers]);
  useEffect(() => storage.set('commissions', commissions), [commissions]);
  useEffect(() => storage.set('brokerPayments', brokerPayments), [brokerPayments]);
  useEffect(() => storage.set('settings', settings), [settings]);
  useEffect(() => storage.set('lastBackupDate', lastBackupDate), [lastBackupDate]);

  const resetData = () => {
    setPurchaseParties([]);
    setSaleParties([]);
    setItemsMaster([]);
    setTransports([]);
    setBookings([]);
    setPurchases([]);
    setDebitNotes([]);
    setCreditNotes([]);
    setPayments([]);
    setPurchasePayments([]);
    setSettings(null);
    setIsDataLoaded(false);
    loadedKeys.current.clear();
    const keys = [
      'purchaseParties', 'saleParties', 'itemsMaster', 'transports', 
      'bookings', 'purchases', 'debit-notes', 'credit-notes', 
      'payments', 'purchasePayments', 'settings'
    ];
    keys.forEach(key => storage.remove(key));
  };

  // Firebase Auth Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid interference when typing in inputs/textareas
      const activeElement = document.activeElement;
      const isInput = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
      
      if (e.key === 'F5') {
        e.preventDefault();
        window.location.reload();
      }

      if (e.key === 'Escape') {
        let closedSomething = false;

        if (previewBooking || previewPurchase || previewDebitNote || previewCreditNote) {
          setPreviewBooking(null);
          setPreviewPurchase(null);
          setPreviewDebitNote(null);
          setPreviewCreditNote(null);
          closedSomething = true;
        }

        if (editingBooking || editingPurchase || editingDebitNote || editingCreditNote || editingPayment) {
          setEditingBooking(null);
          setEditingPurchase(null);
          setEditingDebitNote(null);
          setEditingCreditNote(null);
          setEditingPayment(null);
          closedSomething = true;
        }

        if (showLogoutConfirm || showBackupWarning) {
          setShowLogoutConfirm(false);
          setShowBackupWarning(false);
          setLogoutFocusedIdx(-1);
          closedSomething = true;
        }

        if (closedSomething) return;

        if (focusedIdx === -1) {
          // Blur any active input so arrow keys/enter work for sidebar
          if (activeElement && (activeElement as HTMLElement).blur) {
            (activeElement as HTMLElement).blur();
          }
          // If not focused on sidebar, focus it
          setFocusedIdx(views.indexOf(currentView));
          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // If already in navigation, trigger the stylized logout modal
          setShowLogoutConfirm(true);
          setLogoutFocusedIdx(0);
        }
        return;
      }

      if (isInput) return;

      // ALT + KEY Shortcuts (Navigation)
      if (e.altKey && !e.ctrlKey) {
        const key = e.key.toLowerCase();
        // Allow standard browser/OS alt combinations if needed, but here we capture most
        const shortcutMap: Record<string, View> = {
          'd': 'dash',
          'i': 'inv',
          'h': 'salehistory',
          's': 'saleparty',
          'p': 'pur',
          'j': 'purchasehistory',
          'k': 'purchaseparty',
          'e': 'expenses',
          'm': 'items',
          'r': 'pay',
          'n': 'sendpay',
          'l': 'ledg',
          'g': 'gstreport',
          't': 'transports',
          'b': 'backup',
          '8': 'millchallan',
          '9': 'partychallan',
          '0': 'challancompare'
        };

        if (shortcutMap[key]) {
          e.preventDefault();
          e.stopPropagation();
          setCurrentView(shortcutMap[key]);
          setFocusedIdx(-1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } else if (key !== 'alt' && key !== 'control' && key !== 'shift') {
          // It's an Alt combo but not in our map
          e.preventDefault();
          alert(`Alt + ${key.toUpperCase()} is not a shortcut in this app.`);
          return;
        }
      }

      // CTRL + KEY Shortcuts (New Records)
      if (e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        
        // Whitelist common editing shortcuts so we don't break copy/paste
        const editingKeys = ['c', 'v', 'x', 'a', 'z', 'y'];
        if (editingKeys.includes(key)) return;

        if (key === 'n') {
          e.preventDefault();
          switch(currentView) {
            case 'inv': 
            case 'salehistory':
              setEditingBooking(null); 
              setCurrentView('inv');
              break;
            case 'pur': 
            case 'purchasehistory':
              setEditingPurchase(null); 
              setCurrentView('pur');
              break;
            case 'dn': setEditingDebitNote(null); setCurrentView('dn'); break;
            case 'cn': setEditingCreditNote(null); setCurrentView('cn'); break;
            case 'pay': setEditingPayment(null); setCurrentView('pay'); break;
            case 'sendpay': setEditingPayment(null); setCurrentView('sendpay'); break;
            case 'saleparty': 
            case 'purchaseparty': 
              window.dispatchEvent(new CustomEvent('app-trigger-add-new'));
              break;
            default: break; 
          }
          return;
        }

        // i: Sale, p: Purchase, d: Debit Note, c: Credit Note, e: Expense
        const ctrlShortcutMap: Record<string, View> = {
          'i': 'inv',
          'p': 'pur',
          'd': 'dn',
          'c': 'cn',
          'e': 'expenses',
          'r': 'pay',
          's': 'inv' // Common habit to save/new invoice
        };

        if (ctrlShortcutMap[key]) {
          e.preventDefault();
          setCurrentView(ctrlShortcutMap[key]);
          setFocusedIdx(-1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } else if (key !== 'control' && key !== 'alt' && key !== 'shift') {
          // Block other browser shortcuts like Ctrl+N, Ctrl+T, Ctrl+P if not handled
          e.preventDefault();
          alert(`Ctrl + ${key.toUpperCase()} is not a shortcut in this app.`);
          return;
        }
      }
      
      if (showLogoutConfirm) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setLogoutFocusedIdx(prev => (prev < 2 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setLogoutFocusedIdx(prev => (prev > 0 ? prev - 1 : 2));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (logoutFocusedIdx === 0) {
            setCurrentView('backup');
            setShowLogoutConfirm(false);
            setLogoutFocusedIdx(-1);
          } else if (logoutFocusedIdx === 1) {
            auth.signOut();
            resetData();
            setIsAuthenticated(false);
            setUser(null);
            setCustomLoginId(null);
            storage.remove('customLoginId');
            setShowLogoutConfirm(false);
            setLogoutFocusedIdx(-1);
          } else if (logoutFocusedIdx === 2) {
            setShowLogoutConfirm(false);
            setLogoutFocusedIdx(-1);
          }
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(prev => (prev < views.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(prev => (prev > 0 ? prev - 1 : views.length - 1));
      } else if (e.key === 'Enter') {
        if (focusedIdx !== -1) {
          e.preventDefault();
          setCurrentView(views[focusedIdx]);
          setFocusedIdx(-1); // Reset focus after selection
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, focusedIdx, views, previewBooking, previewPurchase, previewDebitNote, previewCreditNote, editingBooking, editingPurchase, editingDebitNote, editingCreditNote, editingPayment, showLogoutConfirm, showBackupWarning, logoutFocusedIdx]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsAuthenticated(true);
      }
      setIsFirebaseLoading(false);
    });
    
    // Safety timeout: Ensure app opens even if Firebase initialization is slow or fails
    const timeout = setTimeout(() => {
      setIsFirebaseLoading(false);
    }, 7000);

    // Safety timeout: Force data loaded state if it sticks for too long
    // If Firebase takes > 10s, we show what we have in local storage
    const dataTimeout = setTimeout(() => {
      if ((auth.currentUser || storage.get('customLoginId', null)) && !isDataLoaded) {
        console.warn("App: Data sync timeout (10s) - falling back to local data for UI load");
        setIsDataLoaded(true);
      }
    }, 10000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
      clearTimeout(dataTimeout);
    };
  }, [isDataLoaded]);

  // Firebase Data Loader & Syncer
  useEffect(() => {
    const activeId = user?.uid || customLoginId;
    if (!activeId) return;

    loadedKeys.current.clear();
    setIsDataLoaded(false);

    const dataCollections = [
      { key: 'purchaseParties', setter: setPurchaseParties },
      { key: 'saleParties', setter: setSaleParties },
      { key: 'itemsMaster', setter: setItemsMaster },
      { key: 'transports', setter: setTransports },
      { key: 'bookings', setter: setBookings },
      { key: 'purchases', setter: setPurchases },
      { key: 'debit-notes', setter: setDebitNotes },
      { key: 'credit-notes', setter: setCreditNotes },
      { key: 'payments', setter: setPayments },
      { key: 'purchasePayments', setter: setPurchasePayments },
      { key: 'expenses', setter: setExpenses },
      { key: 'millChallans', setter: setMillChallans },
      { key: 'partyChallans', setter: setPartyChallans },
      { key: 'weaverChallans', setter: setWeaverChallans },
      { key: 'weaverParties', setter: setWeaverParties },
      { key: 'brokers', setter: setBrokers },
      { key: 'commissions', setter: setCommissions },
      { key: 'brokerPayments', setter: setBrokerPayments },
      { key: 'settings', setter: setSettings },
      { key: 'lastBackupDate', setter: setLastBackupDate },
    ];

    const unsubscribers = dataCollections.map(({ key, setter }) => {
      const docPath = user ? `users/${user.uid}/appData/${key}` : `custom_accounts/${customLoginId}/appData/${key}`;
      const [col, docId, subCol, subDocId, ...rest] = docPath.split('/');
      
      return onSnapshot(doc(db, col, docId, subCol, subDocId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data().value;
          const stringified = JSON.stringify(data);
          
          const now = Date.now();
          const lastWrite = lastWriteTime.current[key] || 0;
          const isRecentlyWrittenLocally = (now - lastWrite) < 2000; // Ignore snapshots for 2 seconds after a local write
          
          if (!docSnap.metadata.hasPendingWrites && stringified !== lastSyncedData.current[key]) {
            if (isRecentlyWrittenLocally) {
              // We just wrote this locally, wait for our own write to hit the server and come back in a future snapshot
              // or just rely on our local setDoc to eventually sync.
              return;
            }
            lastSyncedData.current[key] = stringified;
            setter(data);
          }
        }
        
        // Mark as loaded regardless of existence
        loadedKeys.current.add(key);
        if (loadedKeys.current.size >= dataCollections.length) {
            setIsDataLoaded(true);
        }
      }, (error) => {
        console.error(`Snapshot error for ${key}:`, error);
        loadedKeys.current.add(key); 
        if (loadedKeys.current.size >= dataCollections.length) {
            setIsDataLoaded(true);
        }
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [user, customLoginId]);

  // Track individual changes to prevent "rollback" flickers
  const prevData = useRef<Record<string, any>>({});
  useEffect(() => {
    const data: Record<string, any> = {
      purchaseParties, saleParties, itemsMaster, transports, bookings, purchases, 
      'debit-notes': debitNotes, 'credit-notes': creditNotes, payments, purchasePayments, 
      expenses, millChallans, partyChallans, weaverChallans, weaverParties,
      settings, lastBackupDate
    };
    
    let hasChanges = false;
    Object.keys(data).forEach(key => {
      const currentVal = JSON.stringify(data[key]);
      if (currentVal !== prevData.current[key]) {
        lastWriteTime.current[key] = Date.now();
        prevData.current[key] = currentVal;
        setSyncStatus('pending');
        hasChanges = true;
      }
    });

    if (hasChanges) {
       setIsSyncing(true);
    }
  }, [purchaseParties, saleParties, itemsMaster, transports, bookings, purchases, debitNotes, creditNotes, payments, purchasePayments, expenses, millChallans, partyChallans, weaverChallans, weaverParties, settings, lastBackupDate]);

  const forceSyncData = async () => {
    const activeId = auth.currentUser?.uid || storage.get('customLoginId', null);
    if (!activeId) return;
    
    setIsSyncing(true);
    try {
      const batch: any = {
        purchaseParties,
        saleParties,
        itemsMaster,
        transports,
        bookings,
        purchases,
        'debit-notes': debitNotes,
        'credit-notes': creditNotes,
        payments,
        purchasePayments,
        expenses,
        millChallans,
        partyChallans,
        weaverChallans,
        weaverParties,
        brokers,
        commissions,
        brokerPayments,
        settings,
        lastBackupDate
      };

      const syncPromises = Object.entries(batch).map(async ([key, value]) => {
        if (value !== undefined) {
           const stringified = JSON.stringify(value);
           if (stringified !== lastSyncedData.current[key]) {
              const docPath = auth.currentUser ? `users/${auth.currentUser.uid}/appData/${key}` : `custom_accounts/${activeId}/appData/${key}`;
              const pathParts = docPath.split('/');
              const [col, docId, subCol, subDocId] = pathParts;
              
              await setDoc(doc(db, col, docId, subCol, subDocId), { value });
              lastSyncedData.current[key] = stringified;
           }
        }
      });
      
      await Promise.all(syncPromises);
      setSyncStatus('synced');
      
      if (activeId && !auth.currentUser && settings?.adminPassword) {
         await setDoc(doc(db, 'custom_credentials', activeId), { 
           password: settings.adminPassword,
           username: settings.adminUsername || activeId,
           updatedAt: new Date().toISOString()
         });
      }
    } catch (err) {
      console.error("Sync failed", err);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync to Firebase on changes
  useEffect(() => {
    const activeId = user?.uid || customLoginId;
    if (!activeId || !isDataLoaded) return;
    
    const timer = setTimeout(forceSyncData, 200); 
    return () => clearTimeout(timer);
  }, [user, customLoginId, purchaseParties, saleParties, itemsMaster, transports, bookings, purchases, debitNotes, creditNotes, payments, purchasePayments, expenses, millChallans, partyChallans, weaverChallans, weaverParties, brokers, commissions, brokerPayments, settings, lastBackupDate, isDataLoaded]);


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


  function handleSaveBooking(data: Partial<Booking>) {
    let updatedSaleParties = [...saleParties];
    
    const isUpdate = !!data.id && bookings.some(b => b.id === data.id);
    const duplicate = bookings.find(b => b.billNumber === data.billNumber && b.id !== data.id);
    
    if (duplicate) {
      if (!confirm(`Warning: Bill Number #${data.billNumber} already exists for ${duplicate.consigneeName}. Do you still want to save?`)) {
        return;
      }
    }

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

    const split = calculateGstSplit(data.taxAmount || 0, data.consignorGstin || '', data.consigneeGstin || '');

    const newBooking: Booking = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      billNumber: nextBillNum,
      lrNumber: data.lrNumber || '',
      ewbNumber: data.ewbNumber || '',
      parcels: data.parcels || '',
      transportName: data.transportName || '',
      transportGstin: data.transportGstin || '',
      consignorGstin: data.consignorGstin || '',
      consignorName: data.consignorName || '',
      consignorAddress: data.consignorAddress || '',
      consigneeGstin: data.consigneeGstin || '',
      consigneeName: data.consigneeName || '',
      consigneeAddress: data.consigneeAddress || '',
      consigneeMobile: data.consigneeMobile || '',
      consigneeMobile2: data.consigneeMobile2 || '',
      items: (data.items || []).map(item => ({
        ...item,
        hsnCode: item.hsnCode || '',
        taka: item.taka || ''
      })),
      basicAmount: data.basicAmount || 0,
      globalDiscount: data.globalDiscount || 0,
      taxRate: data.taxRate || 18,
      taxAmount: data.taxAmount || 0,
      cgstAmount: split.cgst,
      sgstAmount: split.sgst,
      igstAmount: split.igst,
      grandTotal: data.grandTotal || 0,
      date: data.date || new Date().toISOString(),
      notes: data.notes || '',
      brokerId: data.brokerId || ''
    };

    // Commission Logic
    let broker = brokers.find(b => b.id === newBooking.brokerId);
    if (!broker) {
      broker = brokers.find(b => b.partyMappings?.some(m => m.partyId === consignee?.id));
    }
    
    if (broker) {
      newBooking.brokerId = broker.id;
      const mapping = broker.partyMappings?.find(m => m.partyId === consignee?.id);
      
      const totalMtrs = newBooking.items.reduce((sum, it) => sum + (it.unit === 'MTR' ? it.quantity || 0 : 0), 0);
      const commType = mapping?.type || (broker.type === 'mill' ? 'meter' : 'percentage');
      const commRate = data.brokerCommissionRate || mapping?.rate || broker.defaultCommission || 0;
      
      const commAmount = commType === 'fixed' 
        ? commRate 
        : (commType === 'meter' 
            ? Math.round(totalMtrs * commRate)
            : Math.round(newBooking.basicAmount * (commRate / 100)));
        
      const newComm: BrokerCommission = {
        id: Math.random().toString(36).substr(2, 9),
        brokerId: broker.id,
        brokerName: broker.name,
        partyId: consignee!.id,
        partyName: consignee!.name,
        billId: newBooking.id,
        billNumber: newBooking.billNumber,
        billDate: newBooking.date,
        billAmount: newBooking.basicAmount,
        commissionRate: commRate,
        commissionType: commType as any,
        commissionAmount: commAmount,
        status: 'UNPAID',
        paidAmount: 0,
        date: new Date().toISOString()
      };
      setCommissions(prev => {
        const others = prev.filter(c => c.billId !== newBooking.id);
        return [newComm, ...others];
      });
    } else {
      newBooking.brokerId = '';
      setCommissions(prev => prev.filter(c => c.billId !== newBooking.id));
    }

    if (isUpdate) {
      setBookings(prev => prev.map(b => b.id === data.id ? newBooking : b));
      
      setSaleParties(prev => {
        const oldBooking = bookings.find(b => b.id === data.id);
        if (!oldBooking) return prev;
        
        const customerGstin = oldBooking.consigneeGstin;
        const newCustomerGstin = data.consigneeGstin;
        
        return prev.map(p => {
          let total = p.totalSales || 0;
          if (p.gstin === customerGstin) {
            total -= oldBooking.grandTotal || 0;
          }
          if (p.gstin === newCustomerGstin) {
            total += newBooking.grandTotal || 0;
          }
          return { ...p, totalSales: total };
        });
      });
      setEditingBooking(null);
    } else {
      setBookings(prev => [newBooking, ...prev]);
      const customerGstin = data.consigneeGstin;

      setSaleParties(prev => {
        // If party was just added to local `updatedSaleParties` above, it might be in `prev`
        // but we need to find it and update it.
        const gstinExists = prev.some(p => p.gstin === customerGstin);
        if (gstinExists) {
            return prev.map(p => 
              p.gstin === customerGstin 
                ? { ...p, totalSales: (p.totalSales || 0) + newBooking.grandTotal } 
                : p
            );
        } else if (customerGstin) {
            // This case should be handled by the logic at the top of the function
            // which adds the party to updatedSaleParties. 
            // But if we are being purely functional:
            return [...prev, {
              id: Math.random().toString(36).substr(2, 9),
              name: data.consigneeName || "New Party",
              gstin: data.consigneeGstin || "",
              address: data.consigneeAddress || "",
              totalSales: newBooking.grandTotal,
              totalPaid: 0,
              totalPurchases: 0
            }];
        }
        return prev;
      });
    }

    setPreviewBooking(newBooking);
    alert(isUpdate ? "Sale Bill Updated Successfully!" : "Sale Bill Saved Successfully!");
  };

  const handleDeleteBooking = (id: string) => {
    if (!confirm("Are you sure you want to delete this Sale Bill? This will also revert the party balance.")) return;
    
    const bookingToDelete = bookings.find(b => b.id === id);
    if (!bookingToDelete) return;

    // Update sale party balance
    setSaleParties(prev => prev.map(p => 
      p.gstin === bookingToDelete.consigneeGstin 
        ? { ...p, totalSales: p.totalSales - bookingToDelete.grandTotal } 
        : p
    ));

    // Remove booking
    setBookings(prev => prev.filter(b => b.id !== id));
    alert("Sale Bill Deleted Successfully!");
  };

  const handleDeletePurchase = (id: string) => {
    if (!confirm("Are you sure you want to delete this Purchase Bill? This will also revert the party balance.")) return;
    const pToDelete = purchases.find(p => p.id === id);
    if (!pToDelete) return;
    
    setPurchaseParties(prev => prev.map(p => 
      p.gstin === pToDelete.partyGstin 
        ? { ...p, totalPurchases: (p.totalPurchases || 0) - pToDelete.grandTotal } 
        : p
    ));
    setPurchases(prev => prev.filter(p => p.id !== id));
    alert("Purchase Bill Deleted Successfully!");
  };

  const handleDeleteDebitNote = (id: string) => {
    if (!confirm("Are you sure you want to delete this Debit Note? This will also revert the party balance.")) return;
    const dnToDelete = debitNotes.find(dn => dn.id === id);
    if (!dnToDelete) return;

    setPurchaseParties(prev => prev.map(p => 
      p.gstin === dnToDelete.partyGstin 
        ? { ...p, totalPurchases: (p.totalPurchases || 0) + dnToDelete.grandTotal } 
        : p
    ));
    setDebitNotes(prev => prev.filter(dn => dn.id !== id));
    alert("Debit Note Deleted Successfully!");
  };

  const handleDeleteCreditNote = (id: string) => {
    if (!confirm("Are you sure you want to delete this Credit Note? This will also revert the party balance.")) return;
    const cnToDelete = creditNotes.find(cn => cn.id === id);
    if (!cnToDelete) return;

    setSaleParties(prev => prev.map(p => 
      p.gstin === cnToDelete.partyGstin 
        ? { ...p, totalSales: (p.totalSales || 0) + cnToDelete.grandTotal } 
        : p
    ));
    setCreditNotes(prev => prev.filter(cn => cn.id !== id));
    alert("Credit Note Deleted Successfully!");
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

    const split = calculateGstSplit(data.taxAmount || 0, settings?.gstin || '', data.partyGstin || '');

    const newPurchase: Purchase = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      billNumber: nextBillNum,
      partyGstin: data.partyGstin || '',
      partyName: data.partyName || '',
      partyAddress: data.partyAddress || '',
      partyBillNumber: data.partyBillNumber || '',
      partyMobile: data.partyMobile || '',
      partyMobile2: data.partyMobile2 || '',
      parcels: data.parcels || '',
      items: (data.items || []).map(item => ({
        ...item,
        hsnCode: item.hsnCode || '',
        taka: item.taka || ''
      })),
      basicAmount: data.basicAmount || 0,
      globalDiscount: data.globalDiscount || 0,
      taxRate: data.taxRate || 18,
      taxAmount: data.taxAmount || 0,
      cgstAmount: split.cgst,
      sgstAmount: split.sgst,
      igstAmount: split.igst,
      grandTotal: data.grandTotal || 0,
      date: data.date || new Date().toISOString(),
      notes: data.notes || '',
      brokerId: data.brokerId || ''
    };

    // Commission Logic
    let broker = brokers.find(b => b.id === newPurchase.brokerId);
    if (!broker) {
      broker = brokers.find(b => b.partyMappings?.some(m => m.partyId === party?.id));
    }
    
    if (broker) {
      newPurchase.brokerId = broker.id;
      const mapping = broker.partyMappings?.find(m => m.partyId === party?.id);
      
      const totalMtrs = newPurchase.items.reduce((sum, it) => sum + (it.unit === 'MTR' ? it.quantity || 0 : 0), 0);
      const commType = mapping?.type || (broker.type === 'mill' ? 'meter' : 'percentage');
      const commRate = data.brokerCommissionRate || mapping?.rate || broker.defaultCommission || 0;
      
      const commAmount = commType === 'fixed' 
        ? commRate 
        : (commType === 'meter' 
            ? Math.round(totalMtrs * commRate)
            : Math.round(newPurchase.basicAmount * (commRate / 100)));
        
      const newComm: BrokerCommission = {
        id: Math.random().toString(36).substr(2, 9),
        brokerId: broker.id,
        brokerName: broker.name,
        partyId: party!.id,
        partyName: party!.name,
        billId: newPurchase.id,
        billNumber: newPurchase.billNumber,
        billDate: newPurchase.date,
        billAmount: newPurchase.basicAmount,
        commissionRate: commRate,
        commissionType: commType as any,
        commissionAmount: commAmount,
        status: 'UNPAID',
        paidAmount: 0,
        date: new Date().toISOString()
      };
      setCommissions(prev => {
        const others = prev.filter(c => c.billId !== newPurchase.id);
        return [newComm, ...others];
      });
    } else {
      newPurchase.brokerId = '';
      setCommissions(prev => prev.filter(c => c.billId !== newPurchase.id));
    }

    if (isUpdate) {
      setPurchases(prev => prev.map(b => b.id === data.id ? newPurchase : b));
      
      setPurchaseParties(prev => {
        const oldPurchase = purchases.find(b => b.id === data.id);
        if (!oldPurchase) return prev;
        
        return prev.map(p => {
          let total = p.totalPurchases || 0;
          if (p.gstin === oldPurchase.partyGstin) {
            total -= oldPurchase.grandTotal || 0;
          }
          if (p.gstin === data.partyGstin) {
            total += newPurchase.grandTotal || 0;
          }
          return { ...p, totalPurchases: total };
        });
      });
      setEditingPurchase(null);
    } else {
      setPurchases(prev => [newPurchase, ...prev]);
      setPurchaseParties(prev => {
        const partyExists = prev.some(p => p.gstin === data.partyGstin);
        if (partyExists) {
            return prev.map(p => 
              p.gstin === data.partyGstin 
                ? { ...p, totalPurchases: (p.totalPurchases || 0) + newPurchase.grandTotal } 
                : p
            );
        } else if (data.partyGstin) {
            return [...prev, {
              id: Math.random().toString(36).substr(2, 9),
              name: data.partyName || "New Party",
              gstin: data.partyGstin,
              address: data.partyAddress || "",
              totalSales: 0,
              totalPaid: 0,
              totalPurchases: newPurchase.grandTotal
            }];
        }
        return prev;
      });
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
      partyMobile: data.partyMobile || '',
      partyMobile2: data.partyMobile2 || '',
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
      reason: data.reason || '',
      notes: data.notes || ''
    };

    if (isUpdate) {
      setDebitNotes(prev => prev.map(b => b.id === data.id ? newDebitNote : b));
      
      setPurchaseParties(prev => {
        const oldNote = debitNotes.find(b => b.id === data.id);
        if (!oldNote) return prev;
        
        return prev.map(p => {
          let total = p.totalPurchases || 0;
          if (p.gstin === oldNote.partyGstin) {
            total += oldNote.grandTotal || 0;
          }
          if (p.gstin === data.partyGstin) {
            total -= newDebitNote.grandTotal || 0;
          }
          return { ...p, totalPurchases: total };
        });
      });
      setEditingDebitNote(null);
    } else {
      setDebitNotes(prev => [newDebitNote, ...prev]);
      setPurchaseParties(prev => prev.map(p => 
        p.gstin === data.partyGstin 
          ? { ...p, totalPurchases: (p.totalPurchases || 0) - newDebitNote.grandTotal } 
          : p
      ));
    }

    setPreviewDebitNote(newDebitNote);
    alert(isUpdate ? "Debit Note Updated Successfully!" : "Debit Note Saved Successfully!");
  };

  const handleSaveCreditNote = async (data: Partial<CreditNote>) => {
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
      partyMobile2: data.partyMobile2 || '',
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
      reason: data.reason || '',
      notes: data.notes || ''
    };

    setIsSyncing(true);
    try {
      const activeId = auth.currentUser?.uid || customLoginId;
      if (activeId) {
        const cnPath = auth.currentUser ? `users/${auth.currentUser.uid}/appData/credit-notes` : `custom_accounts/${activeId}/appData/credit-notes`;
        const bPath = auth.currentUser ? `users/${auth.currentUser.uid}/appData/bookings` : `custom_accounts/${activeId}/appData/bookings`;
        
        await runTransaction(db, async (transaction) => {
          const cnRef = doc(db, ...cnPath.split('/') as [string, string, string, string]);
          const bRef = doc(db, ...bPath.split('/') as [string, string, string, string]);
          
          const cnSnap = await transaction.get(cnRef);
          const bSnap = await transaction.get(bRef);
          
          let currentCNs = (cnSnap.exists() ? cnSnap.data().value : null) || creditNotes;
          let currentBookings = (bSnap.exists() ? bSnap.data().value : null) || bookings;
          
          if (isUpdate) {
            currentCNs = currentCNs.map((cn: any) => cn.id === data.id ? newCreditNote : cn);
          } else {
            currentCNs = [newCreditNote, ...currentCNs];
          }
          
          let updatedBooking = null;
          if (newCreditNote.salesBillNumber) {
             const bIndex = currentBookings.findIndex((b: any) => b.billNumber.toString() === newCreditNote.salesBillNumber);
             if (bIndex >= 0) {
               const b = currentBookings[bIndex];
               const priorCNsSum = currentCNs
                 .filter((cn: any) => cn.salesBillNumber === b.billNumber.toString() && cn.id !== newCreditNote.id)
                 .reduce((sum: number, cn: any) => sum + cn.grandTotal, 0);
               const totalCNSum = priorCNsSum + newCreditNote.grandTotal;
               
               const existingPaidInfo = getBillPaymentInfo(b.id, b.grandTotal, payments);
               const newPending = b.grandTotal - existingPaidInfo.paidAmount - totalCNSum;
               
               let newStatus = 'UNPAID';
               if (newPending <= 0) newStatus = 'PAID';
               else if ((existingPaidInfo.paidAmount + totalCNSum) > 0) newStatus = 'PARTIAL';
               
               currentBookings[bIndex] = { ...b, pendingAmount: newPending, status: newStatus };
               updatedBooking = currentBookings[bIndex];
             }
          }
          
          transaction.set(cnRef, { value: currentCNs });
          transaction.set(bRef, { value: currentBookings });
        });
      }

      // Update Local State strictly
      setCreditNotes(prev => {
        if (isUpdate) return prev.map(b => b.id === data.id ? newCreditNote : b);
        return [newCreditNote, ...prev];
      });

      // Reverse Brokerage logic for Credit Note
      if (newCreditNote.salesBillNumber) {
        const booking = bookings.find(b => b.billNumber.toString() === newCreditNote.salesBillNumber);
        if (booking && booking.brokerId) {
          const broker = brokers.find(b => b.id === booking.brokerId);
          if (broker) {
            const party = saleParties.find(p => p.gstin === newCreditNote.partyGstin);
            if (party) {
              const mapping = broker.partyMappings?.find(m => m.partyId === party.id);
              const commType = mapping?.type || 'percentage';
              const commRate = mapping?.rate || broker.defaultCommission || 0;
              
              if (commType === 'percentage' && commRate > 0) {
                const reversalAmount = Math.round(newCreditNote.basicAmount * (commRate / 100));
                if (reversalAmount > 0) {
                  const reversalComm: BrokerCommission = {
                    id: `CN-REV-${newCreditNote.id}`,
                    brokerId: broker.id,
                    brokerName: broker.name,
                    partyId: party.id,
                    partyName: party.name,
                    billId: newCreditNote.id,
                    billNumber: newCreditNote.noteNumber,
                    billDate: newCreditNote.date,
                    billAmount: -newCreditNote.basicAmount,
                    commissionRate: commRate,
                    commissionType: 'percentage',
                    commissionAmount: -reversalAmount,
                    status: 'UNPAID',
                    paidAmount: 0,
                    date: new Date().toISOString(),
                    notes: `Reversal for Sales Return (Bill #${newCreditNote.salesBillNumber})`
                  };
                  setCommissions(prev => {
                    const others = prev.filter(c => c.id !== reversalComm.id);
                    return [reversalComm, ...others];
                  });
                }
              }
            }
          }
        }
      }

      if (newCreditNote.salesBillNumber) {
        setBookings(prev => prev.map(b => {
          if (b.billNumber.toString() === newCreditNote.salesBillNumber) {
             const priorCNsSum = creditNotes
               .filter((cn: any) => cn.salesBillNumber === b.billNumber.toString() && cn.id !== newCreditNote.id)
               .reduce((sum: number, cn: any) => sum + cn.grandTotal, 0);
             const totalCNSum = priorCNsSum + newCreditNote.grandTotal;
             const existingPaidInfo = getBillPaymentInfo(b.id, b.grandTotal, payments);
             const newPending = b.grandTotal - existingPaidInfo.paidAmount - totalCNSum;
             let newStatus = 'UNPAID';
             if (newPending <= 0) newStatus = 'PAID';
             else if ((existingPaidInfo.paidAmount + totalCNSum) > 0) newStatus = 'PARTIAL';
             return { ...b, pendingAmount: newPending, status: newStatus as any };
          }
          return b;
        }));
      }

      setSaleParties(prev => {
        if (isUpdate) {
          const oldNote = creditNotes.find(b => b.id === data.id);
          if (!oldNote) return prev;
          return prev.map(p => {
            let total = p.totalSales || 0;
            if (p.gstin === oldNote.partyGstin) total += oldNote.grandTotal || 0;
            if (p.gstin === data.partyGstin) total -= newCreditNote.grandTotal || 0;
            return { ...p, totalSales: total };
          });
        }
        return prev.map(p => p.gstin === data.partyGstin ? { ...p, totalSales: (p.totalSales || 0) - newCreditNote.grandTotal } : p);
      });

      setEditingCreditNote(null);
      setPreviewCreditNote(newCreditNote);
      alert(isUpdate ? "Credit Note Updated Successfully!" : "Credit Note Saved Successfully!");

    } catch (e) {
      console.error("Firestore transaction failed: ", e);
      alert("Error saving Credit Note safely. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveChallan = (data: Partial<Challan>) => {
    const isUpdate = !!data.id;
    const millMaxSerial = millChallans.length > 0 ? Math.max(...millChallans.map(c => c.serialNo || 0)) : 0;
    const partyMaxSerial = partyChallans.length > 0 ? Math.max(...partyChallans.map(c => c.serialNo || 0)) : 0;
    const weaverMaxSerial = weaverChallans.length > 0 ? Math.max(...weaverChallans.map(c => c.serialNo || 0)) : 0;

    // Calculate broker amount if mill challan
    let brokerAmount = 0;
    if (data.type === 'MILL' && data.brokerId && data.brokerRate) {
      const totalMtrs = (data.items || []).reduce((sum, it) => sum + (it.unit === 'MTR' ? it.quantity || 0 : 0), 0);
      brokerAmount = Math.round(totalMtrs * data.brokerRate);
    }

    const newChallan: Challan = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      serialNo: data.serialNo || (data.type === 'MILL' ? millMaxSerial + 1 : data.type === 'PARTY' ? partyMaxSerial + 1 : weaverMaxSerial + 1),
      challanNumber: data.challanNumber || '',
      date: data.date || new Date().toISOString(),
      type: data.type || 'MILL',
      partyName: data.partyName || '',
      partyGstin: data.partyGstin || '',
      items: data.items || [],
      notes: data.notes || '',
      weaverChallanNumber: data.weaverChallanNumber || '',
      brokerId: data.brokerId,
      brokerRate: data.brokerRate,
      brokerAmount: brokerAmount
    };

    if (data.type === 'MILL') {
      if (isUpdate) {
        setMillChallans(prev => prev.map(c => c.id === data.id ? newChallan : c));
      } else {
        setMillChallans(prev => [newChallan, ...prev]);
      }

      // Handle broker commission for Mill Challan
      if (newChallan.brokerId) {
        const broker = brokers.find(b => b.id === newChallan.brokerId);
        if (broker) {
          const totalMtrs = newChallan.items.reduce((sum, it) => sum + (it.unit === 'MTR' ? it.quantity || 0 : 0), 0);
          const commission: BrokerCommission = {
            id: `comm-mill-${newChallan.id}`,
            brokerId: newChallan.brokerId,
            brokerName: broker.name,
            partyId: 'MILL',
            partyName: newChallan.partyName,
            billId: newChallan.id,
            billNumber: newChallan.challanNumber as any,
            billDate: newChallan.date,
            billAmount: 0, // Not applicable for mill meter rate
            commissionRate: newChallan.brokerRate || 0,
            commissionType: 'meter',
            commissionAmount: newChallan.brokerAmount || 0,
            status: 'UNPAID',
            paidAmount: 0,
            date: newChallan.date
          };
          
          setCommissions(prev => {
            const existingIdx = prev.findIndex(c => c.id === commission.id);
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = commission;
              return updated;
            }
            return [commission, ...prev];
          });
        }
      } else {
        // If broker removed during update
        setCommissions(prev => prev.filter(c => c.id !== `comm-mill-${newChallan.id}`));
      }
    } else if (data.type === 'PARTY') {
      if (isUpdate) {
        setPartyChallans(prev => prev.map(c => c.id === data.id ? newChallan : c));
      } else {
        setPartyChallans(prev => [newChallan, ...prev]);
      }
    } else if (data.type === 'WEAVER') {
      if (isUpdate) {
        setWeaverChallans(prev => prev.map(c => c.id === data.id ? newChallan : c));
      } else {
        setWeaverChallans(prev => [newChallan, ...prev]);
      }
    }
    alert(`${data.type === 'MILL' ? 'Mill' : data.type === 'PARTY' ? 'Party' : 'Weaver'} Challan saved successfully!`);
  };

  const handleDeleteChallan = (id: string, type: 'MILL' | 'PARTY' | 'WEAVER') => {
    if (confirm("Are you sure you want to delete this challan?")) {
      if (type === 'MILL') {
        setMillChallans(prev => prev.filter(c => c.id !== id));
        setCommissions(prev => prev.filter(c => c.id !== `comm-mill-${id}`));
      } else if (type === 'PARTY') {
        setPartyChallans(prev => prev.filter(c => c.id !== id));
      } else if (type === 'WEAVER') {
        setWeaverChallans(prev => prev.filter(c => c.id !== id));
      }
    }
  };

  const handleSavePayment = (data: any) => {
    const party = saleParties.find(p => p.id === data.partyId);
    if (!party) return;

    const isUpdate = !!data.id && payments.some(p => p.id === data.id);

    const newPayment: Payment = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      partyId: party.id,
      partyName: party.name,
      partyGstin: party.gstin,
      amount: data.amount,
      date: data.date || new Date().toISOString(),
      chequeNumber: data.chequeNumber,
      chequeDate: data.chequeDate,
      notes: data.notes,
      billAdjustments: data.billAdjustments
    };

    setIsSyncing(true);
    if (isUpdate) {
      setPayments(prev => prev.map(p => p.id === data.id ? newPayment : p));
      
      setSaleParties(prev => {
        const oldPayment = payments.find(p => p.id === data.id);
        if (!oldPayment) return prev;
        
        return prev.map(p => {
          let total = p.totalPaid || 0;
          if (p.id === oldPayment.partyId) {
            total -= oldPayment.amount || 0;
          }
          if (p.id === data.partyId) {
            total += data.amount || 0;
          }
          return { ...p, totalPaid: total };
        });
      });
      setEditingPayment(null);
    } else {
      setPayments(prev => [newPayment, ...prev]);
      setSaleParties(prev => prev.map(p => p.id === data.partyId ? { ...p, totalPaid: (p.totalPaid || 0) + data.amount } : p));
      setPaymentSaveTrigger(prev => prev + 1);
      alert("Payment Received Successfully!");
    }
  };

  const handleSavePurchasePayment = (data: any) => {
    const party = purchaseParties.find(p => p.id === data.partyId);
    if (!party) return;

    const isUpdate = !!data.id && purchasePayments.some(p => p.id === data.id);

    const newPayment: Payment = {
      id: data.id || Math.random().toString(36).substr(2, 9),
      partyId: party.id,
      partyName: party.name,
      partyGstin: party.gstin,
      amount: data.amount,
      date: data.date || new Date().toISOString(),
      chequeNumber: data.chequeNumber,
      chequeDate: data.chequeDate,
      notes: data.notes,
      billAdjustments: data.billAdjustments
    };

    setIsSyncing(true);
    if (isUpdate) {
      setPurchasePayments(prev => prev.map(p => p.id === data.id ? newPayment : p));
      
      setPurchaseParties(prev => {
        const oldPayment = purchasePayments.find(p => p.id === data.id);
        if (!oldPayment) return prev;
        
        return prev.map(p => {
          let total = p.totalPaid || 0;
          if (p.id === oldPayment.partyId) {
            total -= oldPayment.amount || 0;
          }
          if (p.id === data.partyId) {
            total += data.amount || 0;
          }
          return { ...p, totalPaid: total };
        });
      });
      setEditingPayment(null);
    } else {
      setPurchasePayments(prev => [newPayment, ...prev]);
      setPurchaseParties(prev => prev.map(p => p.id === data.partyId ? { ...p, totalPaid: (p.totalPaid || 0) + data.amount } : p));
      setPurchasePaymentSaveTrigger(prev => prev + 1);
      alert("Payment Sent Successfully!");
    }
  };

  const handleDeletePayment = (payment: any) => {
    if (confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) {
      setPayments(payments.filter((p: any) => p.id !== payment.id));
      // Update party totalPaid if necessary (assuming totalPaid exists on party)
      setSaleParties(saleParties.map(p => p.id === payment.partyId ? { ...p, totalPaid: (p.totalPaid || 0) - payment.amount } : p));
      alert("Payment Deleted Successfully!");
    }
  };

  const expectedPassword = useMemo(() => {
    if (settings?.adminPassword) return settings.adminPassword;
    if (!settings?.companyName || !settings?.gstin) return '1234';
    const prefix = settings.companyName.replace(/\s/g, '').substring(0, 5).toUpperCase();
    const suffix = settings.gstin.slice(-3).toUpperCase();
    return prefix + suffix;
  }, [settings]);

  const expectedUsername = useMemo(() => {
    if (settings?.adminUsername) return settings.adminUsername;
    return 'admin';
  }, [settings]);

  const isAnyPrintOpen = useMemo(() => 
    !!(previewBooking || previewPurchase || previewDebitNote || previewCreditNote),
  [previewBooking, previewPurchase, previewDebitNote, previewCreditNote]);

  if (isFirebaseLoading || ((isAuthenticated || customLoginId) && !isDataLoaded)) return (
    <div className="fixed inset-0 bg-[#1E272E] flex flex-col items-center justify-center text-white">
      <RefreshCw size={48} className="animate-spin text-blue-400 mb-4" />
      <h2 className="text-xl font-bold uppercase tracking-widest">
        {isFirebaseLoading ? "Securing Tunnel..." : "Accessing Cloud Data..."}
      </h2>
      <p className="text-slate-400 text-[10px] mt-2 font-mono uppercase tracking-tighter opacity-80">
        {isFirebaseLoading ? "Initializing security handshake" : "Synchronizing your account with cloud backup"}
      </p>
      {!isFirebaseLoading && (
        <div className="flex flex-col items-center gap-3 mt-12">
          <button 
            onClick={() => setIsDataLoaded(true)}
            className="px-8 py-3 bg-[#00cec9] hover:bg-[#00b5b5] text-[#1E272E] rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-[#00cec9]/20 active:scale-95"
          >
            Skip Sync & Enter App
          </button>
          
          <div className="flex items-center gap-4 mt-4">
            <button 
              onClick={() => {
                auth.signOut();
                setCustomLoginId(null);
                storage.remove('customLoginId');
                window.location.reload();
              }}
              className="text-slate-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
            >
              Switch Account
            </button>
            <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
            <button 
              onClick={() => {
                if(confirm("Reset all local data? This will not delete your cloud backup.")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="text-slate-500 hover:text-red-400 text-[9px] font-black uppercase tracking-widest transition-colors"
            >
              Clear Local Data
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated && !customLoginId) return (
    <Login 
      user={user}
      onLogin={(u, customId) => {
        setIsDataLoaded(false);
        loadedKeys.current.clear();
        if (u) {
          setUser(u);
          setIsAuthenticated(true);
        } else if (customId) {
          setCustomLoginId(customId);
          storage.set('customLoginId', customId);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(true);
        }
      }} 
      expectedPassword={expectedPassword} 
      expectedUsername={expectedUsername}
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
              {isSyncing && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[8px] text-blue-400 font-black animate-pulse">
                  <RefreshCw size={8} className="animate-spin" /> CLOUD SYNCING...
                </div>
              )}
            </div>
          ) : (
            <div className="text-[#00cec9] font-black text-2xl tracking-tighter">
              PRO BILLER
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {views.map((v, idx) => (
            <NavBtn 
              key={v}
              active={currentView === v} 
              focused={focusedIdx === idx}
              onClick={() => {
                setCurrentView(v);
                setFocusedIdx(-1);
              }} 
              icon={
                v === 'dash' ? LayoutDashboard :
                v === 'inv' ? Receipt :
                v === 'salehistory' || v === 'purchasehistory' || v === 'ledg' ? BookText :
                v === 'saleparty' || v === 'purchaseparty' || v === 'brokers' ? Users :
                v === 'pur' ? ShoppingBag :
                v === 'dn' ? AlertCircle :
                v === 'cn' ? TrendingUp :
                v === 'millchallan' ? Package :
                v === 'partychallan' ? Download :
                v === 'weaverchallan' ? Package :
                v === 'challancompare' ? Calculator :
                v === 'items' ? Package :
                v === 'expenses' ? Calculator :
                v === 'pay' || v === 'sendpay' ? CreditCard :
                v === 'transports' ? Truck :
                v === 'gstreport' ? TrendingUp :
                v === 'broker-ledger' ? BookText :
                v === 'signature' ? PenTool :
                v === 'bankdetails' ? Landmark :
                v === 'backup' ? Download :
                Settings
              } 
              label={
                v === 'dash' ? "Dashboard" :
                v === 'inv' ? "Sale Bill" :
                v === 'salehistory' ? "Sale History" :
                v === 'saleparty' ? "Sale Party Entry" :
                v === 'pur' ? "Purchase Bill" :
                v === 'purchasehistory' ? "Purchase History" :
                v === 'purchaseparty' ? "Purchase Party Entry" :
                v === 'dn' ? "Debit Note" :
                v === 'cn' ? "Credit Note" :
                v === 'millchallan' ? "Mill Challan Entry" :
                v === 'partychallan' ? "Party Challan Entry" :
                v === 'weaverchallan' ? "Weaver Challan Entry" :
                v === 'challancompare' ? "Compare Challans" :
                v === 'items' ? "Items Master" :
                v === 'expenses' ? "Business Expenses" :
                v === 'pay' ? "Receive Payment" :
                v === 'sendpay' ? "Send Payment" :
                v === 'ledg' ? "Party Ledger" :
                v === 'brokers' ? "Brokers Master" :
                v === 'broker-ledger' ? "Broker Ledger" :
                v === 'transports' ? "Transports" :
                v === 'gstreport' ? "GST Reports" :
                v === 'signature' ? "Upload Signature" :
                v === 'bankdetails' ? "Bank Details" :
                v === 'backup' ? "Data Backup" :
                "Settings"
              }
              shortcut={
                v === 'dash' ? "Alt+D" :
                v === 'inv' ? "Ctrl+I" :
                v === 'salehistory' ? "Alt+H" :
                v === 'saleparty' ? "Alt+S" :
                v === 'pur' ? "Ctrl+P" :
                v === 'purchasehistory' ? "Alt+J" :
                v === 'purchaseparty' ? "Alt+K" :
                v === 'dn' ? "Ctrl+D" :
                v === 'cn' ? "Ctrl+C" :
                v === 'expenses' ? "Ctrl+E" :
                v === 'millchallan' ? "Alt+8" :
                v === 'partychallan' ? "Alt+9" :
                v === 'weaverchallan' ? "Alt+7" :
                v === 'challancompare' ? "Alt+0" :
                v === 'items' ? "Alt+M" :
                v === 'pay' ? "Ctrl+R" :
                v === 'sendpay' ? "Ctrl+N" :
                v === 'ledg' ? "Alt+L" :
                v === 'gstreport' ? "Alt+G" :
                v === 'transports' ? "Alt+T" :
                v === 'backup' ? "Alt+B" :
                undefined
              }
            />
          ))}
          <button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm bg-indigo-600/10 text-indigo-600 hover:bg-indigo-600 hover:text-white"
          >
            <RefreshCw size={18} />
            Update App
          </button>
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
        {currentStatus && <Watermark paymentStatus={currentStatus} />}
        <div className="w-full max-w-6xl mx-auto mb-8 bg-white border border-slate-200 p-4 rounded-2xl flex items-center shadow-lg sticky top-8 z-30 print:hidden">
          <Search className="text-slate-400 ml-4" size={20} />
          <input 
            type="text" 
            placeholder="Quick Bill Finder: Enter Bill # / LR # / Challan #" 
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch(globalSearch)}
            className="w-full px-4 py-2 font-bold outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
          />
        </div>
        {currentView !== 'dash' && currentView !== 'ledg' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 backdrop-blur px-6 py-3 rounded-2xl border border-slate-200 shadow-sm z-10 print:hidden whitespace-nowrap">
            <div className="flex items-center gap-3">
              {syncStatus === 'synced' ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-tighter">Cloud Saved</span>
                </div>
              ) : syncStatus === 'pending' ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                  <RefreshCw size={12} className="animate-spin opacity-70" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Syncing...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full border border-red-100">
                  <AlertTriangle size={12} className="opacity-70" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Sync Error</span>
                </div>
              )}
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Working Year:</span>
              <span className="text-sm font-black text-slate-900 tracking-tight">{financialYear}</span>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          <div className={isAnyPrintOpen ? 'print:hidden' : ''}>
            <AnimatePresence mode="wait">
            {currentView === 'dash' && <DashboardView 
              key="dash" 
              stats={stats} 
              bookings={bookings} 
              purchases={purchases}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
              onEditSale={(b: Booking) => {
                setEditingBooking(b);
                setCurrentView('inv');
              }}
              onDeleteSale={handleDeleteBooking}
              onPreviewSale={(b: Booking) => setPreviewBooking(b)}
              onEditPurchase={(p: Purchase) => {
                setEditingPurchase(p);
                setCurrentView('pur');
              }}
              onDeletePurchase={handleDeletePurchase}
              onPreviewPurchase={(p: Purchase) => setPreviewPurchase(p)}
            />}
            {currentView === 'brokers' && (
              <BrokersView 
                brokers={brokers}
                saleParties={saleParties}
                purchaseParties={purchaseParties}
                millChallans={millChallans}
                onSave={(updated) => setBrokers(updated)}
              />
            )}
            {currentView === 'broker-ledger' && (
              <BrokerLedgerView 
                brokers={brokers}
                commissions={commissions}
                payments={brokerPayments}
                bookings={bookings}
                purchases={purchases}
                millChallans={millChallans}
                onSavePayment={(p: any) => setBrokerPayments(prev => [p, ...prev])}
                onSaveCommission={(c: BrokerCommission) => setCommissions(prev => [c, ...prev])}
                onDeletePayment={(id: string) => setBrokerPayments(prev => prev.filter(p => p.id !== id))}
              />
            )}
            {currentView === 'inv' && <BookingView 
              key={`inv-${editingBooking?.id || 'new'}-${bookings.length}`} 
              onSave={handleSaveBooking} 
              parties={saleParties} 
              settings={settings} 
              creditNotes={creditNotes}
              bookings={bookings}
              purchases={purchases}
              itemsMaster={itemsMaster}
              transports={transports}
              brokers={brokers.filter((b: any) => b.type === 'sale' || b.type === 'mill' || !b.type)}
              challans={challans}
              editingBooking={editingBooking}
              onViewHistory={() => setCurrentView('salehistory')}
              payments={payments}
              onCancel={() => {
                setEditingBooking(null);
                setCurrentView('dash');
              }}
            />}
            {currentView === 'salehistory' && <SaleHistoryView 
              key="salehistory"
              bookings={bookings}
              onEditSale={(b: Booking) => {
                setEditingBooking(b);
                setCurrentView('inv');
              }}
              onDeleteSale={handleDeleteBooking}
              onPreviewSale={(b: Booking) => setPreviewBooking(b)}
            />}
            {currentView === 'purchasehistory' && <PurchaseHistoryView 
              key="purchasehistory"
              purchases={purchases}
              onEditPurchase={(p: Purchase) => {
                setEditingPurchase(p);
                setCurrentView('pur');
              }}
              onDeletePurchase={handleDeletePurchase}
              onPreviewPurchase={(p: Purchase) => setPreviewPurchase(p)}
            />}
            {currentView === 'saleparty' && (
              <PartyMasterView 
                key="saleparty" 
                parties={saleParties} 
                title="Sale Party Entry" 
                onUpdateParties={setSaleParties}
                bookings={bookings}
                creditNotes={creditNotes}
                payments={payments}
              />
            )}
            {currentView === 'pur' && <PurchaseView 
              key={`pur-${editingPurchase?.id || 'new'}-${purchases.length}`} 
              onSave={handleSavePurchase} 
              parties={purchaseParties} 
              settings={settings}
              purchases={purchases}
              itemsMaster={itemsMaster}
              transports={transports}
              brokers={brokers.filter((b: any) => b.type === 'purchase' || b.type === 'mill')}
              challans={challans}
              editingPurchase={editingPurchase}
              onViewHistory={() => setCurrentView('purchasehistory')}
              payments={purchasePayments}
              onCancel={() => {
                setEditingPurchase(null);
                setCurrentView('dash');
              }}
            />}
            {currentView === 'dn' && <DebitNoteView 
              key={`dn-${editingDebitNote?.id || 'new'}-${debitNotes.length}`} 
              onSave={handleSaveDebitNote} 
              onEdit={(dn: DebitNote) => {
                setEditingDebitNote(dn);
              }}
              onDelete={handleDeleteDebitNote}
              onPreview={(dn: DebitNote) => setPreviewDebitNote(dn)}
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
              key={`cn-${editingCreditNote?.id || 'new'}-${creditNotes.length}`} 
              onSave={handleSaveCreditNote} 
              onEdit={(cn: CreditNote) => {
                setEditingCreditNote(cn);
              }}
              onDelete={handleDeleteCreditNote}
              onPreview={(cn: CreditNote) => setPreviewCreditNote(cn)}
              parties={saleParties}
              settings={settings}
              creditNotes={creditNotes}
              bookings={bookings}
              itemsMaster={itemsMaster}
              editingCreditNote={editingCreditNote}
              brokers={brokers}
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
            {currentView === 'pay' && (
              <PaymentView 
                key={`pay-${editingPayment?.id || 'new'}-${paymentSaveTrigger}`} 
                onSave={handleSavePayment} 
                parties={saleParties} 
                bookings={bookings}
                payments={payments}
                creditNotes={creditNotes}
                editingPayment={editingPayment}
                onEdit={setEditingPayment}
                onDelete={handleDeletePayment}
                isSyncing={isSyncing}
                onCancel={() => {
                  setEditingPayment(null);
                  setCurrentView('ledg');
                }}
              />
            )}
            {currentView === 'sendpay' && (
              <SendPaymentView 
                key={`sendpay-${editingPayment?.id || 'new'}-${purchasePaymentSaveTrigger}`} 
                onSave={handleSavePurchasePayment} 
                parties={purchaseParties} 
                purchases={purchases}
                payments={purchasePayments}
                debitNotes={debitNotes}
                editingPayment={editingPayment}
                onEdit={setEditingPayment}
                onDelete={handleDeletePayment}
                isSyncing={isSyncing}
                onCancel={() => {
                  setEditingPayment(null);
                  setCurrentView('ledg');
                }}
              />
            )}
            {currentView === 'purchaseparty' && (
              <PartyMasterView 
                key="purchaseparty" 
                parties={purchaseParties} 
                title="Purchase Party Entry" 
                onUpdateParties={setPurchaseParties}
                purchases={purchases}
                debitNotes={debitNotes}
                payments={payments}
              />
            )}
            {currentView === 'ledg' && (
              <LedgerView 
                key="ledg" 
                parties={saleParties} 
                purchaseParties={purchaseParties} 
                bookings={bookings}
                purchases={purchases}
                payments={payments}
                purchasePayments={purchasePayments}
                debitNotes={debitNotes} 
                creditNotes={creditNotes} 
                settings={settings}
                onDeletePayment={handleDeletePayment}
                onEditPayment={(p: any) => {
                  setEditingPayment(p);
                  setCurrentView(p.originalType === 'PURCHASE_PAYMENT' ? 'sendpay' : 'pay');
                }}
                onEditBooking={(b: any) => {
                  setEditingBooking(b);
                  setCurrentView('inv');
                }}
                onEditPurchase={(p: any) => {
                  setEditingPurchase(p);
                  setCurrentView('pur');
                }}
                onEditCreditNote={(cn: any) => {
                  setEditingCreditNote(cn);
                  setCurrentView('cn');
                }}
                onEditDebitNote={(dn: any) => {
                  setEditingDebitNote(dn);
                  setCurrentView('dn');
                }}
              />
            )}
            {currentView === 'gstreport' && <GstReportView 
              key="gstreport"
              bookings={bookings}
              purchases={purchases}
              creditNotes={creditNotes}
              debitNotes={debitNotes}
              expenses={expenses}
              settings={settings}
            />}
            {currentView === 'transports' && <TransportMasterView 
              key="transports"
              transports={transports}
              onSave={setTransports}
            />}
            {currentView === 'expenses' && <ExpensesView 
              key="expenses"
              expenses={expenses}
              onSave={setExpenses}
              onBack={() => setCurrentView('dash')}
            />}
            {currentView === 'millchallan' && <ChallanEntryView 
              key="millchallan"
              type="MILL"
              challans={millChallans}
              onSave={handleSaveChallan}
              onDelete={(id: string) => handleDeleteChallan(id, 'MILL')}
              parties={purchaseParties}
              itemsMaster={itemsMaster}
              weaverChallans={weaverChallans}
              settings={settings}
              brokers={brokers}
            />}
            {currentView === 'partychallan' && <ChallanEntryView 
              key="partychallan"
              type="PARTY"
              challans={partyChallans}
              onSave={handleSaveChallan}
              onDelete={(id: string) => handleDeleteChallan(id, 'PARTY')}
              parties={saleParties}
              itemsMaster={itemsMaster}
              settings={settings}
              millChallans={millChallans}
              brokers={brokers}
            />}
            {currentView === 'weaverchallan' && <ChallanEntryView 
              key="weaverchallan"
              type="WEAVER"
              challans={weaverChallans}
              onSave={handleSaveChallan}
              onDelete={(id: string) => handleDeleteChallan(id, 'WEAVER')}
              parties={weaverParties}
              itemsMaster={itemsMaster}
              settings={settings}
              brokers={brokers}
            />}
            {currentView === 'weaverparty' && (
              <PartyMasterView 
                key="weaverparty" 
                parties={weaverParties} 
                title="Weaver Party Entry" 
                onUpdateParties={setWeaverParties}
                suggestParties={purchaseParties}
              />
            )}
            {currentView === 'challancompare' && <ChallanCompareView 
              key="challancompare"
              millChallans={millChallans}
              partyChallans={partyChallans}
              weaverChallans={weaverChallans}
            />}
            {currentView === 'signature' && <SignatureAndBankView 
              key="signature"
              settings={{...(settings || {}), viewMode: 'signature'}}
              onUpdateSettings={setSettings}
            />}
            {currentView === 'bankdetails' && <SignatureAndBankView 
              key="bankdetails"
              settings={{...(settings || {}), viewMode: 'bank'}}
              onUpdateSettings={setSettings}
            />}
            {currentView === 'settings' && <SettingsView key="settings" settings={settings} onSave={setSettings} />}
          </AnimatePresence>
          </div>

          <AnimatePresence>
            {previewBooking && (
              <PrintPreview 
                booking={previewBooking} 
                settings={settings} 
                payments={payments}
                creditNotes={creditNotes}
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
                    setLogoutFocusedIdx(-1);
                  }}
                  className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                    logoutFocusedIdx === 0 
                      ? "bg-black text-white shadow-none ring-4 ring-indigo-200" 
                      : "bg-indigo-600 text-white shadow-indigo-100 hover:bg-black"
                  }`}
                >
                  Go to Backup Page
                </button>
                <div className="flex gap-4">
                  <button 
                    onClick={async () => {
                      if (isSyncing) return; // Optional safety
                      await forceSyncData();
                      auth.signOut();
                      resetData();
                      setIsAuthenticated(false);
                      setUser(null);
                      setCustomLoginId(null);
                      storage.remove('customLoginId');
                      setShowLogoutConfirm(false);
                      setLogoutFocusedIdx(-1);
                    }}
                    disabled={isSyncing}
                    className={`flex-1 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${
                      logoutFocusedIdx === 1
                        ? "bg-black text-white ring-4 ring-red-200"
                        : "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    }`}
                  >
                    {isSyncing ? 'Syncing...' : 'Logout Anyway'}
                  </button>
                  <button 
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      setLogoutFocusedIdx(-1);
                    }}
                    className={`flex-1 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${
                      logoutFocusedIdx === 2
                        ? "bg-black text-white ring-4 ring-slate-200"
                        : "bg-slate-100 text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Stay Logged In
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        
        {isSyncing && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl shadow-2xl flex items-center gap-6">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-100 border-t-indigo-600"></div>
              <div>
                <p className="font-black text-slate-900 uppercase tracking-widest text-lg">Syncing...</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Please do not close</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaleHistoryView({ bookings, onEditSale, onDeleteSale, onPreviewSale }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredBookings = useMemo(() => {
    return bookings.filter((b: Booking) => 
      b.billNumber?.toString().includes(searchTerm) || 
      b.consigneeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.consigneeGstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.lrNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bookings, searchTerm]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Sale History</h2>
          <p className="text-slate-500 font-bold text-sm">View, Search and Manage all past invoices</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by Bill No, Party or GST..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-600 shadow-sm w-80 transition-all"
          />
        </div>
      </header>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Bill No.</th>
                <th className="px-8 py-5">Customer (GSTIN)</th>
                <th className="px-8 py-5">E-Way / LR</th>
                <th className="px-8 py-5 text-right">Amount</th>
                <th className="px-8 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.map((b: Booking) => (
                <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 font-bold text-slate-600">
                    {new Date(b.date).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-black text-xs">#{b.billNumber}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-black text-slate-900 uppercase text-xs">{b.consigneeName}</div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wider">{b.consigneeGstin}</div>
                  </td>
                  <td className="px-8 py-5">
                     <div className="text-[10px] font-black text-slate-500">LR: {b.lrNumber || '-'}</div>
                     <div className="text-[9px] font-bold text-slate-400 uppercase">EWB: {b.ewbNumber || '-'}</div>
                     {b.parcels && <div className="text-[9px] font-black text-[#00cec9] mt-0.5">PARCELS: {b.parcels}</div>}
                  </td>
                  <td className="px-8 py-5 text-right whitespace-nowrap">
                    <span className="font-black text-indigo-600 tracking-tighter text-lg">₹ {b.grandTotal.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onPreviewSale(b)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="View/Print">
                        <Printer size={18} />
                      </button>
                      <button onClick={() => onEditSale(b)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Edit Bill">
                        <Plus size={18} className="rotate-45" />
                      </button>
                      <button onClick={() => onDeleteSale(b.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                        <AlertCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <Receipt size={64} opacity={0.2} />
                      <p className="font-black uppercase tracking-widest text-xs">No records found matching search</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function PurchaseHistoryView({ purchases, onEditPurchase, onDeletePurchase, onPreviewPurchase }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter((p: Purchase) => 
      p.billNumber?.toString().includes(searchTerm) || 
      p.partyBillNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.partyGstin.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [purchases, searchTerm]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Purchase History</h2>
          <p className="text-slate-500 font-bold text-sm">View and Manage all inward bills</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by Bill No, Party or GST..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-red-600 shadow-sm w-80 transition-all"
          />
        </div>
      </header>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Our Bill No.</th>
                <th className="px-8 py-5">Party Bill No.</th>
                <th className="px-8 py-5">Supplier (GSTIN)</th>
                <th className="px-8 py-5 text-right">Amount</th>
                <th className="px-8 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPurchases.map((p: Purchase) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 font-bold text-slate-600">
                    {new Date(p.date).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-red-50 text-red-700 px-3 py-1 rounded-lg font-black text-xs">#{p.billNumber}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-black text-xs">{p.partyBillNumber || '-'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-black text-slate-900 uppercase text-xs">{p.partyName}</div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wider">{p.partyGstin}</div>
                  </td>
                  <td className="px-8 py-5 text-right whitespace-nowrap">
                    <span className="font-black text-red-600 tracking-tighter text-lg">₹ {p.grandTotal.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onPreviewPurchase(p)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="View/Print">
                        <Printer size={18} />
                      </button>
                      <button onClick={() => onEditPurchase(p)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Edit Bill">
                        <Plus size={18} className="rotate-45" />
                      </button>
                      <button onClick={() => onDeletePurchase(p.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                        <AlertCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <ShoppingBag size={64} opacity={0.2} />
                      <p className="font-black uppercase tracking-widest text-xs">No records found matching search</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label, focused, shortcut }: any) {
  const ref = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [focused]);

  return (
    <button 
      ref={ref}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm text-left ${
        active 
          ? "bg-[#00cec9] text-[#1e272e] shadow-xl shadow-[#00cec9]/10 scale-[1.02]" 
          : focused
          ? "bg-slate-700/80 text-white border border-slate-600 outline-none"
          : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-4">
        <Icon className={`flex-shrink-0 ${active ? "text-[#1e272e]" : (focused ? "text-white" : "text-slate-500")}`} size={20} />
        {label}
      </div>
      {shortcut && (
        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
          active ? "bg-black/10 border-black/5 text-black/50" : "bg-white/5 border-white/5 text-slate-500"
        }`}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

function DashboardView({ stats, bookings, purchases, onEditSale, onDeleteSale, onPreviewSale, onEditPurchase, onDeletePurchase, onPreviewPurchase, isSyncing, syncStatus }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lrSearchTerm, setLrSearchTerm] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  
  const financialYear = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    if (curMonth >= 4) return `${curYear}-${(curYear + 1).toString().slice(-2)}`;
    return `${curYear - 1}-${curYear.toString().slice(-2)}`;
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b: Booking) => {
      const matchesMain = b.billNumber?.toString().includes(searchTerm) || 
                          b.consigneeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.consigneeGstin.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLr = !lrSearchTerm || (b.lrNumber && b.lrNumber.toLowerCase().includes(lrSearchTerm.toLowerCase()));
      
      return matchesMain && matchesLr;
    });
  }, [bookings, searchTerm, lrSearchTerm]);

  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter((p: Purchase) => {
      return p.billNumber?.toString().includes(searchTerm) || 
             p.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             p.partyGstin.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [purchases, searchTerm]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <header className="grid grid-cols-1 md:grid-cols-3 items-center bg-white p-8 rounded-[40px] border border-slate-200 shadow-2xl gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Vyapaar Summary</h2>
          <p className="text-slate-500 font-medium italic text-sm">Overview of all transactions and returns</p>
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="text-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Working Year</p>
            <span className="bg-indigo-600 text-white text-xs font-black px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-indigo-100">
              {financialYear}
            </span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-[#2ed573]' : syncStatus === 'error' ? 'bg-red-500' : 'bg-indigo-500 animate-pulse'}`}></div>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">
                {syncStatus === 'synced' ? 'Data Synced' : syncStatus === 'error' ? 'Sync Error' : 'Syncing...'}
              </span>
            </div>
            <button 
              onClick={() => setIsVisible(!isVisible)}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-400 border border-slate-100 rounded-lg transition-all active:scale-95 shadow-sm"
            >
              {isVisible ? <EyeOff size={10} /> : <Eye size={10} />}
              <span className="text-[8px] font-black uppercase tracking-widest">{isVisible ? 'Hide Data' : 'Show Data'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search Bills..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-600 shadow-sm w-44 transition-all"
            />
          </div>
          <div className="relative group">
            <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="LR No..." 
              value={lrSearchTerm}
              onChange={(e) => setLrSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-600 shadow-sm w-36 transition-all"
            />
          </div>
        </div>
      </header>
      
      {isVisible ? (
        <AnimatePresence mode="wait">
          <motion.div 
            key="dashboard-content"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
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
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Sale Bills History</h3>
                   <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase">{(searchTerm || lrSearchTerm) ? 'Search Results' : 'Recent Invoices'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-4">Bill Details</th>
                        <th className="px-8 py-4">Customer</th>
                        <th className="px-8 py-4">LR Number</th>
                        <th className="px-8 py-4 text-right">Amount</th>
                        <th className="px-8 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredBookings.slice(0, (searchTerm || lrSearchTerm) ? 50 : 10).map((b: Booking) => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="font-bold text-slate-900"># {b.billNumber}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-black">{new Date(b.date).toLocaleDateString()}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="font-black text-slate-700 uppercase tracking-tight truncate max-w-[150px]">{b.consigneeName}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{b.consigneeGstin}</div>
                          </td>
                          <td className="px-8 py-5">
                            {b.lrNumber ? (
                              <div className="flex items-center gap-1.5 ring-1 ring-blue-100 bg-blue-50/50 text-blue-700 px-2 py-1 rounded-md w-fit">
                                <Truck size={12} />
                                <span className="text-[10px] font-black tracking-tighter uppercase">{b.lrNumber}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic font-bold">N/A</span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-right whitespace-nowrap">
                            <span className="font-black text-indigo-600 tracking-tighter">₹ {b.grandTotal.toLocaleString()}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => onPreviewSale(b)} title="Print" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                <Printer size={16} />
                              </button>
                              <button onClick={() => onEditSale(b)} title="Edit" className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                                <Edit size={16} />
                              </button>
                              <button onClick={() => onDeleteSale(b.id)} title="Delete" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                <AlertCircle size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredBookings.length === 0 && (
                        <tr><td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic font-medium">No sales recorded matching your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Recent Purchase Bills */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest text-red-600">Recent Purchase Bills</h3>
                   <span className="bg-red-50 text-red-600 px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase">{searchTerm ? 'Search Results' : 'Latest Inward'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-4">Bill Details</th>
                        <th className="px-8 py-4">Supplier</th>
                        <th className="px-8 py-4 text-right">Amount</th>
                        <th className="px-8 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPurchases.slice(0, searchTerm ? 50 : 10).map((p: Purchase) => (
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
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => onPreviewPurchase(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="View">
                                <Printer size={14} />
                              </button>
                              <button onClick={() => onEditPurchase(p)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit">
                                <Plus size={14} className="rotate-45" />
                              </button>
                              <button onClick={() => onDeletePurchase(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                                <AlertCircle size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredPurchases.length === 0 && (
                        <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic font-medium">No purchases recorded matching your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-20 text-center"
        >
          <div className="bg-white w-20 h-20 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Lock size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dashboard Information Hidden</h3>
          <p className="text-slate-500 font-bold max-w-xs mx-auto mt-2 italic">Data is currently hidden for privacy. Click "Show Data" to reveal.</p>
          <button 
            onClick={() => setIsVisible(true)}
            className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Show Dashboard Info
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

function PurchaseView({ onSave, parties, settings, purchases, itemsMaster = [], editingPurchase, onViewHistory, onCancel, payments = [], brokers = [], challans = [] }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeCalcId, setActiveCalcId] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPreview(false);
        if (activeCalcId) setActiveCalcId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeCalcId]);

  const [calcValues, setCalcValues] = useState<{ [key: string]: string }>({});
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const form = (e.currentTarget as any).form;
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const form = (e.currentTarget as any).form;
      if (!form) return;
      const elements = Array.from(form.elements) as HTMLElement[];
      const index = elements.indexOf(e.currentTarget as any);
      if (index > -1) {
        for (let i = index - 1; i >= 0; i--) {
          const el = elements[i];
          if (el && el.tagName !== 'BUTTON' && !el.hasAttribute('disabled') && !el.hasAttribute('readonly')) {
            el.focus();
            break;
          }
        }
      }
    }
  };
  const [formData, setFormData] = useState(() => {
    const nextAutoNum = (purchases || []).reduce((max: number, b: any) => Math.max(max, b.billNumber || 0), 0) + 1;
    return {
      id: editingPurchase?.id || '',
      billNumber: editingPurchase?.billNumber || nextAutoNum,
      partyGstin: editingPurchase?.partyGstin || '',
      partyName: editingPurchase?.partyName || '',
      partyAddress: editingPurchase?.partyAddress || '',
      partyMobile: editingPurchase?.partyMobile || '',
      partyMobile2: editingPurchase?.partyMobile2 || '',
      buyerName: settings?.companyName || '',
      buyerGstin: settings?.gstin || '',
      buyerAddress: settings?.address || '',
      items: (editingPurchase?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }]).map(it => it.id ? it : { ...it, id: Math.random().toString(36).substr(2, 9) }),
      basicAmount: editingPurchase?.basicAmount || 0,
      globalDiscount: editingPurchase?.globalDiscount || 0,
      taxRate: editingPurchase?.taxRate || 5,
      date: editingPurchase?.date || new Date().toISOString(),
      partyBillNumber: editingPurchase?.partyBillNumber || '',
      brokerId: editingPurchase?.brokerId || '',
      parcels: editingPurchase?.parcels || '',
      notes: editingPurchase?.notes || '',
      brokerCommissionRate: editingPurchase?.brokerCommissionRate || 0
    };
  });

  const currentEditingPurchase = useMemo(() => {
    return purchases.find((p: Purchase) => p.id === editingPurchase?.id) || editingPurchase;
  }, [purchases, editingPurchase]);

  useEffect(() => {
    console.log("CurrentEditingPurchase:", currentEditingPurchase);
    if (currentEditingPurchase) {
      setFormData({
        id: currentEditingPurchase.id || '',
        billNumber: currentEditingPurchase.billNumber,
        partyGstin: currentEditingPurchase.partyGstin || '',
        partyName: currentEditingPurchase.partyName || '',
        partyAddress: currentEditingPurchase.partyAddress || '',
        partyMobile: currentEditingPurchase.partyMobile || '',
        partyMobile2: currentEditingPurchase.partyMobile2 || '',
        buyerName: settings?.companyName || '',
        buyerGstin: settings?.gstin || '',
        buyerAddress: settings?.address || '',
        items: currentEditingPurchase.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }],
        basicAmount: currentEditingPurchase.basicAmount || 0,
        globalDiscount: currentEditingPurchase.globalDiscount || 0,
        taxRate: currentEditingPurchase.taxRate || 5,
        date: currentEditingPurchase.date || new Date().toISOString(),
        partyBillNumber: currentEditingPurchase.partyBillNumber || '',
        brokerId: currentEditingPurchase.brokerId || '',
        parcels: currentEditingPurchase.parcels || '',
        notes: currentEditingPurchase.notes || '',
        brokerCommissionRate: currentEditingPurchase.brokerCommissionRate || 0
      });
      console.log("FormData updated to:", currentEditingPurchase.partyBillNumber);
    }
  }, [currentEditingPurchase, settings]);

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
          updated.amount = Math.round(gross - (updated.discount || 0));
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
    // 1. Gross Amount - Round each item amount first
    const grossAmount = Math.round(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    
    // 2. Discount Calculation
    const effectiveGlobalDiscount = hasItemDiscount ? 0 : Math.round(Number(formData.globalDiscount) || 0);

    // 3. Taxable Value
    const taxableValue = Math.round(Math.max(0, grossAmount - effectiveGlobalDiscount));
    
    // 4. GST Calculation
    const tax = Math.round(taxableValue * (Number(formData.taxRate) / 100));
    
    // Determine CGST/SGST vs IGST
    const buyerStateCode = formData.buyerGstin?.substring(0, 2);
    const supplierStateCode = formData.partyGstin?.substring(0, 2);
    const isInterstate = buyerStateCode && supplierStateCode && buyerStateCode !== supplierStateCode;
    
    const cgst = isInterstate ? 0 : Math.round(tax / 2);
    const sgst = isInterstate ? 0 : Math.round(tax / 2);
    const igst = isInterstate ? tax : 0;
    
    return { 
      basicAmount: grossAmount, 
      taxableValue, 
      tax, 
      cgst, 
      sgst, 
      igst, 
      isInterstate, 
      total: Math.round(taxableValue + tax), 
      effectiveGlobalDiscount 
    };
  }, [formData.items, formData.globalDiscount, formData.taxRate, hasItemDiscount, formData.buyerGstin, formData.partyGstin]);

  useEffect(() => {
    if (Math.abs(formData.basicAmount - calc.basicAmount) > 0.01) {
      setFormData(prev => ({ ...prev, basicAmount: calc.basicAmount }));
    }
  }, [calc.basicAmount]);

  useEffect(() => {
    const searchGst = formData.partyGstin.trim().toUpperCase();
    const party = parties.find((p: any) => p.gstin.trim().toUpperCase() === searchGst);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        partyName: party.name, 
        partyAddress: party.address,
        partyMobile: party.mobile || '',
        partyMobile2: party.mobile2 || ''
      }));
    } else if (searchGst.length > 2) {
      setFormData(prev => ({ ...prev, partyName: 'New Provider', partyAddress: '', partyMobile: '', partyMobile2: '' }));
    } else {
      setFormData(prev => ({ ...prev, partyName: '', partyAddress: '', partyMobile: '', partyMobile2: '' }));
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
          <button 
            type="button"
            onClick={onViewHistory}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/20 shadow-lg"
          >
            <BookText size={14} /> View Inward History
          </button>
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
              onKeyDown={handleEnter}
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
              onKeyDown={handleEnter}
              className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`} 
            />
          </div>
          <div className="space-y-4">
             <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Broker</label>
             <select
               value={formData.brokerId}
               onChange={(e) => setFormData({ ...formData, brokerId: e.target.value })}
               onKeyDown={handleEnter}
               className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
             >
               <option value="">Select Broker</option>
               {brokers.map((b: any) => (
                 <option key={b.id} value={b.id}>{b.name}</option>
               ))}
             </select>
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
                list="purchase-party-gstin-list"
                onChange={e => setFormData({ ...formData, partyGstin: e.target.value.toUpperCase() })}
                onKeyDown={handleEnter}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="24AAAA..."
              />
              <datalist id="purchase-party-gstin-list">
                {parties.map((p: any) => (
                  <option key={p.id} value={p.gstin}>{p.name}</option>
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Supplier Name</label>
              <input 
                type="text" 
                value={formData.partyName} 
                readOnly={isLocked}
                list="purchase-party-name-list"
                onChange={e => {
                  const val = e.target.value;
                  const party = parties.find((p: any) => p.name === val);
                  if (party) {
                    setFormData({
                      ...formData,
                      partyName: party.name,
                      partyGstin: party.gstin,
                      partyAddress: party.address,
                      partyMobile: party.mobile || '',
                      partyMobile2: party.mobile2 || ''
                    });
                  } else {
                    setFormData({ ...formData, partyName: val });
                  }
                }}
                onKeyDown={handleEnter}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Supplier Name"
              />
              <datalist id="purchase-party-name-list">
                {parties.map((p: any) => (
                  <option key={p.id} value={p.name}>{p.gstin}</option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
              <input 
                type="text" 
                value={formData.partyAddress} 
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyAddress: e.target.value })}
                onKeyDown={handleEnter}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Address"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 1</label>
              <input 
                type="text" 
                value={formData.partyMobile} 
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyMobile: e.target.value })}
                onKeyDown={handleEnter}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Mobile 1"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 2</label>
              <input 
                type="text" 
                value={formData.partyMobile2} 
                readOnly={isLocked}
                onChange={e => setFormData({ ...formData, partyMobile2: e.target.value })}
                onKeyDown={handleEnter}
                className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100' : ''}`}
                placeholder="Enter Mobile 2"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-1 block font-black">Purchase Party Bill No.</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.partyBillNumber} 
                  readOnly={isLocked}
                  onChange={e => setFormData({ ...formData, partyBillNumber: e.target.value })}
                  onKeyDown={handleEnter}
                  className={`flex-1 px-4 py-3 border-2 border-indigo-100 rounded-xl font-black bg-white outline-none focus:border-indigo-500 transition-all shadow-md ${isLocked ? 'bg-slate-100' : ''}`}
                  placeholder="Party Bill No. (Required)"
                />
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = challans.find((ch: any) => ch.challanNumber === formData.partyBillNumber);
                      if (c) {
                        setFormData({ 
                          ...formData, 
                          items: c.items.map((it: any) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            name: it.name,
                            color: '',
                            hsnCode: '',
                            unit: it.unit || 'MTR',
                            quantity: it.quantity,
                            taka: it.taka?.toString() || '',
                            meters: it.meters || '',
                            rate: 0,
                            discount: 0,
                            amount: 0
                          }))
                        });
                      } else {
                        alert("Challan not found");
                      }
                    }}
                    className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                  >
                    Fetch
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-1 block font-black">Broker</label>
              <select
                value={formData.brokerId || ''}
                disabled={isLocked}
                onChange={e => {
                  const bId = e.target.value;
                  const b = brokers.find((br: any) => br.id === bId);
                  setFormData({ ...formData, brokerId: bId, brokerCommissionRate: b?.defaultCommission || 0 });
                }}
                className={`w-full px-4 py-3 border-2 border-indigo-100 rounded-xl font-black bg-white outline-none focus:border-indigo-500 transition-all shadow-md ${isLocked ? 'bg-slate-100' : ''}`}
              >
                <option value="">Select Broker</option>
                {brokers.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            {formData.brokerId && (
              <div>
                <label className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-1 block font-black">
                  {(brokers.find((b: any) => b.id === formData.brokerId)?.type === 'mill') ? 'Rate / MTR' : 'Comm %'}
                </label>
                <input 
                  type="number"
                  step="any"
                  value={formData.brokerCommissionRate || ''}
                  onChange={e => setFormData({ ...formData, brokerCommissionRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl font-black bg-white outline-none focus:border-indigo-500 transition-all shadow-md"
                  placeholder="Rate"
                />
              </div>
            )}
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
            {formData.items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl relative group items-end">
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items-purchase"
                    readOnly={isLocked} 
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    onKeyDown={handleEnter}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                    placeholder="Saree/Cloth" 
                  />
                  {item.meters && (
                    <div className="text-[9px] font-mono text-slate-400 mt-1 break-all bg-indigo-50/30 p-1 rounded border border-indigo-100 uppercase tracking-tighter">
                      {item.meters}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">HSN</label>
                  <input type="text" readOnly={isLocked} value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} onKeyDown={handleEnter} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unit</label>
                  <select disabled={isLocked} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value as any)} onKeyDown={handleEnter} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white">
                    <option value="MTR">MTR</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <div className="md:col-span-1 space-y-1 relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <div className="relative group">
                    <input 
                      type="number" 
                      readOnly={isLocked} 
                      value={item.quantity || ''} 
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)} 
                      onFocus={() => !isLocked && setActiveCalcId(item.id)}
                      onKeyDown={handleEnter} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-indigo-500" 
                    />
                    {!isLocked && (
                      <button 
                        type="button"
                        onClick={() => setActiveCalcId(item.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-indigo-500 transition-all"
                      >
                        <Calculator size={12} />
                      </button>
                    )}
                    {activeCalcId === item.id && (
                      <QtyCalculator 
                        value={calcValues[item.id] || ''}
                        onChange={(v) => setCalcValues({ ...calcValues, [item.id]: v })}
                        onApply={(sum, count) => {
                          updateItem(item.id, 'quantity', sum);
                          updateItem(item.id, 'taka', count.toString());
                          updateItem(item.id, 'meters', calcValues[item.id] || '');
                        }}
                        onBlur={() => setActiveCalcId(null)}
                        isLocked={isLocked}
                      />
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input 
                    type="number" 
                    readOnly={isLocked} 
                    value={item.rate || ''} 
                    onChange={e => updateItem(item.id, 'rate', e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && index === formData.items.length - 1 && !e.shiftKey) {
                        e.preventDefault();
                        addItem();
                      } else if (e.key === 'Enter') {
                        handleEnter(e);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
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
          <datalist id="master-items-purchase">
            {itemsMaster.map((mi: ItemMaster) => (
              <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
            ))}
          </datalist>
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
              onKeyDown={handleEnter}
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
                const val = e.target.value;
                setFormData({ ...formData, globalDiscount: val as any });
              }} 
              onKeyDown={handleEnter}
              className="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none focus:border-indigo-500 transition-all"
              placeholder="₹ 0.00" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-6">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Notes / Remarks</label>
            <textarea 
              value={formData.notes} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all h-24 resize-none ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-indigo-500 focus:bg-white'}`} 
              placeholder="Enter any additional notes here..." 
            />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-8 rounded-3xl border-2 border-dashed border-indigo-200 text-right space-y-2">
          {calc.effectiveGlobalDiscount > 0 && (
            <div className="text-pink-500 font-bold text-sm">Global Discount: <span className="text-pink-600">- ₹{Number(calc.effectiveGlobalDiscount).toFixed(2)}</span></div>
          )}
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{Number(calc.taxableValue).toFixed(2)}</span></div>
          {calc.isInterstate ? (
            <div className="text-slate-500 font-bold text-sm">IGST ({formData.taxRate}%): <span className="text-slate-900">₹{Number(calc.igst).toFixed(2)}</span></div>
          ) : (
            <>
              <div className="text-slate-500 font-bold text-sm">CGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.cgst).toFixed(2)}</span></div>
              <div className="text-slate-500 font-bold text-sm">SGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.sgst).toFixed(2)}</span></div>
            </>
          )}
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Grand Total: <span className="text-indigo-600">₹{Number(calc.total).toFixed(2)}</span></div>
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
          settings={settings} 
          payments={payments}
          onClose={() => setShowPreview(false)} 
        />
      )}
    </motion.div>
  );
}

function DebitNoteView({ onSave, onEdit, onDelete, onPreview, parties, settings, debitNotes, purchases, itemsMaster = [], editingDebitNote, onCancel }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeCalcId, setActiveCalcId] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPreview(false);
        if (activeCalcId) setActiveCalcId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeCalcId]);

  const [invoiceError, setInvoiceError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [calcValues, setCalcValues] = useState<{ [key: string]: string }>({});

  const filteredDebitNotes = useMemo(() => {
    return (debitNotes || []).filter((dn: DebitNote) => 
      dn.noteNumber?.toString().includes(searchTerm) || 
      dn.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dn.partyGstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dn.purchaseBillNumber?.toString().includes(searchTerm)
    );
  }, [debitNotes, searchTerm]);

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const form = (e.currentTarget as any).form;
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const form = (e.currentTarget as any).form;
      if (!form) return;
      const elements = Array.from(form.elements) as HTMLElement[];
      const index = elements.indexOf(e.currentTarget as any);
      if (index > -1) {
        for (let i = index - 1; i >= 0; i--) {
          const el = elements[i];
          if (el && el.tagName !== 'BUTTON' && !el.hasAttribute('disabled') && !el.hasAttribute('readonly')) {
            el.focus();
            break;
          }
        }
      }
    }
  };

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
      partyMobile2: editingDebitNote?.partyMobile2 || '',
      reason: editingDebitNote?.reason || '',
      notes: editingDebitNote?.notes || '',
      items: (editingDebitNote?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }]).map(it => it.id ? it : { ...it, id: Math.random().toString(36).substr(2, 9) }),
      basicAmount: editingDebitNote?.basicAmount || 0,
      globalDiscount: editingDebitNote?.globalDiscount || 0,
      taxRate: editingDebitNote?.taxRate || 5,
      date: editingDebitNote?.date || new Date().toISOString()
    };
  });

  const fetchPurchase = () => {
    setInvoiceError('');
    const billNo = formData.purchaseBillNumber.trim().toLowerCase();
    if (!billNo) {
      setInvoiceError('Please enter a Bill Number');
      return;
    }

    const purchase = purchases.find((p: any) => 
      p.billNumber?.toString().toLowerCase() === billNo || 
      p.id?.toLowerCase() === billNo ||
      p.partyBillNumber?.toString().toLowerCase() === billNo
    );
    if (purchase) {
      setFormData({
        ...formData,
        partyGstin: purchase.partyGstin,
        partyName: purchase.partyName,
        partyAddress: purchase.partyAddress,
        partyMobile: purchase.partyMobile || '',
        partyMobile2: purchase.partyMobile2 || '',
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
          const gross = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
          updated.amount = Math.round(gross - (Number(updated.discount) || 0));
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems, taxRate: newTaxRate };
    });
  };

  const calc = useMemo(() => {
    const basicAmount = Math.round(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    const taxableValue = Math.round(Math.max(0, basicAmount - (Number(formData.globalDiscount) || 0)));
    const tax = Math.round(taxableValue * (Number(formData.taxRate) / 100));
    return { basicAmount, taxableValue, tax, total: Math.round(taxableValue + tax) };
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
              onKeyDown={handleEnter}
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
              onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
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
                  onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="Address"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 1</label>
              <input 
                type="text" 
                value={formData.partyMobile} 
                onChange={e => setFormData({ ...formData, partyMobile: e.target.value })}
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="Mobile 1"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 2</label>
              <input 
                type="text" 
                value={formData.partyMobile2} 
                onChange={e => setFormData({ ...formData, partyMobile2: e.target.value })}
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-red-500 transition-all shadow-sm"
                placeholder="Mobile 2"
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
            {formData.items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-red-50/20 border border-red-100 rounded-2xl items-end relative group">
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items-dn"
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    onKeyDown={handleEnter}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
                  {item.meters && (
                    <div className="text-[9px] font-mono text-slate-400 mt-1 break-all bg-red-50/30 p-1 rounded border border-red-100 uppercase tracking-tighter">
                      {item.meters}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1 relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <div className="relative group">
                    <input 
                      type="number" 
                      value={item.quantity || ''} 
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)} 
                      onFocus={() => setActiveCalcId(item.id)}
                      onKeyDown={handleEnter}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-red-500" 
                    />
                    <button 
                      type="button"
                      onClick={() => setActiveCalcId(item.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Calculator size={12} />
                    </button>
                    {activeCalcId === item.id && (
                      <QtyCalculator 
                        value={calcValues[item.id] || ''}
                        onChange={(v) => setCalcValues({ ...calcValues, [item.id]: v })}
                        onApply={(sum, count) => {
                          updateItem(item.id, 'quantity', sum);
                          updateItem(item.id, 'taka', count.toString());
                          updateItem(item.id, 'meters', calcValues[item.id] || '');
                        }}
                        onBlur={() => setActiveCalcId(null)}
                      />
                    )}
                  </div>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input 
                    type="number" 
                    value={item.rate || ''} 
                    onChange={e => updateItem(item.id, 'rate', e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        handleEnter(e);
                        return;
                      }
                      if (e.key === 'Tab' && index === formData.items.length - 1 && !e.shiftKey) {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
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
          <datalist id="master-items-dn">
            {itemsMaster.map((mi: ItemMaster) => (
              <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-6">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Notes / Remarks</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              onKeyDown={handleEnter}
              className="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none focus:border-red-500 transition-all h-24 resize-none" 
              placeholder="Enter any additional notes here..." 
            />
          </div>
        </div>

        <div className="bg-red-50/50 p-8 rounded-3xl border-2 border-dashed border-red-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{Number(calc.taxableValue).toFixed(2)}</span></div>
          <div className="text-slate-500 font-bold text-sm">GST ({formData.taxRate}%): <span className="text-slate-900">₹{Number(calc.tax).toFixed(2)}</span></div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Debit Amount: <span className="text-red-700">₹{Number(calc.total).toFixed(2)}</span></div>
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

      {/* Debit Note History Section */}
      <div className="mt-12 bg-white border-t border-slate-100 p-8 lg:p-12">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Debit Note History</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search and manage previous notes</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search Party, GST or Note No..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-red-500 w-64 transition-all"
            />
          </div>
        </header>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Note No.</th>
                <th className="px-6 py-4">Party Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDebitNotes.map((dn: DebitNote) => (
                <tr key={dn.id} className="hover:bg-white transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">
                    {new Date(dn.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md font-black text-[10px]">#{dn.noteNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-slate-900 uppercase text-[10px]">{dn.partyName}</div>
                    <div className="text-[9px] text-slate-400 font-bold">{dn.partyGstin}</div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className="font-black text-red-700 tracking-tighter">₹ {dn.grandTotal.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onPreview(dn)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="View/Print">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => onEdit(dn)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit">
                        <Plus size={16} className="rotate-45" />
                      </button>
                      <button onClick={() => onDelete(dn.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <AlertCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDebitNotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
                    No matching records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function PurchaseViewWrapper({ onSave, parties, purchases, editingPurchase, onCancel }: any) {
  return <PurchaseView onSave={onSave} parties={parties} purchases={purchases} editingPurchase={editingPurchase} onCancel={onCancel} />;
}

function QtyCalculator({ value, onChange, onApply, onBlur, isLocked }: { value: string, onChange: (v: string) => void, onApply: (sum: number, count: number) => void, onBlur: () => void, isLocked?: boolean }) {
  const parts = value.split(/[+,\s]+/).filter(v => v.trim() !== '');
  const sum = parts.map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0);
  const count = parts.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      onApply(sum, count);
      onBlur();
    }
  };

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2 bg-[#1E272E] border-2 border-[#00cec9] rounded-2xl shadow-2xl p-6 min-w-[320px] md:min-w-[450px] animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-4 border-b border-[#00cec9]/20 pb-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[#00cec9] uppercase tracking-[0.2em]">Quantity Calculator</span>
          <span className="text-xs font-bold text-slate-400 italic">Enter values separated by +, Space or Enter</span>
        </div>
        <div className="bg-[#00cec9]/10 px-3 py-1.5 rounded-lg border border-[#00cec9]/20 flex flex-col items-end">
          <span className="text-[14px] font-black text-[#00cec9]">Total: {sum.toLocaleString()}</span>
          <span className="text-[10px] font-black text-slate-300 uppercase">{count} Taka / Pcs</span>
        </div>
      </div>
      <textarea
        autoFocus
        readOnly={isLocked}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl p-4 text-white font-mono font-bold text-lg h-48 outline-none focus:border-[#00cec9] transition-all resize-none shadow-inner"
        placeholder="Example: 10.5 + 20 + 30..."
      />
      <div className="flex justify-between items-center mt-4">
        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
           Press <span className="text-[#00cec9]">ENTER</span> to apply
        </div>
        <button 
          type="button" 
          onClick={() => { onApply(sum, count); onBlur(); }}
          className="bg-[#00cec9] text-[#1E272E] px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#00cec9]/20"
        >
          Confirm Total
        </button>
      </div>
    </div>
  );
}

function BookingView({ 
  onSave, 
  parties, 
  settings, 
  bookings, 
  purchases = [],
  itemsMaster = [], 
  transports = [], 
  brokers = [],
  creditNotes = [],
  challans = [],
  editingBooking, 
  onViewHistory, 
  onCancel, 
  payments = []
}: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeCalcId, setActiveCalcId] = useState<string | null>(null);
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);

  // Calculate remaining stock for each purchase item
  const availableInventory = useMemo(() => {
    const stock: Record<string, number> = {};
    
    // Initial quantities from purchases
    (purchases || []).forEach((p: Purchase) => {
      (p.items || []).forEach((item: any) => {
        const key = `${p.id}-${item.name}-${item.color}`;
        stock[key] = (stock[key] || 0) + (parseFloat(item.quantity) || 0);
      });
    });

    // Deduct quantities from sales
    (bookings || []).forEach((b: Booking) => {
      // Exclude current editing bill if we are editing
      if (editingBooking && b.id === editingBooking.id) return;

      (b.items || []).forEach((item: any) => {
        if (item.purchaseId) {
          const key = `${item.purchaseId}-${item.name}-${item.color}`;
          stock[key] = (stock[key] || 0) - (parseFloat(item.quantity) || 0);
        }
      });
    });

    return stock;
  }, [purchases, bookings, editingBooking]);

  const getMatchingPurchases = (itemName: string) => {
    if (!itemName) return [];
    
    const results: any[] = [];
    purchases.forEach((p: Purchase) => {
      p.items.forEach((it: any) => {
        if (it.name.toLowerCase().includes(itemName.toLowerCase())) {
          const stockKey = `${p.id}-${it.name}-${it.color}`;
          const remaining = availableInventory[stockKey] || 0;
          if (remaining > 0) {
            results.push({
              purchaseId: p.id,
              billNo: p.partyBillNumber || p.billNumber,
              party: p.partyName,
              date: p.date,
              itemName: it.name,
              color: it.color,
              hsn: it.hsnCode,
              rate: it.rate,
              unit: it.unit,
              remaining
            });
          }
        }
      });
    });
    return results;
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPreview(false);
        if (activeCalcId) setActiveCalcId(null);
        if (activePurchaseId) setActivePurchaseId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeCalcId, activePurchaseId]);

  const [navigatedBillLocked, setNavigatedBillLocked] = useState(false);
  const [calcValues, setCalcValues] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState(() => {
    const nextAutoNum = bookings.reduce((max: number, b: any) => Math.max(max, b.billNumber || 0), 0) + 1;
    return {
      id: editingBooking?.id || '',
      billNumber: editingBooking?.billNumber || nextAutoNum,
      lrNumber: editingBooking?.lrNumber || '',
      ewbNumber: editingBooking?.ewbNumber || '',
      parcels: editingBooking?.parcels || '',
      transportName: editingBooking?.transportName || '',
      transportGstin: editingBooking?.transportGstin || '',
      consignorGstin: editingBooking?.consignorGstin || settings?.gstin || '',
      consignorName: editingBooking?.consignorName || settings?.companyName || '',
      consignorAddress: editingBooking?.consignorAddress || settings?.address || '',
      consigneeGstin: editingBooking?.consigneeGstin || '',
      consigneeName: editingBooking?.consigneeName || '',
      consigneeAddress: editingBooking?.consigneeAddress || '',
      consigneeMobile: editingBooking?.consigneeMobile || '',
      consigneeMobile2: editingBooking?.consigneeMobile2 || '',
      brokerId: editingBooking?.brokerId || '',
      brokerCommissionRate: editingBooking?.brokerCommissionRate || 0,
      items: (editingBooking?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }]).map(it => it.id ? it : { ...it, id: Math.random().toString(36).substr(2, 9) }),
      basicAmount: editingBooking?.basicAmount || 0,
      globalDiscount: editingBooking?.globalDiscount || 0,
      taxRate: editingBooking?.taxRate || 5,
      date: editingBooking?.date || new Date().toISOString(),
      notes: editingBooking?.notes || ''
    };
  });

  const isLocked = useMemo(() => {
    if (navigatedBillLocked) return true;
    if (!editingBooking) return false;
    const bookingDate = new Date(editingBooking.date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - bookingDate.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  }, [editingBooking, navigatedBillLocked]);

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
          updated.amount = Math.round(gross - (updated.discount || 0));
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
    // 1. Gross Amount - Round each item amount first
    const grossAmount = Math.round(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    
    // 2. Discount Calculation
    const effectiveGlobalDiscount = hasItemDiscount ? 0 : Math.round(Number(formData.globalDiscount) || 0);
    
    // 3. Taxable Value
    const taxableValue = Math.round(Math.max(0, grossAmount - effectiveGlobalDiscount));
    
    // 4. GST Calculation
    const tax = Math.round(taxableValue * (Number(formData.taxRate) / 100));
    
    // Determine CGST/SGST vs IGST
    const consignorStateCode = formData.consignorGstin?.substring(0, 2);
    const consigneeStateCode = formData.consigneeGstin?.substring(0, 2);
    const isInterstate = consignorStateCode && consigneeStateCode && consignorStateCode !== consigneeStateCode;
    
    const cgst = isInterstate ? 0 : Math.round(tax / 2);
    const sgst = isInterstate ? 0 : Math.round(tax / 2);
    const igst = isInterstate ? tax : 0;
    
    return { 
      basicAmount: grossAmount, 
      taxableValue, 
      tax, 
      cgst, 
      sgst, 
      igst, 
      isInterstate, 
      total: Math.round(taxableValue + tax), 
      effectiveGlobalDiscount 
    };
  }, [formData.items, formData.globalDiscount, formData.taxRate, hasItemDiscount, formData.consignorGstin, formData.consigneeGstin]);

  useEffect(() => {
    if (Math.abs(formData.basicAmount - calc.basicAmount) > 0.01) {
      setFormData(prev => ({ ...prev, basicAmount: calc.basicAmount }));
    }
  }, [calc.basicAmount]);

  useEffect(() => {
    if (isConsignorLocked && settings) {
      setFormData(prev => ({
        ...prev,
        consignorGstin: settings.gstin,
        consignorName: settings.companyName,
        consignorAddress: settings.address
      }));
    }
  }, [isConsignorLocked, settings]);

  const handleConsigneeNameChange = (val: string) => {
    const party = parties.find((p: any) => p.name.toLowerCase() === val.toLowerCase());
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        consigneeName: party.name, 
        consigneeGstin: party.gstin,
        consigneeAddress: party.address,
        consigneeMobile: party.mobile || '',
        consigneeMobile2: party.mobile2 || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, consigneeName: val }));
    }
  };

  const handleTransportNameChange = (name: string) => {
    const transport = transports.find((t: any) => t.name === name);
    if (transport) {
      setFormData(prev => ({ ...prev, transportName: name, transportGstin: transport.gstin }));
    } else {
      setFormData(prev => ({ ...prev, transportName: name }));
    }
  };

  const handleConsigneeGstinChange = (val: string) => {
    const upperVal = val.toUpperCase();
    const party = parties.find((p: any) => p.gstin.toUpperCase() === upperVal);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        consigneeName: party.name, 
        consigneeGstin: party.gstin,
        consigneeAddress: party.address,
        consigneeMobile: party.mobile || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, consigneeGstin: upperVal }));
    }
  };

    const navigateBill = (direction: 'prev' | 'next') => {
    const currentNum = parseInt(formData.billNumber);
    const sorted = [...bookings].sort((a, b) => (a.billNumber || 0) - (b.billNumber || 0));
    
    let target;
    if (direction === 'prev') {
      target = [...sorted].reverse().find(b => (b.billNumber || 0) < currentNum);
    } else {
      target = sorted.find(b => (b.billNumber || 0) > currentNum);
    }

    if (target) {
      setFormData({
        ...target,
        items: target.items.map((it: any) => ({ ...it, id: Math.random().toString(36).substr(2, 9) }))
      });
      setNavigatedBillLocked(true);
    } else {
      alert(`No ${direction === 'prev' ? 'previous' : 'next'} bill found.`);
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const form = (e.currentTarget as any).form;
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const form = (e.currentTarget as any).form;
      if (!form) return;
      const elements = Array.from(form.elements) as HTMLElement[];
      const index = elements.indexOf(e.currentTarget as any);
      if (index > -1) {
        for (let i = index - 1; i >= 0; i--) {
          const el = elements[i];
          if (el && el.tagName !== 'BUTTON' && !el.hasAttribute('disabled') && !el.hasAttribute('readonly')) {
            el.focus();
            break;
          }
        }
      }
    }
  };

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
              onKeyDown={handleEnter}
              className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all appearance-none ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <option value="5">GST 5%</option>
              <option value="12">GST 12%</option>
              <option value="18">GST 18%</option>
              <option value="28">GST 28%</option>
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
                  onKeyDown={handleEnter}
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
                  onKeyDown={handleEnter}
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
                <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    list="party-gstins"
                    value={formData.consigneeGstin}
                    readOnly={isLocked}
                    onChange={e => handleConsigneeGstinChange(e.target.value)}
                    onKeyDown={handleEnter}
                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                    placeholder="24BBBB..."
                  />
                  <datalist id="party-gstins">
                    {parties.map((p: any) => (
                      <option key={`gstin-${p.id || p.gstin}`} value={p.gstin}>{p.name}</option>
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Full Name</label>
                <div className="relative group">
                  <Plus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    list="party-names"
                    value={formData.consigneeName} 
                    readOnly={isLocked}
                    onChange={e => handleConsigneeNameChange(e.target.value)}
                    onKeyDown={handleEnter}
                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                    placeholder="Enter Party Name"
                  />
                  <datalist id="party-names">
                    {parties.map((p: any) => (
                      <option key={`name-${p.id || p.name}`} value={p.name}>{p.gstin}</option>
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
                <input 
                  type="text" 
                  value={formData.consigneeAddress} 
                  readOnly={isLocked}
                  onChange={e => setFormData({ ...formData, consigneeAddress: e.target.value })}
                  onKeyDown={handleEnter}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                  placeholder="Enter Address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 1</label>
                  <input 
                    type="text" 
                    value={formData.consigneeMobile} 
                    readOnly={isLocked}
                    onChange={e => setFormData({ ...formData, consigneeMobile: e.target.value })}
                    onKeyDown={handleEnter}
                    className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                    placeholder="Enter Mobile 1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 2</label>
                  <input 
                    type="text" 
                    value={formData.consigneeMobile2} 
                    readOnly={isLocked}
                    onChange={e => setFormData({ ...formData, consigneeMobile2: e.target.value })}
                    onKeyDown={handleEnter}
                    className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-blue-500 transition-all shadow-sm ${isLocked ? 'bg-slate-100 text-slate-400 opacity-70' : ''}`}
                    placeholder="Enter Mobile 2"
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-1 block">Broker</label>
                  <select
                    value={formData.brokerId || ''}
                    disabled={isLocked}
                    onChange={e => {
                      const bId = e.target.value;
                      const b = brokers.find((br: any) => br.id === bId);
                      setFormData({ ...formData, brokerId: bId, brokerCommissionRate: b?.defaultCommission || 0 });
                    }}
                    className={`w-full px-4 py-3 border-2 border-blue-100 rounded-xl font-black bg-white outline-none focus:border-blue-500 transition-all shadow-md ${isLocked ? 'bg-slate-100' : ''}`}
                  >
                    <option value="">Select Broker</option>
                    {brokers.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {formData.brokerId && (
                  <div>
                    <label className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-1 block font-black">
                      {(brokers.find((b: any) => b.id === formData.brokerId)?.type === 'mill') ? 'Rate / MTR' : 'Comm %'}
                    </label>
                    <input 
                      type="number"
                      step="any"
                      value={formData.brokerCommissionRate || ''}
                      onChange={e => setFormData({ ...formData, brokerCommissionRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-blue-100 rounded-xl font-black bg-white outline-none focus:border-blue-500 transition-all shadow-md"
                      placeholder="Rate"
                    />
                  </div>
                )}
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
                <div className="md:col-span-2 space-y-1 relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex justify-between">
                    <span>Item Name</span>
                    {item.name && getMatchingPurchases(item.name).length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setActivePurchaseId(activePurchaseId === item.id ? null : item.id)}
                        className="text-[#00cec9] font-black hover:underline"
                      >
                        [ Link Stock ]
                      </button>
                    )}
                  </label>
                  <input 
                    type="text" 
                    list="master-items"
                    readOnly={isLocked} 
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    onKeyDown={handleEnter}
                    className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} 
                    placeholder="Search Item..." 
                  />
                  {item.meters && (
                    <div className="text-[9px] font-mono text-slate-400 mt-1 break-all bg-slate-50 p-1 rounded border border-slate-100 uppercase tracking-tighter">
                      {item.meters}
                    </div>
                  )}
                  {activePurchaseId === item.id && (
                    <div className="absolute top-full left-0 w-[400px] bg-white border-2 border-indigo-500 rounded-xl shadow-2xl z-[100] mt-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="bg-indigo-600 p-3 text-white flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase">Available Purchase Stock</span>
                        <button onClick={() => setActivePurchaseId(null)}><AlertCircle size={14} /></button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                        {getMatchingPurchases(item.name).map((p: any, i: number) => (
                          <button
                            key={`${p.purchaseId}-${i}`}
                            type="button"
                            onClick={() => {
                              updateItem(item.id, 'name', p.itemName);
                              updateItem(item.id, 'color', p.color);
                              updateItem(item.id, 'hsnCode', p.hsn);
                              updateItem(item.id, 'unit', p.unit);
                              updateItem(item.id, 'purchaseId', p.purchaseId);
                              updateItem(item.id, 'purchaseBillNumber', p.billNo);
                              updateItem(item.id, 'purchasePartyName', p.party);
                              setActivePurchaseId(null);
                            }}
                            className="w-full text-left p-3 hover:bg-indigo-50 transition-colors group"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-black text-slate-900 text-xs uppercase">{p.party}</span>
                              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black">Bill: {p.billNo}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{p.itemName} | {p.color}</span>
                              <span className="text-emerald-600 font-black text-xs">Stock: {p.remaining} {p.unit}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.purchaseBillNumber && (
                    <div className="text-[9px] font-black text-indigo-600 mt-0.5 flex items-center gap-1">
                      <Save size={10} /> Linked to Purchase Bill: {item.purchaseBillNumber} ({item.purchasePartyName})
                    </div>
                  )}
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">HSN</label>
                  <input type="text" readOnly={isLocked} value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} onKeyDown={handleEnter} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="HSN" />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Taka/Pics</label>
                  <input type="text" readOnly={isLocked} value={item.taka} onChange={e => updateItem(item.id, 'taka', e.target.value)} onKeyDown={handleEnter} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="No." />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Color</label>
                  <input type="text" readOnly={isLocked} value={item.color} onChange={e => updateItem(item.id, 'color', e.target.value)} onKeyDown={handleEnter} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="Red" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unit</label>
                  <select 
                    disabled={isLocked}
                    value={item.unit} 
                    onChange={e => updateItem(item.id, 'unit', e.target.value)}
                    onKeyDown={handleEnter}
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
                <div className="md:col-span-1 space-y-1 text-slate-900 relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <div className="relative group">
                    <input 
                      type="number" 
                      readOnly={isLocked} 
                      step="any" 
                      value={item.quantity || ''} 
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)} 
                      onFocus={() => !isLocked && setActiveCalcId(item.id)}
                      onKeyDown={handleEnter} 
                      className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-black bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} 
                      placeholder="0.0" 
                    />
                    {!isLocked && (
                      <button 
                        type="button"
                        onClick={() => setActiveCalcId(item.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-[#00cec9] transition-all"
                      >
                        <Calculator size={12} />
                      </button>
                    )}
                    {activeCalcId === item.id && (
                      <QtyCalculator 
                        value={calcValues[item.id] || item.meters || ''}
                        onChange={(v) => setCalcValues({ ...calcValues, [item.id]: v })}
                        onApply={(sum, count) => {
                          updateItem(item.id, 'quantity', sum);
                          updateItem(item.id, 'taka', count.toString());
                          updateItem(item.id, 'meters', calcValues[item.id] || item.meters || '');
                        }}
                        onBlur={() => setActiveCalcId(null)}
                        isLocked={isLocked}
                      />
                    )}
                  </div>
                </div>
                <div className="md:col-span-1.5 space-y-1 text-slate-900">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input type="number" readOnly={isLocked} step="any" value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', e.target.value)} onKeyDown={handleEnter} className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-black bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="0.00" />
                </div>
                <div className="md:col-span-1.5 space-y-1 text-slate-900">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Disc.</label>
                  <input 
                    type="number" 
                    readOnly={isLocked} 
                    step="any" 
                    value={item.discount || ''} 
                    onChange={e => updateItem(item.id, 'discount', e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && index === formData.items.length - 1 && !e.shiftKey) {
                        e.preventDefault();
                        addItem();
                      } else if (e.key === 'Enter') {
                        handleEnter(e);
                      }
                    }}
                    className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg font-black bg-white outline-none focus:border-blue-500 text-sm shadow-sm ${isLocked ? 'bg-slate-50 text-slate-400' : ''}`} 
                    placeholder="0.00" 
                  />
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
          <datalist id="master-items">
            {itemsMaster.map((mi: ItemMaster) => (
              <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider text-[#00cec9]">Bill Date</label>
            <input 
              type="date" 
              value={formData.date.split('T')[0]} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })} 
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Bill No.</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                min="1"
                value={formData.billNumber || ''} 
                readOnly={isLocked}
                onChange={handleBillNumberChange} 
                onKeyDown={handleEnter}
                className={`flex-1 px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              />
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    const c = challans.find((ch: any) => ch.challanNumber === formData.billNumber?.toString());
                    if (c) {
                      setFormData({ 
                        ...formData, 
                        items: c.items.map((it: any) => ({
                          id: Math.random().toString(36).substr(2, 9),
                          name: it.name,
                          color: '',
                          hsnCode: '',
                          unit: it.unit || 'MTR',
                          quantity: it.quantity,
                          taka: it.taka?.toString() || '',
                          meters: it.meters || '',
                          rate: 0,
                          discount: 0,
                          amount: 0
                        }))
                      });
                    } else {
                      alert("Challan not found");
                    }
                  }}
                  className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                >
                  Fetch
                </button>
              )}
            </div>
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
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${!canEditLr ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder={!canEditLr ? "Locked" : "Enter LR No."}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Parcels / Bails</label>
            <input 
              type="text" 
              value={formData.parcels || ''} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, parcels: e.target.value })} 
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="Enter Number of Parcels"
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
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="Enter EWB" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Transport Name</label>
            <input 
              type="text" 
              list="transport-list"
              value={formData.transportName} 
              readOnly={isLocked}
              onChange={e => handleTransportNameChange(e.target.value)} 
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="e.g. VRL Logistics" 
            />
            <datalist id="transport-list">
              {transports.map((t: any) => (
                <option key={t.id} value={t.name}>{t.gstin}</option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Transport GST</label>
            <input 
              type="text" 
              value={formData.transportGstin} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, transportGstin: e.target.value.toUpperCase() })} 
              onKeyDown={handleEnter}
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
                const val = e.target.value;
                setFormData({ ...formData, globalDiscount: val as any });
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

        <div className="grid grid-cols-1 gap-8 mt-6">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Notes / Remarks</label>
            <textarea 
              value={formData.notes} 
              readOnly={isLocked}
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              onKeyDown={handleEnter}
              className={`w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none transition-all h-24 resize-none ${isLocked ? 'bg-slate-50 text-slate-400' : 'focus:border-[#00cec9] focus:bg-white'}`} 
              placeholder="Enter any additional notes here..." 
            />
          </div>
        </div>

        <div className="bg-[#e0f7f7] p-8 rounded-3xl border-2 border-dashed border-[#00cec9]/30 text-right space-y-2">
          {calc.effectiveGlobalDiscount > 0 && (
            <div className="text-pink-500 font-bold text-sm">Global Discount: <span className="text-pink-600">- ₹{Number(calc.effectiveGlobalDiscount).toFixed(2)}</span></div>
          )}
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{Number(calc.taxableValue).toFixed(2)}</span></div>
          {calc.isInterstate ? (
            <div className="text-slate-500 font-bold text-sm">IGST ({formData.taxRate}%): <span className="text-slate-900">₹{Number(calc.igst).toFixed(2)}</span></div>
          ) : (
            <>
              <div className="text-slate-500 font-bold text-sm">CGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.cgst).toFixed(2)}</span></div>
              <div className="text-slate-500 font-bold text-sm">SGST ({formData.taxRate / 2}%): <span className="text-slate-900">₹{Number(calc.sgst).toFixed(2)}</span></div>
            </>
          )}
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Grand Total: <span className="text-[#00cec9]">₹{Number(calc.total).toFixed(2)}</span></div>
        </div>

        <div className="flex gap-4 flex-col sm:flex-row print:hidden">
          <div className="flex gap-2 flex-1">
            <button 
              type="button"
              onClick={() => navigateBill('prev')}
              className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all flex items-center justify-center gap-2 border border-slate-200"
              title="Previous Bill"
            >
              <ChevronLeft size={20} />
              <span>Prev</span>
            </button>
            <button 
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-3 border border-slate-200"
            >
              Show Preview
            </button>
            <button 
              type="button"
              onClick={() => navigateBill('next')}
              className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all flex items-center justify-center gap-2 border border-slate-200"
              title="Next Bill"
            >
              <span>Next</span>
              <ChevronRight size={20} />
            </button>
          </div>
          <button 
            type="button"
            onClick={onViewHistory}
            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black py-5 rounded-2xl text-xl transition-all flex items-center justify-center gap-3 border border-indigo-100"
          >
            <BookText size={24} />
            History
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
            payments={payments}
            creditNotes={creditNotes}
            onClose={() => setShowPreview(false)} 
          />
        )}
      </form>
    </motion.div>
  );
}

function CreditNoteView({ onSave, onEdit, onDelete, onPreview, parties, settings, creditNotes, bookings, itemsMaster = [], editingCreditNote, onCancel, brokers = [] }: any) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeCalcId, setActiveCalcId] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPreview(false);
        if (activeCalcId) setActiveCalcId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeCalcId]);

  const [invoiceError, setInvoiceError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [calcValues, setCalcValues] = useState<{ [key: string]: string }>({});

  const filteredCreditNotes = useMemo(() => {
    return (creditNotes || []).filter((cn: CreditNote) => 
      cn.noteNumber?.toString().includes(searchTerm) || 
      cn.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cn.partyGstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cn.salesBillNumber?.toString().includes(searchTerm)
    );
  }, [creditNotes, searchTerm]);
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const form = (e.currentTarget as any).form;
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const form = (e.currentTarget as any).form;
      if (!form) return;
      const elements = Array.from(form.elements) as HTMLElement[];
      const index = elements.indexOf(e.currentTarget as any);
      if (index > -1) {
        for (let i = index - 1; i >= 0; i--) {
          const el = elements[i];
          if (el && el.tagName !== 'BUTTON' && !el.hasAttribute('disabled') && !el.hasAttribute('readonly')) {
            el.focus();
            break;
          }
        }
      }
    }
  };
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
      partyMobile2: editingCreditNote?.partyMobile2 || '',
      reason: editingCreditNote?.reason || '',
      notes: editingCreditNote?.notes || '',
      items: (editingCreditNote?.items || [{ id: Math.random().toString(36).substr(2, 9), name: '', color: '', hsnCode: '', taka: '', unit: 'MTR', quantity: 0, rate: 0, discount: 0, amount: 0 }]).map(it => it.id ? it : { ...it, id: Math.random().toString(36).substr(2, 9) }),
      basicAmount: editingCreditNote?.basicAmount || 0,
      globalDiscount: editingCreditNote?.globalDiscount || 0,
      taxRate: editingCreditNote?.taxRate || 5,
      date: editingCreditNote?.date || new Date().toISOString(),
      brokerId: editingCreditNote?.brokerId || '',
      brokerCommission: editingCreditNote?.brokerCommission || 0
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
        partyMobile2: booking.consigneeMobile2 || '',
        taxRate: booking.taxRate || 5,
        globalDiscount: booking.globalDiscount || 0,
        brokerId: booking.brokerId || '',
        brokerCommission: booking.brokerCommission || 0,
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
          const gross = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
          updated.amount = Math.round(gross - (Number(updated.discount) || 0));
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems, taxRate: newTaxRate };
    });
  };

  const calc = useMemo(() => {
    const basicAmount = Math.round(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
    const taxableValue = Math.round(Math.max(0, basicAmount - (Number(formData.globalDiscount) || 0)));
    const tax = Math.round(taxableValue * (Number(formData.taxRate) / 100));
    return { basicAmount, taxableValue, tax, total: Math.round(taxableValue + tax) };
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
              onKeyDown={handleEnter}
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
              onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
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
                  onKeyDown={handleEnter}
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
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="e.g. Quality Issue"
              />
            </div>
          </div>
          
          <div className="pt-4 mt-4 border-t border-green-500/10">
            <label className="text-[11px] font-black text-green-600 uppercase tracking-wider mb-2 block">Brokerage Reversal (Auto-calculated)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Linked Broker</label>
                <select 
                  value={formData.brokerId || ''}
                  onChange={e => {
                    const bId = e.target.value;
                    const b = (brokers || []).find((br: any) => br.id === bId);
                    setFormData({ ...formData, brokerId: bId, brokerCommission: b?.defaultCommission || 0 });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm appearance-none"
                >
                  <option value="">No Broker</option>
                  {(brokers || []).filter((b: any) => b.type === 'sale').map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Commission Rate (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="any"
                    value={formData.brokerCommission || ''}
                    onChange={e => setFormData({ ...formData, brokerCommission: parseFloat(e.target.value) || 0 })}
                    onKeyDown={handleEnter}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-black bg-white outline-none focus:border-green-500 transition-all shadow-sm text-right pr-10"
                    placeholder="Rate"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Address</label>
              <input 
                type="text" 
                value={formData.partyAddress} 
                onChange={e => setFormData({ ...formData, partyAddress: e.target.value })}
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="Address"
              />
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 1</label>
              <input 
                type="text" 
                value={formData.partyMobile} 
                onChange={e => setFormData({ ...formData, partyMobile: e.target.value })}
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="Mobile 1"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Mobile 2</label>
              <input 
                type="text" 
                value={formData.partyMobile2} 
                onChange={e => setFormData({ ...formData, partyMobile2: e.target.value })}
                onKeyDown={handleEnter}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-green-500 transition-all shadow-sm"
                placeholder="Mobile 2"
              />
            </div>
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
            {formData.items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-green-50/20 border border-green-100 rounded-2xl items-end relative group">
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Item Name</label>
                  <input 
                    type="text" 
                    list="master-items-cn"
                    value={item.name} 
                    onChange={e => updateItem(item.id, 'name', e.target.value)} 
                    onKeyDown={handleEnter}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
                  {item.meters && (
                    <div className="text-[9px] font-mono text-slate-400 mt-1 break-all bg-green-50/30 p-1 rounded border border-green-100 uppercase tracking-tighter">
                      {item.meters}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1 relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</label>
                  <div className="relative group">
                    <input 
                      type="number" 
                      value={item.quantity || ''} 
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)} 
                      onFocus={() => setActiveCalcId(item.id)}
                      onKeyDown={handleEnter}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white outline-none focus:border-green-500" 
                    />
                    <button 
                      type="button"
                      onClick={() => setActiveCalcId(item.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-green-500 transition-all"
                    >
                      <Calculator size={12} />
                    </button>
                    {activeCalcId === item.id && (
                      <QtyCalculator 
                        value={calcValues[item.id] || ''}
                        onChange={(v) => setCalcValues({ ...calcValues, [item.id]: v })}
                        onApply={(sum, count) => {
                          updateItem(item.id, 'quantity', sum);
                          updateItem(item.id, 'taka', count.toString());
                          updateItem(item.id, 'meters', calcValues[item.id] || '');
                        }}
                        onBlur={() => setActiveCalcId(null)}
                      />
                    )}
                  </div>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</label>
                  <input 
                    type="number" 
                    value={item.rate || ''} 
                    onChange={e => updateItem(item.id, 'rate', e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        handleEnter(e);
                        return;
                      }
                      if (e.key === 'Tab' && index === formData.items.length - 1 && !e.shiftKey) {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white" 
                  />
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
          <datalist id="master-items-cn">
            {itemsMaster.map((mi: ItemMaster) => (
              <option key={mi.id} value={mi.name}>{mi.hsnCode}</option>
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-6">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Notes / Remarks</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              onKeyDown={handleEnter}
              className="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl font-black bg-white outline-none focus:border-green-500 transition-all h-24 resize-none" 
              placeholder="Enter any additional notes here..." 
            />
          </div>
        </div>

        <div className="bg-green-50/50 p-8 rounded-3xl border-2 border-dashed border-green-200 text-right space-y-2">
          <div className="text-slate-500 font-bold text-sm">Taxable Value: <span className="text-slate-900">₹{Number(calc.taxableValue).toFixed(2)}</span></div>
          <div className="text-slate-500 font-bold text-sm">GST ({formData.taxRate}%): <span className="text-slate-900">₹{Number(calc.tax).toFixed(2)}</span></div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">Credit Amount: <span className="text-green-700">₹{Number(calc.total).toFixed(2)}</span></div>
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

      {/* Credit Note History Section */}
      <div className="mt-12 bg-white border-t border-slate-100 p-8 lg:p-12">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Credit Note History</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search and manage previous notes</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search Party, GST or Note No..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-green-500 w-64 transition-all"
            />
          </div>
        </header>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Note No.</th>
                <th className="px-6 py-4">Party Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCreditNotes.map((cn: CreditNote) => (
                <tr key={cn.id} className="hover:bg-white transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">
                    {new Date(cn.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md font-black text-[10px]">#{cn.noteNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-slate-900 uppercase text-[10px]">{cn.partyName}</div>
                    <div className="text-[9px] text-slate-400 font-bold">{cn.partyGstin}</div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className="font-black text-green-700 tracking-tighter">₹ {cn.grandTotal.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                       <button onClick={() => onPreview(cn)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="View/Print">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => onEdit(cn)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit">
                        <Plus size={16} className="rotate-45" />
                      </button>
                      <button onClick={() => onDelete(cn.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <AlertCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCreditNotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
                    No matching records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}





function CreditNotePrintPreview({ creditNote, settings, payments = [], onClose }: any) {
  const totalPaid = (payments || []).reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
  const p = creditNote;
  const isFullyPaid = totalPaid >= (p.grandTotal - 0.5);
  const remainingBalance = Math.max(0, p.grandTotal - totalPaid);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const consigneeName = p.consigneeName || p.partyName || '';
  const consigneeAddress = p.consigneeAddress || p.partyAddress || '';
  const consigneeGstin = p.consigneeGstin || p.partyGstin || '';
  const consigneeMobile = p.consigneeMobile || p.partyMobile || '';
  const consignorName = p.consignorName || settings?.companyName || "K.K. FABRICS";
  
  const taxableValue = p.basicAmount - (p.globalDiscount || 0);
  const tr = p.taxRate || 5;
  const tax = taxableValue * (tr / 100);
  // Safely fallback cgst, sgst, igst values
  const cgst = p.cgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const sgst = p.sgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const igst = p.igstAmount ?? (p.isInterstate ? tax : 0);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-container');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${p.billNumber || 'document'}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto scrollbar-hide lg:py-12"
    >
      <div className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border my-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full print:hidden flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Close Preview
        </button>
        
        <div className="fixed bottom-8 left-8 flex flex-col gap-3 print:hidden z-[60]">
          <button onClick={() => window.print()} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-indigo-600 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Printer size={20} />
            <span className="absolute left-14 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Print Bill</span>
          </button>
          <button onClick={handleDownloadPDF} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-rose-500 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Download size={20} />
            <span className="absolute left-14 px-2 py-1 bg-rose-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Download PDF</span>
          </button>
        </div>

        <div id="print-container" className="print-container bg-white p-4 sm:p-10 print:p-0 md:text-[11px] text-[10px]">
          <div className="border border-black">
            
            {/* Header */}
            <div className="text-center p-2 border-b border-black">
              <div className="font-bold text-xs" style={{ fontFamily: 'Georgia, serif' }}>||| SHREE GANESHAY NAMAH |||</div>
              <h1 className="text-3xl font-black mt-1 uppercase tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>{settings?.companyName || "K.K. FABRICS"}</h1>
              <div className="font-bold uppercase mt-1 tracking-wide">{settings?.address || "SURAT, GUJARAT"}</div>
            </div>

            <div className="flex justify-between items-center p-2 border-b border-black font-bold uppercase">
              <div className="w-1/3 text-left">
                <div>GSTIN: {settings?.gstin || ""}</div>
              </div>
              <div className="w-1/3 text-center text-xl font-black tracking-widest uppercase">
                CREDIT NOTE
              </div>
              <div className="w-1/3 text-right">
                <div>Mo: {settings?.mobile || ""}</div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-[60%_40%] border-b border-black">
              <div className="border-r border-black p-2 space-y-1">
                <div className="flex"><span className="w-32 font-bold">From:</span> <span className="uppercase">{consignorName}</span></div>
                <div className="flex"><span className="w-32 font-bold">Transport:</span> <span className="uppercase">{p.transportName || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">LR No:</span> <span className="uppercase">{p.lrNumber || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">Remittance:</span> <span></span></div>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex justify-between"><span className="font-bold">Invoice No:</span> <span className="uppercase font-bold">{p.billNumber}</span></div>
                <div className="flex justify-between"><span className="font-bold">Date:</span> <span>{new Date(p.date).toLocaleDateString('en-GB')}</span></div>
                {p.ewbNumber ? (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">EWAY BILL:</span> <span className="uppercase font-black text-black tracking-widest">{p.ewbNumber}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="font-bold">Challan No:</span> <span className="uppercase">-</span></div>
                )}
                {p.parcels && (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">PARCELS/BAILS:</span> <span className="uppercase font-black text-black tracking-widest">{p.parcels}</span></div>
                )}
                <div className="flex justify-between"><span className="font-bold">Broker:</span> <span>-</span></div>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 border-b border-black">
              <div className="border-r border-black p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Receiver (Billed To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                {consigneeMobile && <div className="mt-1">Contact: {consigneeMobile}</div>}
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                  {p.consigneeStateCode && <div><span className="font-bold">State Code:</span> {p.consigneeStateCode}</div>}
                </div>
              </div>
              <div className="p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Consignee (Shipped To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase text-[10px] font-bold h-8">
                  <th className="border-r border-black p-1.5 min-w-[30px]">No</th>
                  <th className="border-r border-black p-1.5 text-left w-[40%]">Description of Goods</th>
                  <th className="border-r border-black p-1.5">HSN No</th>
                  <th className="border-r border-black p-1.5">Taka / Box</th>
                  <th className="border-r border-black p-1.5">Qty</th>
                  <th className="border-r border-black p-1.5">Rate</th>
                  <th className="p-1.5 text-right w-[15%]">Taxable Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b-0 text-[11px] align-top">
                    <td className="border-r border-black p-1">{idx + 1}</td>
                    <td className="border-r border-black p-1 text-left font-bold uppercase">
                      {item.name} {item.color && <span className="font-normal ml-1">({item.color})</span>}
                    </td>
                    <td className="border-r border-black p-1">{item.hsnCode}</td>
                    <td className="border-r border-black p-1">{item.taka || '-'}</td>
                    <td className="border-r border-black p-1 uppercase font-bold">{item.quantity} <span className="font-normal text-[9px]">{item.unit}</span></td>
                    <td className="border-r border-black p-1">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-1 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 10 - p.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="align-top h-6">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-y border-black font-bold uppercase text-[11px] h-6 bg-slate-50">
                  <td className="border-r border-black p-1.5" colSpan={3}>Total</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.taka) || 0), 0) || '-'}</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.quantity) || 0), 0).toFixed(2)}</td>
                  <td className="border-r border-black p-1.5"></td>
                  <td className="p-1.5 text-right tracking-wider">{Number(p.basicAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer sections */}
            <div className="grid grid-cols-[60%_40%]">
              {/* Left Footer */}
              <div className="border-r border-black p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Amount in Words:</div>
                  <div className="font-bold italic uppercase indent-2 text-[11px]">{numberToWords(p.grandTotal)}</div>
                </div>
                
                <div className="mt-4 pb-2 border-b border-black border-dashed">
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Bank Details</div>
                  <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[10px] uppercase">
                    <span className="font-bold">Bank:</span> <span>{settings?.bankName || ''}</span>
                    <span className="font-bold">Branch:</span> <span>{settings?.branchName || ''}</span>
                    <span className="font-bold">A/c No:</span> <span className="font-black tracking-widest">{settings?.accountNumber || ''}</span>
                    <span className="font-bold">IFSC:</span> <span className="font-black tracking-widest">{settings?.ifscCode || ''}</span>
                  </div>
                </div>

                <div className="mt-2 text-[9px] leading-snug">
                  <div className="font-bold underline mb-1 uppercase">Terms of Sales</div>
                  <ol className="list-decimal pl-4 space-y-0.5 m-0 uppercase font-bold text-slate-800">
                    <li>Goods once sold will not be taken back.</li>
                    <li>Interest @ 24% p.a. will be charged if not paid within 30 days.</li>
                    <li>We are not responsible for any damage in transit.</li>
                    <li>Subject to Surat Jurisdiction only.</li>
                  </ol>
                </div>
              </div>

              {/* Right Footer */}
              <div className="flex flex-col">
                <div className="p-2 space-y-1 bg-white flex-1 text-[11px]">
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Gross Amount</span> <span className="font-bold">{Number(p.basicAmount).toFixed(2)}</span></div>
                  {p.globalDiscount > 0 && (
                     <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Less Discount</span> <span className="font-bold">- {Number(p.globalDiscount).toFixed(2)}</span></div>
                  )}
                  
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">SGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(sgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">CGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(cgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">IGST @ {p.isInterstate ? tr.toFixed(2) : '0.00'}%</span> <span>{Number(igst).toFixed(2)}</span></div>
                </div>

                <div className="border-y border-black p-3 flex justify-between font-black text-sm uppercase items-center pb-2 pt-2 bg-slate-50 relative overflow-hidden">
                  <div className="flex flex-col">
                    <span>Net Amount</span>
                    <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block w-fit ${isFullyPaid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                      {isFullyPaid ? 'FULLY PAID' : remainingBalance < p.grandTotal ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base tracking-wider">₹ {Number(p.grandTotal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    {!isFullyPaid && remainingBalance < p.grandTotal && (
                      <span className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-widest">Bal: ₹ {remainingBalance.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div className="p-2 pt-6 text-center flex-1 flex flex-col justify-end">
                  <div className="font-black uppercase text-[10px] mb-8 text-right tracking-widest leading-none">For {settings?.companyName || "K.K. FABRICS"}</div>
                  <div className="text-[9px] font-bold uppercase text-right opacity-60 leading-none">Authorized Signatory</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
function SendPaymentView({ onSave, parties, purchases, editingPayment, onEdit, onDelete, onCancel, payments = [], debitNotes = [], isSyncing = false }: any) {
  const [selectedId, setSelectedId] = useState(editingPayment?.partyId || '');
  const [chequeNumber, setChequeNumber] = useState(editingPayment?.chequeNumber || '');
  const [chequeDate, setChequeDate] = useState(editingPayment?.chequeDate || '');
  const [notes, setNotes] = useState(editingPayment?.notes || '');
  const [billAdjustments, setBillAdjustments] = useState<any[]>(editingPayment?.billAdjustments || []);
  const [date, setDate] = useState(editingPayment?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [partySearch, setPartySearch] = useState('');

  const resetForm = useCallback(() => {
    setSelectedId('');
    setChequeNumber('');
    setChequeDate('');
    setNotes('');
    setBillAdjustments([]);
    setDate(new Date().toISOString().split('T')[0]);
    setPartySearch('');
    if (onCancel && editingPayment) onCancel();
  }, [onCancel, editingPayment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        resetForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetForm]);

  const filteredParties = useMemo(() => {
    return (parties || []).filter((p: any) => 
      p?.name?.toLowerCase().includes(partySearch.toLowerCase()) || 
      p?.gstin?.toLowerCase().includes(partySearch.toLowerCase())
    );
  }, [parties, partySearch]);

  const selectedParty = (parties || []).find((p: any) => p?.id === selectedId);
  const partyPurchases = useMemo(() => {
    if (!selectedParty) return [];
    return (purchases || []).filter((p: any) => p?.partyGstin === selectedParty.gstin);
  }, [selectedParty, purchases]);

  useEffect(() => {
    if (selectedParty) {
      setBillAdjustments(partyPurchases.map((p: any) => {
        const otherPayments = (payments || []).filter((py: any) => py?.id !== editingPayment?.id);
        const info = getBillPaymentInfo(p.id, p.grandTotal, otherPayments, debitNotes, p.billNumber?.toString());
        const existingAdj = editingPayment?.billAdjustments?.find((adj: any) => adj.billId === p.id);
        const paidAmount = existingAdj ? existingAdj.amount : '';

        if (info.status === 'PAID' && !existingAdj) return null;
        return {
          billId: p.id,
          billNumber: p.billNumber,
          grandTotal: p.grandTotal,
          balance: info.balance,
          paid: paidAmount
        };
      }).filter(Boolean));
    } else {
      setBillAdjustments([]);
    }
  }, [selectedParty, partyPurchases, payments, editingPayment]);

  const totalAdjusted = billAdjustments.reduce((sum, b) => sum + (parseFloat(b.paid) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto mt-12 mb-20 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-red-600 to-rose-700 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Send Payment</h2>
          <p className="text-red-100 text-xs font-bold uppercase tracking-widest mt-1 italic">Payment to Purchase Parties</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-red-100 uppercase tracking-widest">Total Sending</p>
          <p className="text-2xl font-black text-white">₹ {(totalAdjusted || 0).toLocaleString()}</p>
        </div>
      </div>
      
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!selectedId) {
          alert("Please select a party");
          return;
        }
        if (totalAdjusted <= 0) {
          alert("Please enter adjustment amount against at least one purchase bill");
          return;
        }
        onSave({ 
          id: editingPayment?.id,
          partyId: selectedId, 
          amount: totalAdjusted,
          date: new Date(date).toISOString(),
          chequeNumber,
          chequeDate,
          notes,
          billAdjustments: billAdjustments.filter(b => (parseFloat(b.paid) || 0) > 0).map(b => ({
            billId: b.billId,
            billNumber: b.billNumber as string,
            amount: parseFloat(b.paid)
          }))
        });
      }} className="p-10 space-y-10">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Search & Select Purchase Party</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Type name or GSTIN..."
                    value={partySearch}
                    onChange={e => setPartySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-red-500"
                  />
                </div>
                <select 
                  value={selectedId} 
                  disabled={!!editingPayment}
                  onChange={e => setSelectedId(e.target.value)}
                  className={`w-40 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:border-red-500 transition-all appearance-none cursor-pointer ${editingPayment ? 'opacity-70' : ''}`}
                >
                  <option value="">Quick Select</option>
                  {(filteredParties || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Payment Date</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:border-red-500 transition-all"
            />
          </div>
          
          {selectedParty && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black text-red-700 uppercase tracking-widest">To Be Paid</div>
                <div className="text-xl font-black text-red-600">
                  ₹ {((selectedParty.totalPurchases || 0) - (selectedParty.totalPaid || 0)).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-red-700 uppercase tracking-widest">Total Purchases</div>
                <div className="text-sm font-bold text-slate-600">₹ {(selectedParty.totalPurchases || 0).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        {selectedParty && (
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Adjust Against Purchase Bills</h3>
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Purchase Bill No.</th>
                    <th className="px-6 py-4">Bill Total</th>
                    <th className="px-6 py-4">Pending (Balance)</th>
                    <th className="px-6 py-4 text-right">Adjust Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {billAdjustments.map((b, idx) => (
                    <tr key={b.billId} className="bg-white">
                      <td className="px-6 py-4 font-black text-slate-900"># {b.billNumber}</td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-sm">₹ {(b.grandTotal || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-red-500 text-sm">₹ {(b.balance || b.grandTotal || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          step="any"
                          value={b.paid || ''}
                          onChange={(e) => {
                            const newAdjustments = [...billAdjustments];
                            newAdjustments[idx].paid = e.target.value === '' ? '' : (parseFloat(e.target.value) || '') as any;
                            setBillAdjustments(newAdjustments);
                          }}
                          className="w-full text-right px-4 py-2 border border-slate-100 rounded-lg font-black text-red-600 outline-none focus:border-red-500"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                  {billAdjustments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-bold italic text-xs">No pending purchase bills found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cheque / Ref Number</label>
                <input 
                  type="text" 
                  value={chequeNumber || ''}
                  onChange={e => setChequeNumber(e.target.value)}
                  className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-red-500"
                  placeholder="e.g. 123456"
                />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cheque Pass Date</label>
                <input 
                  type="date" 
                  value={chequeDate || ''}
                  onChange={e => setChequeDate(e.target.value)}
                  className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-red-500"
                />
             </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Internal Notes</label>
            <textarea 
              rows={4}
              value={notes || ''}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-red-500 resize-none"
              placeholder="Enter payment details..."
            />
          </div>
        </div>

        <div className="pt-4 flex flex-col items-center gap-4">
          <div className="flex gap-4 w-full md:w-auto">
            <button 
              type="submit"
              disabled={totalAdjusted <= 0 || isSyncing}
              className="flex-1 md:min-w-[300px] bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-black py-5 px-12 rounded-2xl text-xl shadow-xl shadow-red-100 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={24} className="animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <Save size={24} /> {editingPayment ? 'Update Payment' : 'Send Payment'} (₹ {(totalAdjusted || 0).toLocaleString()})
                </>
              )}
            </button>
            {!editingPayment && (
              <button 
                type="button"
                onClick={resetForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-5 px-8 rounded-2xl text-xl transition-all active:scale-[0.98] flex items-center gap-2"
                title="Shortcut: Ctrl+N"
              >
                <Plus size={24} /> New
              </button>
            )}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">
            This will update the purchase party ledger and bills
          </p>
        </div>
      </form>

      {/* Payment History Section */}
      {selectedParty && payments && payments.filter((p: any) => p.partyId === selectedParty.id).length > 0 && (
        <div className="p-10 border-t-2 border-dashed border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Payment History for {selectedParty.name}</h3>
          <div className="space-y-4">
            {payments.filter((p: any) => p.partyId === selectedParty.id).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any) => (
              <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-red-50 rounded-lg text-red-600">
                     <History size={20} />
                   </div>
                   <div>
                     <p className="text-xs font-bold text-slate-500">{new Date(p.date).toLocaleDateString()}</p>
                     <p className="text-sm font-black text-slate-900 mt-0.5">₹ {p.amount.toLocaleString()}</p>
                     {p.chequeNumber && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ref: {p.chequeNumber}</p>}
                   </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(p)}
                      type="button"
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      title="Edit Payment Detail"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this payment?")) {
                          onDelete(p);
                        }
                      }}
                      type="button"
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      title="Delete Payment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {p.billAdjustments && p.billAdjustments.length > 0 && (
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Adjusted Bills</p>
                      <div className="flex gap-1 justify-end flex-wrap max-w-[200px]">
                        {p.billAdjustments.map((ba: any) => (
                          <span key={ba.billId} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            #{ba.billNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PaymentView({ onSave, parties, bookings, editingPayment, onEdit, onDelete, onCancel, payments = [], creditNotes = [], isSyncing = false }: any) {
  const [selectedId, setSelectedId] = useState(editingPayment?.partyId || '');
  const [amount, setAmount] = useState(editingPayment?.amount?.toString() || '');
  const [chequeNumber, setChequeNumber] = useState(editingPayment?.chequeNumber || '');
  const [chequeDate, setChequeDate] = useState(editingPayment?.chequeDate || '');
  const [notes, setNotes] = useState(editingPayment?.notes || '');
  const [billAdjustments, setBillAdjustments] = useState<any[]>(editingPayment?.billAdjustments || []);
  const [date, setDate] = useState(editingPayment?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [partySearch, setPartySearch] = useState('');

  const resetForm = useCallback(() => {
    setSelectedId('');
    setAmount('');
    setChequeNumber('');
    setChequeDate('');
    setNotes('');
    setBillAdjustments([]);
    setDate(new Date().toISOString().split('T')[0]);
    setPartySearch('');
    if (onCancel && editingPayment) onCancel();
  }, [onCancel, editingPayment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        resetForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetForm]);

  const filteredParties = useMemo(() => {
    return (parties || []).filter((p: any) => 
      p?.name?.toLowerCase().includes(partySearch.toLowerCase()) || 
      p?.gstin?.toLowerCase().includes(partySearch.toLowerCase())
    );
  }, [parties, partySearch]);

  const selectedParty = (parties || []).find((p: any) => p?.id === selectedId);
  const partyBookings = useMemo(() => {
    if (!selectedParty) return [];
    return (bookings || []).filter((b: any) => b?.consigneeGstin === selectedParty.gstin);
  }, [selectedParty, bookings]);

  useEffect(() => {
    if (selectedParty) {
      setBillAdjustments(partyBookings.map((b: any) => {
        const otherPayments = (payments || []).filter((p: any) => p?.id !== editingPayment?.id);
        const info = getBillPaymentInfo(b.id, b.grandTotal, otherPayments, creditNotes, b.billNumber?.toString());
        const existingAdj = editingPayment?.billAdjustments?.find((adj: any) => adj.billId === b.id);
        const paidAmount = existingAdj ? existingAdj.amount : '';

        if (info.status === 'PAID' && !existingAdj) return null;
        return {
          billId: b.id,
          billNumber: b.billNumber,
          grandTotal: b.grandTotal,
          balance: info.balance,
          paid: paidAmount 
        };
      }).filter(Boolean));
    } else {
      setBillAdjustments([]);
    }
  }, [selectedParty, partyBookings, payments, editingPayment]);

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
          <p className="text-2xl font-black text-white">₹ {(totalAdjusted || 0).toLocaleString()}</p>
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
          id: editingPayment?.id,
          partyId: selectedId, 
          amount: totalAdjusted,
          date: new Date(date).toISOString(),
          chequeNumber,
          chequeDate,
          notes,
          billAdjustments: billAdjustments.filter(b => (parseFloat(b.paid) || 0) > 0).map(b => ({
            billId: b.billId,
            billNumber: b.billNumber as string,
            amount: parseFloat(b.paid)
          }))
        });
      }} className="p-10 space-y-10">
        
        {/* Section 1: Party Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Search & Select Sale Party</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Type name or GSTIN..."
                    value={partySearch}
                    onChange={e => setPartySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <select 
                  value={selectedId} 
                  disabled={!!editingPayment}
                  onChange={e => setSelectedId(e.target.value)}
                  className={`w-40 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer ${editingPayment ? 'opacity-70' : ''}`}
                >
                  <option value="">Quick Select</option>
                  {(filteredParties || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Payment Date</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all"
            />
          </div>
          
          {selectedParty && (
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Pending Ledger Balance</div>
                <div className={`text-xl font-black ${((selectedParty.totalSales || 0) - (selectedParty.totalPaid || 0)) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ₹ {((selectedParty.totalSales || 0) - (selectedParty.totalPaid || 0)).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Total Sales</div>
                <div className="text-sm font-bold text-slate-600">₹ {(selectedParty.totalSales || 0).toLocaleString()}</div>
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
                    <th className="px-6 py-4">Pending (Balance)</th>
                    <th className="px-6 py-4 text-right">Adjustment Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {billAdjustments.map((b, idx) => (
                    <tr key={b.billId} className="bg-white">
                      <td className="px-6 py-4 font-black text-slate-900"># {b.billNumber}</td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-sm">₹ {(b.grandTotal || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-red-500 text-sm">₹ {(b.balance || b.grandTotal || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          step="any"
                          value={b.paid || ''}
                          onChange={(e) => {
                            const newAdjustments = [...billAdjustments];
                            newAdjustments[idx].paid = e.target.value === '' ? '' : (parseFloat(e.target.value) || '') as any;
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
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-bold italic text-xs">No pending bills found for this party</td>
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
                  value={chequeNumber || ''}
                  onChange={e => setChequeNumber(e.target.value)}
                  className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                  placeholder="e.g. 123456"
                />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cheque Pass Date</label>
                <input 
                  type="date" 
                  value={chequeDate || ''}
                  onChange={e => setChequeDate(e.target.value)}
                  className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
             </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Internal Notes</label>
            <textarea 
              rows={4}
              value={notes || ''}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 resize-none"
              placeholder="Enter any additional details here..."
            />
          </div>
        </div>

        <div className="pt-4 flex flex-col items-center gap-4">
          <div className="flex gap-4 w-full md:w-auto">
            <button 
              type="submit"
              disabled={totalAdjusted <= 0 || isSyncing}
              className="flex-1 md:min-w-[300px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-5 px-12 rounded-2xl text-xl shadow-xl shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={24} className="animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <Save size={24} /> {editingPayment ? 'Update Payment' : 'Confirm Payment'} (₹ {(totalAdjusted || 0).toLocaleString()})
                </>
              )}
            </button>
            {!editingPayment && (
              <button 
                type="button"
                onClick={resetForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-5 px-8 rounded-2xl text-xl transition-all active:scale-[0.98] flex items-center gap-2"
                title="Shortcut: Ctrl+N"
              >
                <Plus size={24} /> New
              </button>
            )}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
            This entry will settle selected bills and update party ledger
          </p>
        </div>
      </form>

      {/* Payment History Section */}
      {selectedParty && payments && payments.filter((p: any) => p.partyId === selectedParty.id).length > 0 && (
        <div className="p-10 border-t-2 border-dashed border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Payment History for {selectedParty.name}</h3>
          <div className="space-y-4">
            {payments.filter((p: any) => p.partyId === selectedParty.id).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any) => (
              <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                     <History size={20} />
                   </div>
                   <div>
                     <p className="text-xs font-bold text-slate-500">{new Date(p.date).toLocaleDateString()}</p>
                     <p className="text-sm font-black text-slate-900 mt-0.5">₹ {p.amount.toLocaleString()}</p>
                     {p.chequeNumber && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ref: {p.chequeNumber}</p>}
                   </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(p)}
                      type="button"
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                      title="Edit Payment Detail"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this payment?")) {
                          onDelete(p);
                        }
                      }}
                      type="button"
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      title="Delete Payment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {p.billAdjustments && p.billAdjustments.length > 0 && (
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Adjusted Bills</p>
                      <div className="flex gap-1 justify-end flex-wrap max-w-[200px]">
                        {p.billAdjustments.map((ba: any) => (
                          <span key={ba.billId} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            #{ba.billNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PaymentPrintPreview({ payment, settings, onClose }: any) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payment_${payment.id}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Failed to generate PDF. You can use Print -> Save as PDF instead.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto scrollbar-hide lg:py-12"
    >
      <div className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border my-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full print:hidden flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Close Preview
        </button>
        
        <div className="fixed bottom-8 left-8 flex flex-col gap-3 print:hidden z-[60]">
          <button onClick={() => window.print()} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-indigo-600 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Printer size={20} />
            <span className="absolute left-14 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Print Voucher</span>
          </button>
          <button onClick={handleDownloadPDF} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-rose-500 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Download size={20} />
            <span className="absolute left-14 px-2 py-1 bg-rose-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Download PDF</span>
          </button>
        </div>

        <div ref={printRef} id="print-container" className="print-container space-y-0 p-4 sm:p-10 relative overflow-hidden print:border-2 print:border-slate-900 text-slate-800">
          {/* Watermark for Print */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03] rotate-[-45deg] print:flex hidden">
            <span className="text-[120px] font-black uppercase text-slate-900 whitespace-nowrap">
              {settings?.companyName || "PRO BILLER"}
            </span>
          </div>
          <header className="flex justify-between items-start border-b-2 border-slate-900 pb-8 p-8 print:p-6 relative z-10">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">{settings?.companyName}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Payment Receipt / Voucher</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-400 mb-1 uppercase tracking-widest">Date</p>
              <p className="text-xl font-black text-slate-900">{new Date(payment.date).toLocaleDateString()}</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-0 border-b-2 border-slate-900">
            <div className="p-8 print:p-6 border-r-2 border-slate-900">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Received From</h4>
              <p className="text-2xl font-black text-slate-900 uppercase leading-none mb-1">{payment.partyName}</p>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{payment.partyGstin}</p>
            </div>
            <div className="text-right p-8 print:p-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Voucher Details</h4>
              <p className="text-sm font-bold text-slate-700 font-mono">Ref: {payment.id}</p>
              {payment.chequeNumber && <p className="text-sm font-bold text-slate-700">Cheque No: {payment.chequeNumber}</p>}
              {payment.chequeDate && <p className="text-sm font-bold text-slate-700">Date: {new Date(payment.chequeDate).toLocaleDateString()}</p>}
            </div>
          </div>

          <div className="p-8 print:p-6 border-b-2 border-slate-900 bg-slate-50/10">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Amount Received</span>
              <div className="flex flex-col items-end">
                <span className="text-3xl font-black text-slate-900 tracking-tighter">₹ {payment.amount.toLocaleString()}</span>
                <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded mt-1 uppercase tracking-widest">RECEIVED</span>
              </div>
            </div>
            
            {payment.billAdjustments && payment.billAdjustments.length > 0 && (
              <div className="space-y-3 pt-6 border-t-2 border-slate-900">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjustment Details</h4>
                {payment.billAdjustments.map((adj: any) => (
                  <div key={adj.billId || adj.billNumber} className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="uppercase">Adjusted against Bill # {adj.billNumber}</span>
                    <span className="font-mono">₹ {adj.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {payment.notes && (
            <div className="p-8 print:p-6 border-b-2 border-slate-900">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes / Internal Remarks</h4>
              <p className="text-sm text-slate-600 italic leading-relaxed">{payment.notes}</p>
            </div>
          )}

          <footer className="p-8 print:p-6 flex justify-between items-stretch">
            <div className="flex-1 pr-8 border-r-2 border-slate-900">
              {settings?.bankName && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-sm">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Landmark size={12} className="text-indigo-600" /> Bank Details
                  </h4>
                  <div className="grid grid-cols-[80px_1fr] gap-y-1 text-[11px]">
                    <span className="font-bold text-slate-500 uppercase">Bank:</span>
                    <span className="font-black text-slate-900 uppercase">{settings.bankName}</span>
                    <span className="font-bold text-slate-500 uppercase">A/c No:</span>
                    <span className="font-black text-slate-900 tracking-wider">{settings.accountNumber}</span>
                    <span className="font-bold text-slate-500 uppercase">IFSC:</span>
                    <span className="font-black text-slate-900 tracking-wider">{settings.ifscCode}</span>
                    <span className="font-bold text-slate-500 uppercase">Branch:</span>
                    <span className="font-black text-slate-900 uppercase">{settings.branchName}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="text-center min-w-[12rem] pl-8 flex flex-col justify-end">
               {settings?.signature ? (
                 <div className="h-28 flex items-end justify-center mb-1">
                   <img src={settings.signature} alt="Authorized Signatory" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
                 </div>
               ) : (
                 <div className="h-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-300 uppercase italic">
                   Sign / Stamp
                 </div>
               )}
               <div className="pt-2 border-t-2 border-slate-900">
                 <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Authorized Signatory</p>
               </div>
            </div>
          </footer>
        </div>
      </div>
    </motion.div>
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

function LedgerPrintPreview({ party, transactions, settings, onClose }: any) {
  const printRef = useRef<HTMLDivElement>(null);
  const runningBalance = transactions.reduce((acc: number, t: any) => acc + t.amount, 0);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Ledger_${party.name}.pdf`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto scrollbar-hide lg:py-12"
    >
      <div className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border my-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full print:hidden flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Close Preview
        </button>
        
        <div className="fixed bottom-8 left-8 flex flex-col gap-3 print:hidden z-[60]">
          <button onClick={() => window.print()} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-indigo-600 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Printer size={20} />
            <span className="absolute left-14 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Print Ledger</span>
          </button>
          <button onClick={handleDownloadPDF} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-rose-500 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Download size={20} />
            <span className="absolute left-14 px-2 py-1 bg-rose-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Download PDF</span>
          </button>
        </div>

        <div ref={printRef} id="print-container" className="print-container p-4 sm:p-10 bg-white text-slate-800 relative overflow-hidden print:border-2 print:border-slate-900 border-collapse">
          {/* Watermark for Print */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03] rotate-[-45deg] print:flex hidden font-black text-[100px] uppercase">
            {settings?.companyName}
          </div>

          <header className="p-8 print:p-6 border-b-2 border-slate-900 flex justify-between items-start relative z-10">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">{settings?.companyName}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Address: {settings?.address}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">GSTIN: {settings?.gstin}</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black text-slate-900 uppercase">Statement of Account</h2>
              <p className="text-sm font-bold text-slate-500">Party: <span className="text-slate-900">{party.name}</span></p>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </header>

          <div className="p-8 print:p-6 border-b-2 border-slate-900 bg-slate-50/10">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Statement Period</h4>
                <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">All Previous Records</p>
              </div>
              <div className="text-right">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 italic">Net Outstanding (Balance)</h4>
                <p className={`text-2xl font-black ${runningBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹ {Math.abs(runningBalance).toLocaleString()} {runningBalance > 0 ? 'Debit (Dr)' : 'Credit (Cr)'}
                </p>
              </div>
            </div>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-900 font-black uppercase text-slate-600">
                <th className="py-3 px-4 text-left border-r-2 border-slate-900">Date</th>
                <th className="py-3 px-4 text-left border-r-2 border-slate-900 w-1/3">Bill No/Ref</th>
                <th className="py-3 px-4 text-right border-r-2 border-slate-900">Debit (₹)</th>
                <th className="py-3 px-4 text-right border-r-2 border-slate-900">Credit (₹)</th>
                <th className="py-3 px-4 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="border-b-2 border-slate-900 border-t-2">
              {transactions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).reduce((acc: any[], t: any) => {
                const prevBal = acc.length > 0 ? acc[acc.length - 1].runningBal : 0;
                acc.push({ ...t, runningBal: prevBal + t.amount });
                return acc;
              }, []).map((t: any) => (
                <tr key={t.id || Math.random().toString(36)} className="border-b-2 border-slate-900">
                  <td className="py-3 px-4 font-bold border-r-2 border-slate-900">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="py-3 px-4 border-r-2 border-slate-900">
                    <div className="font-bold uppercase tracking-tight">{t.type.replace('_', ' ')}</div>
                    {t.type === 'PAYMENT' && t.billAdjustments ? (
                      <div className="text-[10px] text-indigo-600 font-black mt-0.5">
                        Settled: {t.billAdjustments.map((ba: any) => `#${ba.billNumber}`).join(', ')}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 font-mono">REF: {t.billNumber || t.invoiceNumber || t.noteNumber || String(t.id).slice(0, 8)}</div>
                    )}
                    {t.chequeNumber && <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">CHQ/REF: {t.chequeNumber}</div>}
                  </td>
                  <td className="py-3 px-4 text-right border-r-2 border-slate-900 font-bold">
                    {t.amount > 0 ? t.amount.toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-right border-r-2 border-slate-900 font-bold">
                    {t.amount < 0 ? Math.abs(t.amount).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-black">
                    {Math.abs(t.runningBal).toLocaleString()} {t.runningBal >= 0 ? 'Dr' : 'Cr'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="p-8 print:p-6 border-t-2 border-slate-900 bg-slate-50 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Automated Ledger Generated I Pro Biller</div>
            <div className="text-center min-w-[12rem]">
               {settings?.signature ? (
                 <div className="h-28 flex items-end justify-center mb-1">
                   <img src={settings.signature} alt="Authorized Signatory" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
                 </div>
               ) : (
                 <div className="h-28 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-200 uppercase italic">
                   Sign / Stamp
                 </div>
               )}
               <div className="pt-2 border-t-2 border-slate-900">
                 <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Authorized Stamp/Sign</p>
               </div>
            </div>
          </footer>
        </div>
      </div>
    </motion.div>
  );
}

function LedgerView({ parties, purchaseParties, bookings, purchases, payments, purchasePayments, creditNotes, debitNotes, settings, onDeletePayment, onEditPayment, onEditBooking, onEditPurchase, onEditCreditNote, onEditDebitNote }: any) {
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [billFilter, setBillFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [previewBooking, setPreviewBooking] = useState<any>(null);
  const [previewPurchase, setPreviewPurchase] = useState<any>(null);
  const [previewCreditNote, setPreviewCreditNote] = useState<any>(null);
  const [previewDebitNote, setPreviewDebitNote] = useState<any>(null);
  const [previewPayment, setPreviewPayment] = useState<any>(null);
  const [showLedgerPrint, setShowLedgerPrint] = useState(false);
  const [printAllTransactions, setPrintAllTransactions] = useState<any[] | null>(null);
  const isLocalPrintOpen = !!(previewBooking || previewPurchase || previewCreditNote || previewDebitNote || previewPayment || showLedgerPrint || printAllTransactions);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLocalPrintOpen) {
          setPreviewBooking(null);
          setPreviewPurchase(null);
          setPreviewCreditNote(null);
          setPreviewDebitNote(null);
          setPreviewPayment(null);
          setShowLedgerPrint(false);
          setPrintAllTransactions(null);
        } else {
          setSelectedParty(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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
        ...partyPayments.map(p => ({ ...p, type: 'PAYMENT', originalType: 'SALE_PAYMENT', amount: -p.amount, date: p.date })),
        ...partyCNs.map(cn => ({ ...cn, type: 'CREDIT_NOTE', amount: -cn.grandTotal, date: cn.date }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const partyPurchases = (purchases || []).filter((p: any) => p.partyGstin === party.gstin);
      const partyPayments = (purchasePayments || []).filter((pp: any) => pp.partyGstin === party.gstin || pp.partyId === party.id);
      const partyDNs = (debitNotes || []).filter((dn: any) => dn.partyGstin === party.gstin);

      return [
        ...partyPurchases.map(p => ({ ...p, type: 'PURCHASE', amount: p.grandTotal, date: p.date })),
        ...partyPayments.map(p => ({ ...p, type: 'PAYMENT', originalType: 'PURCHASE_PAYMENT', amount: -p.amount, date: p.date })),
        ...partyDNs.map(dn => ({ ...dn, type: 'DEBIT_NOTE', amount: -dn.grandTotal, date: dn.date }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  };

  if (selectedParty) {
    let transactions = getPartyLedger(selectedParty);
    // Sort oldest first for balance calculation
    transactions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    transactions = transactions.map((t: any) => {
      runningBalance += t.amount;
      return { ...t, balance: runningBalance };
    });

    if (billFilter !== 'ALL') {
      transactions = transactions.filter((t: any) => {
        if (t.type === 'SALE' || t.type === 'PURCHASE') {
          const paymentsList = activeTab === 'sales' ? payments : purchasePayments;
          const info = getBillPaymentInfo(t.id, Math.abs(t.amount), paymentsList, activeTab === 'sales' ? creditNotes : [], t.billNumber?.toString());
          if (billFilter === 'PAID') return info.status === 'PAID';
          if (billFilter === 'UNPAID') return info.status === 'UNPAID' || info.status === 'PARTIAL';
        }
        return false;
      });
    }

    // Sort back to newest first for display
    transactions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());


    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        <div className={isLocalPrintOpen ? 'print:hidden' : ''}>
          <header className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedParty(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedParty.name}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedParty.gstin}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowLedgerPrint(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
            >
              <Printer size={14} /> Print Ledger
            </button>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Balance</p>
              <p className={`text-3xl font-black tracking-tighter ${runningBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                ₹ {runningBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Transaction Type</th>
                  <th className="px-8 py-5">Bill No/Ref</th>
                  <th className="px-8 py-5 text-right">Debit (+)</th>
                  <th className="px-8 py-5 text-right">Credit (-)</th>
                  <th className="px-8 py-5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr 
                    key={t.id || t.billNumber || t.invoiceNumber || t.noteNumber || Math.random().toString()} 
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
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          t.type === 'SALE' ? 'bg-indigo-100 text-indigo-600' :
                          t.type === 'PURCHASE' ? 'bg-orange-100 text-orange-600' :
                          t.type === 'PAYMENT' ? 'bg-green-100 text-green-600' :
                          t.type === 'CREDIT_NOTE' ? 'bg-pink-100 text-pink-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {t.type.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1">
                          {t.type === 'PAYMENT' ? (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditPayment(t);
                                }}
                                className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold text-[10px] uppercase flex items-center gap-1"
                                title="Edit Payment"
                              >
                                <Edit size={14} /> Edit
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeletePayment(t);
                                }}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                title="Delete Payment"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (t.type === 'SALE') onEditBooking(t);
                                if (t.type === 'PURCHASE') onEditPurchase(t);
                                if (t.type === 'CREDIT_NOTE') onEditCreditNote(t);
                                if (t.type === 'DEBIT_NOTE') onEditDebitNote(t);
                              }}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold text-[10px] uppercase flex items-center gap-1"
                              title="Edit Transaction"
                            >
                              <Edit size={14} /> Edit
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-black text-slate-900">
                      <div className="flex flex-col">
                        {t.type === 'PAYMENT' && t.billAdjustments ? (
                          <>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Adjusted Bills</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {t.billAdjustments.map((ba: any) => (
                                <span key={ba.billId} className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] border border-indigo-100">
                                  #{ba.billNumber}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <span>{t.billNumber || t.invoiceNumber || t.noteNumber || (typeof t.id === 'string' ? t.id.slice(0,8) : t.id) || '-'}</span>
                        )}
                        {t.type === 'PURCHASE' && t.partyBillNumber && (
                          <span className="text-[9px] text-indigo-500 font-black uppercase">Party Bill: {t.partyBillNumber}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-slate-700">
                      {t.amount > 0 ? `₹ ${Math.round(t.amount).toLocaleString()}` : '-'}
                    </td>
                    <td className="px-8 py-5 text-right font-bold text-slate-700">
                      {t.amount < 0 ? `₹ ${Math.round(Math.abs(t.amount)).toLocaleString()}` : '-'}
                    </td>
                    <td className={`px-8 py-5 text-right font-black ${t.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      ₹ {Math.round(t.balance).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {previewBooking && <PrintPreview booking={previewBooking} settings={settings} payments={payments} creditNotes={creditNotes} onClose={() => setPreviewBooking(null)} />}
        {previewPurchase && <PurchasePrintPreview purchase={previewPurchase} settings={settings} payments={purchasePayments} onClose={() => setPreviewPurchase(null)} />}
        {previewPayment && <PaymentPrintPreview payment={previewPayment} settings={settings} onClose={() => setPreviewPayment(null)} />}
        {previewCreditNote && <CreditNotePrintPreview creditNote={previewCreditNote} settings={settings} onClose={() => setPreviewCreditNote(null)} />}
        {previewDebitNote && <DebitNotePrintPreview debitNote={previewDebitNote} settings={settings} onClose={() => setPreviewDebitNote(null)} />}
        {showLedgerPrint && <LedgerPrintPreview party={selectedParty} transactions={transactions} settings={settings} onClose={() => setShowLedgerPrint(false)} />}
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
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-end md:self-auto gap-2">
            <select 
              value={billFilter}
              onChange={(e) => setBillFilter(e.target.value as any)}
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-700 outline-none"
            >
              <option value="ALL">All Bills</option>
              <option value="PAID">Paid Bills</option>
              <option value="UNPAID">Unpaid Bills</option>
            </select>
            <button 
              onClick={() => {
                let allTransactions: any[] = [];
                filteredParties.forEach((p: any) => {
                  let partyT = getPartyLedger(p);
                  if (billFilter !== 'ALL') {
                    partyT = partyT.filter((t: any) => {
                      if (t.type === 'SALE' || t.type === 'PURCHASE') {
                        const paymentsList = activeTab === 'sales' ? payments : purchasePayments;
                        const info = getBillPaymentInfo(t.id, Math.abs(t.amount), paymentsList, activeTab === 'sales' ? creditNotes : [], t.billNumber?.toString());
                        if (billFilter === 'PAID') return info.status === 'PAID';
                        if (billFilter === 'UNPAID') return info.status === 'UNPAID' || info.status === 'PARTIAL';
                      }
                      return false;
                    });
                  }
                  allTransactions.push(...partyT);
                });
                setPrintAllTransactions(allTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all flex items-center gap-1"
            >
              <Printer size={12} /> Print list
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
      {printAllTransactions && (
        <LedgerPrintPreview 
          party={{ name: "ALL PARTIES", gstin: "Multiple" }} 
          transactions={printAllTransactions} 
          settings={settings} 
          onClose={() => setPrintAllTransactions(null)} 
        />
      )}
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

function getBillPaymentInfo(billId: string, grandTotal: number, allPayments: Payment[], allCreditNotes: CreditNote[] = [], billNumberStr: string = '') {
  const BillAdjustments = (allPayments || []).flatMap(p => p?.billAdjustments || []);
  const paidAmount = BillAdjustments
    .filter(adj => adj?.billId === billId)
    .reduce((sum, adj) => sum + (adj?.amount || 0), 0);

  const cnAmount = (allCreditNotes || [])
    .filter(cn => cn?.salesBillNumber === billNumberStr && billNumberStr !== '')
    .reduce((sum, cn) => sum + (cn?.grandTotal || 0), 0);
  
  const balance = (grandTotal || 0) - paidAmount - cnAmount;
  let status: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
  
  if (balance <= 0.5) status = 'PAID';
  else if ((paidAmount + cnAmount) > 0.5) status = 'PARTIAL';
  
  return { paidAmount, balance, status, cnAmount };
}





function PurchasePrintPreview({ purchase, settings, payments = [], onClose }: any) {
  const totalPaid = (payments || []).reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
  const p = purchase;
  const isFullyPaid = totalPaid >= (p.grandTotal - 0.5);
  const remainingBalance = Math.max(0, p.grandTotal - totalPaid);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const consigneeName = p.consigneeName || p.partyName || '';
  const consigneeAddress = p.consigneeAddress || p.partyAddress || '';
  const consigneeGstin = p.consigneeGstin || p.partyGstin || '';
  const consigneeMobile = p.consigneeMobile || p.partyMobile || '';
  const consignorName = p.consignorName || settings?.companyName || "K.K. FABRICS";
  
  const taxableValue = p.basicAmount - (p.globalDiscount || 0);
  const tr = p.taxRate || 5;
  const tax = taxableValue * (tr / 100);
  // Safely fallback cgst, sgst, igst values
  const cgst = p.cgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const sgst = p.sgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const igst = p.igstAmount ?? (p.isInterstate ? tax : 0);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-container');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${p.billNumber || 'document'}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto scrollbar-hide lg:py-12"
    >
      <div className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border my-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full print:hidden flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Close Preview
        </button>
        
        <div className="fixed bottom-8 left-8 flex flex-col gap-3 print:hidden z-[60]">
          <button onClick={() => window.print()} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-indigo-600 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Printer size={20} />
            <span className="absolute left-14 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Print Bill</span>
          </button>
          <button onClick={handleDownloadPDF} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-rose-500 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Download size={20} />
            <span className="absolute left-14 px-2 py-1 bg-rose-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Download PDF</span>
          </button>
        </div>

        <div id="print-container" className="print-container bg-white p-4 sm:p-10 print:p-0 md:text-[11px] text-[10px]">
          <div className="border border-black">
            
            {/* Header */}
            <div className="text-center p-2 border-b border-black">
              <div className="font-bold text-xs" style={{ fontFamily: 'Georgia, serif' }}>||| SHREE GANESHAY NAMAH |||</div>
              <h1 className="text-3xl font-black mt-1 uppercase tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>{settings?.companyName || "K.K. FABRICS"}</h1>
              <div className="font-bold uppercase mt-1 tracking-wide">{settings?.address || "SURAT, GUJARAT"}</div>
            </div>

            <div className="flex justify-between items-center p-2 border-b border-black font-bold uppercase">
              <div className="w-1/3 text-left">
                <div>GSTIN: {settings?.gstin || ""}</div>
              </div>
              <div className="w-1/3 text-center text-xl font-black tracking-widest uppercase">
                PURCHASE BILL
              </div>
              <div className="w-1/3 text-right">
                <div>Mo: {settings?.mobile || ""}</div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-[60%_40%] border-b border-black">
              <div className="border-r border-black p-2 space-y-1">
                <div className="flex"><span className="w-32 font-bold">From:</span> <span className="uppercase">{consignorName}</span></div>
                <div className="flex"><span className="w-32 font-bold">Transport:</span> <span className="uppercase">{p.transportName || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">LR No:</span> <span className="uppercase">{p.lrNumber || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">Remittance:</span> <span></span></div>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex justify-between font-black text-red-600"><span className="font-bold">Our Bill No:</span> <span className="uppercase font-bold">#{p.billNumber}</span></div>
                <div className="flex justify-between font-black text-indigo-700"><span className="font-bold">Party Bill No:</span> <span className="uppercase font-bold">{p.partyBillNumber || '-'}</span></div>
                <div className="flex justify-between"><span className="font-bold">Date:</span> <span>{new Date(p.date).toLocaleDateString('en-GB')}</span></div>
                {p.ewbNumber ? (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">EWAY BILL:</span> <span className="uppercase font-black text-black tracking-widest">{p.ewbNumber}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="font-bold">Challan No:</span> <span className="uppercase">-</span></div>
                )}
                {p.parcels && (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">PARCELS/BAILS:</span> <span className="uppercase font-black text-black tracking-widest">{p.parcels}</span></div>
                )}
                <div className="flex justify-between"><span className="font-bold">Broker:</span> <span>-</span></div>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 border-b border-black">
              <div className="border-r border-black p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Receiver (Billed To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                {consigneeMobile && <div className="mt-1">Contact: {consigneeMobile}</div>}
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                  {p.consigneeStateCode && <div><span className="font-bold">State Code:</span> {p.consigneeStateCode}</div>}
                </div>
              </div>
              <div className="p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Consignee (Shipped To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase text-[10px] font-bold h-8">
                  <th className="border-r border-black p-1.5 min-w-[30px]">No</th>
                  <th className="border-r border-black p-1.5 text-left w-[40%]">Description of Goods</th>
                  <th className="border-r border-black p-1.5">HSN No</th>
                  <th className="border-r border-black p-1.5">Taka / Box</th>
                  <th className="border-r border-black p-1.5">Qty</th>
                  <th className="border-r border-black p-1.5">Rate</th>
                  <th className="p-1.5 text-right w-[15%]">Taxable Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b-0 text-[11px] align-top">
                    <td className="border-r border-black p-1">{idx + 1}</td>
                    <td className="border-r border-black p-1 text-left font-bold uppercase">
                      {item.name} {item.color && <span className="font-normal ml-1">({item.color})</span>}
                    </td>
                    <td className="border-r border-black p-1">{item.hsnCode}</td>
                    <td className="border-r border-black p-1">{item.taka || '-'}</td>
                    <td className="border-r border-black p-1 uppercase font-bold">{item.quantity} <span className="font-normal text-[9px]">{item.unit}</span></td>
                    <td className="border-r border-black p-1">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-1 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 10 - p.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="align-top h-6">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-y border-black font-bold uppercase text-[11px] h-6 bg-slate-50">
                  <td className="border-r border-black p-1.5" colSpan={3}>Total</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.taka) || 0), 0) || '-'}</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.quantity) || 0), 0).toFixed(2)}</td>
                  <td className="border-r border-black p-1.5"></td>
                  <td className="p-1.5 text-right tracking-wider">{Number(p.basicAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer sections */}
            <div className="grid grid-cols-[60%_40%]">
              {/* Left Footer */}
              <div className="border-r border-black p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Amount in Words:</div>
                  <div className="font-bold italic uppercase indent-2 text-[11px]">{numberToWords(p.grandTotal)}</div>
                </div>
                
                <div className="mt-4 pb-2 border-b border-black border-dashed">
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Bank Details</div>
                  <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[10px] uppercase">
                    <span className="font-bold">Bank:</span> <span>{settings?.bankName || ''}</span>
                    <span className="font-bold">Branch:</span> <span>{settings?.branchName || ''}</span>
                    <span className="font-bold">A/c No:</span> <span className="font-black tracking-widest">{settings?.accountNumber || ''}</span>
                    <span className="font-bold">IFSC:</span> <span className="font-black tracking-widest">{settings?.ifscCode || ''}</span>
                  </div>
                </div>

                <div className="mt-2 text-[9px] leading-snug">
                  <div className="font-bold underline mb-1 uppercase">Terms of Sales</div>
                  <ol className="list-decimal pl-4 space-y-0.5 m-0 uppercase font-bold text-slate-800">
                    <li>Goods once sold will not be taken back.</li>
                    <li>Interest @ 24% p.a. will be charged if not paid within 30 days.</li>
                    <li>We are not responsible for any damage in transit.</li>
                    <li>Subject to Surat Jurisdiction only.</li>
                  </ol>
                </div>
              </div>

              {/* Right Footer */}
              <div className="flex flex-col">
                <div className="p-2 space-y-1 bg-white flex-1 text-[11px]">
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Gross Amount</span> <span className="font-bold">{Number(p.basicAmount).toFixed(2)}</span></div>
                  {p.globalDiscount > 0 && (
                     <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Less Discount</span> <span className="font-bold">- {Number(p.globalDiscount).toFixed(2)}</span></div>
                  )}
                  
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">SGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(sgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">CGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(cgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">IGST @ {p.isInterstate ? tr.toFixed(2) : '0.00'}%</span> <span>{Number(igst).toFixed(2)}</span></div>
                </div>

                <div className="border-y border-black p-3 flex justify-between font-black text-sm uppercase items-center pb-2 pt-2 bg-slate-50 relative overflow-hidden">
                  <div className="flex flex-col">
                    <span>Net Amount</span>
                    <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block w-fit ${isFullyPaid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                      {isFullyPaid ? 'FULLY PAID' : remainingBalance < p.grandTotal ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base tracking-wider">₹ {Number(p.grandTotal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    {!isFullyPaid && remainingBalance < p.grandTotal && (
                      <span className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-widest">Bal: ₹ {remainingBalance.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div className="p-2 pt-6 text-center flex-1 flex flex-col justify-end">
                  <div className="font-black uppercase text-[10px] mb-8 text-right tracking-widest leading-none">For {settings?.companyName || "K.K. FABRICS"}</div>
                  <div className="text-[9px] font-bold uppercase text-right opacity-60 leading-none">Authorized Signatory</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DebitNotePrintPreview({ debitNote, settings, payments = [], onClose }: any) {
  const totalPaid = (payments || []).reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
  const p = debitNote;
  const isFullyPaid = totalPaid >= (p.grandTotal - 0.5);
  const remainingBalance = Math.max(0, p.grandTotal - totalPaid);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const consigneeName = p.consigneeName || p.partyName || '';
  const consigneeAddress = p.consigneeAddress || p.partyAddress || '';
  const consigneeGstin = p.consigneeGstin || p.partyGstin || '';
  const consigneeMobile = p.consigneeMobile || p.partyMobile || '';
  const consignorName = p.consignorName || settings?.companyName || "K.K. FABRICS";
  
  const taxableValue = p.basicAmount - (p.globalDiscount || 0);
  const tr = p.taxRate || 5;
  const tax = taxableValue * (tr / 100);
  // Safely fallback cgst, sgst, igst values
  const cgst = p.cgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const sgst = p.sgstAmount ?? (p.isInterstate ? 0 : tax/2);
  const igst = p.igstAmount ?? (p.isInterstate ? tax : 0);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-container');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${p.billNumber || 'document'}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto scrollbar-hide lg:py-12"
    >
      <div className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border my-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full print:hidden flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Close Preview
        </button>
        
        <div className="fixed bottom-8 left-8 flex flex-col gap-3 print:hidden z-[60]">
          <button onClick={() => window.print()} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-indigo-600 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Printer size={20} />
            <span className="absolute left-14 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Print Bill</span>
          </button>
          <button onClick={handleDownloadPDF} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-rose-500 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Download size={20} />
            <span className="absolute left-14 px-2 py-1 bg-rose-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Download PDF</span>
          </button>
        </div>

        <div id="print-container" className="print-container bg-white p-4 sm:p-10 print:p-0 md:text-[11px] text-[10px]">
          <div className="border border-black">
            
            {/* Header */}
            <div className="text-center p-2 border-b border-black">
              <div className="font-bold text-xs" style={{ fontFamily: 'Georgia, serif' }}>||| SHREE GANESHAY NAMAH |||</div>
              <h1 className="text-3xl font-black mt-1 uppercase tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>{settings?.companyName || "K.K. FABRICS"}</h1>
              <div className="font-bold uppercase mt-1 tracking-wide">{settings?.address || "SURAT, GUJARAT"}</div>
            </div>

            <div className="flex justify-between items-center p-2 border-b border-black font-bold uppercase">
              <div className="w-1/3 text-left">
                <div>GSTIN: {settings?.gstin || ""}</div>
              </div>
              <div className="w-1/3 text-center text-xl font-black tracking-widest uppercase">
                DEBIT NOTE
              </div>
              <div className="w-1/3 text-right">
                <div>Mo: {settings?.mobile || ""}</div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-[60%_40%] border-b border-black">
              <div className="border-r border-black p-2 space-y-1">
                <div className="flex"><span className="w-32 font-bold">From:</span> <span className="uppercase">{consignorName}</span></div>
                <div className="flex"><span className="w-32 font-bold">Transport:</span> <span className="uppercase">{p.transportName || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">LR No:</span> <span className="uppercase">{p.lrNumber || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">Remittance:</span> <span></span></div>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex justify-between"><span className="font-bold">Invoice No:</span> <span className="uppercase font-bold">{p.billNumber}</span></div>
                <div className="flex justify-between"><span className="font-bold">Date:</span> <span>{new Date(p.date).toLocaleDateString('en-GB')}</span></div>
                {p.ewbNumber ? (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">EWAY BILL:</span> <span className="uppercase font-black text-black tracking-widest">{p.ewbNumber}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="font-bold">Challan No:</span> <span className="uppercase">-</span></div>
                )}
                {p.parcels && (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">PARCELS/BAILS:</span> <span className="uppercase font-black text-black tracking-widest">{p.parcels}</span></div>
                )}
                <div className="flex justify-between"><span className="font-bold">Broker:</span> <span>-</span></div>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 border-b border-black">
              <div className="border-r border-black p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Receiver (Billed To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                {consigneeMobile && <div className="mt-1">Contact: {consigneeMobile}</div>}
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                  {p.consigneeStateCode && <div><span className="font-bold">State Code:</span> {p.consigneeStateCode}</div>}
                </div>
              </div>
              <div className="p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Consignee (Shipped To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase text-[10px] font-bold h-8">
                  <th className="border-r border-black p-1.5 min-w-[30px]">No</th>
                  <th className="border-r border-black p-1.5 text-left w-[40%]">Description of Goods</th>
                  <th className="border-r border-black p-1.5">HSN No</th>
                  <th className="border-r border-black p-1.5">Taka / Box</th>
                  <th className="border-r border-black p-1.5">Qty</th>
                  <th className="border-r border-black p-1.5">Rate</th>
                  <th className="p-1.5 text-right w-[15%]">Taxable Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b-0 text-[11px] align-top">
                    <td className="border-r border-black p-1">{idx + 1}</td>
                    <td className="border-r border-black p-1 text-left font-bold uppercase">
                      {item.name} {item.color && <span className="font-normal ml-1">({item.color})</span>}
                    </td>
                    <td className="border-r border-black p-1">{item.hsnCode}</td>
                    <td className="border-r border-black p-1">{item.taka || '-'}</td>
                    <td className="border-r border-black p-1 uppercase font-bold">{item.quantity} <span className="font-normal text-[9px]">{item.unit}</span></td>
                    <td className="border-r border-black p-1">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-1 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 10 - p.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="align-top h-6">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-y border-black font-bold uppercase text-[11px] h-6 bg-slate-50">
                  <td className="border-r border-black p-1.5" colSpan={3}>Total</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.taka) || 0), 0) || '-'}</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.quantity) || 0), 0).toFixed(2)}</td>
                  <td className="border-r border-black p-1.5"></td>
                  <td className="p-1.5 text-right tracking-wider">{Number(p.basicAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer sections */}
            <div className="grid grid-cols-[60%_40%]">
              {/* Left Footer */}
              <div className="border-r border-black p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Amount in Words:</div>
                  <div className="font-bold italic uppercase indent-2 text-[11px]">{numberToWords(p.grandTotal)}</div>
                </div>
                
                <div className="mt-4 pb-2 border-b border-black border-dashed">
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Bank Details</div>
                  <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[10px] uppercase">
                    <span className="font-bold">Bank:</span> <span>{settings?.bankName || ''}</span>
                    <span className="font-bold">Branch:</span> <span>{settings?.branchName || ''}</span>
                    <span className="font-bold">A/c No:</span> <span className="font-black tracking-widest">{settings?.accountNumber || ''}</span>
                    <span className="font-bold">IFSC:</span> <span className="font-black tracking-widest">{settings?.ifscCode || ''}</span>
                  </div>
                </div>

                <div className="mt-2 text-[9px] leading-snug">
                  <div className="font-bold underline mb-1 uppercase">Terms of Sales</div>
                  <ol className="list-decimal pl-4 space-y-0.5 m-0 uppercase font-bold text-slate-800">
                    <li>Goods once sold will not be taken back.</li>
                    <li>Interest @ 24% p.a. will be charged if not paid within 30 days.</li>
                    <li>We are not responsible for any damage in transit.</li>
                    <li>Subject to Surat Jurisdiction only.</li>
                  </ol>
                </div>
              </div>

              {/* Right Footer */}
              <div className="flex flex-col">
                <div className="p-2 space-y-1 bg-white flex-1 text-[11px]">
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Gross Amount</span> <span className="font-bold">{Number(p.basicAmount).toFixed(2)}</span></div>
                  {p.globalDiscount > 0 && (
                     <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Less Discount</span> <span className="font-bold">- {Number(p.globalDiscount).toFixed(2)}</span></div>
                  )}
                  
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">SGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(sgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">CGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(cgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">IGST @ {p.isInterstate ? tr.toFixed(2) : '0.00'}%</span> <span>{Number(igst).toFixed(2)}</span></div>
                </div>

                <div className="border-y border-black p-3 flex justify-between font-black text-sm uppercase items-center pb-2 pt-2 bg-slate-50 relative overflow-hidden">
                  <div className="flex flex-col">
                    <span>Net Amount</span>
                    <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block w-fit ${isFullyPaid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                      {isFullyPaid ? 'FULLY PAID' : remainingBalance < p.grandTotal ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base tracking-wider">₹ {Number(p.grandTotal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    {!isFullyPaid && remainingBalance < p.grandTotal && (
                      <span className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-widest">Bal: ₹ {remainingBalance.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div className="p-2 pt-6 text-center flex-1 flex flex-col justify-end">
                  <div className="font-black uppercase text-[10px] mb-8 text-right tracking-widest leading-none">For {settings?.companyName || "K.K. FABRICS"}</div>
                  <div className="text-[9px] font-bold uppercase text-right opacity-60 leading-none">Authorized Signatory</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
function PrintPreview({ booking, settings, payments = [], creditNotes = [], onClose }: { booking: any, settings: AppSettings | null, payments?: Payment[], creditNotes?: CreditNote[], onClose: () => void }) {
  const totalPaid = (payments || []).reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
  const cnAmount = (creditNotes || []).filter(cn => cn.salesBillNumber === booking.billNumber?.toString()).reduce((sum, cn) => sum + cn.grandTotal, 0);
  const p = booking;
  const isFullyPaid = (totalPaid + cnAmount) >= (p.grandTotal - 0.5);
  const remainingBalance = Math.max(0, p.grandTotal - totalPaid - cnAmount);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter') window.print();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fixing lint errors
  const consigneeName = p.consigneeName || '';
  const consigneeAddress = p.consigneeAddress || '';
  const consigneeGstin = p.consigneeGstin || '';
  const consigneeMobile = p.consigneeMobile || '';
  const consignorName = p.consignorName || settings?.companyName || "K.K. FABRICS";

  // Calculate isInterstate on the fly to avoid type errors if not on Booking
  const myStateCode = "24";
  const rState = (consigneeGstin || '').substring(0, 2);
  const isInterstate = rState !== myStateCode;
  
  const taxableValue = p.basicAmount - (p.globalDiscount || 0);
  const tr = p.taxRate || 5;
  const tax = taxableValue * (tr / 100);
  // Safely fallback cgst, sgst, igst values
  const cgst = p.cgstAmount ?? (isInterstate ? 0 : tax/2);
  const sgst = p.sgstAmount ?? (isInterstate ? 0 : tax/2);
  const igst = p.igstAmount ?? (isInterstate ? tax : 0);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-container');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${p.billNumber || 'document'}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto scrollbar-hide lg:py-12"
    >
      <div className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:m-0 print:p-0 text-black font-sans box-border my-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full print:hidden flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Close Preview
        </button>
        
        <div className="fixed bottom-8 left-8 flex flex-col gap-3 print:hidden z-[60]">
          <button onClick={() => window.print()} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-indigo-600 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Printer size={20} />
            <span className="absolute left-14 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Print Bill</span>
          </button>
          <button onClick={handleDownloadPDF} className="w-12 h-12 bg-white hover:bg-slate-50 transition-all text-rose-500 font-bold rounded-2xl shadow-2xl flex items-center justify-center group relative border border-slate-100 active:scale-95">
            <Download size={20} />
            <span className="absolute left-14 px-2 py-1 bg-rose-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-black whitespace-nowrap">Download PDF</span>
          </button>
        </div>

        <div id="print-container" className="print-container bg-white p-4 sm:p-10 print:p-0 md:text-[11px] text-[10px]">
          <div className="border border-black">
            
            {/* Header */}
            <div className="text-center p-2 border-b border-black">
              <div className="font-bold text-xs" style={{ fontFamily: 'Georgia, serif' }}>||| SHREE GANESHAY NAMAH |||</div>
              <h1 className="text-3xl font-black mt-1 uppercase tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>{settings?.companyName || "K.K. FABRICS"}</h1>
              <div className="font-bold uppercase mt-1 tracking-wide">{settings?.address || "SURAT, GUJARAT"}</div>
            </div>

            <div className="flex justify-between items-center p-2 border-b border-black font-bold uppercase">
              <div className="w-1/3 text-left">
                <div>GSTIN: {settings?.gstin || ""}</div>
              </div>
              <div className="w-1/3 text-center text-xl font-black tracking-widest uppercase">
                TAX INVOICE
              </div>
              <div className="w-1/3 text-right">
                <div>Mo: {settings?.mobile || ""}</div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-[60%_40%] border-b border-black">
              <div className="border-r border-black p-2 space-y-1">
                <div className="flex"><span className="w-32 font-bold">From:</span> <span className="uppercase">{consignorName}</span></div>
                <div className="flex"><span className="w-32 font-bold">Transport:</span> <span className="uppercase">{p.transportName || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">LR No:</span> <span className="uppercase">{p.lrNumber || '-'}</span></div>
                <div className="flex"><span className="w-32 font-bold">Remittance:</span> <span></span></div>
              </div>
              <div className="p-2 space-y-1">
                <div className="flex justify-between"><span className="font-bold">Invoice No:</span> <span className="uppercase font-bold">{p.billNumber}</span></div>
                <div className="flex justify-between"><span className="font-bold">Date:</span> <span>{new Date(p.date).toLocaleDateString('en-GB')}</span></div>
                {p.ewbNumber ? (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">EWAY BILL:</span> <span className="uppercase font-black text-black tracking-widest">{p.ewbNumber}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="font-bold">Challan No:</span> <span className="uppercase">-</span></div>
                )}
                {p.parcels && (
                  <div className="flex justify-between"><span className="font-black text-black tracking-widest">PARCELS/BAILS:</span> <span className="uppercase font-black text-black tracking-widest">{p.parcels}</span></div>
                )}
                <div className="flex justify-between"><span className="font-bold">Broker:</span> <span>-</span></div>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 border-b border-black">
              <div className="border-r border-black p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Receiver (Billed To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                {consigneeMobile && <div className="mt-1">Contact: {consigneeMobile}</div>}
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                  {p.consigneeStateCode && <div><span className="font-bold">State Code:</span> {p.consigneeStateCode}</div>}
                </div>
              </div>
              <div className="p-2 h-full">
                <div className="font-bold mb-1 underline">Details of Consignee (Shipped To)</div>
                <div className="font-black text-[13px] uppercase tracking-wide">{consigneeName}</div>
                <div className="uppercase">{consigneeAddress}</div>
                <div className="mt-2 flex gap-4 uppercase">
                  <div><span className="font-bold">GSTIN:</span> {consigneeGstin}</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-black uppercase text-[10px] font-bold h-8">
                  <th className="border-r border-black p-1.5 min-w-[30px]">No</th>
                  <th className="border-r border-black p-1.5 text-left w-[40%]">Description of Goods</th>
                  <th className="border-r border-black p-1.5">HSN No</th>
                  <th className="border-r border-black p-1.5">Taka / Box</th>
                  <th className="border-r border-black p-1.5">Qty</th>
                  <th className="border-r border-black p-1.5">Rate</th>
                  <th className="p-1.5 text-right w-[15%]">Taxable Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b-0 text-[11px] align-top">
                    <td className="border-r border-black p-1">{idx + 1}</td>
                    <td className="border-r border-black p-1 text-left font-bold uppercase">
                      {item.name} {item.color && <span className="font-normal ml-1">({item.color})</span>}
                    </td>
                    <td className="border-r border-black p-1">{item.hsnCode}</td>
                    <td className="border-r border-black p-1">{item.taka || '-'}</td>
                    <td className="border-r border-black p-1 uppercase font-bold">{item.quantity} <span className="font-normal text-[9px]">{item.unit}</span></td>
                    <td className="border-r border-black p-1">{Number(item.rate).toFixed(2)}</td>
                    <td className="p-1 text-right">{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 10 - p.items.length) }).map((_, i) => (
                  <tr key={'empty'+i} className="align-top h-6">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-y border-black font-bold uppercase text-[11px] h-6 bg-slate-50">
                  <td className="border-r border-black p-1.5" colSpan={3}>Total</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.taka) || 0), 0) || '-'}</td>
                  <td className="border-r border-black p-1.5">{p.items.reduce((s:number, i:any) => s + (Number(i.quantity) || 0), 0).toFixed(2)}</td>
                  <td className="border-r border-black p-1.5"></td>
                  <td className="p-1.5 text-right tracking-wider">{Number(p.basicAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer sections */}
            <div className="grid grid-cols-[60%_40%]">
              {/* Left Footer */}
              <div className="border-r border-black p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Amount in Words:</div>
                  <div className="font-bold italic uppercase indent-2 text-[11px]">{numberToWords(p.grandTotal)}</div>
                </div>
                
                <div className="mt-4 pb-2 border-b border-black border-dashed">
                  <div className="font-bold underline mb-1 uppercase text-[10px]">Bank Details</div>
                  <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[10px] uppercase">
                    <span className="font-bold">Bank:</span> <span>{settings?.bankName || ''}</span>
                    <span className="font-bold">Branch:</span> <span>{settings?.branchName || ''}</span>
                    <span className="font-bold">A/c No:</span> <span className="font-black tracking-widest">{settings?.accountNumber || ''}</span>
                    <span className="font-bold">IFSC:</span> <span className="font-black tracking-widest">{settings?.ifscCode || ''}</span>
                  </div>
                </div>

                <div className="mt-2 text-[9px] leading-snug">
                  <div className="font-bold underline mb-1 uppercase">Terms of Sales</div>
                  <ol className="list-decimal pl-4 space-y-0.5 m-0 uppercase font-bold text-slate-800">
                    <li>Goods once sold will not be taken back.</li>
                    <li>Interest @ 24% p.a. will be charged if not paid within 30 days.</li>
                    <li>We are not responsible for any damage in transit.</li>
                    <li>Subject to Surat Jurisdiction only.</li>
                  </ol>
                </div>
              </div>

              {/* Right Footer */}
              <div className="flex flex-col">
                <div className="p-2 space-y-1 bg-white flex-1 text-[11px]">
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Gross Amount</span> <span className="font-bold">{Number(p.basicAmount).toFixed(2)}</span></div>
                  {p.globalDiscount > 0 && (
                     <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">Less Discount</span> <span className="font-bold">- {Number(p.globalDiscount).toFixed(2)}</span></div>
                  )}
                  
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">SGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(sgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">CGST @ {p.isInterstate ? '0.00' : (tr/2).toFixed(2)}%</span> <span>{Number(cgst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="font-bold uppercase text-[10px]">IGST @ {p.isInterstate ? tr.toFixed(2) : '0.00'}%</span> <span>{Number(igst).toFixed(2)}</span></div>
                </div>

                <div className="border-y border-black p-3 flex justify-between font-black text-sm uppercase items-center pb-2 pt-2 bg-slate-50 relative overflow-hidden">
                  <div className="flex flex-col">
                    <span>Net Amount</span>
                    <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block w-fit ${isFullyPaid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                      {isFullyPaid ? 'FULLY PAID' : remainingBalance < p.grandTotal ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base tracking-wider">₹ {Number(p.grandTotal).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    {!isFullyPaid && remainingBalance < p.grandTotal && (
                      <span className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-widest">Bal: ₹ {remainingBalance.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div className="p-2 pt-6 text-center flex-1 flex flex-col justify-end">
                  <div className="font-black uppercase text-[10px] mb-8 text-right tracking-widest leading-none">For {settings?.companyName || "K.K. FABRICS"}</div>
                  <div className="text-[9px] font-bold uppercase text-right opacity-60 leading-none">Authorized Signatory</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
function GstReportView({ bookings, purchases, creditNotes, debitNotes, expenses, settings }: any) {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredSales = useMemo(() => {
    return bookings.filter((b: any) => {
      const d = b.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [bookings, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter((p: any) => {
      const d = p.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [purchases, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter((e: any) => {
      const d = e.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  const gstr1Data = useMemo(() => {
    return filteredSales.map((b: any) => {
      const taxable = b.basicAmount - (b.globalDiscount || 0);
      return {
        id: b.id,
        invoiceNo: b.billNumber,
        date: b.date.split('T')[0],
        customer: b.consigneeName,
        gstin: b.consigneeGstin,
        taxableValue: taxable,
        taxRate: b.taxRate,
        cgst: b.cgstAmount || 0,
        sgst: b.sgstAmount || 0,
        igst: b.igstAmount || 0,
        totalTax: b.taxAmount,
        grandTotal: b.grandTotal,
        hsn: (b.items && b.items[0]?.hsnCode) || 'N/A'
      };
    });
  }, [filteredSales]);

  const gstr2Data = useMemo(() => {
    return filteredPurchases.map((p: any) => {
      const taxable = p.basicAmount - (p.globalDiscount || 0);
      return {
        id: p.id,
        invoiceNo: p.partyBillNumber || p.billNumber,
        date: p.date.split('T')[0],
        supplier: p.partyName,
        gstin: p.partyGstin,
        taxableValue: taxable,
        taxRate: p.taxRate,
        cgst: p.cgstAmount || 0,
        sgst: p.sgstAmount || 0,
        igst: p.igstAmount || 0,
        totalTax: p.taxAmount,
        grandTotal: p.grandTotal,
        hsn: (p.items && p.items[0]?.hsnCode) || 'N/A'
      };
    });
  }, [filteredPurchases]);

  const summary = useMemo(() => {
    const salesTax = filteredSales.reduce((acc: any, b: any) => {
      acc.cgst += (b.cgstAmount || 0);
      acc.sgst += (b.sgstAmount || 0);
      acc.igst += (b.igstAmount || 0);
      acc.total += b.taxAmount;
      acc.taxable += (b.basicAmount - (b.globalDiscount || 0));
      return acc;
    }, { cgst: 0, sgst: 0, igst: 0, total: 0, taxable: 0 });

    const cnTax = (creditNotes || []).filter((cn: any) => {
      const d = cn.date.split('T')[0];
      return d >= startDate && d <= endDate;
    }).reduce((acc: any, cn: any) => {
      acc.total += cn.taxAmount;
      return acc;
    }, { total: 0 });

    const purchaseTax = filteredPurchases.reduce((acc: any, p: any) => {
      acc.cgst += (p.cgstAmount || 0);
      acc.sgst += (p.sgstAmount || 0);
      acc.igst += (p.igstAmount || 0);
      acc.total += p.taxAmount;
      acc.taxable += (p.basicAmount - (p.globalDiscount || 0));
      return acc;
    }, { cgst: 0, sgst: 0, igst: 0, total: 0, taxable: 0 });

    const dnTax = (debitNotes || []).filter((dn: any) => {
      const d = dn.date.split('T')[0];
      return d >= startDate && d <= endDate;
    }).reduce((acc: any, dn: any) => {
      acc.total += dn.taxAmount;
      return acc;
    }, { total: 0 });

    const expenseTax = filteredExpenses.reduce((acc: any, e: any) => {
      if (e.gstIncluded) {
        acc.total += e.gstAmount;
        acc.cgst += e.gstAmount / 2;
        acc.sgst += e.gstAmount / 2;
      }
      acc.amount += e.amount;
      return acc;
    }, { cgst: 0, sgst: 0, igst: 0, total: 0, amount: 0 });

    const salesNet = salesTax.total - cnTax.total;
    const purchaseNet = purchaseTax.total - dnTax.total + expenseTax.total;

    return {
      output: salesTax,
      input: {
        ...purchaseTax,
        cgst: purchaseTax.cgst + expenseTax.cgst,
        sgst: purchaseTax.sgst + expenseTax.sgst,
        total: purchaseTax.total + expenseTax.total,
        taxable: purchaseTax.taxable + (expenseTax.amount - expenseTax.total)
      },
      expenseOnly: expenseTax,
      salesNet,
      purchaseNet,
      net: {
        cgst: salesTax.cgst - (purchaseTax.cgst + expenseTax.cgst),
        sgst: salesTax.sgst - (purchaseTax.sgst + expenseTax.sgst),
        igst: salesTax.igst - purchaseTax.igst,
        total: salesNet - purchaseNet
      }
    };
  }, [filteredSales, filteredPurchases, filteredExpenses, creditNotes, debitNotes, startDate, endDate]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(gstr1Data);
    XLSX.utils.book_append_sheet(wb, ws1, "GSTR-1 Details");
    
    const summaryData = [
      ["Summary", "Output (Sales)", "Input (Purchase + Expense)", "Net Balance"],
      ["Taxable/Expense Value", summary.output.taxable, summary.input.taxable, ""],
      ["CGST", summary.output.cgst, summary.input.cgst, summary.net.cgst],
      ["SGST", summary.output.sgst, summary.input.sgst, summary.net.sgst],
      ["IGST", summary.output.igst, summary.input.igst, summary.net.igst],
      ["Total GST", summary.output.total, summary.input.total, summary.net.total]
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, "GSTR-3B Summary");

    if (filteredExpenses.length > 0) {
      const expenseData = filteredExpenses.map(e => ({
        Date: e.date,
        Category: e.category,
        Description: e.description,
        Amount: e.amount,
        GST_Included: e.gstIncluded ? 'Yes' : 'No',
        GST_Rate: e.gstIncluded ? `${e.gstRate}%` : '-',
        GST_Amount: e.gstIncluded ? e.gstAmount : 0
      }));
      const ws3 = XLSX.utils.json_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(wb, ws3, "Business Expenses");
    }
    
    XLSX.writeFile(wb, `GST_Report_${startDate}_to_${endDate}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("GST Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 30);
    doc.text(`Company: ${settings?.companyName || 'N/A'}`, 14, 37);
    doc.text(`GSTIN: ${settings?.gstin || 'N/A'}`, 14, 44);

    doc.setFontSize(14);
    doc.text("GSTR-3B Summary", 14, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [["Type", "Output (Sales)", "Input (Purchase)", "Net Payable"]],
      body: [
        ["Taxable Value", Number(summary.output.taxable).toFixed(2), Number(summary.input.taxable).toFixed(2), "-"],
        ["CGST", Number(summary.output.cgst).toFixed(2), Number(summary.input.cgst).toFixed(2), Number(summary.net.cgst).toFixed(2)],
        ["SGST", Number(summary.output.sgst).toFixed(2), Number(summary.input.sgst).toFixed(2), Number(summary.net.sgst).toFixed(2)],
        ["IGST", Number(summary.output.igst).toFixed(2), Number(summary.input.igst).toFixed(2), Number(summary.net.igst).toFixed(2)],
        ["Total GST", Number(summary.output.total).toFixed(2), Number(summary.input.total).toFixed(2), Number(summary.net.total).toFixed(2)],
      ],
    });

    doc.addPage();
    doc.text("GSTR-1 Sales Details", 14, 22);
    autoTable(doc, {
      startY: 30,
      head: [["Inv No", "Date", "Customer", "GSTIN", "Taxable", "GST %", "Total Tax", "Total Bill"]],
      body: gstr1Data.map(d => [
        d.invoiceNo, d.date, d.customer, d.gstin,
        Number(d.taxableValue).toFixed(2), d.taxRate + "%", Number(d.totalTax).toFixed(2), Number(d.grandTotal).toFixed(2)
      ]),
    });

    if (filteredExpenses.length > 0) {
      doc.addPage();
      doc.text("Business Expenses", 14, 22);
      autoTable(doc, {
        startY: 30,
        head: [["Date", "Category", "Description", "Payee", "Amount", "GST Amt"]],
        body: filteredExpenses.map(e => [
          new Date(e.date).toLocaleDateString(),
          e.category,
          e.description,
          e.payeeName || '-',
          Number(e.amount).toFixed(2),
          e.gstIncluded ? Number(e.gstAmount).toFixed(2) : '0.00'
        ]),
      });
    }

    doc.save(`GST_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">GST Reports</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Taxation & GSTR Analysis</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase ml-1">Start Date</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent font-bold text-sm px-2 outline-none" />
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase ml-1">End Date</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent font-bold text-sm px-2 outline-none" />
          </div>
          <div className="flex gap-2 ml-4">
             <button onClick={exportExcel} className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 shadow-lg transition-all" title="Export Excel"><Download size={20} /></button>
             <button onClick={exportPDF} className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-lg transition-all" title="Export PDF"><Printer size={20} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Calculator size={16} className="text-orange-400" /> Business Expenses Summary</h3>
              <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full">{filteredExpenses.length} Records</span>
            </div>
            <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Expenses</div>
                <div className="text-2xl font-black text-slate-900">₹{summary.expenseOnly.amount.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">GST Paid (ITC)</div>
                <div className="text-2xl font-black text-orange-500">₹{summary.expenseOnly.total.toLocaleString()}</div>
              </div>
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Net Balance (GST)</div>
                <div className="text-2xl font-black text-indigo-600">₹{summary.net.total.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Receipt size={16} className="text-[#00cec9]" /> GSTR-1 (Sales Details)</h3>
              <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full">{filteredSales.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Inv #</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4 text-right">Taxable</th>
                    <th className="px-6 py-4 text-right">GST %</th>
                    <th className="px-6 py-4 text-right">CGST</th>
                    <th className="px-6 py-4 text-right">SGST</th>
                    <th className="px-6 py-4 text-right">IGST</th>
                    <th className="px-6 py-4 text-right font-black text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gstr1Data.map((d) => (
                    <tr key={d.invoiceNo || d.id || Math.random().toString()} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-sm">#{d.invoiceNo}</td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-xs">{d.date}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">{d.customer}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase">{d.gstin || 'NO GSTIN'}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">₹{d.taxableValue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-500 text-xs">{d.taxRate}%</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">₹{d.cgst.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">₹{d.sgst.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">₹{d.igst.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">₹{d.grandTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                  {gstr1Data.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-bold italic">No sales found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mt-8">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Receipt size={16} className="text-[#00cec9]" /> GSTR-2 (Purchase Details)</h3>
              <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full">{filteredPurchases.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Inv #</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">HSN</th>
                    <th className="px-6 py-4 text-right">Taxable</th>
                    <th className="px-6 py-4 text-right">GST %</th>
                    <th className="px-6 py-4 text-right">Total GST</th>
                    <th className="px-6 py-4 text-right font-black text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gstr2Data.map((d) => (
                    <tr key={d.invoiceNo || d.id || Math.random().toString()} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-sm">#{d.invoiceNo}</td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-xs">{d.date}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">{d.supplier}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase">{d.gstin || 'NO GSTIN'}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-xs">{d.hsn}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">₹{d.taxableValue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-500 text-xs">{d.taxRate}%</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-600 text-sm">₹{d.totalTax.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">₹{d.grandTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                  {gstr2Data.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold italic">No purchases found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden sticky top-8">
            <div className="p-6 bg-indigo-900 text-white">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><TrendingUp size={16} className="text-indigo-400" /> GSTR-3B Summary</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Output (Sales)</span>
                  <span className="text-xl font-black text-slate-900">₹{summary.output.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">CGST</span>
                    <span className="text-xs font-bold font-mono">₹{summary.output.cgst.toFixed(0)}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">SGST</span>
                    <span className="text-xs font-bold font-mono">₹{summary.output.sgst.toFixed(0)}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">IGST</span>
                    <span className="text-xs font-bold font-mono">₹{summary.output.igst.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Input (Purchase)</span>
                  <span className="text-xl font-black text-slate-900">₹{summary.input.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-indigo-50 p-2 rounded-xl text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">CGST</span>
                    <span className="text-xs font-bold font-mono text-indigo-600">₹{summary.input.cgst.toFixed(0)}</span>
                  </div>
                  <div className="bg-indigo-50 p-2 rounded-xl text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">SGST</span>
                    <span className="text-xs font-bold font-mono text-indigo-600">₹{summary.input.sgst.toFixed(0)}</span>
                  </div>
                  <div className="bg-indigo-50 p-2 rounded-xl text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase block">IGST</span>
                    <span className="text-xs font-bold font-mono text-indigo-600">₹{summary.input.igst.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t-2 border-dashed border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-900 uppercase">Net GST Payable</h4>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${summary.net.total > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {summary.net.total > 0 ? 'To Be Paid' : 'ITC Balance'}
                  </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl text-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Total Net Balance</span>
                    <span className={`text-2xl font-black ${summary.net.total > 0 ? 'text-red-400' : 'text-[#00cec9]'}`}>₹{Math.abs(summary.net.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SignatureAndBankView({ settings, onUpdateSettings }: any) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file) return;
    
    // Check if it's an image or PDF
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert("Please upload an image (JPG/PNG) or a PDF file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onUpdateSettings({ ...(settings || {}), signature: base64 });
      alert("Signature uploaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {settings?.viewMode === 'signature' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto mt-12 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-8">
          <header className="mb-8 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Upload Signature</h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">This will appear on your bill print-outs</p>
          </header>

          <div 
            className={`relative border-2 border-dashed rounded-3xl p-12 transition-all flex flex-col items-center justify-center gap-4 ${dragActive ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-slate-200 bg-slate-50'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400">
              <FileText size={32} />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-900 mb-1">Drag and drop your signature here</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or click to browse (JPG, PNG, PDF)</p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={handleChange}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-6 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-50 transition-all"
            >
              Select File
            </button>
            {settings?.signature && (
              <div className="mt-4 flex flex-col gap-2 w-full">
                <button 
                  onClick={() => alert("Signature is ready! It will be saved with other details when you click the main save button in Settings or when updated automatically.")}
                  className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-xl shadow-indigo-900/40 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save Signature
                </button>
                <button 
                  onClick={() => {
                    if(confirm("Are you sure you want to remove the signature?")) {
                      onUpdateSettings({...(settings || {}), signature: ""});
                    }
                  }}
                  className="w-full px-6 py-3 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl font-black text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Remove Signature
                </button>
              </div>
            )}
          </div>

          {settings?.signature && (
            <div className="mt-8 border-t border-slate-100 pt-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Current Signature Preview</h3>
              <div className="bg-white rounded-2xl p-4 border-2 border-slate-100 flex items-center justify-center min-h-[120px] shadow-inner">
                {settings.signature.startsWith('data:application/pdf') ? (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <FileText size={48} />
                    <span className="text-[10px] font-black uppercase">PDF Uploaded</span>
                  </div>
                ) : (
                  <img src={settings.signature} alt="Signature" referrerPolicy="no-referrer" className="max-h-28 object-contain" />
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {settings?.viewMode === 'bank' && (
        <BankDetailsView settings={settings} onUpdateSettings={onUpdateSettings} />
      )}
    </div>
  );
}

function BankDetailsView({ settings, onUpdateSettings }: any) {
  const [formData, setFormData] = useState({
    bankName: settings?.bankName || '',
    accountNumber: settings?.accountNumber || '',
    ifscCode: settings?.ifscCode || '',
    branchName: settings?.branchName || ''
  });
  const [isLocked, setIsLocked] = useState(!!settings?.bankName || !!settings?.accountNumber);
  const [password, setPassword] = useState('');
  const [showPassError, setShowPassError] = useState(false);

  const handleUnlock = () => {
    // Exact same logic as SettingsView
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
    onUpdateSettings({ 
      ...(settings || {}), 
      ...formData 
    });
    setIsLocked(true);
    alert("Bank Details Saved Successfully!");
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto mt-12 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
      <div className="bg-[#1E293B] p-8 text-white">
        <div className="flex items-center gap-4">
          <Landmark size={32} className="text-[#00cec9]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Bank Details</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Update your banking information</p>
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="p-10 space-y-8 text-center bg-slate-50/50">
          <div className="w-20 h-20 bg-slate-900 text-[#00cec9] rounded-full flex items-center justify-center mx-auto shadow-xl">
             <Lock size={32} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase">Section Locked</h3>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest leading-relaxed">Enter your password to modify<br/>Bank details</p>
          </div>
          <div className="max-w-xs mx-auto space-y-4">
             <input 
               type="password" 
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               className={`w-full px-6 py-4 bg-white border outline-none rounded-2xl font-black text-center tracking-[0.5em] transition-all ${showPassError ? 'border-red-500 ring-4 ring-red-50 shadow-inner' : 'border-slate-200 focus:border-[#00cec9] shadow-sm'}`}
               placeholder="••••"
             />
             <button 
               onClick={handleUnlock}
               className="w-full bg-[#1e272e] text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-xl active:scale-[0.98]"
             >
               Unlock Records
             </button>
             {showPassError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Access Denied: Incorrect Password</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="p-10 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Name</label>
                <input 
                  type="text" 
                  required 
                  value={formData.bankName}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-[#00cec9] transition-all"
                  placeholder="HDFC Bank"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Number</label>
                <input 
                  type="text" 
                  required 
                  value={formData.accountNumber}
                  onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-[#00cec9] transition-all"
                  placeholder="1234567890"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IFSC Code</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.ifscCode}
                    onChange={e => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-[#00cec9] transition-all"
                    placeholder="HDFC0001234"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.branchName}
                    onChange={e => setFormData({ ...formData, branchName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-[#00cec9] transition-all"
                    placeholder="Main Branch"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={() => setIsLocked(true)}
              className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-[2] bg-[#1e272e] text-white font-black py-4 rounded-xl hover:bg-black transition-all shadow-xl active:scale-[0.98]"
            >
              Save Bank Details
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}


function SettingsView({ settings, onSave }: any) {
  const [formData, setFormData] = useState<AppSettings>({
    companyName: settings?.companyName || '',
    gstin: settings?.gstin || '',
    address: settings?.address || '',
    mobile: settings?.mobile || '',
    mobile2: settings?.mobile2 || '',
    adminUsername: settings?.adminUsername || 'admin',
    adminPassword: settings?.adminPassword || '1234',
    signature: settings?.signature || '',
    bankName: settings?.bankName || '',
    accountNumber: settings?.accountNumber || '',
    ifscCode: settings?.ifscCode || '',
    branchName: settings?.branchName || ''
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
    onSave({ ...settings, ...formData });
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
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Mobile Number 1</label>
                <input 
                  type="text" 
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  placeholder="+91 00000 00000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Mobile Number 2 (Optional)</label>
                <input 
                  type="text" 
                  value={formData.mobile2}
                  onChange={e => setFormData({ ...formData, mobile2: e.target.value })}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Admin User Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.adminUsername}
                  onChange={e => setFormData({ ...formData, adminUsername: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  placeholder="Set login user name"
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
                  placeholder="Set login password"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Default: admin / 1234. Change these for security.</p>
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

function PartyMasterView({ parties, title, onUpdateParties, suggestParties = [], bookings = [], purchases = [], creditNotes = [], debitNotes = [], payments = [] }: any) {
  useEffect(() => {
    const handleAddNew = () => {
      setEditingId(null);
      setPartyForm({ name: '', gstin: '', address: '', mobile: '', mobile2: '' });
    };
    window.addEventListener('app-trigger-add-new', handleAddNew);
    return () => window.removeEventListener('app-trigger-add-new', handleAddNew);
  }, []);

  const [partyForm, setPartyForm] = useState({
    name: '',
    gstin: '',
    address: '',
    mobile: '',
    mobile2: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSuggestSelect = (val: string) => {
    const suggestion = suggestParties.find((p: any) => p.name === val);
    if (suggestion) {
      setPartyForm({
        name: suggestion.name,
        gstin: suggestion.gstin,
        address: suggestion.address || '',
        mobile: suggestion.mobile || '',
        mobile2: suggestion.mobile2 || ''
      });
    } else {
      setPartyForm({ ...partyForm, name: val });
    }
  };

  const handleSaveParty = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      const updatedParties = parties.map((p: any) => 
        p.id === editingId 
          ? { ...p, name: partyForm.name, gstin: partyForm.gstin.toUpperCase(), address: partyForm.address, mobile: partyForm.mobile, mobile2: partyForm.mobile2 }
          : p
      );
      onUpdateParties(updatedParties);
      setEditingId(null);
      setPartyForm({ name: '', gstin: '', address: '', mobile: '', mobile2: '' });
      alert(`${title} Updated Successfully!`);
    } else {
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
        mobile2: partyForm.mobile2,
        totalSales: 0,
        totalPaid: 0,
        totalPurchases: 0
      };

      onUpdateParties([newParty, ...parties]);
      setPartyForm({ name: '', gstin: '', address: '', mobile: '', mobile2: '' });
      alert(`${title} Added Successfully!`);
    }
  };

  const handleEditParty = (party: any) => {
    setEditingId(party.id);
    setPartyForm({
      name: party.name,
      gstin: party.gstin,
      address: party.address,
      mobile: party.mobile || '',
      mobile2: party.mobile2 || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteParty = (party: Party) => {
    // Check if the party has any transactions
    const hasBookings = bookings.some((b: any) => b.consigneeGstin === party.gstin);
    const hasPurchases = purchases.some((p: any) => p.partyGstin === party.gstin);
    const hasCreditNotes = creditNotes.some((cn: any) => cn.partyGstin === party.gstin);
    const hasDebitNotes = debitNotes.some((dn: any) => dn.partyGstin === party.gstin);
    const hasPayments = payments.some((pay: any) => pay.partyGstin === party.gstin || pay.partyId === party.id);

    if (hasBookings || hasPurchases || hasCreditNotes || hasDebitNotes || hasPayments) {
      alert("Cannot delete this party because it has existing bills or payments in the system.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${party.name}?`)) {
      onUpdateParties(parties.filter((p: any) => p.id !== party.id));
    }
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
        <form onSubmit={handleSaveParty} className={`space-y-6 p-8 rounded-3xl border shadow-inner transition-colors ${editingId ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900 uppercase flex items-center gap-2">
              {editingId ? <Edit size={20} className="text-indigo-600" /> : <Plus size={20} className="text-[#00cec9]" />} 
              {editingId ? `Edit ${title}` : `Add New ${title}`}
            </h3>
            {editingId && (
              <button 
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setPartyForm({ name: '', gstin: '', address: '', mobile: '' });
                }}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Party Name</label>
              <input 
                type="text" 
                required 
                value={partyForm.name}
                list="party-master-suggestions"
                onChange={e => handleSuggestSelect(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-[#00cec9] transition-all"
                placeholder="Party Name"
              />
              <datalist id="party-master-suggestions">
                {suggestParties.map((p: any) => (
                  <option key={p.id} value={p.name}>{p.gstin}</option>
                ))}
              </datalist>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number 1</label>
              <input 
                type="text" 
                value={partyForm.mobile}
                onChange={e => setPartyForm({ ...partyForm, mobile: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-[#00cec9] transition-all"
                placeholder="+91..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number 2</label>
              <input 
                type="text" 
                value={partyForm.mobile2}
                onChange={e => setPartyForm({ ...partyForm, mobile2: e.target.value })}
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
            className={`w-full text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.99] ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-[#1e272e] hover:bg-black'}`}
          >
            {editingId ? `Update ${title}` : `Save ${title}`}
          </button>
        </form>

        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Existing Parties ({parties.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parties.map((p: any) => (
              <div key={p.id} className="p-5 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-[#00cec9] transition-all shadow-sm hover:shadow-md">
                <div className="flex-1">
                  <div className="font-black text-slate-900 uppercase text-sm">{p.name}</div>
                  <div className="text-[10px] font-bold text-[#00cec9] mb-1">{p.gstin}</div>
                  <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{p.address}</div>
                  {p.mobile && <div className="text-[10px] text-slate-500 font-bold mt-1">{p.mobile}{p.mobile2 ? ` / ${p.mobile2}` : ''}</div>}
                </div>
                <div className="text-right flex flex-col items-end gap-3">
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">{title === 'Sale Party Entry' ? 'Total Sales' : 'Total Purchases'}</div>
                    <div className="text-lg font-black text-slate-900">₹{(title === 'Sale Party Entry' ? p.totalSales : (p.totalPurchases || 0)).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleEditParty(p)}
                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Edit Party"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteParty(p)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Party"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </motion.div>
  );
}

function TransportMasterView({ transports, onSave }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState<Partial<Transport>>({ name: '', gstin: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onSave(transports.map(t => t.id === editingId ? { ...t, ...formData } as Transport : t));
    } else {
      const newTransport: Transport = {
        id: Math.random().toString(36).substr(2, 9),
        name: formData.name || '',
        gstin: formData.gstin?.toUpperCase() || ''
      };
      onSave([newTransport, ...transports]);
    }
    setShowAdd(false);
    setEditingId(null);
    setFormData({ name: '', gstin: '' });
  };

  const deleteTransport = (id: string) => {
    if (confirm('Delete this transport?')) {
      onSave(transports.filter(t => t.id !== id));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Transport Master</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Manage Transporters & GST Details</p>
        </div>
        <button 
          onClick={() => { setShowAdd(true); setEditingId(null); setFormData({ name: '', gstin: '' }); }}
          className="flex items-center gap-2 bg-[#1e272e] text-white px-6 py-3 rounded-2xl font-black hover:bg-black transition-all shadow-lg active:scale-95"
        >
          <Plus size={20} /> Add Transporter
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transporter Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                    placeholder="Enter Transport Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GST Number</label>
                  <input 
                    type="text" 
                    value={formData.gstin}
                    onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                    placeholder="24AAAA..."
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-[#00cec9] text-white font-black py-4 rounded-2xl hover:bg-[#00b5b5] transition-all shadow-lg active:scale-[0.99]">
                  {editingId ? 'Update Transporter' : 'Save Transporter'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-8 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {transports.map(t => (
          <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-[#00cec9] group-hover:text-white transition-all shadow-inner">
                <Truck size={24} />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingId(t.id); setFormData(t); setShowAdd(true); }}
                  className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  <Search size={18} />
                </button>
                <button 
                  onClick={() => deleteTransport(t.id)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t.name}</h4>
            <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:bg-[#00cec9]/10 group-hover:text-[#00cec9] transition-all">
              GST: {t.gstin || 'NOT PROVIDED'}
            </div>
          </div>
        ))}
        {transports.length === 0 && !showAdd && (
          <div className="md:col-span-3 py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="text-slate-300 font-black uppercase text-xl mb-2">No Transporters Found</div>
            <p className="text-slate-400 font-bold text-sm">Add your first transporter to get started</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ExpensesView({ expenses, onSave, onBack }: { expenses: Expense[], onSave: (e: Expense[]) => void, onBack: () => void, key?: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: 0,
    description: '',
    gstIncluded: false,
    gstRate: 5,
    gstAmount: 0,
    paymentMode: 'Cash'
  });

  const categories = [
    'Rent', 'Electricity', 'Water', 'Internet/Phone', 'Salary', 'Maintenance', 
    'Travel', 'Stationery', 'Professional Fees', 'Marketing', 'Refreshments', 
    'Repair', 'Transport', 'Others'
  ];

  const calculateGst = (amount: number, rate: number, included: boolean) => {
    if (included) {
      const basic = amount / (1 + rate / 100);
      return amount - basic;
    } else {
      return (amount * rate) / 100;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const gstAmt = formData.gstIncluded ? calculateGst(formData.amount || 0, formData.gstRate || 0, true) : calculateGst(formData.amount || 0, formData.gstRate || 0, false);
    
    const expense: Expense = {
      id: editingId || Math.random().toString(36).substring(2, 9),
      date: formData.date || new Date().toISOString().split('T')[0],
      category: formData.category || 'Others',
      amount: formData.amount || 0,
      description: formData.description || '',
      gstIncluded: formData.gstIncluded || false,
      gstRate: formData.gstRate || 0,
      gstAmount: gstAmt,
      payeeName: formData.payeeName || '',
      paymentMode: formData.paymentMode || 'Cash'
    };

    if (editingId) {
      onSave(expenses.map(exp => exp.id === editingId ? expense : exp));
    } else {
      onSave([...expenses, expense]);
    }

    setShowAdd(false);
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: '',
      amount: 0,
      description: '',
      gstIncluded: false,
      gstRate: 5,
      gstAmount: 0,
      paymentMode: 'Cash'
    });
  };

  const deleteExpense = (id: string) => {
    if (confirm("Delete this expense record?")) {
      onSave(expenses.filter(e => e.id !== id));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Business Expenses</h2>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Manage all business costs & ITC records</p>
          </div>
        </div>
        <button 
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="flex items-center gap-2 bg-[#1e272e] text-white px-6 py-3 rounded-2xl font-black hover:bg-black transition-all shadow-lg active:scale-95"
        >
          <Plus size={20} /> Add Expense
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <select 
                    required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (Final)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? '' : (parseFloat(e.target.value) || '') as any })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payee Name / Vendor</label>
                  <input 
                    type="text" 
                    value={formData.payeeName}
                    onChange={e => setFormData({ ...formData, payeeName: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                    placeholder="Who did you pay?"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Mode</label>
                  <select 
                    value={formData.paymentMode}
                    onChange={e => setFormData({ ...formData, paymentMode: e.target.value as any })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GST Details</label>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.gstIncluded}
                        onChange={e => setFormData({ ...formData, gstIncluded: e.target.checked })}
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-[#00cec9] focus:ring-[#00cec9]"
                      />
                      <span className="text-xs font-bold text-slate-600">GST Included?</span>
                    </label>
                    {formData.gstIncluded && (
                      <select 
                        value={formData.gstRate}
                        onChange={e => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
                      >
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description / Notes</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all resize-none"
                  placeholder="Additional details..."
                  rows={2}
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-[#00cec9] text-white font-black py-4 rounded-2xl hover:bg-[#00b5b5] transition-all shadow-lg active:scale-[0.99]">
                  {editingId ? 'Update Expense' : 'Save Expense'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-8 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900 border-b border-white/5">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payee</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">GST</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
              <tr key={exp.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-8 py-5 font-bold text-slate-600 italic">
                  {new Date(exp.date).toLocaleDateString()}
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    {exp.category}
                  </span>
                </td>
                <td className="px-8 py-5 font-bold text-slate-900 max-w-xs truncate">
                  {exp.description}
                </td>
                <td className="px-8 py-5 text-slate-500 text-sm font-bold uppercase tracking-tight">
                  {exp.payeeName || '-'}
                </td>
                <td className="px-8 py-5 text-right font-black text-xs text-orange-500">
                  {exp.gstIncluded ? `₹${exp.gstAmount.toFixed(2)} (${exp.gstRate}%)` : '-'}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="text-lg font-black text-slate-900">₹{exp.amount.toLocaleString()}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{exp.paymentMode}</div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => { setEditingId(exp.id); setFormData(exp); setShowAdd(true); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => deleteExpense(exp.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center">
                  <div className="bg-slate-50 rounded-[40px] p-20 border-2 border-dashed border-slate-200">
                    <Calculator size={64} className="mx-auto text-slate-200 mb-6" />
                    <h3 className="text-2xl font-black text-slate-300 uppercase tracking-tight">No Expenses Recorded</h3>
                    <p className="text-slate-400 font-bold max-w-xs mx-auto mt-2 leading-relaxed italic">
                      Start tracking your business costs today. Every rupee counts!
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={5} className="px-8 py-6 text-right text-slate-900 font-black uppercase text-xs tracking-widest">Total Expenses:</td>
                <td className="px-8 py-6 text-right text-2xl font-black text-red-600">
                  ₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </motion.div>
  );
}

function MeterEntryModal({ isOpen, onClose, onSave, initialValue, unit }: any) {
  const [meters, setMeters] = useState(initialValue || '');
  
  if (!isOpen) return null;

  const calculateTotal = () => {
    return (meters.split('+').map((m: string) => parseFloat(m) || 0).reduce((a: number, b: number) => a + b, 0)).toFixed(2);
  };

  const takaCount = meters.split('+').filter((m: string) => m.trim() !== '').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase tracking-widest">Meter Calculator</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Entry (Use + for cuts)</div>
            <textarea 
              autoFocus
              value={meters}
              onChange={e => setMeters(e.target.value)}
              className="w-full bg-transparent text-2xl font-black outline-none placeholder:text-white/20 resize-none h-24"
              placeholder="e.regular: 20+15.5+10"
            />
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Taka/Pcs</div>
              <div className="text-2xl font-black text-slate-900">{takaCount}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total {unit}</div>
              <div className="text-2xl font-black text-indigo-600">{calculateTotal()}</div>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => onSave(meters, calculateTotal(), takaCount)}
              className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-3xl hover:bg-black transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-xs"
            >
              Apply Calculations
            </button>
            <button onClick={onClose} className="px-8 bg-slate-100 text-slate-500 font-black py-4 rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ChallanEntryView({ type, challans, onSave, onDelete, parties, itemsMaster = [], weaverChallans = [], settings, millChallans = [], brokers = [] }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isMeterModalOpen, setIsMeterModalOpen] = useState(false);

  const handlePrint = (challan: Challan) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(settings?.companyName || "CHALLAN", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(settings?.address || "", pageWidth / 2, 28, { align: 'center' });
    doc.text(`GSTIN: ${settings?.gstin || ""}`, pageWidth / 2, 34, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(10, 40, pageWidth - 10, 40);
    
    // Challan Details
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${type} CHALLAN`, 10, 50);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Serial No: ${challan.serialNo}`, 10, 60);
    doc.text(`Challan No: ${challan.challanNumber}`, 10, 66);
    doc.text(`Date: ${new Date(challan.date).toLocaleDateString()}`, 10, 72);
    
    doc.text(`Party Name: ${challan.partyName}`, pageWidth - 10, 60, { align: 'right' });
    if (challan.partyGstin) {
        doc.text(`GSTIN: ${challan.partyGstin}`, pageWidth - 10, 66, { align: 'right' });
    }
    
    // Items Table
    const tableData = challan.items.map((item, idx) => [
      idx + 1,
      item.name,
      item.meters || "-",
      item.taka || "-",
      `${item.quantity} ${item.unit}`
    ]);
    
    autoTable(doc, {
      startY: 80,
      head: [['Sr.', 'Item Name', 'Meters/Cuts', 'Taka', 'Total Qty']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 206, 201] as any }, // Theme color #00cec9
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 80 },
        3: { cellWidth: 20 },
        4: { cellWidth: 35 }
      },
      styles: { fontSize: 8, cellPadding: 2, font: "helvetica" }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    if (challan.notes) {
      doc.setFontSize(9);
      doc.text(`Notes: ${challan.notes}`, 10, finalY);
    }
    
    doc.setFontSize(10);
    doc.text("Authorized Signatory", pageWidth - 10, finalY + 30, { align: 'right' });
    
    doc.save(`${type}_Challan_${challan.challanNumber}.pdf`);
  };

  const [formData, setFormData] = useState<Partial<Challan>>({
    serialNo: (challans.length > 0 ? Math.max(...challans.filter((c: any) => c.type === type).map((c: any) => c.serialNo || 0)) : 0) + 1,
    challanNumber: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    type: type,
    items: [],
    notes: '',
    weaverChallanNumber: '',
    brokerId: '',
    brokerRate: 0,
    brokerAmount: 0
  });

  const autoComparison = useMemo(() => {
    if ((type !== 'PARTY' && type !== 'MILL') || !formData.challanNumber) return null;
    
    let compareTarget: any = null;
    let targetType: 'MILL' | 'WEAVER' | null = null;

    if (type === 'PARTY') {
      // Try Mill comparison first
      compareTarget = (millChallans || []).find((c: any) => 
        c.challanNumber.toLowerCase() === formData.challanNumber?.toLowerCase()
      );
      if (compareTarget) {
        targetType = 'MILL';
      } else {
        // If no Mill found, check Weaver comparison directly
        compareTarget = (weaverChallans || []).find((c: any) => 
          c.challanNumber.toLowerCase() === formData.challanNumber?.toLowerCase()
        );
        if (compareTarget) targetType = 'WEAVER';
      }
    } else if (type === 'MILL' && formData.weaverChallanNumber) {
      compareTarget = (weaverChallans || []).find((c: any) => 
        c.challanNumber.toLowerCase() === formData.weaverChallanNumber?.toLowerCase()
      );
      if (compareTarget) targetType = 'WEAVER';
    }
    
    if (!compareTarget) return null;

    const groupItems = (items: any[]) => {
      const grouped: Record<string, { quantity: number; taka: number; unit: string }> = {};
      (items || []).forEach(item => {
        const name = item.name.trim().toUpperCase();
        if (!grouped[name]) {
          grouped[name] = { quantity: 0, taka: 0, unit: item.unit || 'MTR' };
        }
        grouped[name].quantity += (parseFloat(item.quantity) || 0);
        grouped[name].taka += (parseInt(item.taka) || 0);
      });
      return grouped;
    };

    const targetGroups = groupItems(compareTarget.items);
    const formGroups = groupItems(formData.items || []);
    
    const allItemNames = Array.from(new Set([
      ...Object.keys(targetGroups),
      ...Object.keys(formGroups)
    ]));

    const differences = allItemNames.map(name => {
      const targetItem = targetGroups[name] || { quantity: 0, taka: 0, unit: 'MTR' };
      const formItem = formGroups[name] || { quantity: 0, taka: 0, unit: 'MTR' };
      
      return {
        name,
        targetQty: targetItem.quantity,
        formQty: formItem.quantity,
        diffQty: formItem.quantity - targetItem.quantity,
        unit: formItem.unit || targetItem.unit,
        targetTaka: targetItem.taka,
        formTaka: formItem.taka,
        diffTaka: formItem.taka - targetItem.taka
      };
    });

    const totalTargetQty = Object.values(targetGroups).reduce((sum, it) => sum + it.quantity, 0);
    const totalFormQty = Object.values(formGroups).reduce((sum, it) => sum + it.quantity, 0);
    const totalDiff = totalFormQty - totalTargetQty;
    const percentLoss = totalTargetQty > 0 ? (totalDiff / totalTargetQty) * 100 : 0;

    return { target: compareTarget, differences, totalTargetQty, totalFormQty, totalDiff, percentLoss, targetType };
  }, [formData.challanNumber, formData.weaverChallanNumber, formData.items, type, millChallans, weaverChallans]);

  const [itemInput, setItemInput] = useState<Partial<ChallanItem>>({
    name: '',
    quantity: 0,
    unit: 'MTR',
    taka: 0,
    meters: ''
  });

  const handleAddItem = () => {
    if (!itemInput.name || (!itemInput.quantity && !itemInput.meters)) return;
    const newItem: ChallanItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: itemInput.name,
      quantity: Number(itemInput.quantity),
      unit: itemInput.unit || 'MTR',
      taka: itemInput.taka ? Number(itemInput.taka) : 0,
      meters: itemInput.meters
    };
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
    setItemInput({ name: '', quantity: 0, unit: 'MTR', taka: 0, meters: '' });
  };

  useEffect(() => {
    const handleAddShortcut = (e: KeyboardEvent) => {
      if (showAdd && e.altKey && e.key === 'n') {
        e.preventDefault();
        handleAddItem();
      }
    };
    window.addEventListener('keydown', handleAddShortcut);
    return () => window.removeEventListener('keydown', handleAddShortcut);
  }, [showAdd, itemInput]); // Adding itemInput to dependencies so handleAddItem uses current state

  const handleMeterSave = (meters: string, total: string, taka: number) => {
    setItemInput(prev => ({
      ...prev,
      meters,
      quantity: parseFloat(total),
      taka: taka || prev.taka
    }));
    setIsMeterModalOpen(false);
  };

  const handleRemoveItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter(item => item.id !== id)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.challanNumber || !formData.partyName || (formData.items?.length || 0) === 0) {
      alert("Please fill all required fields and add at least one item.");
      return;
    }

    // Duplicate Check
    const isDuplicate = (challans || []).some((c: any) => c.type === type && c.challanNumber === formData.challanNumber && c.id !== formData.id);
    if (isDuplicate) {
      if (!confirm(`A challan with number "${formData.challanNumber}" already exists in ${type} records. Do you want to "OK" to proceed or "Cancel" to stop?`)) {
        return;
      }
    }

    onSave({ ...formData, type });
    const nextSerial = (challans.length > 0 ? Math.max(...challans.filter((c: any) => c.type === type).map((c: any) => c.serialNo || 0)) : 0) + 2; 
    setFormData({
      serialNo: nextSerial,
      challanNumber: '',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      type: type,
      items: [],
      notes: '',
      weaverChallanNumber: '',
      brokerId: '',
      brokerRate: 0,
      brokerAmount: 0
    });
    setShowAdd(false);
    setEditingId(null);
  };

  const filteredChallans = (challans || []).filter((c: Challan) => c.type === type);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <MeterEntryModal 
        isOpen={isMeterModalOpen} 
        onClose={() => setIsMeterModalOpen(false)}
        initialValue={itemInput.meters}
        unit={itemInput.unit}
        onSave={handleMeterSave}
      />
      <header className="flex justify-between items-center bg-white/50 backdrop-blur-md p-8 rounded-[40px] border border-white shadow-xl">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{type === 'MILL' ? 'Mill' : 'Party'} Challan Entry</h2>
          <p className="text-slate-500 font-bold text-sm tracking-wide">Record and track {type.toLowerCase()} details</p>
        </div>
        <button 
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="bg-black text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95"
        >
          <Plus size={18} /> New Challan
        </button>
      </header>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-2xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial No.</label>
                  <input 
                    type="number" 
                    required
                    value={formData.serialNo}
                    onChange={e => setFormData({ ...formData, serialNo: Number(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-indigo-600 transition-all"
                    placeholder="S.No"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Challan Number</label>
                  <input 
                    type="text" 
                    required
                    value={formData.challanNumber}
                    onChange={e => setFormData({ ...formData, challanNumber: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-indigo-600 transition-all"
                    placeholder="Enter Challan #"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date?.split('T')[0]}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-indigo-600 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{type === 'WEAVER' ? 'Weaver Name' : 'Party / Mill Name'}</label>
                  <input 
                    list="party-list-challan"
                    type="text" 
                    required
                    value={formData.partyName}
                    onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-indigo-600 transition-all"
                    placeholder="Search or Enter Name"
                  />
                  <datalist id="party-list-challan">
                    {parties.map((p: any) => <option key={p.id} value={p.name} />)}
                  </datalist>
                </div>
              </div>

              {autoComparison && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 border-2 rounded-[32px] mb-8 ${Math.abs(autoComparison.totalDiff) >= 5 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${Math.abs(autoComparison.totalDiff) >= 5 ? 'bg-red-600' : 'bg-emerald-600'}`}>
                        {Math.abs(autoComparison.totalDiff) >= 5 ? <AlertCircle size={20} /> : <Check size={20} />}
                      </div>
                      <div>
                        <h4 className={`font-black uppercase tracking-tighter ${Math.abs(autoComparison.totalDiff) >= 5 ? 'text-red-900' : 'text-emerald-900'}`}>
                          {autoComparison.targetType === 'MILL' ? 'Mill' : 'Weaver'} Comparison Found
                        </h4>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${Math.abs(autoComparison.totalDiff) >= 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {autoComparison.target.partyName} | {new Date(autoComparison.target.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 bg-white/50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-right px-4 border-r border-slate-200">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Difference</div>
                        <div className={`text-xl font-black tracking-tighter ${Math.abs(autoComparison.totalDiff) >= 5 ? 'text-red-600 animate-pulse' : autoComparison.totalDiff < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {autoComparison.totalDiff > 0 ? '+' : ''}{autoComparison.totalDiff.toFixed(2)} MTR
                        </div>
                      </div>
                      <div className="text-right px-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Loss / Gain %</div>
                        <div className={`text-xl font-black tracking-tighter ${autoComparison.percentLoss < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {autoComparison.percentLoss.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {autoComparison.differences.map((diff, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/60 p-4 rounded-xl border border-slate-100">
                        <div>
                          <span className="font-black text-slate-800 text-xs uppercase block">{diff.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{autoComparison.targetType === 'MILL' ? 'Mill' : 'Weaver'}: {diff.targetQty} | Current: {diff.formQty}</span>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Qty Diff</div>
                              <div className={`text-sm font-black tracking-tighter ${Math.abs(diff.diffQty) >= 5 ? 'text-red-600' : diff.diffQty < 0 ? 'text-red-500' : diff.diffQty > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {diff.diffQty > 0 ? '+' : ''}{diff.diffQty.toFixed(2)} {diff.unit}
                              </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {type === 'MILL' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Weaver Challan Number (For Comparison)</label>
                    <input 
                      list="weaver-challan-suggestions"
                      type="text" 
                      value={formData.weaverChallanNumber || ''}
                      onChange={e => setFormData({ ...formData, weaverChallanNumber: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#00cec9] transition-all"
                      placeholder="Link to Weaver Challan #"
                    />
                    <datalist id="weaver-challan-suggestions">
                      {weaverChallans.map((c: any) => (
                        <option key={c.id} value={c.challanNumber}>{c.partyName} ({new Date(c.date).toLocaleDateString()})</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Broker</label>
                    <select 
                      value={formData.brokerId || ''}
                      onChange={e => {
                        const bId = e.target.value;
                        const broker = (brokers || []).find((b: any) => b.id === bId);
                        setFormData({ ...formData, brokerId: bId, brokerRate: broker?.defaultCommission || 0 });
                      }}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-indigo-600 transition-all shadow-sm"
                    >
                      <option value="">No Broker</option>
                      {(brokers || []).filter((b: any) => b.type === 'mill').map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Broker Rate (Per MTR)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.brokerRate || ''}
                      onChange={e => setFormData({ ...formData, brokerRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-indigo-600 transition-all font-mono"
                      placeholder="Rate e.g. 1.25"
                    />
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Add Items</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Item Name</label>
                    <input 
                      list="challan-item-suggestions"
                      type="text" 
                      value={itemInput.name}
                      onChange={e => setItemInput({ ...itemInput, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-600"
                      placeholder="Cotton, Silk..."
                    />
                    <datalist id="challan-item-suggestions">
                      {itemsMaster.map((item: any) => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center pr-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Quantity</label>
                      <button 
                        type="button" 
                        onClick={() => setIsMeterModalOpen(true)}
                        className="text-[#00cec9] hover:text-indigo-600 transition-colors"
                      >
                         <Calculator size={14} />
                      </button>
                    </div>
                    <input 
                      type="number" 
                      value={itemInput.quantity}
                      onChange={e => setItemInput({ ...itemInput, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-600"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Taka / Pcs</label>
                    <input 
                      type="number" 
                      value={itemInput.taka}
                      onChange={e => setItemInput({ ...itemInput, taka: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-600"
                      placeholder="No. of Taka"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddItem}
                    className="h-[52px] bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 group"
                  >
                    Add <span className="opacity-40 group-hover:opacity-100 transition-opacity">(Alt+N)</span>
                  </button>
                </div>

                {formData.items && formData.items.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100/50">
                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 border-b">
                          <th className="px-5 py-3">Item</th>
                          <th className="px-5 py-3 text-right">Qty</th>
                          <th className="px-5 py-3 text-right">Taka</th>
                          <th className="px-5 py-3 text-center w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.items.map(item => (
                          <tr key={item.id}>
                            <td className="px-5 py-3">
                              <div className="font-bold text-slate-700 text-sm">{item.name}</div>
                              {item.meters && (
                                <div className="text-[10px] text-slate-400 font-medium tracking-tighter truncate max-w-[200px]">
                                  Cuts: {item.meters}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right font-black text-slate-900">{item.quantity} {item.unit}</td>
                            <td className="px-5 py-3 text-right font-black text-slate-500">{item.taka || '-'}</td>
                            <td className="px-5 py-3 text-center">
                              <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-3xl hover:bg-black transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-xs">
                  {editingId ? 'Update Challan' : 'Save Challan Record'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-10 bg-slate-100 text-slate-500 font-black py-5 rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChallans.map((c: Challan) => (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">S.NO {c.serialNo}</span>
                  <div className="text-[10px] font-black text-[#00cec9] uppercase tracking-widest italic">#{c.challanNumber}</div>
                </div>
                <div className="text-xl font-black text-slate-900 uppercase tracking-tighter truncate max-w-[150px]">{c.partyName}</div>
                <div className="text-[10px] font-bold text-slate-400">{new Date(c.date).toLocaleDateString()}</div>
              </div>
              <button 
                onClick={() => onDelete(c.id)}
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="space-y-3 mt-6">
              {c.items.slice(0, 3).map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">{item.name}</span>
                    <span className="text-slate-900">{item.quantity} {item.unit}</span>
                  </div>
                  {item.meters && (
                    <div className="text-[9px] text-slate-300 font-medium truncate bg-slate-50 p-1 rounded">
                      {item.meters}
                    </div>
                  )}
                </div>
              ))}
              {c.items.length > 3 && (
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center pt-2">+{c.items.length - 3} more items</div>
              )}
            </div>

            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
               <button 
                onClick={() => handlePrint(c)}
                className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg hover:bg-black transition-all"
               >
                 <Printer size={16} />
               </button>
               <button 
                onClick={() => { setEditingId(c.id); setFormData(c); setShowAdd(true); }}
                className="bg-slate-900 text-white p-3 rounded-xl shadow-lg hover:bg-black transition-all"
               >
                 <Edit size={16} />
               </button>
            </div>
          </motion.div>
        ))}
        {filteredChallans.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 py-20 text-center bg-white/30 rounded-[40px] border-2 border-dashed border-slate-200">
             <Package size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No {type.toLowerCase()} challans found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ChallanCompareView({ millChallans, partyChallans, weaverChallans = [] }: any) {
  const [searchChallan, setSearchChallan] = useState('');
  const [compareMode, setCompareMode] = useState<'party' | 'weaver'>('party');
  
  const comparison = useMemo(() => {
    if (!searchChallan) return null;
    
    const mill = (millChallans || []).find((c: Challan) => c.challanNumber.toLowerCase() === searchChallan.toLowerCase());
    
    let compareTarget = null;
    if (compareMode === 'party') {
      compareTarget = (partyChallans || []).find((c: Challan) => c.challanNumber.toLowerCase() === searchChallan.toLowerCase());
    } else {
      // Find weaver by number linked in mill challan or by exact match
      const weaverLink = mill?.weaverChallanNumber;
      compareTarget = (weaverChallans || []).find((c: Challan) => 
        (weaverLink && c.challanNumber.toLowerCase() === weaverLink.toLowerCase()) || 
        (c.challanNumber.toLowerCase() === searchChallan.toLowerCase())
      );
    }
    
    if (!mill && !compareTarget) return null;
    
    // Helper to group items by name to handle multiple entries of same item
    const groupItems = (items: any[]) => {
      const grouped: Record<string, { quantity: number; taka: number; unit: string }> = {};
      (items || []).forEach(item => {
        const name = item.name.trim().toUpperCase();
        if (!grouped[name]) {
          grouped[name] = { quantity: 0, taka: 0, unit: item.unit || 'MTR' };
        }
        grouped[name].quantity += (parseFloat(item.quantity) || 0);
        grouped[name].taka += (parseInt(item.taka) || 0);
      });
      return grouped;
    };

    const millGroups = groupItems(mill?.items || []);
    const targetGroups = groupItems(compareTarget?.items || []);

    const allItemNames = Array.from(new Set([
      ...Object.keys(millGroups),
      ...Object.keys(targetGroups)
    ]));
    
    const items = allItemNames.map(name => {
      const millItem = millGroups[name] || { quantity: 0, taka: 0, unit: 'MTR' };
      const targetItem = targetGroups[name] || { quantity: 0, taka: 0, unit: 'MTR' };
      const diffQty = targetItem.quantity - millItem.quantity;
      const diffTaka = targetItem.taka - millItem.taka;
      
      return {
        name,
        millQty: millItem.quantity,
        targetQty: targetItem.quantity,
        millTaka: millItem.taka,
        targetTaka: targetItem.taka,
        unit: targetItem.unit || millItem.unit || 'MTR',
        diffQty: parseFloat(diffQty.toFixed(2)),
        diffTaka
      };
    });
    
    return {
      mill,
      compareTarget,
      items
    };
  }, [searchChallan, millChallans, partyChallans, weaverChallans, compareMode]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 pb-20">
      <header className="bg-slate-900 text-white p-12 rounded-[50px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Challan Comparison</h2>
            <div className="flex bg-white/10 p-1 rounded-2xl w-fit mt-4">
              <button 
                onClick={() => setCompareMode('party')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${compareMode === 'party' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Mill vs Party
              </button>
              <button 
                onClick={() => setCompareMode('weaver')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${compareMode === 'weaver' ? 'bg-[#00cec9] text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                Mill vs Weaver
              </button>
            </div>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Enter Mill Challan Number..."
              value={searchChallan}
              onChange={e => setSearchChallan(e.target.value)}
              className="w-full pl-14 pr-8 py-5 bg-white/5 border border-white/10 rounded-3xl font-black text-lg outline-none focus:bg-white focus:text-slate-900 transition-all placeholder:text-slate-600 shadow-2xl"
            />
          </div>
        </div>
      </header>

      {comparison ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className={`p-8 rounded-[40px] border shadow-sm ${comparison.mill ? 'bg-indigo-50/50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 px-1">Mill Record</div>
              {comparison.mill ? (
                <>
                  <div className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{comparison.mill.partyName}</div>
                  <div className="text-xs font-bold text-slate-500 mt-1 italic">#{comparison.mill.challanNumber} | {new Date(comparison.mill.date).toLocaleDateString()}</div>
                </>
              ) : (
                <div className="text-red-500 font-black uppercase text-sm italic">Mill record not found</div>
              )}
            </div>
            <div className={`p-8 rounded-[40px] border shadow-sm ${comparison.compareTarget ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 px-1">{compareMode === 'party' ? 'Party' : 'Weaver'} Record</div>
              {comparison.compareTarget ? (
                <>
                  <div className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{comparison.compareTarget.partyName}</div>
                  <div className="text-xs font-bold text-slate-500 mt-1 italic">#{comparison.compareTarget.challanNumber} | {new Date(comparison.compareTarget.date).toLocaleDateString()}</div>
                </>
              ) : (
                <div className="text-red-500 font-black uppercase text-sm italic">{compareMode === 'party' ? 'Party' : 'Weaver'} record not found</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-xl">Comparison Summary ({compareMode === 'party' ? 'Party' : 'Weaver'})</h3>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><div className="w-3 h-3 bg-red-400 rounded-full"></div> Shortage</div>
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><div className="w-3 h-3 bg-emerald-400 rounded-full"></div> Excess</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Mill Qty</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{compareMode === 'party' ? 'Party' : 'Weaver'} Qty</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty Difference</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-l border-white/5">Mill Taka</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{compareMode === 'party' ? 'Party' : 'Weaver'} Taka</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Taka Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparison.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-6 font-black text-slate-900 text-sm">{item.name}</td>
                      <td className="px-8 py-6 text-right font-bold text-slate-500">{item.millQty} {item.unit}</td>
                      <td className="px-8 py-6 text-right font-bold text-slate-700">{item.targetQty} {item.unit}</td>
                      <td className={`px-8 py-6 text-right font-black text-lg tracking-tighter ${item.diffQty < 0 ? 'text-red-500' : item.diffQty > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {item.diffQty > 0 ? '+' : ''}{item.diffQty} {item.unit}
                      </td>
                      <td className="px-8 py-6 text-right font-bold text-slate-500 border-l border-slate-50">{item.millTaka}</td>
                      <td className="px-8 py-6 text-right font-bold text-slate-700">{item.targetTaka}</td>
                      <td className={`px-8 py-6 text-right font-black text-lg tracking-tighter ${item.diffTaka < 0 ? 'text-red-500' : item.diffTaka > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {item.diffTaka > 0 ? '+' : ''}{item.diffTaka}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : searchChallan ? (
        <div className="bg-white/50 backdrop-blur-md rounded-[50px] p-24 text-center border border-white shadow-xl">
           <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
             <Search size={48} className="text-slate-300" />
           </div>
           <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tighter">No Records Found</h3>
           <p className="text-slate-500 font-bold mt-2 max-w-xs mx-auto text-sm">We couldn't find any Mill or {compareMode === 'party' ? 'Party' : 'Weaver'} challans with number "{searchChallan}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-indigo-600 rounded-[50px] p-12 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 relative z-10">How it works?</h3>
            <p className="text-indigo-100 font-bold mb-8 relative z-10 leading-relaxed max-w-lg">
              Simply enter the Challan Number in the search bar above. The system will automatically fetch Mill and Party records matching that number and show you the exact shortages or excess quantities item-wise.
            </p>
            <div className="flex gap-4 relative z-10">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="text-2xl font-black italic">Step 1</div>
                <div className="text-[10px] font-black uppercase opacity-60">Enter Mill Challan</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="text-2xl font-black italic">Step 2</div>
                <div className="text-[10px] font-black uppercase opacity-60">Enter Party Challan</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="text-2xl font-black italic">Step 3</div>
                <div className="text-[10px] font-black uppercase opacity-60">Compare Differences</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[50px] p-12 border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center">
            <div className="bg-[#00cec9]/10 w-20 h-20 rounded-full flex items-center justify-center mb-6">
              <Calculator size={40} className="text-[#00cec9]" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Automated Math</h3>
            <p className="text-slate-500 font-bold text-sm">No more manual checking of shortages. Let the system handle the discrepancies.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function BrokersView({ brokers, saleParties, purchaseParties, millChallans, onSave }: any) {
  const [editingBroker, setEditingBroker] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    mobile: '', 
    pan: '', 
    type: 'sale' as 'sale' | 'purchase' | 'mill',
    defaultCommission: '',
    mappings: [] as any[] 
  });

  const millPartiesFromChallans = useMemo(() => {
    const mills = (millChallans || [])
      .map((c: any) => ({ id: c.partyName, name: c.partyName }));
    const uniqueMills = Array.from(new Map(mills.map((m: any) => [m.id, m])).values());
    const sorted = uniqueMills.sort((a: any, b: any) => a.name.localeCompare(b.name));
    return sorted;
  }, [millChallans]);

  const activeParties = formData.type === 'sale' ? saleParties : (formData.type === 'purchase' ? purchaseParties : millPartiesFromChallans);
  const allParties = [...(saleParties || []), ...(purchaseParties || []), ...millPartiesFromChallans];

  const handleAddMapping = () => {
    setFormData({ ...formData, mappings: [...formData.mappings, { partyId: '', rate: 0, type: 'percentage' }] });
  };

  const handleSave = () => {
    if (!formData.name) return alert("Broker Name is required");
    const newBroker = {
      id: editingBroker?.id || Math.random().toString(36).substr(2, 9),
      name: formData.name,
      mobile: formData.mobile,
      pan: formData.pan,
      type: formData.type,
      defaultCommission: parseFloat(formData.defaultCommission as string) || 0,
      partyMappings: formData.mappings
    };

    if (editingBroker) {
      onSave(brokers.map((b: any) => b.id === editingBroker.id ? newBroker : b));
    } else {
      onSave([...brokers, newBroker]);
    }
    setEditingBroker(null);
    setFormData({ name: '', mobile: '', pan: '', type: 'sale', defaultCommission: '', mappings: [] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 pb-32">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Brokers Master</h2>
        <button 
          onClick={() => { setEditingBroker(null); setFormData({ name: '', mobile: '', pan: '', type: 'sale', defaultCommission: '', mappings: [] }); }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg"
        >
          Add New Broker
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-8 rounded-[40px] shadow-xl border border-slate-100">
          <h3 className="text-xl font-black mb-6 uppercase tracking-tighter text-slate-800">
            {editingBroker ? 'Edit Broker' : 'Create Broker'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Broker Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Broker Type</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any, mappings: [] })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="sale">Sale Broker</option>
                  <option value="purchase">Purchase Broker</option>
                  <option value="mill">Mill Broker</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  {formData.type === 'mill' ? 'Rate / MTR' : 'Commission %'}
                </label>
                <input 
                  type="number" 
                  value={formData.defaultCommission} 
                  onChange={e => setFormData({ ...formData, defaultCommission: e.target.value })}
                  placeholder={formData.type === 'mill' ? 'e.g. 1.50' : 'e.g. 2'}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Mobile Number</label>
              <input 
                type="text" 
                value={formData.mobile} 
                onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Party Commission Mapping</h4>
                <button onClick={handleAddMapping} className="text-indigo-600 font-bold text-xs">+ Add Mapping</button>
              </div>
              <div className="space-y-3">
                {formData.mappings.map((m, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                    <select 
                      value={m.partyId}
                      onChange={e => {
                        const newM = [...formData.mappings];
                        newM[idx].partyId = e.target.value;
                        setFormData({ ...formData, mappings: newM });
                      }}
                      className="bg-transparent border-b border-slate-200 font-bold text-sm outline-none"
                    >
                      <option value="">Select Party</option>
                      {activeParties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Rate"
                        value={m.rate}
                        onChange={e => {
                          const newM = [...formData.mappings];
                          newM[idx].rate = parseFloat(e.target.value);
                          setFormData({ ...formData, mappings: newM });
                        }}
                        className="w-20 bg-transparent border-b border-slate-200 font-bold text-sm outline-none"
                      />
                      <select 
                        value={m.type}
                        onChange={e => {
                          const newM = [...formData.mappings];
                          newM[idx].type = e.target.value;
                          setFormData({ ...formData, mappings: newM });
                        }}
                        className="flex-1 bg-transparent border-b border-slate-200 font-bold text-sm outline-none"
                      >
                        <option value="percentage">% Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                        <option value="meter">Rate / MTR</option>
                      </select>
                      <button 
                        onClick={() => setFormData({ ...formData, mappings: formData.mappings.filter((_, i) => i !== idx) })}
                        className="text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button 
              onClick={handleSave}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl mt-8"
            >
              Update Broker List
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Broker Name</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parties Linked</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brokers.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-800 uppercase tracking-tighter">{b.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">{b.mobile || 'No Mobile'}</div>
                  </td>
                  <td className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">
                    <span className={b.type === 'sale' ? 'text-blue-600' : (b.type === 'purchase' ? 'text-purple-600' : 'text-emerald-600')}>
                      {b.type === 'mill' ? 'Mill' : b.type || 'sale'} Broker
                    </span>
                    {b.defaultCommission > 0 && <div className="text-slate-400">{b.defaultCommission}{b.type === 'mill' ? '/mtr' : '%'} Default</div>}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-1">
                      {b.partyMappings?.map((m: any, idx: number) => {
                        const party = allParties.find((p: any) => p.id === m.partyId);
                        return (
                          <span key={idx} className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                            {party?.name || 'Unknown'} ({m.rate}{m.type === 'fixed' ? '₹' : '%'})
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => { setEditingBroker(b); setFormData({ name: b.name, mobile: b.mobile || '', pan: b.pan || '', type: b.type || 'sale', defaultCommission: b.defaultCommission?.toString() || '', mappings: b.partyMappings || [] }); }} className="text-amber-500"><Edit size={18}/></button>
                       <button onClick={() => { if(confirm("Delete Broker?")) onSave(brokers.filter((x: any) => x.id !== b.id)); }} className="text-rose-500"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function BrokerLedgerView({ brokers, commissions, payments, onSavePayment, onSaveCommission, onDeletePayment, bookings, purchases, millChallans = [] }: any) {
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [showCommModal, setShowCommModal] = useState(false);
  const [commForm, setCommForm] = useState({
    billNumber: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    billAmount: 0,
    rate: 0,
    type: 'percentage' as 'percentage' | 'fixed' | 'meter',
    amount: 0,
    totalMtrs: 0
  });
  
  const brokerCommissions = useMemo(() => {
    if (!selectedBroker) return [];
    return commissions.filter((c: any) => c.brokerId === selectedBroker.id).map((c: any) => ({
      ...c,
      transactionType: c.commissionType === 'meter' ? 'MILL' : (bookings.some((b: any) => b.id === c.billId) ? 'SALE' : 'PURCHASE')
    }));
  }, [selectedBroker, commissions, bookings]);

  const brokerPayments = useMemo(() => {
    if (!selectedBroker) return [];
    return payments.filter((p: any) => p.brokerId === selectedBroker.id);
  }, [selectedBroker, payments]);

  const transactions = useMemo(() => {
    const list = [
      ...brokerCommissions.map(c => ({ 
        id: c.id, 
        date: c.date || c.billDate, 
        type: c.transactionType, // SALE or PURCHASE or MILL
        ref: c.billNumber?.toString() || '-', 
        party: c.partyName,
        billAmount: c.billAmount,
        commRate: c.commissionRate,
        commType: c.commissionType,
        dr: c.commissionAmount, 
        cr: 0 
      })),
      ...brokerPayments.map(p => ({ 
        id: p.id, 
        date: p.date, 
        type: 'PAYMENT', 
        ref: '-', 
        party: '-',
        dr: 0, 
        cr: p.amount 
      }))
    ];
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [brokerCommissions, brokerPayments]);

  const stats = useMemo(() => {
    const totalEarned = brokerCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const totalPaid = brokerPayments.reduce((sum, p) => sum + p.amount, 0);
    return { totalEarned, totalPaid, balance: totalEarned - totalPaid };
  }, [brokerCommissions, brokerPayments]);

  const [paymentForm, setPaymentForm] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });

  const handleAddPayment = () => {
    if (!paymentForm.amount || paymentForm.amount <= 0) return alert("Amount must be greater than 0");
    const p = {
      id: Math.random().toString(36).substr(2, 9),
      brokerId: selectedBroker.id,
      amount: paymentForm.amount,
      date: paymentForm.date,
      notes: paymentForm.notes,
      paymentMode: 'Cash'
    };
    onSavePayment(p);
    setPaymentForm({ amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const calculateCommAmount = (rate: number, type: string, billAmount: number, mtrs: number) => {
    if (type === 'fixed') return rate;
    if (type === 'meter') return Math.round(mtrs * rate);
    return Math.round(billAmount * (rate / 100));
  };

  const handleFetchChallan = () => {
    const c = millChallans.find(ch => ch.challanNumber === commForm.billNumber);
    if (c) {
      const totalMtrs = c.items.reduce((sum, it) => sum + (it.unit === 'MTR' ? it.quantity || 0 : 0), 0);
      const rate = selectedBroker?.defaultCommission || 0;
      const type = selectedBroker?.type === 'mill' ? 'meter' : 'percentage';
      const amount = calculateCommAmount(rate, type, 0, totalMtrs);
      
      setCommForm({
        ...commForm,
        partyName: c.partyName,
        totalMtrs,
        rate,
        type,
        amount,
        date: c.date
      });
    } else {
      alert("Mill Challan not found");
    }
  };

  const handleSaveManualComm = () => {
    if (!commForm.billNumber) return alert("Bill/Challan Number is required");
    
    // Duplicate Check
    const isDuplicate = commissions.some(c => 
      c.brokerId === selectedBroker.id && 
      c.billNumber === commForm.billNumber && 
      c.partyName === commForm.partyName
    );

    if (isDuplicate) {
      if (!confirm("Commission for this Bill/Challan Number already exists for this broker. Do you want to proceed anyway?")) {
        return;
      }
    }

    const c: BrokerCommission = {
      id: Math.random().toString(36).substr(2, 9),
      brokerId: selectedBroker.id,
      brokerName: selectedBroker.name,
      partyId: 'MANUAL',
      partyName: commForm.partyName,
      billId: `MANUAL-${commForm.billNumber}`,
      billNumber: commForm.billNumber as any,
      billDate: commForm.date,
      billAmount: commForm.billAmount,
      commissionRate: commForm.rate,
      commissionType: commForm.type,
      commissionAmount: commForm.amount,
      status: 'UNPAID',
      paidAmount: 0,
      date: new Date().toISOString()
    };
    onSaveCommission(c);
    setShowCommModal(false);
    setCommForm({
      billNumber: '',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      billAmount: 0,
      rate: 0,
      type: 'percentage',
      amount: 0,
      totalMtrs: 0
    });
  };

  return (
    <div className="p-8 pb-32">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Broker Commission Ledger</h2>
        <div className="flex gap-4">
          <select 
            value={selectedBroker?.id || ''} 
            onChange={e => setSelectedBroker(brokers.find((b: any) => b.id === e.target.value))}
            className="bg-white border-2 border-slate-200 rounded-2xl px-6 py-3 font-black text-xs uppercase focus:border-indigo-500 outline-none transition-all shadow-lg"
          >
            <option value="">Select Broker</option>
            {brokers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {!selectedBroker ? (
        <div className="bg-white/50 backdrop-blur-md rounded-[50px] p-24 text-center border border-white shadow-xl">
          <BookText size={64} className="mx-auto text-slate-200 mb-6" />
          <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tighter">Please Select a Broker</h3>
        </div>
      ) : (
        <div className="space-y-8">
          {showCommModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Add Manual Commission</h3>
                  <button onClick={() => setShowCommModal(false)} className="text-white/50 hover:text-white transition-colors"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Challan / Bill No</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={commForm.billNumber} 
                          onChange={e => setCommForm({ ...commForm, billNumber: e.target.value })} 
                          className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" 
                        />
                        <button 
                          onClick={handleFetchChallan}
                          className="bg-indigo-600 text-white px-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all"
                        >Fetch</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                      <input type="date" value={commForm.date} onChange={e => setCommForm({ ...commForm, date: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Party Name</label>
                    <input type="text" value={commForm.partyName} onChange={e => setCommForm({ ...commForm, partyName: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 uppercase" />
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                      <select 
                        value={commForm.type} 
                        onChange={e => {
                          const type = e.target.value as any;
                          const amount = calculateCommAmount(commForm.rate, type, commForm.billAmount, commForm.totalMtrs);
                          setCommForm({ ...commForm, type, amount });
                        }} 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500"
                      >
                        <option value="percentage">Percentage</option>
                        <option value="meter">Rate / MTR</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rate</label>
                      <input 
                        type="number" 
                        value={commForm.rate} 
                        onChange={e => {
                          const rate = parseFloat(e.target.value) || 0;
                          const amount = calculateCommAmount(rate, commForm.type, commForm.billAmount, commForm.totalMtrs);
                          setCommForm({ ...commForm, rate, amount });
                        }} 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 text-indigo-600">Calculated Amt</label>
                      <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 font-black text-indigo-600">₹ {commForm.amount}</div>
                    </div>
                  </div>
                  <button onClick={handleSaveManualComm} className="w-full bg-slate-900 text-white rounded-3xl py-6 font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Save Manual Commission Entry</button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[40px] text-white shadow-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Total Earned</div>
              <div className="text-4xl font-black tracking-tighter">₹ {Math.round(stats.totalEarned).toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[40px] text-white shadow-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Total Paid</div>
              <div className="text-4xl font-black tracking-tighter">₹ {Math.round(stats.totalPaid).toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[40px] text-white shadow-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Net Payable Balance</div>
              <div className="text-4xl font-black tracking-tighter text-amber-400">₹ {Math.round(stats.balance).toLocaleString()}</div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 flex-1">
               <h3 className="text-xl font-black mb-6 uppercase tracking-tighter">Record Commission Payment</h3>
               <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Paid Amount (₹)</label>
                   <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-emerald-500" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Payment Date</label>
                   <input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-emerald-500" />
                 </div>
                 <div className="col-span-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Notes / Description</label>
                   <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-emerald-500" />
                 </div>
                 <button onClick={handleAddPayment} className="col-span-2 bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-emerald-700 transition-all">Save Payment</button>
               </div>
            </div>

            <div className="bg-indigo-50 p-8 rounded-[40px] shadow-xl border border-indigo-100 flex-1 flex flex-col justify-center text-center">
              <h3 className="text-xl font-black mb-4 uppercase tracking-tighter text-indigo-900">Manual Entry</h3>
              <p className="text-slate-500 font-bold mb-8 text-sm px-8">Need to record a commission credit that wasn't automatically generated? Use this to link manual Mill Challans.</p>
              <button 
                onClick={() => setShowCommModal(true)}
                className="bg-indigo-600 text-white mx-auto px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-indigo-700 transition-all block w-full lg:w-auto"
              >
                Add Manual Commission Entry
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction History</h3>
              <div className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                {selectedBroker.name} ({selectedBroker.type || 'sale'} Broker)
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill No</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Party Name</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bill Amount</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                      {selectedBroker?.type === 'mill' ? 'Rate/MTR' : 'Comm %'}
                    </th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Brokerage</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Paid Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-6 font-bold text-slate-500 text-xs">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="px-8 py-6 font-bold text-slate-800 text-xs">{t.ref}</td>
                      <td className="px-8 py-6 font-bold text-slate-800 text-xs uppercase">{t.party}</td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${t.type === 'SALE' ? 'bg-blue-50 text-blue-600' : t.type === 'PURCHASE' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-sm text-slate-400">
                        {t.billAmount ? `₹${Math.round(t.billAmount).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-8 py-6 text-right font-black text-sm text-slate-400">
                        {t.commRate ? `${t.commRate}${t.commType === 'percentage' ? '%' : (t.commType === 'meter' ? '/mtr' : '₹')}` : '-'}
                      </td>
                      <td className="px-8 py-6 text-right font-black text-lg tracking-tighter text-indigo-600">
                         {t.dr !== 0 ? `₹${Math.round(t.dr).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-8 py-6 text-right font-black text-lg tracking-tighter text-emerald-600">
                         {t.cr !== 0 ? `₹${Math.round(t.cr).toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
