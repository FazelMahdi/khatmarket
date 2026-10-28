/** rond.ir "نوع رند" filter values (id, label, priority), as served by rond.ir. */
export interface RondAlgorithm {
  id: string;
  label: string;
  priority: number;
  /** Matching detector key in patterns.ts */
  key: string;
}

export const ROND_ALGORITHMS: RondAlgorithm[] = [
  { id: "65b0dbde37686f6de1c9b79d", label: "آینه‌ای", priority: 1, key: "mirror" },
  { id: "65b0dbde37686f6de1c9b79e", label: "پله‌ای از اول", priority: 5, key: "stairs_start" },
  { id: "65b0dbde37686f6de1c9b79f", label: "پله‌ای از آخر", priority: 10, key: "stairs_end" },
  { id: "65b0dbde37686f6de1c9b792", label: "پنج رقم یکی از اول", priority: 15, key: "five_same_start" },
  { id: "65b0dbde37686f6de1c9b799", label: "پنج رقم یکی از وسط", priority: 20, key: "five_same_mid" },
  { id: "65b0dbde37686f6de1c9b791", label: "پنج رقم یکی از آخر", priority: 25, key: "five_same_end" },
  { id: "65b0dbde37686f6de1c9b7a1", label: "ترازویی", priority: 30, key: "balance" },
  { id: "65b0dbde37686f6de1c9b7a2", label: "تاریخ تولدی", priority: 35, key: "birthdate" },
  { id: "65b0dbde37686f6de1c9b7a3", label: "ترتیبی از اول", priority: 40, key: "seq_start" },
  { id: "65b0dbde37686f6de1c9b7a4", label: "ترتیبی از آخر", priority: 45, key: "seq_end" },
  { id: "65b0dbdf37686f6de1c9b7ad", label: "تکرار ۲ رقم یکی", priority: 50, key: "repeat_two" },
  { id: "65b0dbde37686f6de1c9b7a5", label: "تکرار پیش شماره", priority: 55, key: "repeat_prefix" },
  { id: "65b0dbdf37686f6de1c9b7a6", label: "جفت جفت از اول", priority: 60, key: "pairs_start" },
  { id: "65b0dbdf37686f6de1c9b7a7", label: "جفت جفت از آخر", priority: 65, key: "pairs_end" },
  { id: "66eb9065eda2cf6bbec11f6a", label: "جفت اول و آخر", priority: 70, key: "pair_edges" },
  { id: "66eb9065eda2cf6bbec11f69", label: "جفت جفت مجزا", priority: 75, key: "pairs_sep" },
  { id: "65b0dbde37686f6de1c9b798", label: "چهار رقم یکی از اول", priority: 80, key: "four_same_start" },
  { id: "65b0dbdf37686f6de1c9b7ac", label: "چهار رقم یکی از وسط", priority: 85, key: "four_same_mid" },
  { id: "65b0dbde37686f6de1c9b797", label: "چهار رقم یکی از آخر", priority: 90, key: "four_same_end" },
  { id: "65b0dbdf37686f6de1c9b7ae", label: "حروفی", priority: 95, key: "lettered" },
  { id: "65b0dbde37686f6de1c9b79b", label: "ده دهی از اول", priority: 100, key: "tens_k_start" },
  { id: "65b0dbde37686f6de1c9b79a", label: "ده دهی از آخر", priority: 105, key: "tens_end" },
  { id: "65b0dbde37686f6de1c9b78d", label: "ده هزاری از اول", priority: 110, key: "ten_thousand_start" },
  { id: "65b0dbde37686f6de1c9b78c", label: "ده هزاری از آخر", priority: 115, key: "ten_thousand_end" },
  { id: "65b0dbde37686f6de1c9b7a0", label: "سه پله", priority: 120, key: "three_steps" },
  { id: "65b0dbde37686f6de1c9b78e", label: "سه جفت از اول", priority: 125, key: "three_pairs_start" },
  { id: "65b0dbde37686f6de1c9b78f", label: "سه جفت از آخر", priority: 130, key: "three_pairs_end" },
  { id: "66eb9065eda2cf6bbec11f6b", label: "سه جفت مجزا", priority: 135, key: "three_pairs_sep" },
  { id: "65b0dbdf37686f6de1c9b7aa", label: "سه رقم یکی از اول", priority: 140, key: "three_same_start" },
  { id: "65b0dbdf37686f6de1c9b7ab", label: "سه رقم یکی از وسط", priority: 145, key: "three_same_mid" },
  { id: "65b0dbdf37686f6de1c9b7a9", label: "سه رقم یکی از آخر", priority: 150, key: "three_same_end" },
  { id: "65b0dbde37686f6de1c9b78a", label: "شش رقم یکی از اول", priority: 155, key: "six_same_start" },
  { id: "65b0dbde37686f6de1c9b789", label: "شش رقم یکی از آخر", priority: 160, key: "six_same_end" },
  { id: "65b0dbde37686f6de1c9b793", label: "صد صدی", priority: 165, key: "hundreds" },
  { id: "65b0dbdf37686f6de1c9b7a8", label: "کد پایین", priority: 170, key: "low_code" },
  { id: "65b0dbde37686f6de1c9b794", label: "گفتاری", priority: 175, key: "spoken" },
  { id: "65b0dbde37686f6de1c9b790", label: "متشکل از دو رقم", priority: 180, key: "two_digits" },
  { id: "65b0dbde37686f6de1c9b78b", label: "میلیونی", priority: 185, key: "million" },
  { id: "65b0dbde37686f6de1c9b795", label: "هزاری از اول", priority: 190, key: "thousand_start" },
  { id: "65b0dbde37686f6de1c9b796", label: "هزاری از آخر", priority: 195, key: "thousand_end" },
  { id: "65b0dbde37686f6de1c9b788", label: "هفت رقم یکی", priority: 200, key: "seven_same" },
  { id: "65b0dbde37686f6de1c9b79c", label: "معمولی", priority: 205, key: "ordinary" },
];

export const ALGORITHM_BY_ID = new Map(ROND_ALGORITHMS.map((a) => [a.id, a]));

/** MCI (همراه اول) operator id on rond.ir and its pre-codes. */
export const MCI_OPERATOR_ID = "65cb3414c8133a36e6f8708f";
export const MCI_PRECODES = [
  "0910", "0911", "0912", "0913", "0914", "0915", "0916", "0917", "0918", "0919",
  "0990", "0991", "0992", "0993", "0994", "0995", "0996",
];
