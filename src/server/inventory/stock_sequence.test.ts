import { describe, it, expect } from "bun:test";
import {
  FACTORY_NOTEBOOK_SEQUENCE,
  getItemNotebookRank,
  sortItemsByNotebookSequence,
} from "@/lib/stockSequence";

describe("Factory Notebook Sequence (31 Items Default Ordering)", () => {
  it("should have exactly 31 ranked items defined in the canonical sequence", () => {
    expect(FACTORY_NOTEBOOK_SEQUENCE.length).toBe(31);
    expect(FACTORY_NOTEBOOK_SEQUENCE[0].label).toBe("Oats");
    expect(FACTORY_NOTEBOOK_SEQUENCE[0].rank).toBe(1);
    expect(FACTORY_NOTEBOOK_SEQUENCE[30].label).toBe("Glucose syrup");
    expect(FACTORY_NOTEBOOK_SEQUENCE[30].rank).toBe(31);
  });

  it("should accurately rank items according to the real floor ledger notebook", () => {
    // 1. Oats
    expect(getItemNotebookRank({ code: "RAW-OAT", name: "Rolled Oats" })).toBe(1);
    // 2. Sugar
    expect(getItemNotebookRank({ code: "RAW-SUGAR", name: "Granulated Sugar" })).toBe(2);
    // 3. Milk
    expect(getItemNotebookRank({ code: "RAW-MLK-01", name: "Powdered Milk" })).toBe(3);
    // 4. Coconut
    expect(getItemNotebookRank({ code: "RAW-CCN-01", name: "Coconut Flakes" })).toBe(4);
    // 5. Apples
    expect(getItemNotebookRank({ code: "RAW-APPLE", name: "Fresh Apples" })).toBe(5);
    // 6. Cashewnut
    expect(getItemNotebookRank({ code: "RAW-CSH-01", name: "Cashew Nuts" })).toBe(6);
    // 7. Grapes
    expect(getItemNotebookRank({ code: "RAW-GRP-01", name: "Green Grapes" })).toBe(7);
    // 8. Vanilla extract
    expect(getItemNotebookRank({ code: "RAW-VAN-01", name: "Vanilla Extract Liquid" })).toBe(8);
    // 9. Granola spices
    expect(getItemNotebookRank({ code: "RAW-GSP-01", name: "Granola Spices Mix" })).toBe(9);
    // 10. Greek cup
    expect(getItemNotebookRank({ code: "PKG-CUP-GRK", name: "Greek Yogurt Cup 500ml" })).toBe(10);
    // 11. Greek cover
    expect(getItemNotebookRank({ code: "PKG-COV-GRK", name: "Greek Yogurt Lid / Cover" })).toBe(11);
    // 12. Parfait cup
    expect(getItemNotebookRank({ code: "PKG-CUP-400", name: "Parfait Cup 400ml" })).toBe(12);
    // 13. Parfait cover
    expect(getItemNotebookRank({ code: "PKG-LID-01", name: "Parfait Dome Lid" })).toBe(13);
    // 14. Vanilla bottle
    expect(getItemNotebookRank({ code: "PKG-BOT-VAN", name: "Vanilla Bottle 350ml" })).toBe(14);
    // 15. Plastic spoons
    expect(getItemNotebookRank({ code: "PKG-SPN-PLS", name: "Plastic Spoons" })).toBe(15);
    // 16. Foil
    expect(getItemNotebookRank({ code: "PKG-FOL-01", name: "Sealing Foil" })).toBe(16);
    // 17. Wooden spoons
    expect(getItemNotebookRank({ code: "PKG-SPN-WOD", name: "Wooden Spoons" })).toBe(17);
    // 18. Date ribbon
    expect(getItemNotebookRank({ code: "PKG-RBN-01", name: "Batch Date Coding Ribbon" })).toBe(18);
    // 19. Parfait temperproof
    expect(getItemNotebookRank({ code: "PKG-TMP-PRF", name: "Parfait Tamperproof Seal" })).toBe(19);
    // 20. Greek temperproof
    expect(getItemNotebookRank({ code: "PKG-TMP-GRK", name: "Greek Tamperproof Seal" })).toBe(20);
    // 21. Parfait top label
    expect(getItemNotebookRank({ code: "PKG-LBL-PRF-TOP", name: "Parfait Top Label" })).toBe(21);
    // 22. Parfait body label
    expect(getItemNotebookRank({ code: "PKG-LBL-PRF-BDY", name: "Parfait Body Label" })).toBe(22);
    // 23. Unsweetened top label
    expect(getItemNotebookRank({ code: "PKG-LBL-UNS-TOP", name: "Unsweetened Top Label" })).toBe(23);
    // 24. Unsweetened body label
    expect(getItemNotebookRank({ code: "PKG-LBL-UNS-BDY", name: "Unsweetened Body Label" })).toBe(24);
    // 25. Sweetened top label
    expect(getItemNotebookRank({ code: "PKG-LBL-SWT-TOP", name: "Sweetened Top Label" })).toBe(25);
    // 26. Sweetened body label
    expect(getItemNotebookRank({ code: "PKG-LBL-SWT-BDY", name: "Sweetened Body Label" })).toBe(26);
    // 27. Vanilla front label
    expect(getItemNotebookRank({ code: "PKG-LBL-VAN-FNT", name: "Vanilla Front Label" })).toBe(27);
    // 28. Vanilla back label
    expect(getItemNotebookRank({ code: "PKG-LBL-VAN-BCK", name: "Vanilla Back Label" })).toBe(28);
    // 29. Culture
    expect(getItemNotebookRank({ code: "RAW-CLT-01", name: "Live Probiotic Culture" })).toBe(29);
    // 30. Raisin
    expect(getItemNotebookRank({ code: "RAW-RSN-01", name: "Dried Raisins" })).toBe(30);
    // 31. Glucose syrup
    expect(getItemNotebookRank({ code: "RAW-GLC-01", name: "Glucose Syrup 25kg" })).toBe(31);
  });

  it("should assign rank 9999 to new or unlisted items and place them below", () => {
    const brandNewItem = { code: "RAW-CHIA-01", name: "Chia Seeds" };
    expect(getItemNotebookRank(brandNewItem)).toBe(9999);

    const testItem = { code: "PKG-TEST-BOX", name: "Cardboard Delivery Box" };
    expect(getItemNotebookRank(testItem)).toBe(9999);
  });

  it("should sort items placing 1..31 first in exact notebook order and new items below alphabetically", () => {
    const mixed = [
      { name: "Cardboard Box", code: "PKG-BOX" },
      { name: "Glucose Syrup", code: "RAW-GLC-01" },
      { name: "Almond Flour", code: "RAW-ALM" },
      { name: "Oats", code: "RAW-OAT" },
      { name: "Greek Cup", code: "PKG-CUP-GRK" },
      { name: "Sugar", code: "RAW-SUGAR" },
    ];

    const sorted = sortItemsByNotebookSequence(mixed);
    expect(sorted.map((i) => i.name)).toEqual([
      "Oats",          // rank 1
      "Sugar",         // rank 2
      "Greek Cup",     // rank 10
      "Glucose Syrup", // rank 31
      "Almond Flour",  // rank 9999 (alphabetical)
      "Cardboard Box", // rank 9999 (alphabetical)
    ]);
  });
});
