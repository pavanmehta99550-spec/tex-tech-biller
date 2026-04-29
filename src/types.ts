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
  adminPassword?: string;
  signature?: string;
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
