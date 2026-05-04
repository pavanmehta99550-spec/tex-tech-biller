/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Party {
  id: string;
  name: string;
  gstin: string;
  address: string;
  mobile?: string;
  mobile2?: string;
  totalSales: number;
  totalPaid: number;
  totalPurchases: number;
}

export interface BillItem {
  id: string;
  name: string;
  color: string;
  hsnCode: string;
  taka: string;
  unit: 'MTR' | 'PCS';
  quantity: number;
  rate: number;
  discount: number;
  amount: number;
  purchaseId?: string;
  purchaseBillNumber?: string;
  purchasePartyName?: string;
}

export interface Booking {
  id: string;
  lrNumber: string;
  ewbNumber: string;
  transportName: string;
  transportGstin: string;
  consignorGstin: string;
  consignorName: string;
  consignorAddress: string;
  consigneeGstin: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeMobile?: string;
  consigneeMobile2?: string;
  items: BillItem[];
  basicAmount: number;
  globalDiscount: number;
  taxRate: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  grandTotal: number;
  date: string;
  billNumber: number;
}

export interface Transport {
  id: string;
  name: string;
  gstin: string;
}

export interface AppSettings {
  companyName: string;
  gstin: string;
  address: string;
  mobile: string;
  mobile2?: string;
  adminPassword?: string;
  adminUsername?: string;
  signature?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
}

export interface Payment {
  id: string;
  partyId: string;
  partyName: string;
  partyGstin?: string;
  amount: number;
  date: string;
  chequeNumber?: string;
  chequeDate?: string;
  notes?: string;
  billAdjustments?: { billId: string; billNumber: string; amount: number }[];
}

export interface Purchase {
  id: string;
  billNumber: number;
  date: string;
  partyGstin: string;
  partyName: string;
  partyAddress: string;
  partyMobile?: string;
  partyMobile2?: string;
  items: BillItem[];
  basicAmount: number;
  globalDiscount: number;
  taxRate: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  grandTotal: number;
  notes?: string;
  partyBillNumber?: string;
}

export interface DebitNote {
  id: string;
  noteNumber: number;
  date: string;
  purchaseBillNumber?: string;
  partyGstin: string;
  partyName: string;
  partyAddress: string;
  partyMobile?: string;
  partyMobile2?: string;
  items: BillItem[];
  basicAmount: number;
  globalDiscount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  reason?: string;
}

export interface CreditNote {
  id: string;
  noteNumber: number;
  date: string;
  salesBillNumber?: string;
  partyGstin: string;
  partyName: string;
  partyAddress: string;
  partyMobile?: string;
  partyMobile2?: string;
  items: BillItem[];
  basicAmount: number;
  globalDiscount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  reason?: string;
}

export interface ItemMaster {
  id: string;
  name: string;
  hsnCode: string;
  unit: 'MTR' | 'PCS' | 'SET' | 'BOX' | 'KG';
  gstRate: number;
}

export interface ChallanItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  taka?: number;
}

export interface Challan {
  id: string;
  serialNo: number;
  challanNumber: string;
  date: string;
  type: 'MILL' | 'PARTY';
  partyName: string;
  partyGstin?: string;
  items: ChallanItem[];
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  gstIncluded: boolean;
  gstRate: number;
  gstAmount: number;
  payeeName?: string;
  paymentMode: 'Cash' | 'Bank' | 'Cheque' | 'UPI';
}
