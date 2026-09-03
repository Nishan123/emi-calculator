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
  const [rateUnit, setRateUnit] = useState<"yearly" | "monthly">("yearly");
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
  // The engine works in annual terms; a monthly rate is scaled up so that
  // dividing by 12 inside `calculateLoan` returns the rate as entered.
  const annualRate =
    rateUnit === "monthly" ? rateField.value * 12 : rateField.value;

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
      annualRatePercent: annualRate,
      tenure: tenureField.value,
      tenureUnit: unit,
      method,
    });
  }, [isValid, financed, annualRate, tenureField.value, unit, method]);

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

      <section
        aria-label="Loan details"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="loan-amount"
            label="Total amount"
            prefix="NPR"
            value={amount}
            onChange={setAmount}
            error={amountField.error}
            hint="Before any down payment"
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

          <Readout
            label="Loan amount"
            value={
              !amountField.error && !downError ? formatAmount(financed) : "—"
            }
            hint="Financed after down payment"
          />
        </div>

        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field
            id="loan-rate"
            label="Loan rate"
            prefix="%"
            value={rate}
            onChange={setRate}
            error={rateField.error}
            hint={
              rateUnit === "yearly"
                ? `${(rateField.value / 12).toFixed(3)}% per month`
                : `${(rateField.value * 12).toFixed(2)}% per year`
            }
            trailing={
              <Segmented
                legend="Rate period"
                name="rate-unit"
                value={rateUnit}
                onChange={setRateUnit}
                options={[
                  { value: "yearly", label: "Per year" },
                  { value: "monthly", label: "Per month" },
                ]}
              />
            }
          />

          <Field
            id="loan-tenure"
            label="Loan tenure"
            value={tenure}
            onChange={setTenure}
            error={tenureField.error}
            hint={
              months > 0
                ? `${months} monthly payment${months === 1 ? "" : "s"} · ${formatTenure(months)}`
                : undefined
            }
            trailing={
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
            }
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">
            Repayment method
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
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
      </section>

      <section
        aria-label="Repayment summary"
        aria-live="polite"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {result ? (
          <div className="grid gap-6 sm:grid-cols-3">
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
        ) : (
          <p className="text-sm text-slate-500">
            Enter a valid loan amount, rate and tenure to see your repayment
            breakdown.
          </p>
        )}
      </section>

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
    <fieldset className="flex shrink-0 items-stretch gap-1 rounded-lg bg-slate-100 p-1">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex cursor-pointer items-center whitespace-nowrap rounded-md px-3 text-center text-sm font-medium transition-colors ${
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
  trailing,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  prefix?: string;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1.5 flex items-stretch gap-2">
        <div
          className={`flex flex-1 overflow-hidden rounded-lg border bg-white focus-within:ring-2 ${
            error
              ? "border-red-400 focus-within:ring-red-100"
              : "border-slate-300 focus-within:border-blue-500 focus-within:ring-blue-100"
          }`}
        >
          {prefix && (
            <span
              aria-hidden="true"
              className="flex w-12 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-medium text-slate-500"
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
            className="w-full min-w-0 bg-transparent px-3 py-2.5 text-slate-900 tabular-nums outline-none"
          />
        </div>
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

/** A computed value shown in the same shape as an input, so it lines up. */
function Readout({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="mb-5">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1.5 flex rounded-lg border border-slate-200 bg-slate-50">
        <span
          aria-hidden="true"
          className="flex w-12 shrink-0 items-center justify-center border-r border-slate-200 text-sm font-medium text-slate-500"
        >
          NPR
        </span>
        <span className="w-full px-3 py-2.5 font-semibold tabular-nums text-slate-900">
          {value}
        </span>
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
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
          emphasis ? "text-3xl font-semibold" : "text-2xl font-medium"
        }`}
      >
        <span className="mr-1 text-sm font-normal text-slate-500">NPR</span>
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
