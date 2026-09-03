const npr = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "1,239.86" — paired with a separate NPR label in the UI. */
export const formatAmount = (n: number) => npr.format(n);

/** Schedule rows are rounded to the rupee, as on a bank statement. */
export const formatRupees = (n: number) => whole.format(Math.round(n));

export function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
  return parts.join(" ") || "0 months";
}
