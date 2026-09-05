import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import {
  getManagementOverview,
  getRetailStockists,
  getRetailStockistById,
  createRetailStockist,
  createConsignmentDelivery,
  recordConsignmentReturn,
  recordConsignmentPayment,
  getWhatsAppInvoices,
  createWhatsAppInvoice,
  verifyWhatsAppInvoice,
  getPlantParRunway,
  generateSoRCSV,
} from "../../management/store";

export const managementRouter = new Hono();

async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// 1. EXECUTIVE KPI OVERVIEW
managementRouter.get("/overview", async (c) => {
  try {
    const data = await getManagementOverview();
    return c.json({ success: true, ...data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load management overview." }, 500);
  }
});

// 2. RETAIL STOCKISTS DIRECTORY
managementRouter.get("/stockists", async (c) => {
  try {
    const search = c.req.query("search");
    const stockists = await getRetailStockists(search);
    return c.json({ success: true, stockists });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load stockists." }, 500);
  }
});

// CREATE RETAIL STOCKIST
managementRouter.post("/stockists", async (c) => {
  try {
    const body = await c.req.json();
    const { name, location, contactPerson, phone, standardUnitPrice, paymentTerms } = body;

    if (!name || !location || !contactPerson || !phone) {
      return c.json({ error: "Name, location, contact person, and phone are required." }, 400);
    }

    const stockist = await createRetailStockist({
      name,
      location,
      contactPerson,
      phone,
      standardUnitPrice: Number(standardUnitPrice) || 2000,
      paymentTerms,
    });

    return c.json({ success: true, stockist, message: `Stockist account ${stockist.name} registered.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create stockist." }, 400);
  }
});

// GET STOCKIST DETAILS & LEDGER HISTORY
managementRouter.get("/stockists/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const details = await getRetailStockistById(id);
    return c.json({ success: true, ...details });
  } catch (err: any) {
    return c.json({ error: err.message || "Stockist not found." }, 404);
  }
});

// 3. DISPATCH CONSIGNMENT DELIVERY
managementRouter.post("/deliveries", async (c) => {
  try {
    const body = await c.req.json();
    const {
      stockistId,
      productCode = "REC-PARFAIT-400ML",
      productName = "Moh Yogurt Parfait (400ml Cup)",
      quantityDelivered,
      unitPrice,
      driverName = "Sunday B. (Van 1)",
      notes,
    } = body;

    if (!stockistId || !quantityDelivered || Number(quantityDelivered) <= 0) {
      return c.json({ error: "Stockist ID and delivered quantity (> 0) are required." }, 400);
    }

    const delivery = await createConsignmentDelivery({
      stockistId,
      productCode,
      productName,
      quantityDelivered: Number(quantityDelivered),
      unitPrice: unitPrice ? Number(unitPrice) : undefined,
      driverName,
      notes,
    });

    return c.json({
      success: true,
      delivery,
      message: `Consignment delivery ${delivery.waybillNumber} recorded successfully.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record delivery." }, 400);
  }
});

// 4. RECORD SALE OR RETURN (SoR) SHELF RETURN & CREDIT
managementRouter.post("/returns", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const {
      stockistId,
      quantityReturned,
      reason = "EXPIRED_ON_SHELF",
      receivedBy = user?.fullName || "Sunday B. (Driver)",
      productCode,
      notes,
    } = body;

    if (!stockistId || !quantityReturned || Number(quantityReturned) <= 0) {
      return c.json({ error: "Stockist ID and returned quantity (> 0) are required." }, 400);
    }

    const ret = await recordConsignmentReturn({
      stockistId,
      quantityReturned: Number(quantityReturned),
      reason,
      receivedBy,
      productCode,
      notes,
    });

    return c.json({
      success: true,
      returnRecord: ret,
      message: `SoR return recorded. Credit adjustment of ₦${ret.creditAmount.toLocaleString()} applied.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record return." }, 400);
  }
});

// 5. RECORD PAYMENT SETTLEMENT
managementRouter.post("/payments", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const {
      stockistId,
      amount,
      paymentMethod = "BANK_TRANSFER",
      reference,
      notes,
    } = body;

    if (!stockistId || !amount || Number(amount) <= 0 || !reference) {
      return c.json({ error: "Stockist ID, payment amount, and payment reference are required." }, 400);
    }

    const payment = await recordConsignmentPayment({
      stockistId,
      amount: Number(amount),
      paymentMethod,
      reference,
      verifiedBy: user?.fullName || "Executive Management",
      notes,
    });

    return c.json({
      success: true,
      payment,
      message: `Payment of ₦${payment.amount.toLocaleString()} settled successfully.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record payment." }, 400);
  }
});

// 6. WHATSAPP INVOICES QUEUE
managementRouter.get("/whatsapp-invoices", async (c) => {
  try {
    const status = c.req.query("status");
    const invoices = await getWhatsAppInvoices(status);
    return c.json({ success: true, invoices });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load WhatsApp queue." }, 500);
  }
});

// SUBMIT NEW WHATSAPP INVOICE / RECEIPT
managementRouter.post("/whatsapp-invoices", async (c) => {
  try {
    const body = await c.req.json();
    const { driverName, senderPhone, stockistName, amount, itemCount, fileUrl, notes } = body;

    if (!driverName || !senderPhone || !stockistName || !amount) {
      return c.json({ error: "Driver name, sender phone, stockist, and amount are required." }, 400);
    }

    const invoice = await createWhatsAppInvoice({
      driverName,
      senderPhone,
      stockistName,
      amount: Number(amount),
      itemCount: Number(itemCount) || 0,
      fileUrl,
      notes,
    });

    return c.json({ success: true, invoice, message: `WhatsApp invoice ${invoice.invoiceNumber} queued.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to submit invoice." }, 400);
  }
});

// ONE-CLICK VERIFY WHATSAPP INVOICE
managementRouter.put("/whatsapp-invoices/:id/verify", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const verifiedByName = user?.fullName || "Executive Director";

    const invoice = await verifyWhatsAppInvoice(id, verifiedByName);
    return c.json({
      success: true,
      invoice,
      message: `Invoice ${invoice.invoiceNumber} verified and reconciled.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Verification failed." }, 400);
  }
});

// 7. PLANT PAR LEVELS RUNWAY
managementRouter.get("/par-levels", async (c) => {
  try {
    const runways = await getPlantParRunway();
    return c.json({ success: true, parRunways: runways });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load par levels." }, 500);
  }
});

// 8. EXPORT SoR RECONCILIATION CSV
managementRouter.get("/export-sor", (c) => {
  const csvData = generateSoRCSV();
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="moh-sor-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.text(csvData);
});
