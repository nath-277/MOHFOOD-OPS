import { getInventoryItems } from "@/server/inventory/store";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";

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
    totalDelivered: 0,
    totalReturns: 0,
    totalNetSold: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    status: "ACTIVE",
    lastDeliveryDate: "None",
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
    totalDelivered: 0,
    totalReturns: 0,
    totalNetSold: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    status: "ACTIVE",
    lastDeliveryDate: "None",
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
    totalDelivered: 0,
    totalReturns: 0,
    totalNetSold: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    status: "ACTIVE",
    lastDeliveryDate: "None",
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
    totalDelivered: 0,
    totalReturns: 0,
    totalNetSold: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    status: "ACTIVE",
    lastDeliveryDate: "None",
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
    totalDelivered: 0,
    totalReturns: 0,
    totalNetSold: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingDebt: 0,
    status: "ACTIVE",
    lastDeliveryDate: "None",
  },
];

export const CONSIGNMENT_DELIVERIES: ConsignmentDelivery[] = [];

export const CONSIGNMENT_RETURNS: ConsignmentReturn[] = [];

export const CONSIGNMENT_PAYMENTS: ConsignmentPayment[] = [];

export const WHATSAPP_INVOICES: WhatsAppInvoice[] = [];

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
  const stockists = await getRetailStockists();
  const invoices = await getWhatsAppInvoices();

  // 1. Raw Stock Valuation
  const rawStockValuation = items.reduce(
    (sum, item) => sum + item.currentStock * (item.costPerUnit || 0),
    0
  );

  // 2. Total Supermarket Consignment Receivables (Debt)
  const totalConsignmentDebt = stockists.reduce(
    (sum, s) => sum + s.outstandingDebt,
    0
  );

  // 3. WhatsApp Invoices Queue
  const pendingInvoices = invoices.filter(
    (inv) => inv.status === "PENDING_REVIEW"
  ).length;

  // 4. Daily Production Output
  const dailyOutput = 0;
  const targetOutput = 1000;

  return {
    rawStockValuation: Math.round(rawStockValuation),
    totalConsignmentDebt,
    pendingInvoices,
    dailyOutput,
    targetOutput,
    totalStockists: stockists.length,
    activeAccountsPending: stockists.filter((s) => s.outstandingDebt > 0).length,
  };
}

export async function getRetailStockists(searchQuery?: string) {
  if (db) {
    try {
      const dbStockists = await db.select().from(schema.retailStockists);
      const dbDeliveries = await db.select().from(schema.consignmentDeliveries);
      const dbReturns = await db.select().from(schema.consignmentReturns);
      const dbPayments = await db.select().from(schema.consignmentPayments);

      let list: RetailStockist[] = dbStockists.map((s) => {
        const deliveries = dbDeliveries.filter((d) => d.stockistId === s.id);
        const returns = dbReturns.filter((r) => r.stockistId === s.id);
        const payments = dbPayments.filter((p) => p.stockistId === s.id);

        const totalDelivered = deliveries.reduce((sum, d) => sum + d.quantityDelivered, 0);
        const totalReturns = returns.reduce((sum, r) => sum + r.quantityReturned, 0);
        const totalNetSold = Math.max(0, totalDelivered - totalReturns);
        const unitPrice = Number(s.standardUnitPrice) || 2000;
        const totalInvoiced = deliveries.reduce((sum, d) => sum + Number(d.totalAmount), 0);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalCredits = returns.reduce((sum, r) => sum + Number(r.creditAmount), 0);
        const outstandingDebt = Math.max(0, totalInvoiced - totalCredits - totalPaid);

        let status: any = s.status;
        if (outstandingDebt === 0 && totalInvoiced > 0) status = "VERIFIED_PAID";
        else if (outstandingDebt > 0) status = "PENDING_SETTLEMENT";

        const lastDelivery = deliveries[0]?.dispatchDate;
        const lastDeliveryDate = lastDelivery ? new Date(lastDelivery).toLocaleDateString() : "None";

        return {
          id: s.id,
          code: s.code,
          name: s.name,
          location: s.location,
          contactPerson: s.contactPerson || "Procurement Officer",
          phone: s.phone || "+234 800 000 0000",
          standardUnitPrice: unitPrice,
          paymentTerms: s.paymentTerms || "Sale or Return (SoR)",
          totalDelivered,
          totalReturns,
          totalNetSold,
          totalInvoiced,
          totalPaid,
          outstandingDebt,
          status,
          lastDeliveryDate,
        };
      });

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
    } catch (err) {
      console.error("DB error in getRetailStockists:", err);
    }
  }

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

  if (db) {
    try {
      const inserted = await db.insert(schema.retailStockists).values({
        code,
        name: data.name.trim(),
        location: data.location.trim(),
        contactPerson: data.contactPerson.trim(),
        phone: data.phone.trim(),
        standardUnitPrice: (Number(data.standardUnitPrice) || 2000).toFixed(2),
        paymentTerms: data.paymentTerms?.trim() || "Sale or Return (SoR)",
        status: "ACTIVE",
      }).returning();

      if (inserted.length > 0) {
        const s = inserted[0];
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          location: s.location,
          contactPerson: s.contactPerson || "",
          phone: s.phone || "",
          standardUnitPrice: Number(s.standardUnitPrice),
          paymentTerms: s.paymentTerms || "Sale or Return (SoR)",
          totalDelivered: 0,
          totalReturns: 0,
          totalNetSold: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingDebt: 0,
          status: "ACTIVE" as const,
          lastDeliveryDate: "None",
        };
      }
    } catch (err) {
      console.error("DB error in createRetailStockist:", err);
    }
  }

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
  const quantity = Number(data.quantityDelivered);
  const unitPrice = Number(data.unitPrice) || 2000;
  const totalAmount = quantity * unitPrice;
  const waybillNumber = `WAY-MOH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  if (db) {
    try {
      const stockist = await db.select().from(schema.retailStockists).where(eq(schema.retailStockists.id, data.stockistId)).limit(1);
      if (stockist.length > 0) {
        const inserted = await db.insert(schema.consignmentDeliveries).values({
          stockistId: stockist[0].id,
          productCode: data.productCode,
          productName: data.productName,
          quantityDelivered: quantity,
          unitPrice: unitPrice.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          driverName: data.driverName.trim(),
          waybillNumber,
          status: "DELIVERED",
          notes: data.notes?.trim(),
        }).returning();

        return {
          id: inserted[0].id,
          stockistId: stockist[0].id,
          stockistName: stockist[0].name,
          productCode: data.productCode,
          productName: data.productName,
          quantityDelivered: quantity,
          unitPrice,
          totalAmount,
          driverName: data.driverName.trim(),
          waybillNumber,
          dispatchDate: inserted[0].dispatchDate.toISOString(),
          status: "DELIVERED" as const,
          notes: data.notes?.trim(),
        };
      }
    } catch (err) {
      console.error("DB error in createConsignmentDelivery:", err);
    }
  }

  const stockist = RETAIL_STOCKISTS.find((s) => s.id === data.stockistId);
  if (!stockist) throw new Error(`Stockist not found: ${data.stockistId}`);

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
  const quantity = Number(data.quantityReturned);
  const unitPrice = 2000;
  const creditAmount = quantity * unitPrice;

  if (db) {
    try {
      const stockist = await db.select().from(schema.retailStockists).where(eq(schema.retailStockists.id, data.stockistId)).limit(1);
      if (stockist.length > 0) {
        const inserted = await db.insert(schema.consignmentReturns).values({
          stockistId: stockist[0].id,
          productCode: data.productCode || "REC-PARFAIT-400ML",
          quantityReturned: quantity,
          unitPrice: unitPrice.toFixed(2),
          creditAmount: creditAmount.toFixed(2),
          reason: data.reason,
          receivedBy: data.receivedBy,
          notes: data.notes?.trim(),
        }).returning();

        return {
          id: inserted[0].id,
          stockistId: stockist[0].id,
          stockistName: stockist[0].name,
          productCode: data.productCode || "REC-PARFAIT-400ML",
          quantityReturned: quantity,
          unitPrice,
          creditAmount,
          reason: data.reason,
          returnDate: inserted[0].returnDate.toISOString(),
          receivedBy: data.receivedBy,
          notes: data.notes?.trim(),
        };
      }
    } catch (err) {
      console.error("DB error in recordConsignmentReturn:", err);
    }
  }

  const stockist = RETAIL_STOCKISTS.find((s) => s.id === data.stockistId);
  if (!stockist) throw new Error(`Stockist not found: ${data.stockistId}`);

  const ret: ConsignmentReturn = {
    id: `cret-${Date.now()}`,
    stockistId: stockist.id,
    stockistName: stockist.name,
    productCode: data.productCode || "REC-PARFAIT-400ML",
    quantityReturned: quantity,
    unitPrice: stockist.standardUnitPrice,
    creditAmount: quantity * stockist.standardUnitPrice,
    reason: data.reason,
    returnDate: new Date().toISOString(),
    receivedBy: data.receivedBy,
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
  receiptUrl?: string;
  notes?: string;
}) {
  const amount = Number(data.amount);

  if (db) {
    try {
      const stockist = await db.select().from(schema.retailStockists).where(eq(schema.retailStockists.id, data.stockistId)).limit(1);
      if (stockist.length > 0) {
        const inserted = await db.insert(schema.consignmentPayments).values({
          stockistId: stockist[0].id,
          amount: amount.toFixed(2),
          paymentMethod: data.paymentMethod,
          reference: data.reference.trim(),
          receivedBy: data.verifiedBy || "Executive Management",
          notes: data.notes?.trim(),
        }).returning();

        return {
          id: inserted[0].id,
          stockistId: stockist[0].id,
          stockistName: stockist[0].name,
          amount,
          paymentMethod: data.paymentMethod,
          reference: data.reference.trim(),
          paymentDate: inserted[0].paymentDate.toISOString(),
          receiptUrl: data.receiptUrl,
          verifiedBy: data.verifiedBy || "Executive Management",
          notes: data.notes?.trim(),
        };
      }
    } catch (err) {
      console.error("DB error in recordConsignmentPayment:", err);
    }
  }

  const stockist = RETAIL_STOCKISTS.find((s) => s.id === data.stockistId);
  if (!stockist) throw new Error(`Stockist not found: ${data.stockistId}`);

  const payment: ConsignmentPayment = {
    id: `cpay-${Date.now()}`,
    stockistId: stockist.id,
    stockistName: stockist.name,
    amount,
    paymentMethod: data.paymentMethod,
    reference: data.reference.trim(),
    paymentDate: new Date().toISOString(),
    receiptUrl: data.receiptUrl,
    verifiedBy: data.verifiedBy || "Executive Management",
    notes: data.notes?.trim(),
  };

  CONSIGNMENT_PAYMENTS.unshift(payment);
  recalculateStockist(stockist.id);

  return payment;
}

export async function getWhatsAppInvoices(statusFilter?: string) {
  if (db) {
    try {
      const rows = await db.select().from(schema.whatsappInvoices).orderBy(desc(schema.whatsappInvoices.uploadDate));
      let list: WhatsAppInvoice[] = rows.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.fileName || `INV-${inv.id.slice(0, 6)}`,
        senderPhone: inv.senderPhone || "+234 800 000 0000",
        driverName: "Delivery Driver",
        stockistName: "Retail Store",
        amount: Number(inv.amount || 0),
        itemCount: 0,
        time: inv.uploadDate ? new Date(inv.uploadDate).toLocaleString() : "Recent",
        fileUrl: inv.fileUrl,
        status: inv.status === "PAYMENT_RECONCILED" ? "VERIFIED" : inv.status === "DISPUTED" ? "REJECTED" : "PENDING_REVIEW",
        notes: inv.notes || undefined,
      }));

      if (statusFilter && statusFilter !== "ALL") {
        list = list.filter((inv) => inv.status === statusFilter);
      }
      return list;
    } catch (err) {
      console.error("DB error in getWhatsAppInvoices:", err);
    }
  }

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

  if (db) {
    try {
      const inserted = await db.insert(schema.whatsappInvoices).values({
        fileName: id.toUpperCase(),
        fileUrl: data.fileUrl || "",
        senderPhone: data.senderPhone.trim(),
        amount: Number(data.amount).toFixed(2),
        status: "PENDING_VERIFICATION",
        notes: data.notes?.trim(),
      }).returning();

      if (inserted.length > 0) {
        return {
          id: inserted[0].id,
          invoiceNumber: id.toUpperCase(),
          driverName: data.driverName.trim(),
          senderPhone: data.senderPhone.trim(),
          stockistName: data.stockistName.trim(),
          amount: Number(data.amount),
          itemCount: Number(data.itemCount),
          time: "Just now",
          fileUrl: data.fileUrl,
          status: "PENDING_REVIEW" as const,
          notes: data.notes?.trim(),
        };
      }
    } catch (err) {
      console.error("DB error in createWhatsAppInvoice:", err);
    }
  }

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
