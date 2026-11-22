// GST rules live ONLY here. All money is in paise (1 rupee = 100 paise).
// Rule: if a night's room price is <= upTo, use that rate. Above all slabs, use the last one.
// To change tax, edit this file and nothing else.
export const GST_SLABS = [
  { upTo: 750000, ratePercent: 5 }, // up to Rs 7,500 -> 5%
  { upTo: Infinity, ratePercent: 18 }, // above Rs 7,500 -> 18%
];
