"use client";

import React from "react";
import { X, Printer, FileText, CheckCircle2 } from "lucide-react";
import { generateRequisitionSlipHtml, printHtmlDocument, cleanStaffName } from "@/lib/printUtils";

export interface RequisitionItem {
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface MaterialRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftType: string;
  date: string;
  referenceId?: string;
  preparedBy?: string;
  acceptedBy?: string;
  issuedBy?: string;
  status?: "PENDING_APPROVAL" | "APPROVED";
  isApproved?: boolean;
  items: RequisitionItem[];
  productName?: string;
}

export function MaterialRequisitionModal({
  isOpen,
  onClose,
  shiftType,
  date,
  referenceId,
  preparedBy = "David Adeleke",
  acceptedBy,
  issuedBy = "Ajayi Boluwatife",
  status,
  isApproved,
  items,
  productName,
}: MaterialRequisitionModalProps) {
  if (!isOpen) return null;

  const cleanAccepted = cleanStaffName(acceptedBy || preparedBy, "David Adeleke");
  const cleanIssued = cleanStaffName(issuedBy, "Ajayi Boluwatife");
  const approved = Boolean(isApproved || status === "APPROVED");

  const handlePrint = () => {
    const html = generateRequisitionSlipHtml({
      shiftType,
      date,
      referenceId,
      productName,
      preparedBy: cleanAccepted,
      acceptedBy: cleanAccepted,
      issuedBy: cleanIssued,
      items,
      status,
      isApproved: approved,
    });
    printHtmlDocument(html, `Material_Requisition_${date}_${shiftType}`, "portrait");
  };

  const formatShiftLabel = (shift: string) => {
    if (shift === "MORNING_SHIFT") return "Morning Shift (08:00 – 18:00)";
    if (shift === "NIGHT_SHIFT") return "Night Shift (18:00 – 08:00)";
    return "Consolidated Shift Run";
  };

  const isKgUnit = (unit: string) => {
    const u = (unit || "").toLowerCase();
    return u === "kg" || u === "kilogram" || u === "kilograms" || u === "g" || u === "grams";
  };

  const formatKgQty = (qty: number, unit: string) => {
    const u = (unit || "").toLowerCase();
    if (u === "g" || u === "grams") {
      return (qty / 1000).toFixed(3);
    }
    return qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  };

  const formatPiecesQty = (qty: number, unit: string) => {
    return qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:fixed print:inset-0 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
        {/* Modal Top Bar (Screen only) */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Material Requisition Form
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Official Production Floor Exchange Document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Slip Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-sans print:p-0 print:overflow-visible">


          {/* Authentic Form Border Frame */}
          <div
            id="material-requisition-printable"
            className="border-2 border-slate-950 p-4 sm:p-5 space-y-3 print:p-4 print:space-y-2.5 bg-white"
          >
            {/* 1. Official Header matching physical slip */}
            <div className="text-center border-b-2 border-slate-950 pb-2">
              <h2 className="text-base sm:text-lg font-black tracking-wider text-slate-950 uppercase font-serif">
                MOH INDUSTRIES LIMITED
              </h2>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase mt-0.5">
                RAW MATERIAL AND PACKAGING MATERIAL REQUISITION FORM
              </h3>
            </div>

            {/* 2. Metadata: Shift & Date */}
            <div className="grid grid-cols-2 border-b-2 border-slate-950 pb-2 text-xs font-bold">
              <div>
                <span className="text-slate-600 uppercase">SHIFT: </span>
                <span className="text-slate-950 font-black underline decoration-slate-400">
                  {formatShiftLabel(shiftType)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-600 uppercase">DATE: </span>
                <span className="text-slate-950 font-black underline decoration-slate-400">
                  {date}
                </span>
              </div>
              {referenceId && (
                <div className="col-span-2 text-[10px] text-slate-500 font-mono mt-1">
                  Requisition / Batch Ref: <span className="font-bold text-slate-800">{referenceId}</span>
                  {productName && <span> • Target Recipe: <strong className="text-slate-800">{productName}</strong></span>}
                </div>
              )}
            </div>

            {/* 3. The 3-Column Table: ITEMS | KILOGRAM | PIECES */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse border border-slate-950 text-xs print:text-[10px]">
                <thead>
                  <tr className="border-b-2 border-slate-950 bg-slate-100 font-black text-slate-950 text-[11px] print:text-[9px] uppercase">
                    <th className="py-1.5 px-3 border-r-2 border-slate-950 min-w-[200px]" rowSpan={2}>
                      ITEMS
                    </th>
                    <th className="py-1 px-3 text-center border-b border-slate-950" colSpan={2}>
                      QUANTITY
                    </th>
                  </tr>
                  <tr className="border-b-2 border-slate-950 bg-slate-100 font-black text-slate-950 text-[10px] print:text-[8.5px] uppercase">
                    <th className="py-1 px-3 text-right border-r-2 border-slate-950 w-28">
                      KILOGRAM
                    </th>
                    <th className="py-1 px-3 text-right w-28">
                      PIECES / UNITS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-medium text-slate-900">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 font-semibold italic">
                        No materials requisitioned for this period.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      let displayQty = Math.abs(item.quantity);
                      let displayUnit = item.unit;
                      let displayNotes = item.notes;

                      const dishedMatch =
                        item.notes?.match(/(?:dished|dispensed|variable material:?)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i) ||
                        item.notes?.match(/^(\d+(?:\.\d+)?)\s*(pcs|pieces|cups|ml|g|kg)$/i);

                      if (dishedMatch && Number(dishedMatch[1]) > 0) {
                        displayQty = Number(dishedMatch[1]);
                        displayUnit = dishedMatch[2];
                        displayNotes =
                          item.quantity > 0 && item.unit !== displayUnit
                            ? `dished for floor run (drawn from ${item.quantity} ${item.unit})`
                            : undefined;
                      }

                      const isKg = isKgUnit(displayUnit);

                      return (
                        <tr key={idx} className="hover:bg-slate-50 print:hover:bg-transparent">
                          {/* Item Name */}
                          <td className="py-1.5 px-3 border-r-2 border-slate-950 font-bold uppercase tracking-wide print:py-1">
                            <div className="flex flex-col">
                              <span>{item.itemName}</span>
                              {displayNotes && (
                                <span className="text-[10px] print:text-[8px] text-slate-500 font-normal lowercase italic">
                                  {displayNotes}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Kilogram Column */}
                          <td className="py-1.5 px-3 text-right border-r-2 border-slate-950 font-mono font-bold print:py-1">
                            {isKg ? (
                              <span>{formatKgQty(displayQty, displayUnit)}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>

                          {/* Pieces / Units Column */}
                          <td className="py-1.5 px-3 text-right font-mono font-bold print:py-1">
                            {!isKg ? (
                              <span>
                                {formatPiecesQty(displayQty, displayUnit)}
                                <span className="ml-1 text-[10px] print:text-[8px] text-slate-500 font-normal">
                                  {displayUnit}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Empty lined rows for physical matching (tightly capped so total form fits 1 page) */}
                  {items.length > 0 && items.length < 6 && (
                    Array.from({ length: Math.max(0, Math.min(4, 5 - items.length)) }).map((_, i) => (
                      <tr key={`pad-${i}`} className="h-6 print:h-5">
                        <td className="py-1 px-3 border-r-2 border-slate-950">&nbsp;</td>
                        <td className="py-1 px-3 border-r-2 border-slate-950">&nbsp;</td>
                        <td className="py-1 px-3">&nbsp;</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. Bottom Signature & Authorization Block matching physical form */}
            <div className="border-t-2 border-slate-950 pt-2.5 mt-2.5 grid grid-cols-2 gap-4 text-xs print:text-[10px] font-bold text-slate-950">
              {/* Accepted By (Production Supervisor) */}
              <div className="space-y-1.5 border-r border-slate-200 pr-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 uppercase">ACCEPTED BY:</span>
                  <span className="text-slate-900 font-black">{cleanAccepted}</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-600 uppercase text-[10px] print:text-[8.5px] block">SIGNATURE:</span>
                  <div className="border-b border-slate-900 w-4/5 mt-3 flex items-center justify-between">
                    {approved ? (
                      <span className="text-[10px] print:text-[8px] text-[#059669] font-mono flex items-center gap-0.5 pb-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Accepted & Verified
                      </span>
                    ) : (
                      <span className="text-[9px] print:text-[7.5px] text-amber-600 font-mono italic pb-0.5">
                        Pending Production Acceptance
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Issued By (Store Officer) */}
              <div className="space-y-1.5 pl-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 uppercase">ISSUED BY:</span>
                  <span className="text-slate-900 font-black">{cleanIssued}</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-600 uppercase text-[10px] print:text-[8.5px] block">SIGNATURE:</span>
                  <div className="border-b border-slate-900 w-4/5 mt-3 flex items-center justify-between">
                    <span className="text-[10px] print:text-[8px] text-[#059669] font-mono flex items-center gap-0.5 pb-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Issued From Store
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-1 text-[8.5px] text-slate-400 uppercase tracking-widest font-mono">
              Moh Foods Digital Plant Operations • Material Requisition Certified Record
            </div>
          </div>
        </div>

        {/* Modal Bottom Close (Screen only) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between print:hidden">
          <span className="text-[11px] text-slate-500">
            Click &quot;Print Slip&quot; for standard A4 or floor tablet paper printout.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
