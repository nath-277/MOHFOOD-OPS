/**
 * Isolated Print Utilities for Moh Foods Operations
 * Uses an isolated, clean iframe document to prevent any dashboard CSS,
 * overflow restrictions (e.g. h-screen), or background page elements
 * from interfering with printing or PDF generation.
 */

import { DailyShiftReport, DailyShiftReportRow } from "@/server/inventory/store";

export function printHtmlDocument(
  htmlContent: string,
  documentTitle: string,
  orientation: "portrait" | "landscape" = "landscape"
) {
  if (typeof window === "undefined") return;

  // Clean up any existing print iframe
  const existing = document.getElementById("moh-isolated-print-frame");
  if (existing && document.body.contains(existing)) {
    document.body.removeChild(existing);
  }

  // Create an invisible iframe
  const iframe = document.createElement("iframe");
  iframe.setAttribute("id", "moh-isolated-print-frame");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";

  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) {
    console.error("Failed to access print iframe document");
    return;
  }

  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${documentTitle}</title>
        <style>
          @page {
            size: A4 ${orientation};
            margin: ${orientation === "landscape" ? "8mm 10mm" : "8mm 10mm"};
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            font-size: 11px;
            line-height: 1.35;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          tbody {
            display: table-row-group;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  frameDoc.close();

  // Wait for iframe resources and trigger native print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Print execution error:", err);
    } finally {
      // Clean up iframe after print dialog is closed
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 350);
}

/**
 * Format numbers nicely for reports
 */
function formatQty(qty: number): string {
  if (qty === 0) return "0";
  return Number(qty.toFixed(3)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/**
 * Generate Standalone Multi-Page HTML for Daily Store Shift Stock Sheet (A4 Landscape)
 */
export function generateStockSheetHtml({
  report,
  selectedDate,
  shiftLabel,
  rows,
}: {
  report: DailyShiftReport | null;
  selectedDate: string;
  shiftLabel: string;
  rows: DailyShiftReportRow[];
}): string {
  const tableRowsHtml = rows
    .map((row, idx) => {
      return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
        <td style="padding: 5px 6px; text-align: center; color: #64748b; font-family: monospace; font-size: 10px; width: 30px;">
          ${idx + 1}
        </td>
        <td style="padding: 5px 8px; min-width: 180px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${row.itemName}</div>
          <div style="font-size: 9px; color: #64748b; font-family: monospace; margin-top: 1px;">
            ${row.itemCode} • ${row.uom} ${row.isVariablePack ? '<span style="color: #7e22ce; font-weight: bold;">(Variable)</span>' : ""}
          </div>
        </td>
        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #334155; background-color: #f1f5f933;">
          ${formatQty(row.openingStock)} <span style="font-size: 9px; color: #94a3b8;">${row.uom}</span>
        </td>
        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700;">
          ${
            row.newStock > 0
              ? `<span style="color: #059669; background-color: #ecfdf5; padding: 1px 4px; border-radius: 3px;">+${formatQty(row.newStock)}</span>`
              : `<span style="color: #cbd5e1;">—</span>`
          }
        </td>
        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a; background-color: #f1f5f966;">
          ${formatQty(row.totalStock)} <span style="font-size: 9px; color: #94a3b8;">${row.uom}</span>
        </td>
        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700;">
          ${
            row.usage > 0
              ? `<span style="color: #cf0458; background-color: #fdf2f8; padding: 1px 4px; border-radius: 3px;">-${formatQty(row.usage)} ${row.uom}</span>`
              : `<span style="color: #cbd5e1;">—</span>`
          }
          ${row.usageSecondary ? `<div style="font-size: 9px; color: #7e22ce; margin-top: 1px;">(${row.usageSecondary})</div>` : ""}
        </td>
        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700;">
          ${
            row.damages > 0
              ? `<span style="color: #b45309; background-color: #fef3c7; padding: 1px 4px; border-radius: 3px;">-${formatQty(row.damages)}</span>`
              : `<span style="color: #cbd5e1;">—</span>`
          }
        </td>
        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #020617; background-color: #e2e8f066;">
          <span style="font-size: 11.5px;">${formatQty(row.closingStock)}</span>
          <span style="font-size: 9px; color: #475569; font-weight: bold;">${row.uom}</span>
        </td>
      </tr>
    `;
    })
    .join("");

  return `
    <div style="width: 100%;">
      <!-- Official Header Bar -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #020617;">
            Moh Foods & Confectionery
          </h1>
          <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 700; color: #334155;">
            Plant: Lagos Central Processing Facility • Central Store Division
          </p>
          <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 900; color: #cf0458; letter-spacing: 0.5px;">
            DAILY STORE SHIFT STOCK SHEET
          </p>
        </div>
        <div style="text-align: right; font-size: 10.5px; font-family: monospace; line-height: 1.4;">
          <div><strong style="color: #475569;">Date:</strong> <span style="font-weight: bold; color: #0f172a;">${selectedDate}</span></div>
          <div><strong style="color: #475569;">Shift:</strong> <span style="font-weight: bold; color: #0f172a;">${shiftLabel}</span></div>
          <div><strong style="color: #475569;">Officer on Duty:</strong> <span style="font-weight: bold; color: #0f172a;">${report?.officerOnDuty || "Store Officer"}</span></div>
        </div>
      </div>

      <!-- 7-Column Ledger Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; margin-top: 6px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
            <th style="padding: 7px 6px; text-align: center; border: 1px solid #334155; width: 30px;">#</th>
            <th style="padding: 7px 8px; text-align: left; border: 1px solid #334155; min-width: 180px;">Item Name</th>
            <th style="padding: 7px 8px; text-align: right; border: 1px solid #334155;">Opening Stock</th>
            <th style="padding: 7px 8px; text-align: right; border: 1px solid #334155;">New Stock (+)</th>
            <th style="padding: 7px 8px; text-align: right; border: 1px solid #334155;">Total Stock</th>
            <th style="padding: 7px 8px; text-align: right; border: 1px solid #334155;">Usage (-)</th>
            <th style="padding: 7px 8px; text-align: right; border: 1px solid #334155;">Damages (-)</th>
            <th style="padding: 7px 8px; text-align: right; border: 1px solid #334155;">Closing Stock</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <!-- Sign-off Blocks (Kept atomic on page) -->
      <div class="avoid-break" style="margin-top: 24px; padding-top: 14px; border-top: 2px solid #0f172a;">
        <table style="width: 100%; border: none;">
          <tr style="border: none;">
            <td style="width: 50%; vertical-align: top; border: none; padding-right: 20px;">
              <p style="margin: 0 0 6px 0; font-weight: 800; font-size: 11px; color: #1e293b;">Store Officer on Duty Sign-off:</p>
              <div style="border-bottom: 1px dashed #475569; width: 80%; margin: 28px 0 6px 0;"></div>
              <p style="margin: 0; font-size: 10.5px; font-weight: 600; color: #334155;">
                Name: ${report?.officerOnDuty || "................................................"}
              </p>
              <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #64748b;">Date & Time: ................................................</p>
            </td>
            <td style="width: 50%; vertical-align: top; border: none; padding-left: 20px;">
              <p style="margin: 0 0 6px 0; font-weight: 800; font-size: 11px; color: #1e293b;">Handover Receiving Officer / Plant Supervisor:</p>
              <div style="border-bottom: 1px dashed #475569; width: 80%; margin: 28px 0 6px 0;"></div>
              <p style="margin: 0; font-size: 10.5px; font-weight: 600; color: #334155;">
                Name: ${report?.handoverOfficer || "................................................"}
              </p>
              <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #64748b;">Date & Time: ................................................</p>
            </td>
          </tr>
        </table>
        <p style="text-align: center; margin: 16px 0 0 0; font-size: 8.5px; color: #94a3b8; letter-spacing: 0.5px;">
          Certified by Moh Foods Digital Plant Operations System • Printed on ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;
}

/**
 * Utility to strip parenthesized role titles and resolve clean person names
 */
export function cleanStaffName(name?: string, defaultFallback: string = "Staff"): string {
  if (!name) return defaultFallback;
  // Remove parenthesized role or info: e.g. "David Adeleke (Production Supervisor)" -> "David Adeleke"
  let cleaned = name.replace(/\s*\([^)]*\)/g, "").trim();
  const lower = cleaned.toLowerCase();
  if (
    lower === "production supervisor" ||
    lower === "production floor supervisor" ||
    lower === "production lead" ||
    lower === "supervisor"
  ) {
    return defaultFallback !== "Staff" ? defaultFallback : "David Adeleke";
  }
  if (
    lower === "store officer" ||
    lower === "store officer on duty" ||
    lower === "store staff" ||
    lower === "store manager" ||
    lower === "store"
  ) {
    return defaultFallback !== "Staff" ? defaultFallback : "Ajayi Boluwatife";
  }
  return cleaned || defaultFallback;
}

/**
 * Generate Standalone Single-Page HTML for Material Requisition Slip (A4 Portrait)
 */
export function generateRequisitionSlipHtml({
  shiftType,
  date,
  referenceId,
  productName,
  preparedBy,
  acceptedBy,
  issuedBy,
  items,
  status,
  isApproved,
}: {
  shiftType: string;
  date: string;
  referenceId?: string;
  productName?: string;
  preparedBy?: string;
  acceptedBy?: string;
  issuedBy: string;
  items: Array<{ itemName: string; itemCode?: string; quantity: number; unit: string; notes?: string }>;
  status?: "PENDING_APPROVAL" | "APPROVED";
  isApproved?: boolean;
}): string {
  const cleanAccepted = cleanStaffName(acceptedBy || preparedBy, "David Adeleke");
  const cleanIssued = cleanStaffName(issuedBy, "Store Officer");
  const approved = Boolean(isApproved || status === "APPROVED");

  const isKgUnit = (unit: string) => {
    const u = (unit || "").toLowerCase();
    return u === "kg" || u === "kilogram" || u === "kilograms" || u === "g" || u === "grams";
  };

  const formatKgQty = (qty: number, unit: string) => {
    const u = (unit || "").toLowerCase();
    if (u === "g" || u === "grams") return (qty / 1000).toFixed(3);
    return qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  };

  const formatPiecesQty = (qty: number) => {
    return qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  };

  const formatShiftLabel = (shift: string) => {
    if (shift === "MORNING_SHIFT") return "Morning Shift (08:00 – 18:00)";
    if (shift === "NIGHT_SHIFT") return "Night Shift (18:00 – 08:00)";
    return "Consolidated Shift Run";
  };

  const itemRowsHtml = items
    .map((item) => {
      // Prioritize the actual dished amount (e.g. 400 pcs) if found in notes or secondary usage
      let displayQty = Math.abs(item.quantity);
      let displayUnit = item.unit;
      let displayNotes = item.notes;

      const dishedMatch = item.notes?.match(/(?:dished|dispensed|variable material:?)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i) ||
                          item.notes?.match(/^(\d+(?:\.\d+)?)\s*(pcs|pieces|cups|ml|g|kg)$/i);

      if (dishedMatch && Number(dishedMatch[1]) > 0) {
        displayQty = Number(dishedMatch[1]);
        displayUnit = dishedMatch[2];
        displayNotes = item.quantity > 0 && item.unit !== displayUnit
          ? `dished for floor run (drawn from ${item.quantity} ${item.unit})`
          : undefined;
      }

      const isKg = isKgUnit(displayUnit);

      return `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 4px 8px; border-right: 2px solid #020617; font-weight: 800; text-transform: uppercase; font-size: 10.5px;">
          <div>${item.itemName}</div>
          ${displayNotes ? `<div style="font-size: 8.5px; color: #64748b; font-style: italic; font-weight: normal; text-transform: none;">${displayNotes}</div>` : ""}
        </td>
        <td style="padding: 4px 8px; border-right: 2px solid #020617; text-align: right; font-family: monospace; font-weight: 700; font-size: 11px;">
          ${isKg ? formatKgQty(displayQty, displayUnit) : `<span style="color: #cbd5e1;">—</span>`}
        </td>
        <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; font-size: 11px;">
          ${
            !isKg
              ? `${formatPiecesQty(displayQty)} <span style="font-size: 8.5px; color: #64748b; font-weight: normal;">${displayUnit}</span>`
              : `<span style="color: #cbd5e1;">—</span>`
          }
        </td>
      </tr>
    `;
    })
    .join("");

  // Pad lines so total lines look neat without overflowing 1 A4 page
  const padCount = Math.max(0, Math.min(4, 6 - items.length));
  const padRowsHtml = Array.from({ length: padCount })
    .map(
      () => `
      <tr style="border-bottom: 1px solid #cbd5e1; height: 22px;">
        <td style="border-right: 2px solid #020617;">&nbsp;</td>
        <td style="border-right: 2px solid #020617;">&nbsp;</td>
        <td>&nbsp;</td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="width: 100%; border: 2.5px solid #020617; padding: 14px 16px; box-sizing: border-box; background: #ffffff;">
      <!-- Slip Header matching factory paper form -->
      <div style="text-align: center; border-bottom: 2px solid #020617; padding-bottom: 6px; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; font-family: Georgia, serif; color: #020617;">
          MOH INDUSTRIES LIMITED
        </h2>
        <h3 style="margin: 2px 0 0 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px;">
          RAW MATERIAL AND PACKAGING MATERIAL REQUISITION FORM
        </h3>
      </div>

      <!-- Shift & Date Metadata -->
      <table style="width: 100%; border-bottom: 2px solid #020617; margin-bottom: 8px; padding-bottom: 4px;">
        <tr>
          <td style="font-size: 10.5px; font-weight: 800; color: #020617;">
            <span style="color: #475569; text-transform: uppercase;">SHIFT:</span>
            <span style="text-decoration: underline; margin-left: 4px;">${formatShiftLabel(shiftType)}</span>
          </td>
          <td style="font-size: 10.5px; font-weight: 800; color: #020617; text-align: right;">
            <span style="color: #475569; text-transform: uppercase;">DATE:</span>
            <span style="text-decoration: underline; margin-left: 4px;">${date}</span>
          </td>
        </tr>
        ${
          referenceId
            ? `<tr>
                <td colspan="2" style="font-size: 9px; font-family: monospace; color: #64748b; padding-top: 2px;">
                  Requisition Ref: <strong>${referenceId}</strong>
                  ${productName ? ` • Target: <strong>${productName}</strong>` : ""}
                </td>
              </tr>`
            : ""
        }
      </table>

      <!-- 3-Column Materials Table -->
      <table style="width: 100%; border: 2px solid #020617; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #020617; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #020617;">
            <th rowspan="2" style="padding: 4px 8px; border-right: 2px solid #020617; text-align: left; font-size: 10.5px; width: 60%;">
              ITEMS
            </th>
            <th colspan="2" style="padding: 2px 8px; text-align: center; border-bottom: 1px solid #020617; font-size: 10px;">
              QUANTITY
            </th>
          </tr>
          <tr style="background-color: #f1f5f9; color: #020617; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #020617;">
            <th style="padding: 3px 8px; border-right: 2px solid #020617; text-align: right; font-size: 9.5px; width: 20%;">
              KILOGRAM
            </th>
            <th style="padding: 3px 8px; text-align: right; font-size: 9.5px; width: 20%;">
              PIECES / UNITS
            </th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
          ${padRowsHtml}
        </tbody>
      </table>

      <!-- Dual Verification Signatures -->
      <div style="border-top: 2px solid #020617; margin-top: 10px; padding-top: 8px;">
        <table style="width: 100%; border: none;">
          <tr>
            <td style="width: 50%; vertical-align: top; border-right: 1px solid #cbd5e1; padding-right: 12px;">
              <div style="font-size: 10px; font-weight: 800; color: #020617; display: flex; justify-content: space-between;">
                <span style="color: #475569;">ACCEPTED BY:</span>
                <span>${cleanAccepted}</span>
              </div>
              <div style="margin-top: 6px;">
                <span style="font-size: 8.5px; font-weight: 800; color: #64748b;">SIGNATURE:</span>
                ${
                  approved
                    ? `<div style="border-bottom: 1px solid #020617; width: 85%; margin-top: 8px; font-size: 8.5px; color: #059669; font-weight: bold; font-family: monospace;">
                        ✓ Accepted & Verified (${cleanAccepted})
                      </div>`
                    : `<div style="border-bottom: 1px dashed #94a3b8; width: 85%; margin-top: 12px; font-size: 8px; color: #b45309; font-weight: 700; font-family: monospace;">
                        Pending Production Acceptance
                      </div>`
                }
              </div>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 12px;">
              <div style="font-size: 10px; font-weight: 800; color: #020617; display: flex; justify-content: space-between;">
                <span style="color: #475569;">ISSUED BY:</span>
                <span>${cleanIssued}</span>
              </div>
              <div style="margin-top: 6px;">
                <span style="font-size: 8.5px; font-weight: 800; color: #64748b;">SIGNATURE:</span>
                <div style="border-bottom: 1px solid #020617; width: 85%; margin-top: 8px; font-size: 8.5px; color: #059669; font-weight: bold; font-family: monospace;">
                  ✓ Issued From Store (${cleanIssued})
                </div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <p style="text-align: center; margin: 8px 0 0 0; font-size: 8px; color: #94a3b8; font-family: monospace; letter-spacing: 0.5px; text-transform: uppercase;">
        Moh Foods Digital Plant Operations • Material Requisition Certified Record
      </p>
    </div>
  `;
}
