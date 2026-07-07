import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, ShieldAlert, Sparkles, Plus, Trash2, Trophy, Award, ArrowUp } from 'lucide-react';
import { calculateRefinance, calculateRegularPayment, getPeriodInterestRate, getPaymentsPerYear, calculateRemainingMonths } from '../utils/mortgageMath';
import type { MortgageInputs, PaymentFrequency } from '../utils/mortgageMath';
import { useI18n } from '../utils/i18n';
import { useSystemTheme } from '../hooks/useSystemTheme';
import { cadCurrencyTooltipLabel } from '../utils/formatters';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);


const getOverallBestLabel = (locale: string) => {
  switch (locale) {
    case 'fr': return 'Meilleur global';
    case 'es': return 'Mejor general';
    case 'zh': return '整体最佳';
    case 'zh-HK': return '整體最佳';
    case 'ar': return 'الأفضل بشكل عام';
    case 'pa': return 'ਕੁੱਲ ਮਿਲਾ ਕੇ ਵਧੀਆ';
    default: return 'Overall Best';
  }
};

const renderBestIcon = (isBest: boolean | undefined, bestIds: string[] | undefined) => {
  if (!isBest) return null;
  const isTie = bestIds && bestIds.length > 1;
  if (isTie) {
    return <Award size={14} style={{ color: '#cbd5e1', flexShrink: 0 }} />;
  }
  return <Trophy size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />;
};

interface Offer {
  id: string;
  name: string;
  rate: number;
  term: number;
  type: 'fixed' | 'variable';
  variableType?: 'vrm' | 'arm';
}

interface RateComparerProps {
  profile: MortgageInputs | null;
  onSaveProfile?: (newProfile: MortgageInputs) => void;
}

const SaveStatusBadge: React.FC<{ status: 'saved' | 'pending' | 'saving'; labels: { saved: string; pending: string; saving: string } }> = ({ status, labels }) => {
  const config = {
    saved: { color: 'var(--color-success)', text: labels.saved, bg: 'rgba(16, 185, 129, 0.08)' },
    pending: { color: 'var(--color-warning)', text: labels.pending, bg: 'rgba(245, 158, 11, 0.08)' },
    saving: { color: 'var(--color-primary)', text: labels.saving, bg: 'rgba(99, 102, 241, 0.08)' }
  };
  
  const current = config[status];
  
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: current.color,
      background: current.bg,
      padding: '0.2rem 0.5rem',
      borderRadius: '0.375rem',
      transition: 'all 0.3s ease',
      border: `1px solid ${current.color}33`,
      height: '22px'
    }}>
      {status === 'saving' && (
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          border: `1.5px solid ${current.color}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite'
        }} />
      )}
      {status === 'pending' && (
        <span style={{
          width: '6px',
          height: '6px',
          background: current.color,
          borderRadius: '50%',
          animation: 'pulse 1.5s infinite ease-in-out'
        }} />
      )}
      {status === 'saved' && (
        <span style={{ color: current.color }}>✓</span>
      )}
      <span>{current.text}</span>
    </div>
  );
};

const estimateRemainingAmortization = (
  balance: number,
  rate: number,
  payment: number,
  frequency: PaymentFrequency,
  compounding: 'semi_annual' | 'monthly'
): { years: number; months: number } | null => {
  if (balance <= 0.01) return { years: 0, months: 0 };
  
  const periodRate = getPeriodInterestRate(rate, frequency, compounding);
  if (payment <= balance * periodRate) {
    return null; // Infinite amortization
  }
  
  try {
    const n = -Math.log(1 - (balance * periodRate) / payment) / Math.log(1 + periodRate);
    const ppy = getPaymentsPerYear(frequency);
    const totalYears = n / ppy;
    const years = Math.floor(totalYears);
    const months = Math.round((totalYears - years) * 12);
    
    if (months === 12) {
      return { years: years + 1, months: 0 };
    }
    return { years, months };
  } catch {
    return null;
  }
};

export const RateComparer: React.FC<RateComparerProps> = ({ profile, onSaveProfile }) => {
  const { t, locale } = useI18n();
  const systemTheme = useSystemTheme();
  const [activeSubTab, setActiveSubTab] = useState<'renewal' | 'refinance'>('renewal');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'saving'>('saved');

  const defaultBalance = profile?.principal || 400000;
  const defaultRate = profile?.interestRate || 4.85;
  const defaultAmortization = profile?.amortizationYears || 25;

  // Renewal states
  const [renewalBalance, setRenewalBalance] = useState<number>(() => {
    return profile?.renewalBalance || defaultBalance;
  });
  const [renewalAmortizationYears, setRenewalAmortizationYears] = useState<number>(() => {
    return profile?.renewalAmortizationYears || defaultAmortization;
  });
  const [renewalAmortizationMonths, setRenewalAmortizationMonths] = useState<number>(() => {
    return profile?.renewalAmortizationMonths !== undefined ? profile.renewalAmortizationMonths : (profile?.amortizationMonths || 0);
  });
  const [renewalFrequency, setRenewalFrequency] = useState<PaymentFrequency>(() => {
    return (profile?.rateComparerPaymentFrequency as PaymentFrequency) || profile?.paymentFrequency || 'monthly';
  });
  
  const [offers, setOffers] = useState<Offer[]>(() => {
    if (profile?.offers && profile.offers.length > 0) {
      return profile.offers;
    }
    return [
      { id: 'baseline', name: 'Baseline Offer', rate: defaultRate, term: 5, type: 'fixed' },
      { id: 'offer_2', name: 'Option B', rate: 5.15, term: 3, type: 'fixed' },
      { id: 'offer_3', name: 'Option C', rate: 4.45, term: 5, type: 'variable' }
    ];
  });

  const handleAddOffer = () => {
    if (offers.length >= 10) return;
    const newOffer: Offer = {
      id: 'offer_' + Date.now(),
      name: t.rate.offerN.replace('{n}', String(offers.length + 1)),
      rate: 4.5,
      term: 5,
      type: 'fixed'
    };
    setOffers(prev => [...prev, newOffer]);
  };

  const handleRemoveOffer = (id: string) => {
    if (offers.length <= 1) return;
    setOffers(prev => prev.filter(o => o.id !== id));
  };

  const handleUpdateOffer = (id: string, field: keyof Offer, value: any) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  // Refinance states
  const [refinanceBalance, setRefinanceBalance] = useState<number>(() => {
    return profile?.refinanceBalance || defaultBalance;
  });
  const [refinanceCurrentRate, setRefinanceCurrentRate] = useState<number>(() => {
    return profile?.refinanceCurrentRate || defaultRate;
  });
  const [refinanceRemainingTerm, setRefinanceRemainingTerm] = useState<number>(() => {
    if (profile?.refinanceRemainingTerm !== undefined) return profile.refinanceRemainingTerm;
    return profile?.maturityDate ? calculateRemainingMonths(profile.maturityDate) : 36;
  });
  const [refinanceAmortizationYears, setRefinanceAmortizationYears] = useState<number>(() => {
    return profile?.refinanceAmortizationYears || defaultAmortization;
  });
  const [refinanceAmortizationMonths, setRefinanceAmortizationMonths] = useState<number>(() => {
    return profile?.refinanceAmortizationMonths !== undefined ? profile.refinanceAmortizationMonths : (profile?.amortizationMonths || 0);
  });
  const [refinanceNewRate, setRefinanceNewRate] = useState<number>(() => {
    return profile?.refinanceNewRate || 4.49;
  });
  const [refinancePenaltyType, setRefinancePenaltyType] = useState<'three_months_interest' | 'ird' | 'custom'>(() => {
    return profile?.refinancePenaltyType || 'ird';
  });
  const [refinanceCustomPenalty, setRefinanceCustomPenalty] = useState<number>(() => {
    return profile?.refinanceCustomPenalty || 0;
  });
  const [refinanceFees, setRefinanceFees] = useState<number>(() => {
    return profile?.refinanceFees !== undefined ? profile.refinanceFees : 1500;
  });

  // Auto-save useEffect hook
  useEffect(() => {
    if (!profile || !onSaveProfile) return;

    const offersChanged = JSON.stringify(offers) !== JSON.stringify(profile.offers);
    const othersChanged = 
      renewalBalance !== profile.renewalBalance ||
      renewalFrequency !== profile.rateComparerPaymentFrequency ||
      renewalAmortizationYears !== profile.renewalAmortizationYears ||
      renewalAmortizationMonths !== profile.renewalAmortizationMonths ||
      refinanceBalance !== profile.refinanceBalance ||
      refinanceCurrentRate !== profile.refinanceCurrentRate ||
      refinanceRemainingTerm !== profile.refinanceRemainingTerm ||
      refinanceAmortizationYears !== profile.refinanceAmortizationYears ||
      refinanceAmortizationMonths !== profile.refinanceAmortizationMonths ||
      refinanceNewRate !== profile.refinanceNewRate ||
      refinancePenaltyType !== profile.refinancePenaltyType ||
      refinanceCustomPenalty !== profile.refinanceCustomPenalty ||
      refinanceFees !== profile.refinanceFees;

    if (!offersChanged && !othersChanged) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('pending');
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      onSaveProfile({
        ...profile,
        offers,
        renewalBalance,
        rateComparerPaymentFrequency: renewalFrequency,
        renewalAmortizationYears,
        renewalAmortizationMonths,
        refinanceBalance,
        refinanceCurrentRate,
        refinanceRemainingTerm,
        refinanceAmortizationYears,
        refinanceAmortizationMonths,
        refinanceNewRate,
        refinancePenaltyType,
        refinanceCustomPenalty,
        refinanceFees
      });
      const successTimer = setTimeout(() => {
        setSaveStatus('saved');
      }, 400);
      return () => clearTimeout(successTimer);
    }, 800);

    return () => clearTimeout(timer);
  }, [
    offers,
    renewalBalance,
    renewalFrequency,
    renewalAmortizationYears,
    renewalAmortizationMonths,
    refinanceBalance,
    refinanceCurrentRate,
    refinanceRemainingTerm,
    refinanceAmortizationYears,
    refinanceAmortizationMonths,
    refinanceNewRate,
    refinancePenaltyType,
    refinanceCustomPenalty,
    refinanceFees,
    profile,
    onSaveProfile
  ]);

  const householdIncome = profile?.householdIncome || 0;
  const incomeTypeLabel = profile?.incomeType === 'net' ? t.rate.incomeNet : t.rate.incomeGross;
  const renewalPaymentsPerYear = getPaymentsPerYear(renewalFrequency);

  const estimatedNetIncome = useMemo(() => {
    if (!profile || profile.incomeType !== 'gross') return null;
    const gross = profile.householdIncome || 0;
    if (gross <= 0) return 0;
    
    const taxFree = 15000;
    if (gross <= taxFree) return gross;
    
    const taxable = gross - taxFree;
    let tax = 0;
    if (taxable <= 40000) {
      tax = taxable * 0.20;
    } else if (taxable <= 85000) {
      tax = (40000 * 0.20) + (taxable - 40000) * 0.305;
    } else if (taxable <= 150000) {
      tax = (40000 * 0.20) + (45000 * 0.305) + (taxable - 85000) * 0.38;
    } else if (taxable <= 220000) {
      tax = (40000 * 0.20) + (45000 * 0.305) + (65000 * 0.38) + (taxable - 150000) * 0.435;
    } else {
      tax = (40000 * 0.20) + (45000 * 0.305) + (65000 * 0.38) + (70000 * 0.435) + (taxable - 220000) * 0.48;
    }
    return gross - tax;
  }, [profile]);

  // New Design 1: Delta from current payments
  const currentPayment = useMemo(() => {
    if (!profile) return null;
    
    if (profile.confirmedPayment && profile.confirmedPayment > 0) {
      return profile.confirmedPayment;
    }
    
    const principalForPayment = profile.originalPrincipal && profile.originalPrincipal > 0 
      ? profile.originalPrincipal 
      : profile.principal;
    
    const amortizationForPayment = profile.originalAmortizationYears && profile.originalAmortizationYears > 0
      ? profile.originalAmortizationYears + (profile.originalAmortizationMonths || 0) / 12
      : profile.amortizationYears + (profile.amortizationMonths || 0) / 12;
      
    const compoundingToUse = profile.rateType === 'variable' && profile.variableType
      ? 'monthly'
      : (profile.compounding || 'semi_annual');
      
    return calculateRegularPayment(
      principalForPayment,
      profile.interestRate,
      amortizationForPayment,
      profile.paymentFrequency,
      compoundingToUse
    );
  }, [profile]);

  const comparableCurrentPayment = useMemo(() => {
    if (!profile || currentPayment === null) return null;
    const currentPaymentsPerYear = getPaymentsPerYear(profile.paymentFrequency);
    return (currentPayment * currentPaymentsPerYear) / renewalPaymentsPerYear;
  }, [profile, currentPayment, renewalPaymentsPerYear]);

  const isStackedLayout = activeSubTab === 'renewal' && offers.length > 3;

  // 1. Renewal calculations
  const renewalResults = useMemo(() => {
    const renewalAmortization = renewalAmortizationYears + renewalAmortizationMonths / 12;

    // Helper to calculate term details
    const getTermDetails = (rate: number, termYears: number, type: 'fixed' | 'variable') => {
      const compounding = type === 'variable' ? 'monthly' : 'semi_annual';
      const monthlyPayment = calculateRegularPayment(renewalBalance, rate, renewalAmortization, renewalFrequency, compounding);
      const periodRate = getPeriodInterestRate(rate, renewalFrequency, compounding);
      const ppy = getPaymentsPerYear(renewalFrequency);
      
      let balance = renewalBalance;
      let totalInterest = 0;
      let totalPrincipal = 0;
      const termPayments = termYears * ppy;

      for (let m = 0; m < termPayments; m++) {
        const interest = balance * periodRate;
        let principalPaid = monthlyPayment - interest;
        if (principalPaid > balance) principalPaid = balance;
        
        totalInterest += interest;
        totalPrincipal += principalPaid;
        balance = Math.max(0, balance - principalPaid);
      }

      const remainingAmortization = estimateRemainingAmortization(balance, rate, monthlyPayment, renewalFrequency, compounding);

      return {
        monthlyPayment,
        totalInterest,
        totalPrincipal,
        endingBalance: balance,
        remainingAmortization
      };
    };

    return offers.map(o => ({
      ...o,
      results: getTermDetails(o.rate, o.term, o.type)
    }));
  }, [renewalBalance, renewalFrequency, renewalAmortizationYears, renewalAmortizationMonths, offers]);

  // 1.5. Calculate the best option for each metric in renewal results
  const bestMetricOffers = useMemo(() => {
    if (renewalResults.length <= 1) return {};

    const findBest = (
      extractor: (item: typeof renewalResults[0]) => number | null | undefined,
      comparator: (a: number, b: number) => boolean
    ) => {
      let bestVal: number | null = null;
      let worstVal: number | null = null;

      for (const item of renewalResults) {
        const val = extractor(item);
        if (val === null || val === undefined || isNaN(val)) continue;
        if (bestVal === null || comparator(val, bestVal)) {
          bestVal = val;
        }
        if (worstVal === null || !comparator(val, worstVal)) {
          worstVal = val;
        }
      }

      if (bestVal === worstVal) return [];

      const bestIds: string[] = [];
      for (const item of renewalResults) {
        const val = extractor(item);
        if (val === bestVal) {
          bestIds.push(item.id);
        }
      }
      return bestIds;
    };

    const getRemainingAmortMonths = (item: typeof renewalResults[0]) => {
      const amort = item.results.remainingAmortization;
      if (!amort) return Infinity;
      return amort.years * 12 + amort.months;
    };

    return {
      rate: findBest(o => o.rate, (a, b) => a < b),
      payment: findBest(o => o.results.monthlyPayment, (a, b) => a < b),
      pctIncome: householdIncome > 0
        ? findBest(o => (o.results.monthlyPayment * renewalPaymentsPerYear) / householdIncome, (a, b) => a < b)
        : [],
      interest: findBest(o => o.results.totalInterest, (a, b) => a < b),
      principal: findBest(o => o.results.totalPrincipal, (a, b) => a > b),
      endingBalance: findBest(o => o.results.endingBalance, (a, b) => a < b),
      amortAtEnd: findBest(getRemainingAmortMonths, (a, b) => a < b),
    };
  }, [renewalResults, householdIncome, renewalPaymentsPerYear]);

  // 1.7. Compute overall best offer(s)
  const overallBestOffers = useMemo(() => {
    if (renewalResults.length <= 1) return [];

    const counts: Record<string, number> = {};
    for (const key of Object.keys(bestMetricOffers)) {
      const ids = bestMetricOffers[key as keyof typeof bestMetricOffers] || [];
      for (const id of ids) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }

    let maxCount = 0;
    let winners: string[] = [];

    for (const [id, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        winners = [id];
      } else if (count === maxCount) {
        winners.push(id);
      }
    }

    // If there is a tie where all offers have the same max wins, or no category was won,
    // we don't highlight any option as overall best.
    if (maxCount === 0 || winners.length === renewalResults.length) {
      return [];
    }

    return winners;
  }, [bestMetricOffers, renewalResults.length]);

  // 2. Refinance calculations
  const refinanceResults = useMemo(() => {
    return calculateRefinance({
      currentBalance: refinanceBalance,
      currentRate: refinanceCurrentRate,
      remainingTermMonths: refinanceRemainingTerm,
      remainingAmortizationYears: refinanceAmortizationYears + refinanceAmortizationMonths / 12,
      prepaymentPenaltyType: refinancePenaltyType,
      customPenaltyAmount: refinanceCustomPenalty,
      newRate: refinanceNewRate,
      refinanceFees
    });
  }, [refinanceBalance, refinanceCurrentRate, refinanceRemainingTerm, refinanceAmortizationYears, refinanceAmortizationMonths, refinancePenaltyType, refinanceCustomPenalty, refinanceNewRate, refinanceFees]);

  // Renewal Charts Helper Functions
  const getBarColors = (
    values: number[],
    lowerIsBetter: boolean
  ) => {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
    const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
    const maxVal = validValues.length > 0 ? Math.max(...validValues) : 0;
    const range = maxVal - minVal || 1;

    return renewalResults.map((_, i) => {
      const val = values[i];
      if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
        return { bg: 'rgba(148, 163, 184, 0.2)', border: 'rgba(148, 163, 184, 0.5)' };
      }

      // Calculate hue from red (10) to emerald green (130)
      let pct = (val - minVal) / range;
      if (lowerIsBetter) {
        pct = 1 - pct; // lower values get higher pct (closer to green)
      }

      // If all values are identical, use a neutral theme color (e.g. blue/indigo)
      const allIdentical = maxVal === minVal;
      const hue = allIdentical ? 220 : Math.round(10 + pct * 120);

      return {
        bg: `hsla(${hue}, 75%, 55%, 0.7)`,
        border: `hsla(${hue}, 75%, 45%, 1)`
      };
    });
  };

  const createChartData = (
    label: string,
    values: number[],
    lowerIsBetter: boolean,
    bestIds: string[] | undefined
  ) => {
    const colors = getBarColors(values, lowerIsBetter);
    return {
      labels: renewalResults.map(o => {
        const isBest = bestIds?.includes(o.id);
        const isTie = bestIds && bestIds.length > 1;
        const prefix = isBest ? (isTie ? '🎖️ ' : '🏆 ') : '';
        return `${prefix}${o.name}`;
      }),
      datasets: [
        {
          label,
          data: values,
          backgroundColor: colors.map(c => c.bg),
          borderColor: colors.map(c => c.border),
          borderWidth: 1,
          borderRadius: 8,
        }
      ]
    };
  };

  const createChartOptions = (yTickCallback: (value: any) => string) => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              return context.dataset.label + ': ' + yTickCallback(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { 
            color: '#94a3b8',
            callback: yTickCallback
          }
        }
      }
    };
  };

  // Generate 6 Comparison Charts Configuration
  const chartRateData = createChartData(
    t.rate.rateTerm,
    renewalResults.map(o => o.rate),
    true,
    bestMetricOffers.rate
  );
  const chartRateOptions = createChartOptions(val => val.toFixed(2) + '%');

  const chartPaymentData = createChartData(
    'Payment',
    renewalResults.map(o => o.results.monthlyPayment),
    true,
    bestMetricOffers.payment
  );
  const chartPaymentOptions = createChartOptions(val => '$' + val.toLocaleString(undefined, { maximumFractionDigits: 0 }));

  const chartPctIncomeData = createChartData(
    t.rate.percentOfIncome,
    renewalResults.map(o => householdIncome > 0 ? (o.results.monthlyPayment * renewalPaymentsPerYear) / householdIncome * 100 : 0),
    true,
    bestMetricOffers.pctIncome
  );
  const chartPctIncomeOptions = createChartOptions(val => val.toFixed(1) + '%');

  const chartInterestData = createChartData(
    t.rate.interestPaidInTerm,
    renewalResults.map(o => o.results.totalInterest),
    true,
    bestMetricOffers.interest
  );
  const chartInterestOptions = createChartOptions(val => '$' + (val / 1000).toFixed(0) + 'k');

  const chartPrincipalData = createChartData(
    t.rate.principalPaidInTerm,
    renewalResults.map(o => o.results.totalPrincipal),
    false,
    bestMetricOffers.principal
  );
  const chartPrincipalOptions = createChartOptions(val => '$' + (val / 1000).toFixed(0) + 'k');

  const chartEndingBalanceData = createChartData(
    t.rate.endingBalance,
    renewalResults.map(o => o.results.endingBalance),
    true,
    bestMetricOffers.endingBalance
  );
  const chartEndingBalanceOptions = createChartOptions(val => '$' + (val / 1000).toFixed(0) + 'k');

  const chartAmortAtEndData = createChartData(
    t.rate.amortAtTermEnd,
    renewalResults.map(o => {
      const amort = o.results.remainingAmortization;
      return amort ? amort.years + amort.months / 12 : 50; // cap at 50 if never payoff
    }),
    true,
    bestMetricOffers.amortAtEnd
  );
  const chartAmortAtEndOptions = createChartOptions(val => val === 50 ? 'Never' : val.toFixed(1) + ' yrs');

  // Refinance Chart Data
  const refinanceChartData = {
    labels: [t.rate.currentRatePlan, t.rate.newRatePlan],
    datasets: [
      {
        label: t.rate.interestCostOverTerm,
        data: [
          refinanceResults.currentInterestOverTerm,
          refinanceResults.newInterestOverTerm
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(16, 185, 129, 0.7)'
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(16, 185, 129, 1)'
        ],
        borderWidth: 1,
        borderRadius: 8,
      }
    ]
  };

  const refinanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return t.rate.interestCost + ' ' + new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(context.parsed.y);
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: systemTheme === 'dark' ? '#94a3b8' : '#64748b' }
      },
      y: {
        grid: { color: systemTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { 
          color: systemTheme === 'dark' ? '#94a3b8' : '#64748b',
          callback: function(value: any) { return '$' + (value / 1000) + 'k'; }
        }
      }
    }
  };

  const breakEvenChartData = {
    labels: Array.from({ length: (refinanceRemainingTerm || 60) + 1 }, (_, i) => `Month ${i}`),
    datasets: [
      {
        label: t.rate?.totalBreakingCosts || 'Total Closing Costs',
        data: Array.from({ length: (refinanceRemainingTerm || 60) + 1 }, () => refinanceResults.totalClosingCosts),
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      },
      {
        label: t.rate?.monthlySavings || 'Cumulative Savings',
        data: Array.from({ length: (refinanceRemainingTerm || 60) + 1 }, (_, i) => Math.round(refinanceResults.monthlySavings * i * 100) / 100),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 2
      }
    ]
  };

  const breakEvenChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: systemTheme === 'dark' ? '#e2e8f0' : '#1e293b',
          font: { family: 'Inter', size: 10 }
        }
      },
      tooltip: {
        callbacks: {
          label: cadCurrencyTooltipLabel
        }
      }
    },
    scales: {
      x: {
        grid: { color: systemTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: systemTheme === 'dark' ? '#94a3b8' : '#64748b', maxTicksLimit: 12 }
      },
      y: {
        grid: { color: systemTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { 
          color: systemTheme === 'dark' ? '#94a3b8' : '#64748b',
          callback: function(value: any) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  const saveStatusLabels = { saved: t.rate.saved, pending: t.rate.pending, saving: t.rate.saving };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t.rate.title}</h2>
        <p style={{ fontSize: '0.95rem' }}>{t.rate.subtitle}</p>
      </div>

      {/* Sub-tab selection */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`btn ${activeSubTab === 'renewal' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('renewal')}
        >
          {t.rate.renewalTab}
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === 'refinance' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('refinance')}
        >
          {t.rate.refinanceTab}
        </button>
      </div>

      {activeSubTab === 'renewal' ? (
        /* RENEWAL COMPARE PANEL */
        <div className={`grid-main ${isStackedLayout ? 'grid-main-stacked' : ''}`}>
          {/* Inputs */}
          <div className={`card flex flex-col gap-4 card-${saveStatus}`}>
            <h3 style={{ 
              borderBottom: '1px solid var(--border-color)', 
              paddingBottom: '0.5rem', 
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{t.rate.renewalParams}</span>
              <SaveStatusBadge status={saveStatus} labels={saveStatusLabels} />
            </h3>

            {/* Core Parameters */}
            <div className={isStackedLayout ? "grid grid-cols-3 gap-4" : "flex flex-col gap-4"}>
              {/* Balance */}
              <div className="form-group" style={{ marginBottom: isStackedLayout ? 0 : undefined }}>
                <label className="form-label">
                  <span>{t.rate.balanceToRenew}</span>
                  <span className="form-label-val">${renewalBalance.toLocaleString()}</span>
                </label>
                <div className="form-input-wrapper">
                  <DollarSign size={16} className="form-input-prefix" />
                  <input 
                    type="number" 
                    className="form-input form-input-with-prefix" 
                    value={renewalBalance} 
                    onChange={(e) => setRenewalBalance(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Amortization */}
              <div className="form-group" style={{ marginBottom: isStackedLayout ? 0 : undefined }}>
                <label className="form-label">
                  <span>{t.rate.remainingAmort}</span>
                  <span className="form-label-val">{renewalAmortizationYears} {t.rate.yrs}, {renewalAmortizationMonths} {t.rate.mos}</span>
                </label>
                <div className="flex gap-2">
                  <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={renewalAmortizationYears} 
                      onChange={(e) => setRenewalAmortizationYears(Math.max(1, parseInt(e.target.value) || 25))}
                      placeholder={t.rate.years}
                      style={{ paddingRight: '2rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.rate.yrs}</span>
                  </div>
                  <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={renewalAmortizationMonths} 
                      onChange={(e) => setRenewalAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                      placeholder={t.rate.months}
                      style={{ paddingRight: '2.2rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.rate.mos}</span>
                  </div>
                </div>
              </div>

              {/* Frequency */}
              <div className="form-group" style={{ marginBottom: isStackedLayout ? 0 : undefined }}>
                <label className="form-label">{t.rate.paymentFrequency}</label>
                <select 
                  className="form-select" 
                  value={renewalFrequency} 
                  onChange={(e) => setRenewalFrequency(e.target.value as PaymentFrequency)}
                >
                  <option value="monthly">{t.rate.monthly}</option>
                  <option value="semi_monthly">{t.rate.semiMonthly}</option>
                  <option value="regular_bi_weekly">{t.rate.biWeekly}</option>
                  <option value="accelerated_bi_weekly">{t.rate.accBiWeekly}</option>
                  <option value="regular_weekly">{t.rate.weekly}</option>
                  <option value="accelerated_weekly">{t.rate.accWeekly}</option>
                </select>
              </div>
            </div>

            {/* Dynamic Offers list */}
            <div className={isStackedLayout ? "grid grid-cols-3" : "flex flex-col"} style={{ gap: '1rem' }}>
              {offers.map((offer) => (
                <div 
                  key={offer.id} 
                  style={{ 
                    background: 'rgba(255,255,255,0.01)', 
                    padding: '0.75rem', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '0.5rem',
                  }}
                >
                  <div className="flex justify-between align-center" style={{ marginBottom: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={offer.name} 
                      onChange={(e) => handleUpdateOffer(offer.id, 'name', e.target.value)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        borderBottom: '1px dashed var(--border-color)',
                        borderRadius: 0,
                        padding: '0.15rem 0',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                        width: 'auto'
                      }}
                    />
                    {offers.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveOffer(offer.id)}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: 'var(--color-danger)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {/* Rate */}
                    <div className="form-group w-full" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>{t.rate.interestRate}</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="form-input" 
                        value={offer.rate} 
                        onChange={(e) => handleUpdateOffer(offer.id, 'rate', parseFloat(e.target.value) || 0)}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    {/* Term */}
                    <div className="form-group w-full" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>{t.rate.term}</label>
                      <select 
                        className="form-select" 
                        value={offer.term} 
                        onChange={(e) => handleUpdateOffer(offer.id, 'term', parseInt(e.target.value) || 5)}
                        style={{ padding: '0.4rem 1.75rem 0.4rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        <option value="1">{t.rate.yr1}</option>
                        <option value="2">{t.rate.yrs2}</option>
                        <option value="3">{t.rate.yrs3}</option>
                        <option value="4">{t.rate.yrs4}</option>
                        <option value="5">{t.rate.yrs5}</option>
                        <option value="7">{t.rate.yrs7}</option>
                        <option value="10">{t.rate.yrs10}</option>
                      </select>
                    </div>
                    {/* Type */}
                    <div className="form-group w-full" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>{t.paydown.rateType || 'Interest Rate Type'}</label>
                      <select 
                        className="form-select" 
                        value={offer.type === 'variable' ? (offer.variableType === 'arm' ? 'variable_arm' : 'variable_vrm') : 'fixed'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setOffers(prev => prev.map(o => {
                            if (o.id !== offer.id) return o;
                            if (val === 'fixed') {
                              return { ...o, type: 'fixed', variableType: undefined };
                            } else if (val === 'variable_vrm') {
                              return { ...o, type: 'variable', variableType: 'vrm' };
                            } else {
                              return { ...o, type: 'variable', variableType: 'arm' };
                            }
                          }));
                        }}
                        style={{ padding: '0.4rem 1.75rem 0.4rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        <option value="fixed">{t.rate.fixed}</option>
                        <option value="variable_vrm">{t.rate.variableVrm || 'Variable (VRM)'}</option>
                        <option value="variable_arm">{t.rate.variableArm || 'Variable (ARM)'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Offer Button */}
            {offers.length < 10 && (
              <button 
                type="button" 
                className="btn btn-secondary w-full flex align-center justify-center gap-2"
                onClick={handleAddOffer}
                style={{ marginTop: '0.25rem', padding: '0.5rem' }}
              >
                <Plus size={14} />
                <span style={{ fontSize: '0.85rem' }}>{t.rate.addOffer.replace('{count}', String(offers.length))}</span>
              </button>
            )}

          </div>

          {/* Renewal Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t.rate.renewalResults}</h3>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t.rate.metric}</th>
                      {renewalResults.map((o, index) => (
                        <th 
                          key={o.id} 
                          style={{ 
                            color: `hsla(${200 + (index * 35) % 160}, 85%, 65%, 1)`,
                            textAlign: 'right',
                            minWidth: '130px'
                          }}
                        >
                          {o.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{t.rate.rateTerm}</td>
                      {renewalResults.map(o => {
                        const isBest = bestMetricOffers.rate?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(isBest, bestMetricOffers.rate)}
                              <span style={{ color: isBest ? 'var(--color-success)' : undefined }}>
                                <strong>{o.rate.toFixed(2)}%</strong> ({o.term} {t.rate.yrs} {o.type === 'variable' ? (o.variableType === 'arm' ? 'ARM' : 'VRM') : t.rate.fix})
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td>{renewalFrequency.includes('accelerated') ? 'Acc. ' : ''}{renewalFrequency.replace('accelerated_', '').replace('regular_', '').replace('_', '-').replace(/\b\w/g, c => c.toUpperCase())} Payment</td>
                      {renewalResults.map(o => {
                        const isBest = bestMetricOffers.payment?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(isBest, bestMetricOffers.payment)}
                              <span style={{ color: isBest ? 'var(--color-success)' : undefined }}>
                                ${o.results.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {comparableCurrentPayment !== null && (
                      <tr>
                        <td>{t.rate.paymentDelta || 'Delta from Current'}</td>
                        {renewalResults.map(o => {
                          const delta = o.results.monthlyPayment - comparableCurrentPayment;
                          const isNegative = delta < 0;
                          const formattedDelta = (isNegative ? '-' : '+') + '$' + Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          return (
                            <td key={o.id} style={{ textAlign: 'right', color: isNegative ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 500 }}>
                              {formattedDelta}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                    <tr>
                      <td>{t.rate.percentOfIncome} ({incomeTypeLabel})</td>
                      {renewalResults.map(o => {
                        const pct = householdIncome > 0
                          ? (o.results.monthlyPayment * renewalPaymentsPerYear) / householdIncome * 100
                          : null;
                        const isBest = bestMetricOffers.pctIncome?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(isBest && pct !== null, bestMetricOffers.pctIncome)}
                              <span style={{ color: isBest && pct !== null ? 'var(--color-success)' : undefined }}>
                                {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {estimatedNetIncome !== null && estimatedNetIncome > 0 && (
                      <tr>
                        <td>{t.rate.percentOfIncomeEstNet}</td>
                        {renewalResults.map(o => {
                          const pct = (o.results.monthlyPayment * renewalPaymentsPerYear) / estimatedNetIncome * 100;
                          const isBest = bestMetricOffers.pctIncome?.includes(o.id);
                          return (
                            <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                {renderBestIcon(isBest, bestMetricOffers.pctIncome)}
                                <span style={{ color: isBest ? 'var(--color-success)' : undefined }}>
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                    <tr>
                      <td>{t.rate.interestPaidInTerm}</td>
                      {renewalResults.map(o => {
                        const isBest = bestMetricOffers.interest?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(isBest, bestMetricOffers.interest)}
                              <span style={{ color: isBest ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                ${o.results.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td>{t.rate.principalPaidInTerm}</td>
                      {renewalResults.map(o => {
                        const isBest = bestMetricOffers.principal?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(isBest, bestMetricOffers.principal)}
                              <span style={{ color: 'var(--color-success)' }}>
                                ${o.results.totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td>{t.rate.endingBalance}</td>
                      {renewalResults.map(o => {
                        const isBest = bestMetricOffers.endingBalance?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(isBest, bestMetricOffers.endingBalance)}
                              <span style={{ color: isBest ? 'var(--color-success)' : undefined }}>
                                <strong>${o.results.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td>{t.rate.amortAtTermEnd}</td>
                      {renewalResults.map(o => {
                        const amort = o.results.remainingAmortization;
                        const isBest = bestMetricOffers.amortAtEnd?.includes(o.id);
                        return (
                          <td key={o.id} style={{ textAlign: 'right', background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined, fontWeight: 600 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {renderBestIcon(!!(isBest && amort), bestMetricOffers.amortAtEnd)}
                              <span style={{ color: isBest && amort ? 'var(--color-success)' : undefined }}>
                                {amort ? `${amort.years} ${t.rate.yrs}, ${amort.months} ${t.rate.mos}` : t.rate.neverPayoff}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {overallBestOffers.length > 0 && (
                      <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.02)' }}>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                          {getOverallBestLabel(locale)}
                        </td>
                        {renewalResults.map(o => {
                          const isOverallBest = overallBestOffers.includes(o.id);
                          const isOverallTie = overallBestOffers.length > 1;
                          return (
                            <td key={o.id} style={{ textAlign: 'center', background: isOverallBest ? 'rgba(16, 185, 129, 0.08)' : undefined }}>
                              {isOverallBest ? (
                                <div style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                                  {isOverallTie ? (
                                    <Award size={15} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                  ) : (
                                    <ArrowUp size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                                  )}
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Trophy size={13} style={{ color: 'var(--color-warning)' }} />
                  <span>{locale === 'fr' ? 'Meilleure option' : 'Best Option'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Award size={13} style={{ color: '#cbd5e1' }} />
                  <span>{locale === 'fr' ? 'Égalité (meilleures options)' : 'Tie (Best Options)'}</span>
                </div>
              </div>
            </div>

            {/* Comparison Charts Grid */}
            <div className="grid grid-cols-2" style={{ gap: '1.5rem', width: '100%' }}>
              {/* Chart 1: Interest Rate */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.rate.rateTerm}</h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartRateData} options={chartRateOptions} />
                </div>
              </div>

              {/* Chart 2: Regular Payment */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  {renewalFrequency.includes('accelerated') ? 'Acc. ' : ''}
                  {renewalFrequency.replace('accelerated_', '').replace('regular_', '').replace('_', '-').replace(/\b\w/g, c => c.toUpperCase())} Payment
                </h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartPaymentData} options={chartPaymentOptions} />
                </div>
              </div>

              {/* Chart 3: Percent of Income */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.rate.percentOfIncome} ({incomeTypeLabel})</h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartPctIncomeData} options={chartPctIncomeOptions} />
                </div>
              </div>

              {/* Chart 4: Interest Paid */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.rate.interestPaidInTerm}</h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartInterestData} options={chartInterestOptions} />
                </div>
              </div>

              {/* Chart 5: Principal Paid */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.rate.principalPaidInTerm}</h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartPrincipalData} options={chartPrincipalOptions} />
                </div>
              </div>

              {/* Chart 6: Ending Balance */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.rate.endingBalance}</h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartEndingBalanceData} options={chartEndingBalanceOptions} />
                </div>
              </div>

              {/* Chart 7: Amortization at Term End */}
              <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.rate.amortAtTermEnd}</h3>
                <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                  <Bar data={chartAmortAtEndData} options={chartAmortAtEndOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* REFINANCE PENALTY PANEL */
        <div className="grid-main">
          {/* Inputs */}
          <div className={`card flex flex-col gap-4 card-${saveStatus}`}>
            <h3 style={{ 
              borderBottom: '1px solid var(--border-color)', 
              paddingBottom: '0.5rem', 
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{t.rate.refinanceParams}</span>
              <SaveStatusBadge status={saveStatus} labels={saveStatusLabels} />
            </h3>

            {/* Current Mortgage Info */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 0 }}>{t.rate.currentMortgage}</h4>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.outstandingBalance}</label>
                <div className="form-input-wrapper">
                  <DollarSign size={14} className="form-input-prefix" />
                  <input type="number" className="form-input form-input-with-prefix" value={refinanceBalance} onChange={(e) => setRefinanceBalance(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.currentRate}</label>
                  <input type="number" step="0.01" className="form-input" value={refinanceCurrentRate} onChange={(e) => setRefinanceCurrentRate(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.amortLeft}</label>
                  <div className="flex gap-2">
                    <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={refinanceAmortizationYears} 
                        onChange={(e) => setRefinanceAmortizationYears(Math.max(1, parseInt(e.target.value) || 20))}
                        placeholder={t.rate.yrs}
                        style={{ paddingRight: '1.8rem', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.rate.yrs}</span>
                    </div>
                    <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={refinanceAmortizationMonths} 
                        onChange={(e) => setRefinanceAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                        placeholder={t.rate.mos}
                        style={{ paddingRight: '2rem', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.rate.mos}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.remainingTermMonths}</label>
                <input type="number" className="form-input" value={refinanceRemainingTerm} onChange={(e) => setRefinanceRemainingTerm(Math.max(1, parseInt(e.target.value) || 12))} />
              </div>
            </div>

            {/* New Deal Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', marginBottom: 0 }}>{t.rate.newMortgageOffer}</h4>

              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.newRate}</label>
                  <input type="number" step="0.01" className="form-input" value={refinanceNewRate} onChange={(e) => setRefinanceNewRate(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.appraisalFees}</label>
                  <input type="number" className="form-input" value={refinanceFees} onChange={(e) => setRefinanceFees(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.penaltyMethod}</label>
                <select className="form-select" value={refinancePenaltyType} onChange={(e) => setRefinancePenaltyType(e.target.value as any)}>
                  <option value="three_months_interest">{t.rate.threeMonthsInterest}</option>
                  <option value="ird">{t.rate.ird}</option>
                  <option value="custom">{t.rate.customPenalty}</option>
                </select>
              </div>

              {refinancePenaltyType === 'custom' && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.rate.customPenaltyAmount}</label>
                  <div className="form-input-wrapper">
                    <DollarSign size={14} className="form-input-prefix" />
                    <input type="number" className="form-input form-input-with-prefix" value={refinanceCustomPenalty} onChange={(e) => setRefinanceCustomPenalty(Math.max(0, parseInt(e.target.value) || 0))} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Refinance Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Savings Cards */}
            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
              <div className="card">
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  {t.rate.totalBreakingCosts}
                </h4>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-danger)' }}>
                  ${refinanceResults.totalClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {t.rate.penalty} ${refinanceResults.estimatedPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 })} + {t.rate.fees} ${refinanceFees.toLocaleString()}
                </div>
              </div>

              <div className="card">
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  {t.rate.monthlySavings}
                </h4>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-success)' }}>
                  ${refinanceResults.monthlySavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.rate.perMonth}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {t.rate.loweredPayment}
                </div>
              </div>
            </div>

            {/* Break-even banner */}
            <div className="card card-accent" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{t.rate.breakEvenSummary}</h3>
              {refinanceResults.netSavingsOverTerm > 0 ? (
                <div className="flex align-center gap-4">
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>
                      {t.rate.refinanceWillSave} <strong className="color-success">${refinanceResults.netSavingsOverTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> {t.rate.netOverRemaining.replace('{months}', String(refinanceRemainingTerm))}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t.rate.recoverCosts} <strong>{refinanceResults.breakEvenMonths.toFixed(1)} {t.rate.monthsOfPayments}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex align-center gap-4">
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-danger)', display: 'block', fontWeight: 600 }}>
                      {t.rate.refinanceNotRecommended}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {t.rate.penaltyExceedsSavings} <strong>${Math.abs(refinanceResults.netSavingsOverTerm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> {t.rate.overTheTerm}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="card" style={{ height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{t.rate.interestSavingsComparison}</h3>
              <div style={{ flexGrow: 1, position: 'relative', height: '140px' }}>
                <Bar data={refinanceChartData} options={refinanceChartOptions} />
              </div>
            </div>

            {/* Break-Even Timeline Chart */}
            <div className="card" style={{ height: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{t.rate.breakEvenChartTitle}</h3>
              <div style={{ flexGrow: 1, position: 'relative', height: '200px' }}>
                <Line data={breakEvenChartData} options={breakEvenChartOptions} />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
