import { describe, it, expect } from 'vitest';
import {
  getPeriodInterestRate,
  getPaymentsPerYear,
  calculateBaseMonthlyPayment,
  calculateRegularPayment,
  calculateAmortization,
  calculateRefinance,
  calculateHELOC,
  type MortgageInputs,
  type RefinanceInputs,
} from './mortgageMath';

describe('getPaymentsPerYear', () => {
  it('returns 12 for monthly', () => {
    expect(getPaymentsPerYear('monthly')).toBe(12);
  });

  it('returns 24 for semi-monthly', () => {
    expect(getPaymentsPerYear('semi_monthly')).toBe(24);
  });

  it('returns 26 for regular bi-weekly', () => {
    expect(getPaymentsPerYear('regular_bi_weekly')).toBe(26);
  });

  it('returns 26 for accelerated bi-weekly', () => {
    expect(getPaymentsPerYear('accelerated_bi_weekly')).toBe(26);
  });

  it('returns 52 for regular weekly', () => {
    expect(getPaymentsPerYear('regular_weekly')).toBe(52);
  });

  it('returns 52 for accelerated weekly', () => {
    expect(getPaymentsPerYear('accelerated_weekly')).toBe(52);
  });
});

describe('getPeriodInterestRate', () => {
  describe('semi-annual compounding (Canadian standard)', () => {
    it('calculates monthly period rate for 5% annual', () => {
      // (1 + 0.05/2)^(2/12) - 1 ≈ 0.004123915
      const rate = getPeriodInterestRate(5, 'monthly', 'semi_annual');
      expect(rate).toBeCloseTo(0.004123915, 6);
    });

    it('calculates bi-weekly period rate for 5% annual', () => {
      // (1 + 0.05/2)^(2/26) - 1
      const rate = getPeriodInterestRate(5, 'regular_bi_weekly', 'semi_annual');
      expect(rate).toBeCloseTo(0.001903, 4);
    });

    it('calculates weekly period rate for 5% annual', () => {
      // (1 + 0.05/2)^(2/52) - 1
      const rate = getPeriodInterestRate(5, 'regular_weekly', 'semi_annual');
      expect(rate).toBeCloseTo(0.000951, 4);
    });

    it('returns 0 for 0% rate', () => {
      expect(getPeriodInterestRate(0, 'monthly', 'semi_annual')).toBe(0);
    });
  });

  describe('monthly compounding (variable rates)', () => {
    it('calculates monthly period rate for 5% annual with monthly compounding', () => {
      // (1 + 0.05/12)^(12/12) - 1 = 0.05/12 ≈ 0.0041667
      const rate = getPeriodInterestRate(5, 'monthly', 'monthly');
      expect(rate).toBeCloseTo(0.0041667, 5);
    });

    it('calculates bi-weekly period rate with monthly compounding', () => {
      // (1 + 0.05/12)^(12/26) - 1
      const rate = getPeriodInterestRate(5, 'regular_bi_weekly', 'monthly');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.003);
    });
  });
});

describe('calculateBaseMonthlyPayment', () => {
  it('calculates a standard $500k mortgage at 5% over 25 years', () => {
    const payment = calculateBaseMonthlyPayment(500000, 5, 25);
    // Expected ~$2908 for Canadian semi-annual compounding
    expect(payment).toBeGreaterThan(2900);
    expect(payment).toBeLessThan(2930);
  });

  it('calculates a $300k mortgage at 3% over 25 years', () => {
    const payment = calculateBaseMonthlyPayment(300000, 3, 25);
    // Expected ~$1419
    expect(payment).toBeGreaterThan(1410);
    expect(payment).toBeLessThan(1430);
  });

  it('handles 0% interest rate (simple division)', () => {
    const payment = calculateBaseMonthlyPayment(240000, 0, 20);
    expect(payment).toBe(1000); // 240000 / (20*12) = 1000
  });

  it('handles short amortization (5 years)', () => {
    const payment = calculateBaseMonthlyPayment(100000, 4, 5);
    // Should be around $1843
    expect(payment).toBeGreaterThan(1830);
    expect(payment).toBeLessThan(1860);
  });
});

describe('calculateRegularPayment', () => {
  const principal = 500000;
  const rate = 5;
  const amort = 25;

  it('monthly payment matches base monthly payment', () => {
    const base = calculateBaseMonthlyPayment(principal, rate, amort);
    const regular = calculateRegularPayment(principal, rate, amort, 'monthly');
    expect(regular).toBeCloseTo(base, 2);
  });

  it('semi-monthly is half of monthly', () => {
    const monthly = calculateRegularPayment(principal, rate, amort, 'monthly');
    const semiMonthly = calculateRegularPayment(principal, rate, amort, 'semi_monthly');
    expect(semiMonthly).toBeCloseTo(monthly / 2, 2);
  });

  it('regular bi-weekly is (monthly * 12) / 26', () => {
    const monthly = calculateRegularPayment(principal, rate, amort, 'monthly');
    const biWeekly = calculateRegularPayment(principal, rate, amort, 'regular_bi_weekly');
    expect(biWeekly).toBeCloseTo((monthly * 12) / 26, 2);
  });

  it('accelerated bi-weekly is half of monthly', () => {
    const monthly = calculateRegularPayment(principal, rate, amort, 'monthly');
    const accBiWeekly = calculateRegularPayment(principal, rate, amort, 'accelerated_bi_weekly');
    expect(accBiWeekly).toBeCloseTo(monthly / 2, 2);
  });

  it('regular weekly is (monthly * 12) / 52', () => {
    const monthly = calculateRegularPayment(principal, rate, amort, 'monthly');
    const weekly = calculateRegularPayment(principal, rate, amort, 'regular_weekly');
    expect(weekly).toBeCloseTo((monthly * 12) / 52, 2);
  });

  it('accelerated weekly is monthly / 4', () => {
    const monthly = calculateRegularPayment(principal, rate, amort, 'monthly');
    const accWeekly = calculateRegularPayment(principal, rate, amort, 'accelerated_weekly');
    expect(accWeekly).toBeCloseTo(monthly / 4, 2);
  });

  it('accelerated bi-weekly > regular bi-weekly (pays more)', () => {
    const regular = calculateRegularPayment(principal, rate, amort, 'regular_bi_weekly');
    const accelerated = calculateRegularPayment(principal, rate, amort, 'accelerated_bi_weekly');
    expect(accelerated).toBeGreaterThan(regular);
  });
});

describe('calculateAmortization', () => {
  describe('basic amortization (no prepayments)', () => {
    const basicInputs: MortgageInputs = {
      principal: 500000,
      interestRate: 5,
      amortizationYears: 25,
      paymentFrequency: 'monthly',
    };

    it('produces a schedule', () => {
      const result = calculateAmortization(basicInputs);
      expect(result.schedule.length).toBeGreaterThan(0);
    });

    it('ends with balance near zero', () => {
      const result = calculateAmortization(basicInputs);
      const lastPeriod = result.schedule[result.schedule.length - 1];
      expect(lastPeriod.endingBalance).toBeLessThan(1);
    });

    it('pays off in approximately 25 years', () => {
      const result = calculateAmortization(basicInputs);
      expect(result.yearsToPayoff).toBeCloseTo(25, 0);
    });

    it('total interest paid is reasonable for 500k @ 5% / 25yr', () => {
      const result = calculateAmortization(basicInputs);
      // Expect roughly $370k-$380k in total interest
      expect(result.totalInterestPaid).toBeGreaterThan(350000);
      expect(result.totalInterestPaid).toBeLessThan(400000);
    });

    it('reports zero savings when no prepayments', () => {
      const result = calculateAmortization(basicInputs);
      expect(result.interestSaved).toBe(0);
      expect(result.yearsSaved).toBe(0);
    });

    it('monthly equivalent payment is positive', () => {
      const result = calculateAmortization(basicInputs);
      expect(result.monthlyEquivalentPayment).toBeGreaterThan(0);
    });
  });

  describe('with lump-sum prepayments', () => {
    const inputs: MortgageInputs = {
      principal: 500000,
      interestRate: 5,
      amortizationYears: 25,
      paymentFrequency: 'monthly',
      prepayments: {
        lumpSumAmount: 10000,
        doubleUp: false,
        paymentIncreasePercent: 0,
        paymentIncreaseFixed: 0,
      },
    };

    it('pays off faster than without prepayments', () => {
      const withPrepay = calculateAmortization(inputs);
      const without = calculateAmortization({ ...inputs, prepayments: undefined });
      expect(withPrepay.yearsToPayoff).toBeLessThan(without.yearsToPayoff);
    });

    it('saves interest', () => {
      const result = calculateAmortization(inputs);
      expect(result.interestSaved).toBeGreaterThan(0);
    });

    it('saves years', () => {
      const result = calculateAmortization(inputs);
      expect(result.yearsSaved).toBeGreaterThan(0);
    });
  });

  describe('with double-up payments', () => {
    const inputs: MortgageInputs = {
      principal: 500000,
      interestRate: 5,
      amortizationYears: 25,
      paymentFrequency: 'monthly',
      prepayments: {
        lumpSumAmount: 0,
        doubleUp: true,
        paymentIncreasePercent: 0,
        paymentIncreaseFixed: 0,
      },
    };

    it('pays off significantly faster', () => {
      const result = calculateAmortization(inputs);
      // Double-up should roughly halve the amortization
      expect(result.yearsToPayoff).toBeLessThan(15);
    });

    it('each period has doubleUpAmount > 0', () => {
      const result = calculateAmortization(inputs);
      const periodsWithDoubleUp = result.schedule.filter(p => p.doubleUpAmount > 0);
      // Most periods should have double-up (all except maybe the last)
      expect(periodsWithDoubleUp.length).toBeGreaterThan(result.schedule.length * 0.9);
    });

    it('treats a missing doubleUpEvery the same as every payment (interval 1)', () => {
      const everyOne = calculateAmortization({
        ...inputs,
        prepayments: { ...inputs.prepayments!, doubleUpEvery: 1 },
      });
      const noInterval = calculateAmortization(inputs);
      expect(everyOne.yearsToPayoff).toBe(noInterval.yearsToPayoff);
      expect(everyOne.totalInterestPaid).toBe(noInterval.totalInterestPaid);
    });
  });

  describe('with interval double-up payments (doubleUpEvery)', () => {
    const baseInputs: MortgageInputs = {
      principal: 500000,
      interestRate: 5,
      amortizationYears: 25,
      paymentFrequency: 'monthly',
      prepayments: {
        lumpSumAmount: 0,
        doubleUp: true,
        doubleUpEvery: 6,
        paymentIncreasePercent: 0,
        paymentIncreaseFixed: 0,
      },
    };

    it('only applies the double-up on multiples of the interval', () => {
      const result = calculateAmortization(baseInputs);
      const doubleUpPeriods = result.schedule.filter(p => p.doubleUpAmount > 0);
      // Every double-up must land on a period that is a multiple of 6
      expect(doubleUpPeriods.length).toBeGreaterThan(0);
      expect(doubleUpPeriods.every(p => p.periodNumber % 6 === 0)).toBe(true);
    });

    it('pays off slower than doubling every payment but faster than none', () => {
      const interval = calculateAmortization(baseInputs);
      const everyPayment = calculateAmortization({
        ...baseInputs,
        prepayments: { ...baseInputs.prepayments!, doubleUpEvery: 1 },
      });
      const none = calculateAmortization({ ...baseInputs, prepayments: undefined });
      expect(interval.yearsToPayoff).toBeGreaterThan(everyPayment.yearsToPayoff);
      expect(interval.yearsToPayoff).toBeLessThan(none.yearsToPayoff);
    });
  });

  describe('with payment increase', () => {
    const inputs: MortgageInputs = {
      principal: 500000,
      interestRate: 5,
      amortizationYears: 25,
      paymentFrequency: 'monthly',
      prepayments: {
        lumpSumAmount: 0,
        doubleUp: false,
        paymentIncreasePercent: 5,
        paymentIncreaseFixed: 0,
      },
    };

    it('pays off faster than without', () => {
      const withIncrease = calculateAmortization(inputs);
      const without = calculateAmortization({ ...inputs, prepayments: undefined });
      expect(withIncrease.yearsToPayoff).toBeLessThan(without.yearsToPayoff);
    });

    it('later periods have paymentIncreaseAmount > 0', () => {
      const result = calculateAmortization(inputs);
      // After year 1 (period 13+), increases should kick in
      const laterPeriods = result.schedule.filter(p => p.periodNumber > 12);
      const withIncrease = laterPeriods.filter(p => p.paymentIncreaseAmount > 0);
      expect(withIncrease.length).toBeGreaterThan(0);
    });
  });

  describe('with accelerated bi-weekly frequency', () => {
    const inputs: MortgageInputs = {
      principal: 500000,
      interestRate: 5,
      amortizationYears: 25,
      paymentFrequency: 'accelerated_bi_weekly',
    };

    it('pays off faster than regular bi-weekly', () => {
      const accelerated = calculateAmortization(inputs);
      const regular = calculateAmortization({ ...inputs, paymentFrequency: 'regular_bi_weekly' });
      expect(accelerated.yearsToPayoff).toBeLessThan(regular.yearsToPayoff);
    });

    it('reports savings metrics compared to regular frequency baseline', () => {
      const result = calculateAmortization(inputs);
      // The accelerated frequency should pay off faster
      // yearsSaved compares against regular_bi_weekly baseline
      expect(result.yearsToPayoff).toBeLessThan(25);
      // Verify savings are non-negative (exact values depend on rounding)
      expect(result.yearsSaved).toBeGreaterThanOrEqual(0);
      expect(result.interestSaved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('with confirmed payment override', () => {
    it('uses the override payment instead of calculated', () => {
      const inputs: MortgageInputs = {
        principal: 500000,
        interestRate: 5,
        amortizationYears: 25,
        paymentFrequency: 'monthly',
        confirmedPayment: 3500,
      };
      const result = calculateAmortization(inputs);
      // Payment should be roughly 3500 in first period
      expect(result.schedule[0].payment).toBeCloseTo(3500, 0);
    });
  });

  describe('with amortizationMonths', () => {
    it('handles fractional amortization (25 years 6 months)', () => {
      const inputs: MortgageInputs = {
        principal: 500000,
        interestRate: 5,
        amortizationYears: 25,
        amortizationMonths: 6,
        paymentFrequency: 'monthly',
      };
      const result = calculateAmortization(inputs);
      expect(result.yearsToPayoff).toBeCloseTo(25.5, 0);
    });
  });

  describe('edge cases', () => {
    it('handles very small principal', () => {
      const inputs: MortgageInputs = {
        principal: 1000,
        interestRate: 5,
        amortizationYears: 5,
        paymentFrequency: 'monthly',
      };
      const result = calculateAmortization(inputs);
      expect(result.schedule.length).toBeGreaterThan(0);
      expect(result.schedule[result.schedule.length - 1].endingBalance).toBeLessThan(1);
    });

    it('handles high interest rate', () => {
      const inputs: MortgageInputs = {
        principal: 300000,
        interestRate: 10,
        amortizationYears: 25,
        paymentFrequency: 'monthly',
      };
      const result = calculateAmortization(inputs);
      expect(result.totalInterestPaid).toBeGreaterThan(result.totalPaymentsPaid * 0.5);
    });
  });
});

describe('calculateRefinance', () => {
  const baseInputs: RefinanceInputs = {
    currentBalance: 400000,
    currentRate: 5.5,
    remainingTermMonths: 36,
    remainingAmortizationYears: 22,
    prepaymentPenaltyType: 'three_months_interest',
    newRate: 4.0,
    refinanceFees: 1500,
  };

  describe('three months interest penalty', () => {
    it('calculates a positive penalty', () => {
      const result = calculateRefinance(baseInputs);
      expect(result.estimatedPenalty).toBeGreaterThan(0);
    });

    it('penalty is approximately 3 months of interest', () => {
      const result = calculateRefinance(baseInputs);
      // Rough: 400000 * (0.055 / 12 equivalent) * 3
      // With semi-annual compounding it's slightly different but should be in the ballpark
      expect(result.estimatedPenalty).toBeGreaterThan(4000);
      expect(result.estimatedPenalty).toBeLessThan(7000);
    });
  });

  describe('IRD penalty', () => {
    it('IRD penalty >= 3 months interest when rates are lower', () => {
      const inputs: RefinanceInputs = { ...baseInputs, prepaymentPenaltyType: 'ird' };
      const result = calculateRefinance(inputs);
      const threeMonthResult = calculateRefinance(baseInputs);
      expect(result.estimatedPenalty).toBeGreaterThanOrEqual(threeMonthResult.estimatedPenalty);
    });
  });

  describe('custom penalty', () => {
    it('uses the provided custom amount', () => {
      const inputs: RefinanceInputs = {
        ...baseInputs,
        prepaymentPenaltyType: 'custom',
        customPenaltyAmount: 8000,
      };
      const result = calculateRefinance(inputs);
      expect(result.estimatedPenalty).toBe(8000);
    });
  });

  describe('savings calculations', () => {
    it('shows monthly savings when new rate is lower', () => {
      const result = calculateRefinance(baseInputs);
      expect(result.monthlySavings).toBeGreaterThan(0);
    });

    it('shows no savings when new rate is higher', () => {
      const inputs: RefinanceInputs = { ...baseInputs, newRate: 6.5 };
      const result = calculateRefinance(inputs);
      expect(result.monthlySavings).toBeLessThan(0);
    });

    it('calculates break-even months', () => {
      const result = calculateRefinance(baseInputs);
      expect(result.breakEvenMonths).toBeGreaterThan(0);
      expect(result.breakEvenMonths).toBeLessThan(baseInputs.remainingTermMonths);
    });

    it('returns -1 for break-even when savings are zero or negative', () => {
      const inputs: RefinanceInputs = { ...baseInputs, newRate: 6.5 };
      const result = calculateRefinance(inputs);
      expect(result.breakEvenMonths).toBe(-1);
    });

    it('total closing costs = penalty + fees', () => {
      const result = calculateRefinance(baseInputs);
      expect(result.totalClosingCosts).toBe(result.estimatedPenalty + baseInputs.refinanceFees);
    });

    it('interest over term is consistent between current and new', () => {
      const result = calculateRefinance(baseInputs);
      expect(result.currentInterestOverTerm).toBeGreaterThan(result.newInterestOverTerm);
    });
  });
});

describe('calculateHELOC', () => {
  describe('standard scenario', () => {
    it('calculates correct limits for $800k home with $400k mortgage', () => {
      const result = calculateHELOC({ homeValue: 800000, currentMortgageBalance: 400000 });
      expect(result.maxTotalLtvAmount).toBe(640000); // 80% of 800k
      expect(result.maxHelocLtvAmount).toBe(520000); // 65% of 800k
      expect(result.maxAvailableHeloc).toBe(240000); // min(520k, 640k - 400k) = 240k
      expect(result.currentLtvPercent).toBe(50); // 400k / 800k
    });

    it('HELOC capped at 65% when mortgage is small', () => {
      const result = calculateHELOC({ homeValue: 1000000, currentMortgageBalance: 100000 });
      // 80% - mortgage = 700k, but 65% cap = 650k
      expect(result.maxAvailableHeloc).toBe(650000);
    });
  });

  describe('high LTV scenarios', () => {
    it('returns 0 HELOC when mortgage exceeds 80% LTV', () => {
      const result = calculateHELOC({ homeValue: 500000, currentMortgageBalance: 450000 });
      expect(result.maxAvailableHeloc).toBe(0);
      expect(result.currentLtvPercent).toBe(90);
    });

    it('returns 0 HELOC when mortgage equals 80% LTV', () => {
      const result = calculateHELOC({ homeValue: 500000, currentMortgageBalance: 400000 });
      expect(result.maxAvailableHeloc).toBe(0);
    });

    it('small HELOC available when just under 80%', () => {
      const result = calculateHELOC({ homeValue: 500000, currentMortgageBalance: 390000 });
      expect(result.maxAvailableHeloc).toBe(10000); // 400k - 390k
    });
  });

  describe('edge cases', () => {
    it('handles zero mortgage balance', () => {
      const result = calculateHELOC({ homeValue: 600000, currentMortgageBalance: 0 });
      expect(result.maxAvailableHeloc).toBe(390000); // min(390k, 480k) = 390k (65%)
      expect(result.currentLtvPercent).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
      const result = calculateHELOC({ homeValue: 333333, currentMortgageBalance: 100000 });
      // Values should not have more than 2 decimal places
      expect(result.maxTotalLtvAmount).toBe(Math.round(333333 * 0.8 * 100) / 100);
      expect(result.maxHelocLtvAmount).toBe(Math.round(333333 * 0.65 * 100) / 100);
    });
  });
});
