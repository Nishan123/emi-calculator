"use client";

import { useMemo, useState } from "react";
import {
  LIMITS,
  calculateLoan,
  toMonths,
  type RepaymentMethod,
  type TenureUnit,
} from "@/app/lib/emi";
import { formatAmount, formatRupees, formatTenure } from "@/app/lib/format";

const METHODS: {
  value: RepaymentMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "equal-instalment",
    label: "Equal instalment (EMI)",
    description:
      "Same total payment every month; interest on the balance you still owe.",
  },
  {
    value: "equal-principal",
    label: "Equal principal",
    description:
      "Principal split evenly; interest on the balance you still owe, so payments shrink.",
  },
  {
    value: "instalment-interest",
    label: "Interest on instalment",
    description:
      "Principal split evenly; interest charged on that monthly slice rather than the balance.",
  },
];

type Parsed = { value: number; error: string | null };

function parseField(
  raw: string,
  { min, max }: { min: number; max: number },
  label: string,
  { allowZero = false } = {},
): Parsed {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: NaN, error: `${label} is required` };

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: NaN, error: "Enter a number" };
  if (value < min || (value === 0 && !allowZero)) {
    return { value, error: `${label} must be at least ${min}` };
  }
  if (value > max) {
    return { value, error: `${label} cannot exceed ${max.toLocaleString()}` };
  }
  return { value, error: null };
}

export default function EmiCalculator() {
  const [amount, setAmount] = useState("100000");
  const [down, setDown] = useState("0");
  const [rate, setRate] = useState("8.5");
  const [tenure, setTenure] = useState("120");
  const [unit, setUnit] = useState<TenureUnit>("months");
  const [method, setMethod] = useState<RepaymentMethod>("equal-instalment");

  const amountField = parseField(amount, LIMITS.principal, "Total amount");
  const downField = parseField(down, LIMITS.downPayment, "Down payment", {
    allowZero: true,
  });
  // A down payment that covers the whole price leaves nothing to finance.
  const downError =
    downField.error ??
    (Number.isFinite(amountField.value) && downField.value >= amountField.value
      ? "Down payment must be less than the total amount"
      : null);

  const financed = amountField.value - downField.value;
  const downShare =
    amountField.value > 0 ? (downField.value / amountField.value) * 100 : 0;

  const rateField = parseField(rate, LIMITS.rate, "Interest rate", {
    allowZero: true,
  });

  const tenureLimits = useMemo(
    () =>
      unit === "years"
        ? { min: 1, max: LIMITS.months.max / 12 }
        : LIMITS.months,
    [unit],
  );
  const tenureField = parseField(tenure, tenureLimits, "Tenure");

  const isValid =
    !amountField.error && !downError && !rateField.error && !tenureField.error;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calculateLoan({
      principal: financed,
      annualRatePercent: rateField.value,
      tenure: tenureField.value,
      tenureUnit: unit,
      method,
    });
  }, [isValid, financed, rateField.value, tenureField.value, unit, method]);

  const months = Number.isFinite(tenureField.value)
    ? Math.round(toMonths(tenureField.value, unit))
    : 0;
  const isEmi = method === "equal-instalment";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          EMI Calculator
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Work out your monthly instalment and see exactly how each payment
          splits between principal and interest.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <section
          aria-label="Loan details"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Field
            id="loan-amount"
            label="Total amount"
            prefix="NPR"
            value={amount}
            onChange={setAmount}
            error={amountField.error}
            hint="Price of what you are financing, before any down payment"
          />

          <Field
            id="down-payment"
            label="Down payment"
            prefix="NPR"
            value={down}
            onChange={setDown}
            error={downError}
            hint={
              downShare > 0
                ? `${downShare.toFixed(downShare % 1 === 0 ? 0 : 1)}% of the total amount`
                : "Paid upfront, so it is not financed"
            }
          />

          {!amountField.error && !downError && (
            <div className="mb-5 flex items-baseline justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-sm font-medium text-slate-700">
                Loan amount
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                <span className="mr-1 font-normal text-slate-500">NPR</span>
                {formatAmount(financed)}
              </span>
            </div>
          )}

          <Field
            id="loan-rate"
            label="Loan rate"
            prefix="%"
            value={rate}
            onChange={setRate}
            error={rateField.error}
            hint="Annual interest rate"
          />

          <Field
            id="loan-tenure"
            label="Loan tenure"
            value={tenure}
            onChange={setTenure}
            error={tenureField.error}
          >
            <div className="mt-3">
              <Segmented
                legend="Tenure unit"
                name="tenure-unit"
                value={unit}
                onChange={setUnit}
                options={[
                  { value: "months", label: "Months" },
                  { value: "years", label: "Years" },
                ]}
              />
            </div>
          </Field>

          <fieldset className="mb-5">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">
              Repayment method
            </legend>
            <div className="space-y-2">
              {METHODS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${
                    method === option.value
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="repayment-method"
                    value={option.value}
                    checked={method === option.value}
                    onChange={() => setMethod(option.value)}
                    className="mt-0.5 size-4 shrink-0 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {months > 0 && !tenureField.error && (
            <p className="text-xs text-slate-500">
              {months} monthly payment{months === 1 ? "" : "s"} ·{" "}
              {formatTenure(months)}
            </p>
          )}
        </section>

        <section
          aria-label="Repayment summary"
          aria-live="polite"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {result ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex-1 space-y-5">
                <Stat
                  label={
                    result.levelPayment === null
                      ? "First payment"
                      : isEmi
                        ? "Loan EMI"
                        : "Monthly payment"
                  }
                  value={formatAmount(result.levelPayment ?? result.firstPayment)}
                  emphasis
                  note={
                    result.levelPayment === null
                      ? `Falls to NPR ${formatAmount(result.lastPayment)} by month ${result.months}`
                      : undefined
                  }
                />
                <Stat
                  label="Total interest payable"
                  value={formatAmount(result.totalInterest)}
                  swatch="bg-amber-500"
                />
                <Stat
                  label="Total payment"
                  value={formatAmount(result.totalPayment)}
                  swatch="bg-blue-600"
                  note="Principal + interest"
                />
              </div>
              <SplitDonut
                principal={financed}
                interest={result.totalInterest}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Enter a valid loan amount, rate and tenure to see your repayment
              breakdown.
            </p>
          )}
        </section>
      </div>

      {result && (
        <section className="mt-8" aria-label="Monthly breakdown">
          <h2 className="text-lg font-semibold text-slate-900">
            Monthly breakdown in principal and interest components
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-600">
            {isEmi
              ? "Every payment is the same; the principal share grows as the interest share falls."
              : method === "equal-principal"
                ? `You repay NPR ${formatAmount(financed / result.months)} of principal each month, plus interest on the balance still outstanding.`
                : `You repay NPR ${formatAmount(financed / result.months)} of principal each month, and interest is charged on that instalment rather than the outstanding balance.`}{" "}
            Amounts are rounded to the nearest rupee.
          </p>

          <div className="max-h-[32rem] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[34rem] table-fixed border-collapse text-right text-sm tabular-nums">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th
                    scope="col"
                    className="w-20 border-b border-slate-200 px-4 py-3 text-left font-medium"
                  >
                    Month
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 px-4 py-3 font-medium"
                  >
                    Principal
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 px-4 py-3 font-medium"
                  >
                    Interest
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 px-4 py-3 font-medium"
                  >
                    Payment
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 px-4 py-3 font-medium"
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {result.schedule.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-50">
                    <th
                      scope="row"
                      className="px-4 py-2.5 text-left font-normal text-slate-500"
                    >
                      {row.month}
                    </th>
                    <td className="px-4 py-2.5 text-slate-900">
                      {formatRupees(row.principal)}
                    </td>
                    <td className="px-4 py-2.5 text-amber-700">
                      {formatRupees(row.interest)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {formatRupees(row.payment)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatRupees(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="flex gap-1 rounded-lg bg-slate-100 p-1">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${
            value === option.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  prefix,
  hint,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  prefix?: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="mb-5 last:mb-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className={`mt-1.5 flex overflow-hidden rounded-lg border bg-white focus-within:ring-2 ${
          error
            ? "border-red-400 focus-within:ring-red-100"
            : "border-slate-300 focus-within:border-blue-500 focus-within:ring-blue-100"
        }`}
      >
        {prefix && (
          <span
            aria-hidden="true"
            className="flex w-14 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-medium text-slate-500"
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full bg-transparent px-3 py-2.5 text-slate-900 tabular-nums outline-none"
        />
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
  swatch,
  note,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  swatch?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {swatch && (
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${swatch}`}
          />
        )}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <p
        className={`mt-0.5 tabular-nums text-slate-900 ${
          emphasis ? "text-3xl font-semibold" : "text-xl font-medium"
        }`}
      >
        <span className="mr-1 text-sm font-normal text-slate-500">NPR</span>
        {value}
      </p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function SplitDonut({
  principal,
  interest,
}: {
  principal: number;
  interest: number;
}) {
  const total = principal + interest;
  const share = total > 0 ? principal / total : 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex shrink-0 justify-center">
      <svg
        viewBox="0 0 140 140"
        className="size-36"
        role="img"
        aria-label={`Principal is ${Math.round(share * 100)}% of the total payment, interest is ${Math.round((1 - share) * 100)}%`}
      >
        {/* Interest fills the full ring; principal is drawn over it. */}
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="20"
          className="stroke-amber-500"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="20"
          className="stroke-blue-600"
          strokeDasharray={`${circumference * share} ${circumference}`}
          transform="rotate(-90 70 70)"
        />
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-slate-500 text-[11px]"
        >
          Principal
        </text>
        <text
          x="70"
          y="84"
          textAnchor="middle"
          className="fill-slate-900 text-lg font-semibold"
        >
          {Math.round(share * 100)}%
        </text>
      </svg>
    </div>
  );
}
