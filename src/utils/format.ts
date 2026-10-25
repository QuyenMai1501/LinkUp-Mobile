/** Định dạng tiền VND không dấu thập phân: 1500000 → "1.500.000 ₫". */
export function formatVnd(value: number): string {
  return `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
}

/** Định dạng số theo locale ("vi" | "en"): 1234567 → "1.234.567". */
export function formatCount(value: number, locale: string): string {
  return value.toLocaleString(locale);
}

/** Phần trăm 2 chữ số thập phân: 2.345 → "2.35%". */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale);
}
