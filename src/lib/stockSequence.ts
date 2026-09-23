/**
 * Factory Floor Notebook Canonical Sequence.
 * Derived from the authentic daily stock ledger notebook (e.g. 7/9/2026 Night Shift).
 *
 * Sequence order:
 *  1. Oats
 *  2. Sugar
 *  3. Milk
 *  4. Coconut
 *  5. Apples
 *  6. Cashewnut
 *  7. Grapes
 *  8. Vanilla extract
 *  9. Granola spices
 * 10. Greek cup
 * 11. Greek cover
 * 12. Parfait cup
 * 13. Parfait cover
 * 14. Vanilla bottle
 * 15. Plastic spoons
 * 16. Foil
 * 17. Wooden spoons
 * 18. Date ribbon
 * 19. Parfait temperproof
 * 20. Greek temperproof
 * 21. Parfait top label
 * 22. Parfait body label
 * 23. Unsweetened top label
 * 24. Unsweetened body label
 * 25. Sweetened top label
 * 26. Sweetened body label
 * 27. Vanilla front label
 * 28. Vanilla back label
 * 29. Culture
 * 30. Raisin
 * 31. Glucose syrup
 *
 * Everything else new or unlisted is placed below (rank 9999).
 */

export interface NotebookSequenceEntry {
  rank: number;
  label: string;
  matchCodes: string[];
  namePatterns: RegExp[];
}

export const FACTORY_NOTEBOOK_SEQUENCE: readonly NotebookSequenceEntry[] = [
  { rank: 1, label: "Oats", matchCodes: ["RAW-OAT", "RAW-OAT-01"], namePatterns: [/\boats\b/i] },
  { rank: 2, label: "Sugar", matchCodes: ["RAW-SUGAR", "RAW-SGR-01"], namePatterns: [/\bsugar\b/i] },
  { rank: 3, label: "Milk", matchCodes: ["RAW-MLK-01", "RAW-MLK-02"], namePatterns: [/\bmilk\b/i] },
  { rank: 4, label: "Coconut", matchCodes: ["RAW-CCN-01"], namePatterns: [/\bcoconut(s)?\b(?!.*oil)/i] },
  { rank: 5, label: "Apples", matchCodes: ["RAW-APPLE", "RAW-APL-01"], namePatterns: [/\bapple(s)?\b/i] },
  { rank: 6, label: "Cashewnut", matchCodes: ["RAW-CSH-01"], namePatterns: [/\bcashew/i] },
  { rank: 7, label: "Grapes", matchCodes: ["RAW-GRP-01"], namePatterns: [/\bgrape(s)?\b/i] },
  { rank: 8, label: "Vanilla extract", matchCodes: ["RAW-VAN-01"], namePatterns: [/\bvanilla\s+extract\b/i] },
  { rank: 9, label: "Granola spices", matchCodes: ["RAW-GSP-01", "RAW-GRN-01"], namePatterns: [/\bgranola\s+spice/i, /\bspices?\b/i] },
  { rank: 10, label: "Greek cup", matchCodes: ["PKG-CUP-GRK", "PKG-GYC-500"], namePatterns: [/greek.*cup/i] },
  { rank: 11, label: "Greek cover", matchCodes: ["PKG-COV-GRK"], namePatterns: [/greek.*(lid|cover|dome)/i] },
  { rank: 12, label: "Parfait cup", matchCodes: ["RAW-CUP-01", "PKG-CUP-400"], namePatterns: [/parfait.*cup(?!.*(lid|cover))/i] },
  { rank: 13, label: "Parfait cover", matchCodes: ["PKG-LID-01"], namePatterns: [/parfait.*(lid|cover)/i] },
  { rank: 14, label: "Vanilla bottle", matchCodes: ["PKG-BOT-VAN", "PKG-BOT-350"], namePatterns: [/vanilla.*bottle(?!.*label)/i] },
  { rank: 15, label: "Plastic spoons", matchCodes: ["PKG-SPN-PLS"], namePatterns: [/plastic\s+spoon/i] },
  { rank: 16, label: "Foil", matchCodes: ["PKG-FOL-01"], namePatterns: [/\bfoil\b/i] },
  { rank: 17, label: "Wooden spoons", matchCodes: ["PKG-SPN-WOD"], namePatterns: [/wooden\s+spoon/i] },
  { rank: 18, label: "Date ribbon", matchCodes: ["PKG-RBN-01"], namePatterns: [/(date.*ribbon|coding.*ribbon|ribbon)/i] },
  { rank: 19, label: "Parfait temperproof", matchCodes: ["PKG-TMP-PRF", "PKG-SEAL-01"], namePatterns: [/parfait.*(tamper|shrink|seal)/i] },
  { rank: 20, label: "Greek temperproof", matchCodes: ["PKG-TMP-GRK"], namePatterns: [/greek.*(tamper|shrink|seal)/i] },
  { rank: 21, label: "Parfait top label", matchCodes: ["PKG-LBL-PRF-TOP"], namePatterns: [/parfait.*top.*label/i] },
  { rank: 22, label: "Parfait body label", matchCodes: ["PKG-LBL-PRF-BDY", "PKG-LBL-PRF"], namePatterns: [/parfait.*(body|nafdac).*label/i] },
  { rank: 23, label: "Unsweetened top label", matchCodes: ["PKG-LBL-UNS-TOP"], namePatterns: [/unsweetened.*top.*label/i] },
  { rank: 24, label: "Unsweetened body label", matchCodes: ["PKG-LBL-UNS-BDY"], namePatterns: [/unsweetened.*body.*label/i] },
  { rank: 25, label: "Sweetened top label", matchCodes: ["PKG-LBL-SWT-TOP"], namePatterns: [/sweetened.*top.*label/i] },
  { rank: 26, label: "Sweetened body label", matchCodes: ["PKG-LBL-SWT-BDY"], namePatterns: [/sweetened.*body.*label/i] },
  { rank: 27, label: "Vanilla front label", matchCodes: ["PKG-LBL-VAN-FNT"], namePatterns: [/vanilla.*front.*label/i] },
  { rank: 28, label: "Vanilla back label", matchCodes: ["PKG-LBL-VAN-BCK"], namePatterns: [/vanilla.*back.*label/i] },
  { rank: 29, label: "Culture", matchCodes: ["RAW-CLT-01"], namePatterns: [/\bculture\b/i] },
  { rank: 30, label: "Raisin", matchCodes: ["RAW-RSN-01"], namePatterns: [/\braisin/i] },
  { rank: 31, label: "Glucose syrup", matchCodes: ["RAW-GLC-01"], namePatterns: [/\bglucose/i] },
] as const;

/**
 * Returns the notebook rank (1-31) of an item, or 9999 if it is new/unlisted.
 */
export function getItemNotebookRank(item: {
  code?: string;
  itemCode?: string;
  name?: string;
  itemName?: string;
}): number {
  const code = (item.code || item.itemCode || "").toUpperCase().trim();
  const name = (item.name || item.itemName || "").trim();

  // 1. Check exact item codes first
  if (code) {
    for (const entry of FACTORY_NOTEBOOK_SEQUENCE) {
      if (entry.matchCodes.some((c) => c.toUpperCase() === code)) {
        return entry.rank;
      }
    }
  }

  // 2. Check regex name patterns
  if (name) {
    for (const entry of FACTORY_NOTEBOOK_SEQUENCE) {
      if (entry.namePatterns.some((pattern) => pattern.test(name))) {
        return entry.rank;
      }
    }
  }

  // Everything else new is placed below
  return 9999;
}

/**
 * Sorts any list of items by the factory notebook sequence (ranks 1..31 first),
 * placing all other items below alphabetically.
 */
export function sortItemsByNotebookSequence<
  T extends {
    code?: string;
    itemCode?: string;
    name?: string;
    itemName?: string;
  }
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = getItemNotebookRank(a);
    const rankB = getItemNotebookRank(b);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const nameA = a.name || a.itemName || a.code || a.itemCode || "";
    const nameB = b.name || b.itemName || b.code || b.itemCode || "";
    return nameA.localeCompare(nameB);
  });
}
