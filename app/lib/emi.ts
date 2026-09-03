export type TenureUnit = "months" | "years";

/**
 * How a loan is repaid:
 * - `equal-instalment` (EMI): every payment is identical; the principal share
 *   grows month by month as the interest share falls.
 * - `equal-principal`: the principal is split evenly across the term and
 *   interest is charged on whatever is still outstanding, so payments start
 *   high and shrink. Cheaper overall, but front-loaded.
 */
export type RepaymentMethod = "equal-instalment" | "equal-principal";

export type LoanInput = {
  /** Amount actually financed, in NPR. */
  principal: number;
  /** Nominal annual interest rate, as a percentage (e.g. 8.5). */
  annualRatePercent: number;
  /** Loan tenure, expressed in `tenureUnit`. */
  tenure: number;
  tenureUnit: TenureUnit;
  method: RepaymentMethod;
};

export type ScheduleRow = {
  month: number;
  /** Total due this month: principal + interest. */
  payment: number;
  /** Portion of this payment that repays the outstanding balance. */
  principal: number;
  /** Portion of this payment that covers interest for the period. */
  interest: number;
  /** Balance remaining after this payment. */
  balance: number;
};

export type LoanResult = {
  method: RepaymentMethod;
  months: number;
  /** The fixed instalment — only meaningful when payments don't vary. */
  emi: number | null;
  firstPayment: number;
  lastPayment: number;
  totalPayment: number;
  totalInterest: number;
  schedule: ScheduleRow[];
};

export const LIMITS = {
  principal: { min: 1, max: 1_000_000_000 },
  downPayment: { min: 0, max: 1_000_000_000 },
  rate: { min: 0, max: 100 },
  months: { min: 1, max: 600 },
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function toMonths(tenure: number, unit: TenureUnit): number {
  return unit === "years" ? tenure * 12 : tenure;
}

/**
 * Standard reducing-balance EMI:
 *
 *   EMI = P · r · (1 + r)^n / ((1 + r)^n − 1)
 *
 * where `r` is the monthly rate and `n` the number of instalments. A 0%
 * loan degenerates to a flat P/n, which the formula above cannot express.
 */
export function monthlyInstalment(
  principal: number,
  annualRatePercent: number,
  months: number,
): number {
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return principal / months;
  const growth = Math.pow(1 + r, months);
  return (principal * r * growth) / (growth - 1);
}

export function calculateLoan({
  principal,
  annualRatePercent,
  tenure,
  tenureUnit,
  method,
}: LoanInput): LoanResult {
  const months = Math.round(toMonths(tenure, tenureUnit));
  const monthlyRate = annualRatePercent / 100 / 12;
  const isEmi = method === "equal-instalment";

  const instalment = isEmi
    ? monthlyInstalment(principal, annualRatePercent, months)
    : 0;
  const principalPerMonth = principal / months;

  const schedule: ScheduleRow[] = [];
  let balance = principal;
  let interestPaid = 0;

  for (let month = 1; month <= months; month++) {
    // Interest always accrues on the balance still outstanding. Only the
    // principal repaid differs between the two methods.
    const interest = balance * monthlyRate;
    const isLast = month === months;
    // The final payment settles whatever is left, absorbing the fractional
    // residue that accumulates over the schedule.
    const repaid = isLast
      ? balance
      : isEmi
        ? instalment - interest
        : principalPerMonth;

    balance -= repaid;
    interestPaid += interest;
    schedule.push({
      month,
      payment: repaid + interest,
      principal: repaid,
      interest,
      balance: isLast ? 0 : balance,
    });
  }

  // Totals come from the schedule rather than `instalment * months`, so the
  // summary always agrees with the table below it — and a 0% loan repays
  // exactly the principal instead of drifting by the rounding on the EMI.
  const totalInterest = round2(interestPaid);

  return {
    method,
    months,
    emi: isEmi ? round2(instalment) : null,
    firstPayment: round2(schedule[0].payment),
    lastPayment: round2(schedule[schedule.length - 1].payment),
    totalPayment: round2(principal + totalInterest),
    totalInterest,
    schedule,
  };
}
