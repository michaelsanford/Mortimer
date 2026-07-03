export interface MortgageInputs {
  principal: number;
  interestRate: number; // e.g. 5.25 for 5.25%
  amortizationYears: number; // e.g. 25
  paymentFrequency: PaymentFrequency;
  prepayments?: PrepaymentInputs;
  compounding?: 'semi_annual' | 'monthly';
  termYears?: number; // Current term length in years (e.g. 5)
  maturityDate?: string; // YYYY-MM-DD date string
}

export type PaymentFrequency =
  | 'monthly'
  | 'semi_monthly'
  | 'regular_bi_weekly'
  | 'accelerated_bi_weekly'
  | 'regular_weekly'
  | 'accelerated_weekly';

export interface PrepaymentInputs {
  lumpSumAmount: number; // Annual lump sum paid at the end of each year
  doubleUp: boolean; // Double the regular payment (added directly to principal)
  paymentIncreasePercent: number; // Annual payment increase percentage
  paymentIncreaseFixed: number; // Annual fixed dollar payment increase
}

export interface AmortizationPeriod {
  periodNumber: number;
  payment: number;
  interest: number;
  principal: number;
  lumpSum: number;
  doubleUpAmount: number;
  paymentIncreaseAmount: number;
  endingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface AmortizationSummary {
  schedule: AmortizationPeriod[];
  totalInterestPaid: number;
  totalPaymentsPaid: number;
  yearsToPayoff: number;
  interestSaved: number;
  yearsSaved: number;
  monthlyEquivalentPayment: number;
}

// Convert annual nominal rate to period rate (supporting Canadian semi-annual compounding for fixed rates, and monthly compounding for variable rates)
export function getPeriodInterestRate(annualRatePercent: number, frequency: PaymentFrequency, compounding: 'semi_annual' | 'monthly' = 'semi_annual'): number {
  const r = annualRatePercent / 100;
  const ppy = getPaymentsPerYear(frequency);
  if (compounding === 'monthly') {
    return Math.pow(1 + r / 12, 12 / ppy) - 1;
  }
  // Canadian rule: (1 + i_period)^ppy = (1 + r/2)^2 => i_period = (1 + r/2)^(2 / ppy) - 1
  return Math.pow(1 + r / 2, 2 / ppy) - 1;
}

export function getPaymentsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'monthly':
      return 12;
    case 'semi_monthly':
      return 24;
    case 'regular_bi_weekly':
    case 'accelerated_bi_weekly':
      return 26;
    case 'regular_weekly':
    case 'accelerated_weekly':
      return 52;
  }
}

export function getFrequencyLabel(frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'monthly':
      return 'Monthly';
    case 'semi_monthly':
      return 'Semi-Monthly';
    case 'regular_bi_weekly':
      return 'Regular Bi-Weekly';
    case 'accelerated_bi_weekly':
      return 'Accelerated Bi-Weekly';
    case 'regular_weekly':
      return 'Regular Weekly';
    case 'accelerated_weekly':
      return 'Accelerated Weekly';
  }
}

// Calculate the base monthly payment using Canadian compounding rules
export function calculateBaseMonthlyPayment(principal: number, annualRatePercent: number, amortizationYears: number, compounding: 'semi_annual' | 'monthly' = 'semi_annual'): number {
  const i_m = getPeriodInterestRate(annualRatePercent, 'monthly', compounding);
  const n_m = amortizationYears * 12;
  if (i_m === 0) return principal / n_m;
  return (principal * i_m * Math.pow(1 + i_m, n_m)) / (Math.pow(1 + i_m, n_m) - 1);
}

// Calculate regular payment based on frequency and Canadian standards
export function calculateRegularPayment(principal: number, annualRatePercent: number, amortizationYears: number, frequency: PaymentFrequency, compounding: 'semi_annual' | 'monthly' = 'semi_annual'): number {
  const baseMonthly = calculateBaseMonthlyPayment(principal, annualRatePercent, amortizationYears, compounding);

  switch (frequency) {
    case 'monthly':
      return baseMonthly;
    case 'semi_monthly':
      // Regular semi-monthly is monthly payment / 2 (or monthly * 12 / 24)
      return baseMonthly / 2;
    case 'regular_bi_weekly':
      // (Monthly payment * 12) / 26
      return (baseMonthly * 12) / 26;
    case 'accelerated_bi_weekly':
      // Monthly payment / 2 (results in 26 half-payments a year, i.e., 13 full payments)
      return baseMonthly / 2;
    case 'regular_weekly':
      // (Monthly payment * 12) / 52
      return (baseMonthly * 12) / 52;
    case 'accelerated_weekly':
      // Monthly payment / 4
      return baseMonthly / 4;
  }
}

// Calculate the complete amortization schedule
export function calculateAmortization(inputs: MortgageInputs): AmortizationSummary {
  const { principal, interestRate, amortizationYears, paymentFrequency, prepayments, compounding = 'semi_annual' } = inputs;
  
  const baseRegularPayment = calculateRegularPayment(principal, interestRate, amortizationYears, paymentFrequency, compounding);
  const periodRate = getPeriodInterestRate(interestRate, paymentFrequency, compounding);
  const ppy = getPaymentsPerYear(paymentFrequency);
  
  const schedule: AmortizationPeriod[] = [];
  let currentBalance = principal;
  let periodNumber = 0;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  
  const maxPeriods = amortizationYears * ppy * 2; // Safeguard limit to prevent infinite loops
  
  while (currentBalance > 0.01 && periodNumber < maxPeriods) {
    periodNumber++;
    
    // Determine payment increase factor (applied annually on the anniversary of the mortgage)
    // Anniversary occurs every 'ppy' periods
    const yearNumber = Math.floor((periodNumber - 1) / ppy);
    let paymentIncreaseAmt = 0;
    if (prepayments && yearNumber > 0) {
      if (prepayments.paymentIncreasePercent > 0) {
        paymentIncreaseAmt += baseRegularPayment * (prepayments.paymentIncreasePercent / 100) * yearNumber;
      }
      if (prepayments.paymentIncreaseFixed > 0) {
        paymentIncreaseAmt += prepayments.paymentIncreaseFixed * yearNumber;
      }
    }
    
    const basePaymentForPeriod = baseRegularPayment + paymentIncreaseAmt;
    
    // 1. Calculate Interest for the period
    const interestCharge = currentBalance * periodRate;
    
    // 2. Base principal paid
    let principalPaid = basePaymentForPeriod - interestCharge;
    let actualPayment = basePaymentForPeriod;
    
    if (principalPaid > currentBalance) {
      principalPaid = currentBalance;
      actualPayment = principalPaid + interestCharge;
    }
    
    // 3. Prepayments
    let doubleUpPaid = 0;
    if (prepayments?.doubleUp && currentBalance - principalPaid > 0.01) {
      // Double up payment is equal to the base payment amount, applied to principal
      doubleUpPaid = basePaymentForPeriod;
      if (doubleUpPaid > currentBalance - principalPaid) {
        doubleUpPaid = currentBalance - principalPaid;
      }
      principalPaid += doubleUpPaid;
    }
    
    let lumpSumPaid = 0;
    // Apply lump sum at the end of each mortgage year (anniversary)
    if (prepayments?.lumpSumAmount && prepayments.lumpSumAmount > 0 && periodNumber % ppy === 0 && currentBalance - principalPaid > 0.01) {
      lumpSumPaid = prepayments.lumpSumAmount;
      if (lumpSumPaid > currentBalance - principalPaid) {
        lumpSumPaid = currentBalance - principalPaid;
      }
      principalPaid += lumpSumPaid;
    }
    
    // Ending balance
    currentBalance = Math.max(0, currentBalance - principalPaid);
    cumulativeInterest += interestCharge;
    cumulativePrincipal += (principalPaid - doubleUpPaid - lumpSumPaid); // Regular principal
    
    schedule.push({
      periodNumber,
      payment: actualPayment,
      interest: interestCharge,
      principal: principalPaid - doubleUpPaid - lumpSumPaid,
      lumpSum: lumpSumPaid,
      doubleUpAmount: doubleUpPaid,
      paymentIncreaseAmount: paymentIncreaseAmt,
      endingBalance: Math.round(currentBalance * 100) / 100,
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
      cumulativePrincipal: Math.round((cumulativePrincipal + doubleUpPaid + lumpSumPaid) * 100) / 100,
    });
  }

  const totalPaymentsPaid = schedule.reduce((sum, p) => sum + p.payment + p.lumpSum + p.doubleUpAmount, 0);
  const totalInterestPaid = cumulativeInterest;
  const yearsToPayoff = schedule.length / ppy;

  // Calculate baseline schedule (without prepayments) for comparisons
  let baselineSummary: { totalInterestPaid: number; yearsToPayoff: number } | null = null;
  const hasPrepayments = prepayments && (prepayments.lumpSumAmount > 0 || prepayments.doubleUp || prepayments.paymentIncreasePercent > 0 || prepayments.paymentIncreaseFixed > 0 || paymentFrequency.includes('accelerated'));
  
  if (hasPrepayments) {
    // If accelerated is selected, standard baseline is monthly frequency without prepayments
    // Otherwise, it is the same frequency but with prepayments disabled
    const baselineFrequency = paymentFrequency.includes('accelerated') 
      ? (paymentFrequency === 'accelerated_bi_weekly' ? 'regular_bi_weekly' : 'regular_weekly') 
      : paymentFrequency;
      
    const baseline = calculateAmortization({
      principal,
      interestRate,
      amortizationYears,
      paymentFrequency: baselineFrequency,
      prepayments: undefined
    });
    baselineSummary = {
      totalInterestPaid: baseline.totalInterestPaid,
      yearsToPayoff: baseline.yearsToPayoff
    };
  }

  const interestSaved = baselineSummary ? Math.max(0, baselineSummary.totalInterestPaid - totalInterestPaid) : 0;
  const yearsSaved = baselineSummary ? Math.max(0, baselineSummary.yearsToPayoff - yearsToPayoff) : 0;

  return {
    schedule,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    totalPaymentsPaid: Math.round(totalPaymentsPaid * 100) / 100,
    yearsToPayoff: Math.round(yearsToPayoff * 10) / 10,
    interestSaved: Math.round(interestSaved * 100) / 100,
    yearsSaved: Math.round(yearsSaved * 10) / 10,
    monthlyEquivalentPayment: calculateRegularPayment(principal, interestRate, amortizationYears, 'monthly'),
  };
}

// Calculate Refinance break-even and savings
export interface RefinanceInputs {
  currentBalance: number;
  currentRate: number;
  remainingTermMonths: number; // e.g. 36 months (3 years) left on current term
  remainingAmortizationYears: number; // e.g. 22 years
  prepaymentPenaltyType: 'three_months_interest' | 'ird' | 'custom';
  customPenaltyAmount?: number;
  newRate: number;
  refinanceFees: number; // e.g. appraisal, legal ($1500)
}

export interface RefinanceResult {
  estimatedPenalty: number;
  totalClosingCosts: number;
  monthlySavings: number;
  netSavingsOverTerm: number;
  breakEvenMonths: number;
  currentInterestOverTerm: number;
  newInterestOverTerm: number;
}

export function calculateRefinance(inputs: RefinanceInputs): RefinanceResult {
  const {
    currentBalance,
    currentRate,
    remainingTermMonths,
    remainingAmortizationYears,
    prepaymentPenaltyType,
    customPenaltyAmount = 0,
    newRate,
    refinanceFees
  } = inputs;

  // 1. Calculate Prepayment Penalty
  let estimatedPenalty = 0;
  
  if (prepaymentPenaltyType === 'custom') {
    estimatedPenalty = customPenaltyAmount;
  } else {
    // 3 Months Interest Penalty
    // Period interest rate (monthly) = (1 + r/2)^(1/6) - 1
    const currentMonthlyRate = getPeriodInterestRate(currentRate, 'monthly');
    const threeMonthsInterest = currentBalance * currentMonthlyRate * 3;

    if (prepaymentPenaltyType === 'three_months_interest') {
      estimatedPenalty = threeMonthsInterest;
    } else {
      // IRD (Interest Rate Differential) Penalty Estimation
      // In Canada, IRD is roughly: Balance * (Current Rate - Lender's current rate for remaining term) * remaining term / 12
      // Let's assume the lender's current rate for the remaining term is equivalent to newRate,
      // which is typically what happens in a refinancing scenario if rates have fallen.
      const rateDifferential = Math.max(0, (currentRate - newRate) / 100);
      const ird = currentBalance * rateDifferential * (remainingTermMonths / 12);
      
      // Fixed mortgage penalties are usually the greater of 3-months interest or IRD
      estimatedPenalty = Math.max(threeMonthsInterest, ird);
    }
  }

  const totalClosingCosts = estimatedPenalty + refinanceFees;

  // 2. Interest Over the remaining term under current rate
  // We can simulate an amortization schedule for the remaining term months
  const currentMonthlyPayment = calculateRegularPayment(currentBalance, currentRate, remainingAmortizationYears, 'monthly');
  const currentMonthlyRate = getPeriodInterestRate(currentRate, 'monthly');
  let tempBalanceCurrent = currentBalance;
  let currentInterestOverTerm = 0;
  for (let m = 0; m < remainingTermMonths; m++) {
    const interest = tempBalanceCurrent * currentMonthlyRate;
    const principalPaid = currentMonthlyPayment - interest;
    currentInterestOverTerm += interest;
    tempBalanceCurrent = Math.max(0, tempBalanceCurrent - principalPaid);
  }

  // 3. Interest Over the remaining term under new rate (adding closing costs to principal)
  // Usually, refinancing rolls the closing costs into the new mortgage, or it is paid cash.
  // We'll assume the new mortgage principal includes closing costs for calculation, or stays same.
  // Let's assume closing costs are paid out of pocket, so we compare interest on the same balance.
  const newMonthlyPayment = calculateRegularPayment(currentBalance, newRate, remainingAmortizationYears, 'monthly');
  const newMonthlyRate = getPeriodInterestRate(newRate, 'monthly');
  let tempBalanceNew = currentBalance;
  let newInterestOverTerm = 0;
  for (let m = 0; m < remainingTermMonths; m++) {
    const interest = tempBalanceNew * newMonthlyRate;
    const principalPaid = newMonthlyPayment - interest;
    newInterestOverTerm += interest;
    tempBalanceNew = Math.max(0, tempBalanceNew - principalPaid);
  }

  const monthlySavings = currentMonthlyPayment - newMonthlyPayment;
  const grossSavingsOverTerm = currentInterestOverTerm - newInterestOverTerm;
  const netSavingsOverTerm = grossSavingsOverTerm - totalClosingCosts;
  
  // Break-even (months to recover closing costs via monthly payment savings)
  const breakEvenMonths = monthlySavings > 0 ? totalClosingCosts / monthlySavings : Infinity;

  return {
    estimatedPenalty: Math.round(estimatedPenalty * 100) / 100,
    totalClosingCosts: Math.round(totalClosingCosts * 100) / 100,
    monthlySavings: Math.round(monthlySavings * 100) / 100,
    netSavingsOverTerm: Math.round(netSavingsOverTerm * 100) / 100,
    breakEvenMonths: breakEvenMonths === Infinity ? -1 : Math.round(breakEvenMonths * 10) / 10,
    currentInterestOverTerm: Math.round(currentInterestOverTerm * 100) / 100,
    newInterestOverTerm: Math.round(newInterestOverTerm * 100) / 100,
  };
}

// Calculate HELOC Availability
export interface HELOCInputs {
  homeValue: number;
  currentMortgageBalance: number;
}

export interface HELOCResult {
  maxTotalLtvAmount: number; // 80% of home value
  maxHelocLtvAmount: number; // 65% of home value (legal HELOC limit in Canada)
  maxAvailableHeloc: number; // Lesser of (80% home value - current mortgage) OR (65% home value)
  currentLtvPercent: number;
}

export function calculateHELOC(inputs: HELOCInputs): HELOCResult {
  const { homeValue, currentMortgageBalance } = inputs;
  
  // Canadian regulation limits:
  // 1. Total borrowing (mortgage + HELOC) cannot exceed 80% of home value
  const maxTotalLtvAmount = homeValue * 0.8;
  
  // 2. The HELOC portion alone cannot exceed 65% of home value
  const maxHelocLtvAmount = homeValue * 0.65;
  
  // Maximum HELOC available is:
  // min(65% home value, 80% home value - current mortgage balance)
  const maxAvailableHeloc = Math.max(0, Math.min(
    maxHelocLtvAmount,
    maxTotalLtvAmount - currentMortgageBalance
  ));
  
  const currentLtvPercent = (currentMortgageBalance / homeValue) * 100;

  return {
    maxTotalLtvAmount: Math.round(maxTotalLtvAmount * 100) / 100,
    maxHelocLtvAmount: Math.round(maxHelocLtvAmount * 100) / 100,
    maxAvailableHeloc: Math.round(maxAvailableHeloc * 100) / 100,
    currentLtvPercent: Math.round(currentLtvPercent * 10) / 10,
  };
}
