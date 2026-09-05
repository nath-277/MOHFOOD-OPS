import { getInventoryItems } from "@/server/inventory/store";

export interface RetailStockist {
  id: string;
  code: string;
  name: string;
  location: string;
  contactPerson: string;
  phone: string;
  standardUnitPrice: number;
  paymentTerms: string;
  totalDelivered: number;
  totalReturns: number;
  totalNetSold: number;
  totalInvoiced: number;
  totalPaid: number;
  outstandingDebt: number;
  status: "ACTIVE" | "PENDING_SETTLEMENT" | "VERIFIED_PAID" | "OVERDUE";
  lastDeliveryDate: string;
}

export interface ConsignmentDelivery {
  id: string;
  stockistId: string;
  stockistName: string;
  productCode: string;
  productName: string;
  quantityDelivered: number;
  unitPrice: number;
  totalAmount: number;
  driverName: string;
  waybillNumber: string;
  dispatchDate: string;
  status: "DELIVERED" | "RECONCILED" | "SETTLED";
  notes?: string;
}

export interface ConsignmentReturn {
  id: string;
  stockistId: string;
  stockistName: string;
  deliveryId?: string;
  productCode: string;
  quantityReturned: number;
  unitPrice: number;
  creditAmount: number;
  reason: "EXPIRED_ON_SHELF" | "BROKEN_SEAL" | "COLD_CHAIN_FAILURE" | "DAMAGED";
  returnDate: string;
  receivedBy: string;
  notes?: string;
}

export interface ConsignmentPayment {
  id: string;
  stockistId: string;
  stockistName: string;
  amount: number;
  paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
  reference: string;
  paymentDate: string;
  receiptUrl?: string;
  verifiedBy: string;
  notes?: string;
}

export interface WhatsAppInvoice {
  id: string;
  invoiceNumber: string;
  senderPhone: string;
  driverName: string;
  stockistId?: string;
  stockistName: string;
  amount: number;
  itemCount: number;
  time: string;
  fileUrl?: string;
  status: "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  verifiedByName?: string;
  verifiedAt?: string;
  notes?: string;
}

// In-Memory Seeds
export const RETAIL_STOCKISTS: RetailStockist[] = [
  {
    id: "stk-01",
    code: "STK-HUB-IKJ",
    name: "Hubmart Supermarket",
    location: "Ikeja GRA, Lagos",
    contactPerson: "Mrs. Funke Adeyemi",
    phone: "+234 803 214 5589",
    standardUnitPrice: 2000,
    paymentTerms: "Weekly Net 7",
    totalDelivered: 150,
    totalReturns: 8,
    totalNetSold: 142,
    totalInvoiced: 284000,
    totalPaid: 0,
    outstandingDebt: 284000,
    status: "PENDING_SETTLEMENT",
    lastDeliveryDate: "Today, 08:30 AM",
  },
  {
    id: "stk-02",
    code: "STK-EBN-LEK",
    name: "Prince Ebeano Supermarket",
    location: "Lekki Phase 1, Lagos",
    contactPerson: "Chukwudi Okafor",
    phone: "+234 802 887 9120",
    standardUnitPrice: 2000,
    paymentTerms: "Weekly Net 7",
    totalDelivered: 200,
    totalReturns: 5,
    totalNetSold: 195,
    totalInvoiced: 390000,
    totalPaid: 0,
    outstandingDebt: 390000,
    status: "PENDING_SETTLEMENT",
    lastDeliveryDate: "Yesterday",
  },
  {
    id: "stk-03",
    code: "STK-JUS-MGD",
    name: "Justrite Superstore",
    location: "Magodo Shangisha, Lagos",
    contactPerson: "Babatunde Alabi",
    phone: "+234 805 441 9023",
    standardUnitPrice: 2000,
    paymentTerms: "Cash on Reconcile",
    totalDelivered: 120,
    totalReturns: 2,
    totalNetSold: 118,
    totalInvoiced: 236000,
    totalPaid: 236000,
    outstandingDebt: 0,
    status: "VERIFIED_PAID",
    lastDeliveryDate: "02 Sep 2026",
  },
  {
    id: "stk-04",
    code: "STK-SUP-OGD",
    name: "Supersaver Supermarket",
    location: "Ogudu GRA, Lagos",
    contactPerson: "Tonia Briggs",
    phone: "+234 818 902 4431",
    standardUnitPrice: 2000,
    paymentTerms: "Bi-Weekly",
    totalDelivered: 100,
    totalReturns: 12,
    totalNetSold: 88,
    totalInvoiced: 176000,
    totalPaid: 0,
    outstandingDebt: 176000,
    status: "PENDING_SETTLEMENT",
    lastDeliveryDate: "01 Sep 2026",
  },
  {
    id: "stk-05",
    code: "STK-SPR-VI",
    name: "SPAR Nigeria",
    location: "Victoria Island, Lagos",
    contactPerson: "Mr. Kalu Nnamdi",
    phone: "+234 809 332 1198",
    standardUnitPrice: 2000,
    paymentTerms: "Monthly Net 14",
    totalDelivered: 250,
    totalReturns: 10,
    totalNetSold: 240,
    totalInvoiced: 480000,
    totalPaid: 0,
    outstandingDebt: 480000,
    status: "PENDING_SETTLEMENT",
    lastDeliveryDate: "Today, 07:15 AM",
  },
];

export const CONSIGNMENT_DELIVERIES: ConsignmentDelivery[] = [
  {
    id: "cdel-1001",
    stockistId: "stk-01",
    stockistName: "Hubmart Supermarket",
    productCode: "REC-PARFAIT-400ML",
    productName: "Moh Yogurt Parfait (400ml Cup)",
    quantityDelivered: 150,
    unitPrice: 2000,
    totalAmount: 300000,
    driverName: "Sunday B. (Van 1)",
    waybillNumber: "WAY-MOH-2026-0901",
    dispatchDate: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: "DELIVERED",
    notes: "Delivered to cold display room",
  },
  {
    id: "cdel-1002",
    stockistId: "stk-02",
    stockistName: "Prince Ebeano Supermarket",
    productCode: "REC-PARFAIT-400ML",
    productName: "Moh Yogurt Parfait (400ml Cup)",
    quantityDelivered: 200,
    unitPrice: 2000,
    totalAmount: 400000,
    driverName: "Sunday B. (Van 1)",
    waybillNumber: "WAY-MOH-2026-0902",
    dispatchDate: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: "DELIVERED",
  },
  {
    id: "cdel-1003",
    stockistId: "stk-05",
    stockistName: "SPAR Nigeria",
    productCode: "REC-PARFAIT-400ML",
    productName: "Moh Yogurt Parfait (400ml Cup)",
    quantityDelivered: 250,
    unitPrice: 2000,
    totalAmount: 500000,
    driverName: "Kayode O. (Van 2)",
    waybillNumber: "WAY-MOH-2026-0903",
    dispatchDate: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: "DELIVERED",
  },
];

export const CONSIGNMENT_RETURNS: ConsignmentReturn[] = [
  {
    id: "cret-2001",
    stockistId: "stk-01",
    stockistName: "Hubmart Supermarket",
    deliveryId: "cdel-1001",
    productCode: "REC-PARFAIT-400ML",
    quantityReturned: 8,
    unitPrice: 2000,
    creditAmount: 16000,
    reason: "EXPIRED_ON_SHELF",
    returnDate: new Date().toISOString(),
    receivedBy: "Sunday B. (Van 1)",
    notes: "Shelf date exceeded, retrieved for destruction",
  },
  {
    id: "cret-2002",
    stockistId: "stk-02",
    stockistName: "Prince Ebeano Supermarket",
    deliveryId: "cdel-1002",
    productCode: "REC-PARFAIT-400ML",
    quantityReturned: 5,
    unitPrice: 2000,
    creditAmount: 10000,
    reason: "BROKEN_SEAL",
    returnDate: new Date(Date.now() - 3600000 * 20).toISOString(),
    receivedBy: "Sunday B. (Van 1)",
  },
];

export const CONSIGNMENT_PAYMENTS: ConsignmentPayment[] = [
  {
    id: "cpay-3001",
    stockistId: "stk-03",
    stockistName: "Justrite Superstore",
    amount: 236000,
    paymentMethod: "BANK_TRANSFER",
    reference: "GTB/TRF/9921049281/JUS",
    paymentDate: "2026-09-02T14:30:00.000Z",
    verifiedBy: "Executive Management",
    notes: "Full settlement for 02 Sep delivery batch",
  },
];

export const WHATSAPP_INVOICES: WhatsAppInvoice[] = [
  {
    id: "wa-inv-1092",
    invoiceNumber: "WA-INV-1092",
    senderPhone: "+234 803 555 1201",
    driverName: "Sunday B. (Van 1)",
    stockistId: "stk-01",
    stockistName: "Hubmart Ikeja",
    amount: 284000,
    itemCount: 142,
    time: "Today, 10:15 AM",
    status: "PENDING_REVIEW",
    notes: "Received signed delivery note and store receiving clerk stamp",
  },
  {
    id: "wa-inv-1091",
    invoiceNumber: "WA-INV-1091",
    senderPhone: "+234 803 555 1201",
    driverName: "Sunday B. (Van 1)",
    stockistId: "stk-02",
    stockistName: "Prince Ebeano Lekki",
    amount: 390000,
    itemCount: 195,
    time: "Yesterday, 04:30 PM",
    status: "PENDING_REVIEW",
    notes: "Attached photo of store credit voucher deducting 5 returned cups",
  },
  {
    id: "wa-inv-1089",
    invoiceNumber: "WA-INV-1089",
    senderPhone: "+234 809 111 8844",
    driverName: "Kayode O. (Van 2)",
    stockistId: "stk-05",
    stockistName: "SPAR Nigeria (VI)",
    amount: 480000,
    itemCount: 240,
    time: "Today, 08:00 AM",
    status: "PENDING_REVIEW",
    notes: "Delivery waybill with receiving warehouse stamp",
  },
  {
    id: "wa-inv-1088",
    invoiceNumber: "WA-INV-1088",
    senderPhone: "+234 803 555 1201",
    driverName: "Sunday B. (Van 1)",
    stockistId: "stk-03",
    stockistName: "Justrite Magodo",
    amount: 236000,
    itemCount: 118,
    time: "02 Sep 2026",
    status: "VERIFIED",
    verifiedByName: "Executive Director (Mrs. Moh)",
    verifiedAt: "2026-09-02T15:00:00.000Z",
    notes: "Bank alert confirmed and matched to GTB statement",
  },
];

// Helper to recalculate a stockist's summary metrics
function recalculateStockist(stockistId: string) {
  const stockist = RETAIL_STOCKISTS.find((s) => s.id === stockistId);
  if (!stockist) return;

  const deliveries = CONSIGNMENT_DELIVERIES.filter((d) => d.stockistId === stockistId);
  const returns = CONSIGNMENT_RETURNS.filter((r) => r.stockistId === stockistId);
  const payments = CONSIGNMENT_PAYMENTS.filter((p) => p.stockistId === stockistId);

  stockist.totalDelivered = deliveries.reduce((sum, d) => sum + d.quantityDelivered, 0);
  stockist.totalReturns = returns.reduce((sum, r) => sum + r.quantityReturned, 0);
  stockist.totalNetSold = Math.max(0, stockist.totalDelivered - stockist.totalReturns);
  stockist.totalInvoiced = stockist.totalNetSold * stockist.standardUnitPrice;
  stockist.totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  stockist.outstandingDebt = Math.max(0, stockist.totalInvoiced - stockist.totalPaid);

  if (stockist.outstandingDebt === 0 && stockist.totalInvoiced > 0) {
    stockist.status = "VERIFIED_PAID";
  } else if (stockist.outstandingDebt > 0) {
    stockist.status = "PENDING_SETTLEMENT";
  } else {
    stockist.status = "ACTIVE";
  }
}

// -------------------------------------------------------------
// EXPORTED DOMAIN FUNCTIONS
// -------------------------------------------------------------

export async function getManagementOverview() {
  const items = await getInventoryItems();

  // 1. Raw Stock Valuation
  const rawStockValuation = items.reduce(
    (sum, item) => sum + item.currentStock * (item.costPerUnit || 0),
    0
  );

  // 2. Total Supermarket Consignment Receivables (Debt)
  const totalConsignmentDebt = RETAIL_STOCKISTS.reduce(
    (sum, s) => sum + s.outstandingDebt,
    0
  );

  // 3. WhatsApp Invoices Queue
  const pendingInvoices = WHATSAPP_INVOICES.filter(
    (inv) => inv.status === "PENDING_REVIEW"
  ).length;

  // 4. Daily Production Output
  const dailyOutput = 850;
  const targetOutput = 1000;

  return {
    rawStockValuation: Math.round(rawStockValuation),
    totalConsignmentDebt,
    pendingInvoices,
    dailyOutput,
    targetOutput,
    totalStockists: RETAIL_STOCKISTS.length,
    activeAccountsPending: RETAIL_STOCKISTS.filter((s) => s.outstandingDebt > 0).length,
  };
}

export async function getRetailStockists(searchQuery?: string) {
  let list = [...RETAIL_STOCKISTS];
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getRetailStockistById(id: string) {
  const stockist = RETAIL_STOCKISTS.find((s) => s.id === id || s.code === id);
  if (!stockist) throw new Error(`Stockist not found: ${id}`);

  const deliveries = CONSIGNMENT_DELIVERIES.filter((d) => d.stockistId === stockist.id);
  const returns = CONSIGNMENT_RETURNS.filter((r) => r.stockistId === stockist.id);
  const payments = CONSIGNMENT_PAYMENTS.filter((p) => p.stockistId === stockist.id);

  return {
    stockist,
    deliveries,
    returns,
    payments,
  };
}

export async function createRetailStockist(data: {
  name: string;
  location: string;
  contactPerson: string;
  phone: string;
  standardUnitPrice?: number;
  paymentTerms?: string;
}) {
  const code = `STK-${data.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`;
  const newStockist: RetailStockist = {
    id: `stk-${Date.now()}`,
    code,
    name: data.name.trim(),
    location: data.location.trim(),
    contactPerson: data.contactPerson.trim(),
    phone: data.phone.trim(),
    standardUnitPrice: Number(data.standardUnitPrice) || 2000,
    paymentTerms: data.paymentTerms?.trim() || "Weekly Net 7",
    totalDelivered: 0,
    totalReturns: 0,
    totalNetSold: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    status: "ACTIVE",
    lastDeliveryDate: "New Account",
  };

  RETAIL_STOCKISTS.unshift(newStockist);
  return newStockist;
}

export async function createConsignmentDelivery(data: {
  stockistId: string;
  productCode: string;
  productName: string;
  quantityDelivered: number;
  unitPrice?: number;
  driverName: string;
  notes?: string;
}) {
  const stockist = RETAIL_STOCKISTS.find((s) => s.id === data.stockistId);
  if (!stockist) throw new Error(`Stockist not found: ${data.stockistId}`);

  const unitPrice = Number(data.unitPrice) || stockist.standardUnitPrice;
  const quantity = Number(data.quantityDelivered);
  const totalAmount = quantity * unitPrice;
  const waybillNumber = `WAY-MOH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const delivery: ConsignmentDelivery = {
    id: `cdel-${Date.now()}`,
    stockistId: stockist.id,
    stockistName: stockist.name,
    productCode: data.productCode,
    productName: data.productName,
    quantityDelivered: quantity,
    unitPrice,
    totalAmount,
    driverName: data.driverName.trim(),
    waybillNumber,
    dispatchDate: new Date().toISOString(),
    status: "DELIVERED",
    notes: data.notes?.trim(),
  };

  CONSIGNMENT_DELIVERIES.unshift(delivery);
  stockist.lastDeliveryDate = "Today, " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  recalculateStockist(stockist.id);

  return delivery;
}

export async function recordConsignmentReturn(data: {
  stockistId: string;
  quantityReturned: number;
  reason: "EXPIRED_ON_SHELF" | "BROKEN_SEAL" | "COLD_CHAIN_FAILURE" | "DAMAGED";
  receivedBy: string;
  productCode?: string;
  notes?: string;
}) {
  const stockist = RETAIL_STOCKISTS.find((s) => s.id === data.stockistId);
  if (!stockist) throw new Error(`Stockist not found: ${data.stockistId}`);

  const quantity = Number(data.quantityReturned);
  const creditAmount = quantity * stockist.standardUnitPrice;

  const ret: ConsignmentReturn = {
    id: `cret-${Date.now()}`,
    stockistId: stockist.id,
    stockistName: stockist.name,
    productCode: data.productCode || "REC-PARFAIT-400ML",
    quantityReturned: quantity,
    unitPrice: stockist.standardUnitPrice,
    creditAmount,
    reason: data.reason,
    returnDate: new Date().toISOString(),
    receivedBy: data.receivedBy.trim(),
    notes: data.notes?.trim(),
  };

  CONSIGNMENT_RETURNS.unshift(ret);
  recalculateStockist(stockist.id);

  return ret;
}

export async function recordConsignmentPayment(data: {
  stockistId: string;
  amount: number;
  paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
  reference: string;
  verifiedBy?: string;
  notes?: string;
}) {
  const stockist = RETAIL_STOCKISTS.find((s) => s.id === data.stockistId);
  if (!stockist) throw new Error(`Stockist not found: ${data.stockistId}`);

  const payment: ConsignmentPayment = {
    id: `cpay-${Date.now()}`,
    stockistId: stockist.id,
    stockistName: stockist.name,
    amount: Number(data.amount),
    paymentMethod: data.paymentMethod,
    reference: data.reference.trim(),
    paymentDate: new Date().toISOString(),
    verifiedBy: data.verifiedBy || "Executive Management",
    notes: data.notes?.trim(),
  };

  CONSIGNMENT_PAYMENTS.unshift(payment);
  recalculateStockist(stockist.id);

  return payment;
}

export async function getWhatsAppInvoices(statusFilter?: string) {
  let list = [...WHATSAPP_INVOICES];
  if (statusFilter && statusFilter !== "ALL") {
    list = list.filter((inv) => inv.status === statusFilter);
  }
  return list;
}

export async function createWhatsAppInvoice(data: {
  driverName: string;
  senderPhone: string;
  stockistName: string;
  amount: number;
  itemCount: number;
  fileUrl?: string;
  notes?: string;
}) {
  const id = `wa-inv-${Date.now().toString().slice(-4)}`;
  const invoice: WhatsAppInvoice = {
    id,
    invoiceNumber: id.toUpperCase(),
    driverName: data.driverName.trim(),
    senderPhone: data.senderPhone.trim(),
    stockistName: data.stockistName.trim(),
    amount: Number(data.amount),
    itemCount: Number(data.itemCount),
    time: "Today, " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    fileUrl: data.fileUrl,
    status: "PENDING_REVIEW",
    notes: data.notes?.trim(),
  };

  WHATSAPP_INVOICES.unshift(invoice);
  return invoice;
}

export async function verifyWhatsAppInvoice(id: string, verifiedByName: string) {
  const invoice = WHATSAPP_INVOICES.find((inv) => inv.id === id || inv.invoiceNumber === id);
  if (!invoice) throw new Error(`Invoice not found: ${id}`);

  invoice.status = "VERIFIED";
  invoice.verifiedByName = verifiedByName;
  invoice.verifiedAt = new Date().toISOString();

  // If there is an associated stockist with outstanding debt, record a verified payment automatically
  const matchedStockist = RETAIL_STOCKISTS.find(
    (s) =>
      (invoice.stockistId && s.id === invoice.stockistId) ||
      s.name.toLowerCase().includes(invoice.stockistName.toLowerCase()) ||
      invoice.stockistName.toLowerCase().includes(s.name.toLowerCase()) ||
      (invoice.stockistName.toLowerCase().includes("ebeano") && s.name.toLowerCase().includes("ebeano")) ||
      (invoice.stockistName.toLowerCase().includes("hubmart") && s.name.toLowerCase().includes("hubmart")) ||
      (invoice.stockistName.toLowerCase().includes("justrite") && s.name.toLowerCase().includes("justrite")) ||
      (invoice.stockistName.toLowerCase().includes("spar") && s.name.toLowerCase().includes("spar"))
  );

  if (matchedStockist && matchedStockist.outstandingDebt > 0) {
    await recordConsignmentPayment({
      stockistId: matchedStockist.id,
      amount: Math.min(invoice.amount, matchedStockist.outstandingDebt),
      paymentMethod: "BANK_TRANSFER",
      reference: `WA-VERIFIED-${invoice.invoiceNumber}`,
      verifiedBy: verifiedByName,
      notes: `Auto-reconciled from verified WhatsApp receipt ${invoice.invoiceNumber}`,
    });
  }

  return invoice;
}

export async function getPlantParRunway() {
  const items = await getInventoryItems();
  const dailyTargetUnits = 850;

  // Recipe usage per unit parfait (approximations):
  // Milk: 0.15 kg / parfait -> daily = 127.5 kg
  // Granola: 0.04 kg / parfait -> daily = 34.0 kg
  // Sugar: 0.03 kg / unit -> daily = 25.5 kg
  // Cups: 1 set / unit -> daily = 850 sets
  // Bottles: 1 set / unit -> daily = 850 sets
  const milkItem = items.find((i) => i.code === "RAW-MLK-01");
  const granolaItem = items.find((i) => i.code === "RAW-GRN-01");
  const sugarItem = items.find((i) => i.code === "RAW-SGR-01");
  const cupItem = items.find((i) => i.code === "PKG-CUP-400");
  const bottleItem = items.find((i) => i.code === "PKG-BOT-350");

  const milkRunway = milkItem ? Number((milkItem.currentStock / 127.5).toFixed(1)) : 0;
  const granolaRunway = granolaItem ? Number((granolaItem.currentStock / 34.0).toFixed(1)) : 0;
  const sugarRunway = sugarItem ? Number((sugarItem.currentStock / 25.5).toFixed(1)) : 0;
  const cupRunway = cupItem ? Number((cupItem.currentStock / 850).toFixed(1)) : 0;
  const bottleRunway = bottleItem ? Number((bottleItem.currentStock / 850).toFixed(1)) : 0;

  return [
    {
      name: "Fresh Whole Cow Milk",
      code: "RAW-MLK-01",
      stock: milkItem?.currentStock || 0,
      uom: "kg",
      runwayDays: milkRunway,
      status: milkRunway < 2 ? "CRITICAL" : milkRunway < 4 ? "WARNING" : "HEALTHY",
      reorderAlert: milkRunway < 3,
    },
    {
      name: "Honey Crunchy Granola",
      code: "RAW-GRN-01",
      stock: granolaItem?.currentStock || 0,
      uom: "kg",
      runwayDays: granolaRunway,
      status: granolaRunway < 2 ? "CRITICAL" : granolaRunway < 4 ? "WARNING" : "HEALTHY",
      reorderAlert: granolaRunway < 3,
    },
    {
      name: "Granulated White Sugar",
      code: "RAW-SGR-01",
      stock: sugarItem?.currentStock || 0,
      uom: "kg",
      runwayDays: sugarRunway,
      status: sugarRunway < 2 ? "CRITICAL" : sugarRunway < 4 ? "WARNING" : "HEALTHY",
      reorderAlert: sugarRunway < 3,
    },
    {
      name: "Parfait Cups & Dome Lids (400ml)",
      code: "PKG-CUP-400",
      stock: cupItem?.currentStock || 0,
      uom: "sets",
      runwayDays: cupRunway,
      status: cupRunway < 2 ? "CRITICAL" : cupRunway < 4 ? "WARNING" : "HEALTHY",
      reorderAlert: cupRunway < 3,
    },
    {
      name: "Vanilla Yogurt Bottles (350ml)",
      code: "PKG-BOT-350",
      stock: bottleItem?.currentStock || 0,
      uom: "sets",
      runwayDays: bottleRunway,
      status: bottleRunway < 2 ? "CRITICAL" : bottleRunway < 4 ? "WARNING" : "HEALTHY",
      reorderAlert: bottleRunway < 3,
    },
  ];
}

export function generateSoRCSV(): string {
  const headers = [
    "Stockist Code",
    "Supermarket Name",
    "Location",
    "Contact Person",
    "Phone",
    "Unit Price (NGN)",
    "Delivered (Units)",
    "Expired Returns (Units)",
    "Net Sold (Units)",
    "Total Invoiced (NGN)",
    "Total Paid (NGN)",
    "Outstanding Debt (NGN)",
    "Status",
    "Last Delivery",
  ];

  const rows = RETAIL_STOCKISTS.map((s) => [
    `"${s.code}"`,
    `"${s.name}"`,
    `"${s.location}"`,
    `"${s.contactPerson}"`,
    `"${s.phone}"`,
    s.standardUnitPrice,
    s.totalDelivered,
    s.totalReturns,
    s.totalNetSold,
    s.totalInvoiced,
    s.totalPaid,
    s.outstandingDebt,
    `"${s.status}"`,
    `"${s.lastDeliveryDate}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
