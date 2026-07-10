import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Eraser, Percent, Sparkles, ShieldAlert } from 'lucide-react';
import { calculateAmortization, getPaymentsPerYear, calculateRegularPayment, calculateTriggerRate } from '../utils/mortgageMath';
import type { MortgageInputs, PaymentFrequency } from '../utils/mortgageMath';
import { useI18n } from '../utils/i18n';
import { useSystemTheme } from '../hooks/useSystemTheme';
import {
  cadCurrencyTooltipLabel,
  formatLocaleCurrency,
  formatLocaleNumber,
  formatLocalePercent
} from '../utils/formatters';
import { FormattedNumericInput } from './FormattedNumericInput';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);


interface CurrentMortgageProps {
  initialProfile: MortgageInputs | null;
  onSaveProfile: (profile: MortgageInputs) => void;
  onNavigate?: (tab: string) => void;
}

const SaveStatusBadge: React.FC<{ status: 'saved' | 'pending' | 'saving'; labels: Record<'saved' | 'pending' | 'saving', string> }> = ({ status, labels }) => {
  const config = {
    saved: { color: 'var(--color-success)', bg: 'rgba(16, 185, 129, 0.08)' },
    pending: { color: 'var(--color-warning)', bg: 'rgba(245, 158, 11, 0.08)' },
    saving: { color: 'var(--color-primary)', bg: 'rgba(99, 102, 241, 0.08)' }
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
      <span>{labels[status]}</span>
    </div>
  );
};

export const CurrentMortgage: React.FC<CurrentMortgageProps> = ({ initialProfile, onSaveProfile, onNavigate }) => {
  const { t, locale } = useI18n();
  const systemTheme = useSystemTheme();

  // Load offers configured in the RateComparer tab (from initialProfile) or fall back to default offers
  const defaultRate = initialProfile?.interestRate || 4.85;
  const defaultOffers = [
    { id: 'baseline', name: t.rate?.baselineOffer || 'Baseline Offer', rate: defaultRate, term: 5, type: 'fixed' as const },
    { id: 'offer_2', name: t.rate?.optionB || 'Option B', rate: 5.15, term: 3, type: 'fixed' as const },
    { id: 'offer_3', name: t.rate?.optionC || 'Option C', rate: 4.45, term: 5, type: 'variable' as const }
  ];
  const offers = initialProfile?.offers || defaultOffers;

  const [selectedScenario, setSelectedScenario] = useState<string>('current');

  // Local state for inputs
  const [principal, setPrincipal] = useState<number | ''>(initialProfile?.principal || 450000);
  const [interestRate, setInterestRate] = useState<number | ''>(initialProfile?.interestRate || 4.85);
  const [amortizationYears, setAmortizationYears] = useState<number | ''>(initialProfile?.amortizationYears || 25);
  const [amortizationMonths, setAmortizationMonths] = useState<number | ''>(initialProfile?.amortizationMonths || 0);
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(initialProfile?.paymentFrequency || 'monthly');
  const [maturityDate, setMaturityDate] = useState<string>(initialProfile?.maturityDate || '');
  
  // Custom Payment Override
  const [confirmedPayment, setConfirmedPayment] = useState<number | ''>(initialProfile?.confirmedPayment || 0);

  // Rate Type and Variable Type
  const [rateType, setRateType] = useState<'fixed' | 'variable'>(initialProfile?.rateType || 'fixed');
  const [variableType, setVariableType] = useState<'vrm' | 'arm'>(initialProfile?.variableType || 'vrm');

  // Original Parameters
  const [originalPrincipal, setOriginalPrincipal] = useState<number | ''>(initialProfile?.originalPrincipal || 0);
  const [originalAmortizationYears, setOriginalAmortizationYears] = useState<number | ''>(initialProfile?.originalAmortizationYears || 0);
  const [originalAmortizationMonths, setOriginalAmortizationMonths] = useState<number | ''>(initialProfile?.originalAmortizationMonths || 0);
  const [originalTermYears, setOriginalTermYears] = useState<number | ''>(initialProfile?.originalTermYears || 0);

  // Household affordability (persisted globally; not used by the amortization math)
  const [householdIncome, setHouseholdIncome] = useState<number | ''>(initialProfile?.householdIncome || 0);
  const [incomeType, setIncomeType] = useState<'gross' | 'net'>(initialProfile?.incomeType || 'gross');

  // Prepayments
  const [showPrepayments, setShowPrepayments] = useState<boolean>(
    !!(initialProfile?.prepayments && 
    (initialProfile.prepayments.lumpSumAmount > 0 || 
     initialProfile.prepayments.doubleUp || 
     initialProfile.prepayments.paymentIncreasePercent > 0 || 
     initialProfile.prepayments.paymentIncreaseFixed > 0))
  );
  
  const [lumpSumAmount, setLumpSumAmount] = useState<number | ''>(initialProfile?.prepayments?.lumpSumAmount || 0);
  const [doubleUp, setDoubleUp] = useState<boolean>(initialProfile?.prepayments?.doubleUp || false);
  // Interval between double-ups, in payments. Defaults to once per year (ppy) for a fresh profile.
  const [doubleUpEvery, setDoubleUpEvery] = useState<number | ''>(
    initialProfile?.prepayments?.doubleUpEvery || getPaymentsPerYear(initialProfile?.paymentFrequency || 'monthly')
  );
  const [paymentIncreasePercent, setPaymentIncreasePercent] = useState<number | ''>(initialProfile?.prepayments?.paymentIncreasePercent || 0);
  const [paymentIncreaseFixed, setPaymentIncreaseFixed] = useState<number | ''>(initialProfile?.prepayments?.paymentIncreaseFixed || 0);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'saving'>('saved');
  const [interestRateOffset, setInterestRateOffset] = useState<number>(0);

  const saveStatusLabels = useMemo(() => ({
    saved: t.paydown.saved,
    pending: t.paydown.pending,
    saving: t.paydown.saving,
  }), [t]);

  // Find selected offer if any
  const selectedOffer = useMemo(() => {
    if (selectedScenario === 'current') return null;
    return offers.find(o => o.id === selectedScenario) || null;
  }, [selectedScenario, offers]);

  // Effective parameters used for calculations and read-only inputs
  const rawPrincipal = selectedOffer ? (initialProfile?.renewalBalance || principal) : principal;
  const rawInterestRate = selectedOffer ? selectedOffer.rate : interestRate;
  const rawAmortizationYears = selectedOffer ? (initialProfile?.renewalAmortizationYears || amortizationYears) : amortizationYears;
  const rawAmortizationMonths = selectedOffer ? (initialProfile?.renewalAmortizationMonths !== undefined ? initialProfile.renewalAmortizationMonths : amortizationMonths) : amortizationMonths;
  const rawConfirmedPayment = selectedOffer ? 0 : confirmedPayment;
  const rawOriginalPrincipal = selectedOffer ? 0 : originalPrincipal;
  const rawOriginalAmortizationYears = selectedOffer ? 0 : originalAmortizationYears;
  const rawOriginalAmortizationMonths = selectedOffer ? 0 : originalAmortizationMonths;
  const rawOriginalTermYears = selectedOffer ? selectedOffer.term : originalTermYears;

  const effPrincipal = rawPrincipal === '' ? 0 : rawPrincipal;
  const effInterestRate = rawInterestRate === '' ? 0 : rawInterestRate;
  const effAmortizationYears = rawAmortizationYears === '' ? 25 : rawAmortizationYears;
  const effAmortizationMonths = rawAmortizationMonths === '' ? 0 : rawAmortizationMonths;
  const effPaymentFrequency = selectedOffer ? ((initialProfile?.rateComparerPaymentFrequency as PaymentFrequency) || paymentFrequency) : paymentFrequency;
  const effMaturityDate = selectedOffer ? '' : maturityDate;
  const effConfirmedPayment = rawConfirmedPayment === '' ? 0 : rawConfirmedPayment;
  const effOriginalPrincipal = rawOriginalPrincipal === '' ? 0 : rawOriginalPrincipal;
  const effOriginalAmortizationYears = rawOriginalAmortizationYears === '' ? 0 : rawOriginalAmortizationYears;
  const effOriginalAmortizationMonths = rawOriginalAmortizationMonths === '' ? 0 : rawOriginalAmortizationMonths;
  const effOriginalTermYears = rawOriginalTermYears === '' ? 0 : rawOriginalTermYears;

  const effVariableType = useMemo(() => {
    if (selectedOffer) {
      return selectedOffer.type === 'variable' ? (selectedOffer.variableType || 'vrm') : undefined;
    }
    return rateType === 'variable' ? variableType : undefined;
  }, [selectedOffer, rateType, variableType]);

  const compoundingToUse = useMemo(() => {
    if (effVariableType) return 'monthly';
    return initialProfile?.compounding || 'semi_annual';
  }, [effVariableType, initialProfile]);

  const calculatedRegularPayment = useMemo(() => {
    const principalForPayment = effOriginalPrincipal && effOriginalPrincipal > 0 ? effOriginalPrincipal : effPrincipal;
    const amortizationForPayment = effOriginalAmortizationYears && effOriginalAmortizationYears > 0 
      ? effOriginalAmortizationYears + (effOriginalAmortizationMonths || 0) / 12 
      : effAmortizationYears + (effAmortizationMonths || 0) / 12;
    return calculateRegularPayment(principalForPayment, effInterestRate, amortizationForPayment, effPaymentFrequency, compoundingToUse);
  }, [effPrincipal, effInterestRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, effOriginalPrincipal, effOriginalAmortizationYears, effOriginalAmortizationMonths, compoundingToUse]);

  const basePaymentForComp = effConfirmedPayment && effConfirmedPayment > 0 ? effConfirmedPayment : calculatedRegularPayment;
  const stressedRate = effInterestRate + interestRateOffset;

  const stressedPayment = useMemo(() => {
    if (interestRateOffset > 0 && effVariableType === 'arm') {
      const amortizationForPayment = effAmortizationYears + (effAmortizationMonths || 0) / 12;
      return calculateRegularPayment(effPrincipal, stressedRate, amortizationForPayment, effPaymentFrequency, compoundingToUse);
    }
    return basePaymentForComp;
  }, [interestRateOffset, effVariableType, effPrincipal, stressedRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, compoundingToUse, basePaymentForComp]);

  const confirmedPaymentToUse = useMemo(() => {
    if (interestRateOffset > 0) {
      return stressedPayment;
    }
    return effConfirmedPayment;
  }, [interestRateOffset, stressedPayment, effConfirmedPayment]);

  const triggerRate = useMemo(() => {
    return calculateTriggerRate(effPrincipal, basePaymentForComp, effPaymentFrequency, compoundingToUse);
  }, [effPrincipal, basePaymentForComp, effPaymentFrequency, compoundingToUse]);

  const isTriggerRateReached = interestRateOffset > 0 && effVariableType === 'vrm' && stressedRate >= triggerRate;

  // Amortization results
  const results = useMemo(() => {
    const inputs: MortgageInputs = {
      principal: effPrincipal,
      interestRate: stressedRate,
      amortizationYears: effAmortizationYears,
      amortizationMonths: effAmortizationMonths,
      paymentFrequency: effPaymentFrequency,
      maturityDate: effMaturityDate,
      confirmedPayment: confirmedPaymentToUse,
      compounding: compoundingToUse,
      rateType,
      variableType,
      originalPrincipal: effOriginalPrincipal,
      originalAmortizationYears: effOriginalAmortizationYears,
      originalAmortizationMonths: effOriginalAmortizationMonths,
      originalTermYears: effOriginalTermYears,
      prepayments: showPrepayments ? {
        lumpSumAmount: lumpSumAmount === '' ? 0 : lumpSumAmount,
        doubleUp,
        doubleUpEvery: doubleUpEvery === '' ? 1 : doubleUpEvery,
        paymentIncreasePercent: paymentIncreasePercent === '' ? 0 : paymentIncreasePercent,
        paymentIncreaseFixed: paymentIncreaseFixed === '' ? 0 : paymentIncreaseFixed
      } : undefined
    };
    return calculateAmortization(inputs);
  }, [effPrincipal, stressedRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, effMaturityDate, confirmedPaymentToUse, compoundingToUse, rateType, variableType, effOriginalPrincipal, effOriginalAmortizationYears, effOriginalAmortizationMonths, effOriginalTermYears, showPrepayments, lumpSumAmount, doubleUp, doubleUpEvery, paymentIncreasePercent, paymentIncreaseFixed]);

  const baselineUnstressedPayment = useMemo(() => {
    const principalForPayment = effOriginalPrincipal && effOriginalPrincipal > 0 ? effOriginalPrincipal : effPrincipal;
    const amortizationForPayment = effOriginalAmortizationYears && effOriginalAmortizationYears > 0 
      ? effOriginalAmortizationYears + (effOriginalAmortizationMonths || 0) / 12 
      : effAmortizationYears + (effAmortizationMonths || 0) / 12;
    const baseFreq = effPaymentFrequency.includes('accelerated')
      ? (effPaymentFrequency === 'accelerated_bi_weekly' ? 'regular_bi_weekly' : 'regular_weekly')
      : effPaymentFrequency;
    return calculateRegularPayment(principalForPayment, effInterestRate, amortizationForPayment, baseFreq, compoundingToUse);
  }, [effPrincipal, effInterestRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, effOriginalPrincipal, effOriginalAmortizationYears, effOriginalAmortizationMonths, compoundingToUse]);

  const baselineConfirmedPaymentToUse = useMemo(() => {
    if (interestRateOffset === 0) {
      if (effConfirmedPayment > 0) {
        if (effPaymentFrequency === 'accelerated_bi_weekly') {
          return effConfirmedPayment * (24 / 26);
        }
        if (effPaymentFrequency === 'accelerated_weekly') {
          return effConfirmedPayment * (48 / 52);
        }
        return effConfirmedPayment;
      }
      return 0;
    }
    if (effVariableType === 'arm') {
      return 0;
    }
    if (effConfirmedPayment > 0) {
      if (effPaymentFrequency === 'accelerated_bi_weekly') {
        return effConfirmedPayment * (24 / 26);
      }
      if (effPaymentFrequency === 'accelerated_weekly') {
        return effConfirmedPayment * (48 / 52);
      }
      return effConfirmedPayment;
    }
    return baselineUnstressedPayment;
  }, [interestRateOffset, effVariableType, effConfirmedPayment, effPaymentFrequency, baselineUnstressedPayment]);

  const baselineResults = useMemo(() => {
    // Standard baseline (always without prepayments, regular frequency)
    const baseFreq = effPaymentFrequency.includes('accelerated')
      ? (effPaymentFrequency === 'accelerated_bi_weekly' ? 'regular_bi_weekly' : 'regular_weekly')
      : effPaymentFrequency;

    return calculateAmortization({
      principal: effPrincipal,
      interestRate: stressedRate,
      amortizationYears: effAmortizationYears,
      amortizationMonths: effAmortizationMonths,
      paymentFrequency: baseFreq,
      confirmedPayment: baselineConfirmedPaymentToUse,
      compounding: compoundingToUse,
      prepayments: undefined
    });
  }, [effPrincipal, stressedRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, baselineConfirmedPaymentToUse, compoundingToUse]);

  const isDirty = useMemo(() => {
    if (!initialProfile) return true;
    const prepay = showPrepayments ? {
      lumpSumAmount,
      doubleUp,
      doubleUpEvery,
      paymentIncreasePercent,
      paymentIncreaseFixed
    } : undefined;

    const initPrepay = initialProfile.prepayments;

    const prepaymentsEqual = (!prepay && !initPrepay) || (
      !!prepay && !!initPrepay &&
      prepay.lumpSumAmount === initPrepay.lumpSumAmount &&
      prepay.doubleUp === initPrepay.doubleUp &&
      (prepay.doubleUpEvery || 1) === (initPrepay.doubleUpEvery || 1) &&
      prepay.paymentIncreasePercent === initPrepay.paymentIncreasePercent &&
      prepay.paymentIncreaseFixed === initPrepay.paymentIncreaseFixed
    );

    return (
      principal !== initialProfile.principal ||
      interestRate !== initialProfile.interestRate ||
      amortizationYears !== initialProfile.amortizationYears ||
      (amortizationMonths || 0) !== (initialProfile.amortizationMonths || 0) ||
      paymentFrequency !== initialProfile.paymentFrequency ||
      (maturityDate || '') !== (initialProfile.maturityDate || '') ||
      (confirmedPayment || 0) !== (initialProfile.confirmedPayment || 0) ||
      (originalPrincipal || 0) !== (initialProfile.originalPrincipal || 0) ||
      (originalAmortizationYears || 0) !== (initialProfile.originalAmortizationYears || 0) ||
      (originalAmortizationMonths || 0) !== (initialProfile.originalAmortizationMonths || 0) ||
      (originalTermYears || 0) !== (initialProfile.originalTermYears || 0) ||
      (householdIncome || 0) !== (initialProfile.householdIncome || 0) ||
      (incomeType || 'gross') !== (initialProfile.incomeType || 'gross') ||
      (rateType || 'fixed') !== (initialProfile.rateType || 'fixed') ||
      (variableType || 'vrm') !== (initialProfile.variableType || 'vrm') ||
      !prepaymentsEqual
    );
  }, [
    principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, maturityDate, confirmedPayment,
    originalPrincipal, originalAmortizationYears, originalAmortizationMonths, originalTermYears,
    householdIncome, incomeType, rateType, variableType,
    showPrepayments, lumpSumAmount, doubleUp, doubleUpEvery, paymentIncreasePercent, paymentIncreaseFixed, initialProfile
  ]);

  // Set to pending when inputs change compared to initialProfile
  useEffect(() => {
    if (isDirty && saveStatus === 'saved') {
      setSaveStatus('pending');
    }
  }, [isDirty, saveStatus]);

  // Debounced autosave
  useEffect(() => {
    if (!isDirty) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('pending');
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      
      onSaveProfile({
        ...(initialProfile || {}),
        principal,
        interestRate,
        amortizationYears,
        amortizationMonths,
        paymentFrequency,
        maturityDate,
        confirmedPayment,
        originalPrincipal,
        originalAmortizationYears,
        originalAmortizationMonths,
        originalTermYears,
        householdIncome,
        incomeType,
        rateType,
        variableType,
        prepayments: showPrepayments ? {
          lumpSumAmount,
          doubleUp,
          doubleUpEvery,
          paymentIncreasePercent,
          paymentIncreaseFixed
        } : undefined
      } as any);

      const successTimer = setTimeout(() => {
        setSaveStatus('saved');
      }, 400);
      return () => clearTimeout(successTimer);
    }, 800);

    return () => clearTimeout(timer);
  }, [
    isDirty,
    principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, maturityDate, confirmedPayment,
    originalPrincipal, originalAmortizationYears, originalAmortizationMonths, originalTermYears,
    householdIncome, incomeType, rateType, variableType,
    showPrepayments, lumpSumAmount, doubleUp, doubleUpEvery, paymentIncreasePercent, paymentIncreaseFixed,
    onSaveProfile, initialProfile
  ]);

  // Line Chart Data
  const chartData = useMemo(() => {
    // Generate data points for chart (e.g. plot ending balance at the end of each year)
    const labels: string[] = [t.paydown.year0];
    const baselineDataPoints: number[] = [effPrincipal];
    const prepaymentDataPoints: number[] = [effPrincipal];

    const maxYears = effAmortizationYears;
    
    // Find baseline balances at the end of each year
    const baselinePpy = baselineResults.schedule.length / baselineResults.yearsToPayoff;
    for (let y = 1; y <= maxYears; y++) {
      labels.push(t.paydown.yearN.replace('{n}', String(y)));
      
      // Baseline
      const baseIdx = Math.min(Math.round(y * baselinePpy) - 1, baselineResults.schedule.length - 1);
      baselineDataPoints.push(baseIdx >= 0 ? baselineResults.schedule[baseIdx].endingBalance : 0);
      
      // Prepayment
      const prepPpy = results.schedule.length / results.yearsToPayoff;
      const prepIdx = Math.min(Math.round(y * prepPpy) - 1, results.schedule.length - 1);
      prepaymentDataPoints.push(prepIdx >= 0 ? results.schedule[prepIdx].endingBalance : 0);
    }

    return {
      labels,
      datasets: [
        {
          label: t.paydown.baseline,
          data: baselineDataPoints,
          borderColor: 'rgba(148, 163, 184, 0.6)',
          backgroundColor: 'rgba(148, 163, 184, 0.1)',
          borderDash: [5, 5],
          tension: 0.2,
          fill: false,
        },
        {
          label: t.paydown.withPrepayments,
          data: prepaymentDataPoints,
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.2,
          fill: true,
        }
      ]
    };
  }, [effPrincipal, effAmortizationYears, results, baselineResults, t]);

  const textColor = systemTheme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = systemTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const legendColor = systemTheme === 'dark' ? '#e2e8f0' : '#1e293b';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: legendColor,
          font: { family: 'Inter', size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => cadCurrencyTooltipLabel(context, locale)
        }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
      y: {
        grid: { color: gridColor },
        ticks: { 
          color: textColor,
          callback: function(value: any) {
            return locale === 'fr' ? `${value / 1000}k $` : `$${value / 1000}k`;
          }
        }
      }
    }
  };

  const cleanLump = lumpSumAmount === '' ? 0 : lumpSumAmount;
  const cleanPct = paymentIncreasePercent === '' ? 0 : paymentIncreasePercent;
  const cleanFixed = paymentIncreaseFixed === '' ? 0 : paymentIncreaseFixed;
  const cleanDoubleUpEvery = doubleUpEvery === '' ? 1 : doubleUpEvery;

  const hasPrepaymentsActive = showPrepayments && (cleanLump > 0 || doubleUp || cleanPct > 0 || cleanFixed > 0 || effPaymentFrequency.includes('accelerated'));

  // Payments per year for the current frequency — drives the double-up interval slider.
  const ppy = getPaymentsPerYear(effPaymentFrequency);

  // Double-up interval slider bounds (in payments): 1 = every payment (most frequent),
  // ppy × term = once per term (least frequent, the "no less than 1/term" floor).
  // Term falls back to the full amortization when the original term isn't tracked.
  const doubleUpTermYears = effOriginalTermYears > 0 ? effOriginalTermYears : effAmortizationYears;
  const maxDoubleUpInterval = Math.max(1, Math.round(ppy * doubleUpTermYears));

  // Keep the double-up interval within [1, once-per-term] as frequency/term change.
  useEffect(() => {
    setDoubleUpEvery((prev) => Math.min(maxDoubleUpInterval, Math.max(1, prev === '' ? 1 : prev)));
  }, [maxDoubleUpInterval]);

  // Human-friendly description of how often the double-up applies
  const doubleUpFrequencyLabel = useMemo(() => {
    if (cleanDoubleUpEvery >= maxDoubleUpInterval) return t.paydown.doubleUpOncePerTerm;
    if (cleanDoubleUpEvery <= 1) return t.paydown.everyPayment;
    return t.paydown.everyNPayments.replace('{n}', String(cleanDoubleUpEvery));
  }, [cleanDoubleUpEvery, maxDoubleUpInterval, t]);

  const doubleUpTimesPerYear = useMemo(() => {
    const times = ppy / Math.max(1, cleanDoubleUpEvery);
    return times >= 1 ? Math.round(times) : Math.round(times * 10) / 10;
  }, [ppy, cleanDoubleUpEvery]);

  // Reset all extra-payment inputs back to their defaults
  const clearExtraPayments = () => {
    setLumpSumAmount(0);
    setDoubleUp(false);
    setDoubleUpEvery(ppy);
    setPaymentIncreasePercent(0);
    setPaymentIncreaseFixed(0);
  };


  const cleanOriginalPrincipal = originalPrincipal === '' ? 0 : originalPrincipal;
  const cleanOriginalAmortYears = originalAmortizationYears === '' ? 0 : originalAmortizationYears;
  const cleanOriginalAmortMonths = originalAmortizationMonths === '' ? 0 : originalAmortizationMonths;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t.paydown.title}</h2>
        <p style={{ fontSize: '0.95rem' }}>{t.paydown.subtitle}</p>
      </div>

      <div className="grid-main">
        {/* Inputs panel */}
        <div className={`card flex flex-col gap-4 card-${saveStatus}`}>
          {/* Scenario Selector */}
          <div className="form-group" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>{t.paydown.selectScenario}</label>
            <div className="flex gap-2">
              <select
                className="form-select"
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                style={{ flexGrow: 1 }}
              >
                <option value="current">{t.paydown.currentMortgageOption}</option>
                {offers.map(offer => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name} ({formatLocalePercent(offer.rate, locale)} - {offer.term} Yr {offer.type === 'fixed' ? t.rate.fixed : (offer.variableType === 'arm' ? t.rate.variableArm : t.rate.variableVrm)})
                  </option>
                ))}
              </select>
              {selectedScenario !== 'current' && onNavigate && (
                <button
                  key="edit-offer-btn"
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigate('rate')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
                >
                  {t.paydown.editOfferBtn}
                </button>
              )}
            </div>
            {selectedScenario !== 'current' && (
              <div className="alert alert-info" style={{ marginTop: '0.75rem', padding: '0.75rem', gap: '0.5rem', marginBottom: 0 }}>
                <Sparkles size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {t.paydown.linkedOfferNotice.replace('{name}', offers.find(o => o.id === selectedScenario)?.name || '')}
                </span>
              </div>
            )}
          </div>

          <h3 style={{ 
            borderBottom: '1px solid var(--border-color)', 
            paddingBottom: '0.5rem', 
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{t.paydown.mortgageParams}</span>
            <SaveStatusBadge status={saveStatus} labels={saveStatusLabels} />
          </h3>
          
          {/* Group 1: Current Term & Balance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
              {t.paydown.balancePayments}
            </h4>

            {/* Remaining Principal */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.remainingBalance}</span>
                <span className="form-label-val">{formatLocaleCurrency(effPrincipal, locale)}</span>
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <FormattedNumericInput 
                  className="form-input form-input-with-prefix" 
                  value={selectedOffer ? effPrincipal : principal} 
                  onChange={(val) => setPrincipal(val)}
                  disabled={!!selectedOffer}
                />
              </div>
            </div>

            {/* Interest Rate Type */}
            <div className="form-group">
              <label className="form-label">{t.paydown.rateType || 'Interest Rate Type'}</label>
              <select
                className="form-select"
                value={
                  selectedOffer
                    ? selectedOffer.type === 'variable'
                      ? selectedOffer.variableType === 'arm'
                        ? 'variable_arm'
                        : 'variable_vrm'
                      : 'fixed'
                    : rateType === 'variable'
                    ? variableType === 'arm'
                      ? 'variable_arm'
                      : 'variable_vrm'
                    : 'fixed'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'fixed') {
                    setRateType('fixed');
                  } else if (val === 'variable_vrm') {
                    setRateType('variable');
                    setVariableType('vrm');
                  } else if (val === 'variable_arm') {
                    setRateType('variable');
                    setVariableType('arm');
                  }
                }}
                disabled={!!selectedOffer}
              >
                <option value="fixed">{t.paydown.fixedRate || 'Fixed Rate'}</option>
                <option value="variable_vrm">{t.paydown.variableVrm || 'Variable Rate'}</option>
                <option value="variable_arm">{t.paydown.variableArm || 'Adjustable Rate'}</option>
              </select>
            </div>

            {/* Interest Rate */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.annualRate}</span>
                <span className="form-label-val">{formatLocalePercent(effInterestRate, locale)}</span>
              </label>
              <div className="form-input-wrapper">
                <Percent size={16} className="form-input-suffix" />
                <FormattedNumericInput 
                  className="form-input form-input-with-suffix" 
                  value={selectedOffer ? effInterestRate : interestRate} 
                  onChange={(val) => setInterestRate(val)}
                  disabled={!!selectedOffer}
                  isDecimal={true}
                />
              </div>
            </div>

            {/* Remaining Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.remainingAmort}</span>
                <span className="form-label-val">{effAmortizationYears} {t.paydown.yrs}, {effAmortizationMonths} {t.paydown.mos}</span>
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <FormattedNumericInput 
                    className="form-input" 
                    value={selectedOffer ? effAmortizationYears : amortizationYears} 
                    onChange={(val) => setAmortizationYears(val)}
                    placeholder={t.paydown.years}
                    style={{ paddingRight: '2rem' }}
                    disabled={!!selectedOffer}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.yrs}</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <FormattedNumericInput 
                    className="form-input" 
                    value={selectedOffer ? effAmortizationMonths : amortizationMonths} 
                    onChange={(val) => setAmortizationMonths(val)}
                    placeholder={t.paydown.months}
                    style={{ paddingRight: '2.2rem' }}
                    disabled={!!selectedOffer}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.mos}</span>
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div className="form-group">
              <label className="form-label">{t.paydown.paymentFrequency}</label>
              <select 
                className="form-select" 
                value={effPaymentFrequency} 
                onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                disabled={!!selectedOffer}
              >
                <option value="monthly">{t.paydown.monthly}</option>
                <option value="semi_monthly">{t.paydown.semiMonthly}</option>
                <option value="regular_bi_weekly">{t.paydown.biWeekly}</option>
                <option value="accelerated_bi_weekly">{t.paydown.accBiWeekly}</option>
                <option value="regular_weekly">{t.paydown.weekly}</option>
                <option value="accelerated_weekly">{t.paydown.accWeekly}</option>
              </select>
            </div>

            {/* Confirmed Payment */}
            <div className="form-group">
              <label className="form-label flex justify-between align-center">
                <span>{t.paydown.paymentOverride}</span>
                <span className="form-label-val" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {t.paydown.calculated} {formatLocaleCurrency(calculatedRegularPayment, locale)}
                </span>
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <FormattedNumericInput 
                  className="form-input form-input-with-prefix" 
                  placeholder={formatLocaleNumber(calculatedRegularPayment, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  value={selectedOffer ? '' : (confirmedPayment || '')} 
                  onChange={(val) => setConfirmedPayment(val)}
                  disabled={!!selectedOffer}
                  isDecimal={true}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                {t.paydown.paymentOverrideHint}
              </span>
            </div>

            {/* Household Income (with gross/net toggle) — persisted globally, used by the Rates Comparer */}
            <div className="form-group">
              <label className="form-label flex justify-between align-center">
                <span>{t.paydown.householdIncome}</span>
                <div style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '0.375rem', overflow: 'hidden' }}>
                  {(['gross', 'net'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setIncomeType(type)}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: incomeType === type ? 'var(--color-primary)' : 'transparent',
                        color: incomeType === type ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {type === 'gross' ? t.paydown.incomeGross : t.paydown.incomeNet}
                    </button>
                  ))}
                </div>
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <FormattedNumericInput
                  className="form-input form-input-with-prefix"
                  value={householdIncome || ''}
                  onChange={(val) => setHouseholdIncome(val)}
                />
              </div>
            </div>
          </div>

          {/* Group 2: Current Term Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              {t.paydown.termTimeline}
            </h4>

            {/* Maturity Date */}
            <div className="form-group">
              <label className="form-label">{t.paydown.termMaturity}</label>
              <input 
                type="date" 
                className="form-input" 
                value={effMaturityDate} 
                onChange={(e) => setMaturityDate(e.target.value)} 
                style={{ colorScheme: 'dark' }}
                disabled={!!selectedOffer}
              />
            </div>
          </div>

          {/* Group 3: Original Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              {t.paydown.originalParams}
            </h4>

            {/* Original Principal */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.originalAmount}</span>
                {!selectedOffer && cleanOriginalPrincipal > 0 && <span className="form-label-val">{formatLocaleCurrency(cleanOriginalPrincipal, locale)}</span>}
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <FormattedNumericInput 
                  className="form-input form-input-with-prefix" 
                  placeholder={t.paydown.originalAmountPlaceholder}
                  value={selectedOffer ? '' : (originalPrincipal || '')} 
                  onChange={(val) => setOriginalPrincipal(val)}
                  disabled={!!selectedOffer}
                />
              </div>
            </div>

            {/* Original Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.originalAmort}</span>
                {!selectedOffer && (cleanOriginalAmortYears > 0 || cleanOriginalAmortMonths > 0) && (
                  <span className="form-label-val">{cleanOriginalAmortYears} {t.paydown.yrs}, {cleanOriginalAmortMonths} {t.paydown.mos}</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <FormattedNumericInput 
                    className="form-input" 
                    placeholder={t.paydown.years}
                    value={selectedOffer ? '' : (originalAmortizationYears || '')} 
                    onChange={(val) => setOriginalAmortizationYears(val)}
                    style={{ paddingRight: '2rem' }}
                    disabled={!!selectedOffer}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.yrs}</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <FormattedNumericInput 
                    className="form-input" 
                    placeholder={t.paydown.months}
                    value={selectedOffer ? '' : (originalAmortizationMonths || '')} 
                    onChange={(val) => setOriginalAmortizationMonths(val)}
                    style={{ paddingRight: '2.2rem' }}
                    disabled={!!selectedOffer}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.mos}</span>
                </div>
              </div>
            </div>

            {/* Original Term */}
            <div className="form-group">
              <label className="form-label">{t.paydown.originalTerm}</label>
              <select 
                className="form-select" 
                value={selectedOffer ? 0 : originalTermYears} 
                onChange={(e) => setOriginalTermYears(parseInt(e.target.value) || 0)}
                disabled={!!selectedOffer}
              >
                <option value="0">{t.paydown.notTracked}</option>
                <option value="1">{t.paydown.year1}</option>
                <option value="2">{t.paydown.years2}</option>
                <option value="3">{t.paydown.years3}</option>
                <option value="4">{t.paydown.years4}</option>
                <option value="5">{t.paydown.years5}</option>
                <option value="7">{t.paydown.years7}</option>
                <option value="10">{t.paydown.years10}</option>
              </select>
            </div>
          </div>


        </div>

        {/* Charts & Outcomes Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Combined Outcome Zone: baseline vs. active plan */}
          <div className="card">
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              {t.paydown.totalInterestZone}
            </h4>
            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>

              {/* Baseline column */}
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t.paydown.baselineOutcome}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  {formatLocaleCurrency(baselineResults.totalInterestPaid, locale)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isTriggerRateReached ? (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{t.rate?.neverPayoff || 'Never Payoff'}</span>
                  ) : (
                    t.paydown.overYears.replace('{years}', formatLocaleNumber(baselineResults.yearsToPayoff, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  {t.paydown.regPayment} <strong>{formatLocaleCurrency(baselineResults.schedule[0]?.payment, locale)}</strong>
                </div>
              </div>

              {/* Active Plan column */}
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t.paydown.activePlanOutcome}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                  {formatLocaleCurrency(results.totalInterestPaid, locale)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isTriggerRateReached ? (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{t.rate?.neverPayoff || 'Never Payoff'}</span>
                  ) : (
                    t.paydown.overYears.replace('{years}', formatLocaleNumber(results.yearsToPayoff, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  {t.paydown.planPayment} <strong>{formatLocaleCurrency(results.schedule[0]?.payment, locale)}</strong>
                </div>
              </div>

            </div>
          </div>

          {/* Optimization Callout */}
          {hasPrepaymentsActive && (
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              <Sparkles size={20} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{t.paydown.optimizationSuccess}</strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {t.paydown.shaveOff
                    .replace('{years}', formatLocaleNumber(results.yearsSaved, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
                    .replace('{amount}', formatLocaleCurrency(results.interestSaved, locale))}
                </span>
              </div>
            </div>
          )}

          {/* Graph Card */}
          <div className="card" style={{ height: '480px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.paydown.balanceProjection}</h3>
            <div style={{ flexGrow: 1, position: 'relative', height: '360px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Variable Rate Stress Test Card — only shown for non-fixed rates */}
          {!!effVariableType && (
          <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} />
              <span>{t.paydown.stressTest}</span>
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
              {t.paydown.stressTestDesc}
            </p>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>{t.paydown.stressTestSlider}</span>
                <span className="form-label-val" style={{ fontWeight: 'bold', color: 'var(--color-warning)', fontSize: '0.9rem' }}>
                  +{formatLocalePercent(interestRateOffset, locale)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                className="w-full"
                value={interestRateOffset}
                onChange={(e) => setInterestRateOffset(parseFloat(e.target.value))}
                style={{ cursor: 'pointer', accentColor: 'var(--color-warning)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                <span>+{formatLocalePercent(0.00, locale)}</span>
                <span>+{formatLocalePercent(1.50, locale)}</span>
                <span>+{formatLocalePercent(3.00, locale)}</span>
              </div>
            </div>

            {/* Stressed Rate details */}
            {interestRateOffset > 0 && (
              <div style={{ background: 'var(--bg-badge)', borderRadius: '0.35rem', padding: '0.6rem 0.75rem', marginTop: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Stressed Interest Rate:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatLocalePercent(stressedRate, locale)}</strong>
                </div>
                {effVariableType === 'vrm' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Trigger Rate:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatLocalePercent(triggerRate, locale)}</strong>
                  </div>
                )}
                {effVariableType === 'arm' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stressed Payment:</span>
                    <strong style={{ color: 'var(--color-primary)' }}>
                      {formatLocaleCurrency(stressedPayment, locale)}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Trigger Rate Warning Banner (VRM) */}
            {isTriggerRateReached && effVariableType === 'vrm' && (
              <div className="alert alert-warning" style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', border: '1px solid var(--color-warning)', borderRadius: '0.375rem', backgroundColor: 'rgba(217, 119, 6, 0.1)' }}>
                <ShieldAlert size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-warning)', marginBottom: '0.1rem' }}>
                    {t.paydown.triggerRateWarning}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                    {t.paydown.triggerRateWarningDesc
                      .replace('{offset}', formatLocaleNumber(interestRateOffset, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                      .replace('{rate}', formatLocaleNumber(stressedRate, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                      .replace('{triggerRate}', formatLocaleNumber(triggerRate, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Adjustment Banner (ARM) */}
            {interestRateOffset > 0 && effVariableType === 'arm' && (
              <div className="alert alert-info" style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', border: '1px solid var(--color-info || #0284c7)', borderRadius: '0.375rem', backgroundColor: 'rgba(2, 132, 199, 0.1)' }}>
                <ShieldAlert size={18} style={{ color: 'var(--color-info || #0284c7)', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-info || #0284c7)', marginBottom: '0.1rem' }}>
                    Payment Recalculated
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                    {t.paydown.armPaymentIncrease
                      .replace('{payment}', formatLocaleCurrency(stressedPayment, locale))
                      .replace('{diff}', formatLocaleCurrency(stressedPayment - basePaymentForComp, locale))}
                  </span>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Simulate Extra Payments (extracted section, directly below the graph) */}
          <div className={`card card-${saveStatus}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: showPrepayments ? '1rem' : '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
                {t.paydown.simulateExtra}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearExtraPayments}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', gap: '0.35rem' }}
                  title={t.paydown.clearExtra}
                >
                  <Eraser size={14} />
                  {t.paydown.clearExtra}
                </button>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showPrepayments}
                    onChange={(e) => setShowPrepayments(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {!showPrepayments && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {t.paydown.extraDisabledHint}
              </p>
            )}

            {showPrepayments && (
              <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>

                {/* Anniversary Lump Sum */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>{t.paydown.lumpSum}</span>
                    <span className="form-label-val">{formatLocaleCurrency(lumpSumAmount || 0, locale)}</span>
                  </label>
                  <div className="form-input-wrapper">
                    <DollarSign size={14} className="form-input-prefix" />
                    <FormattedNumericInput
                      className="form-input form-input-with-prefix"
                      value={lumpSumAmount}
                      onChange={(val) => setLumpSumAmount(val)}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                    {t.paydown.lumpSumHint}
                  </span>
                </div>

                {/* Double-Up + interval */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div className="settings-item" style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="settings-item-info">
                      <div className="settings-item-title" style={{ fontSize: '0.9rem' }}>{t.paydown.doubleUp}</div>
                      <div className="settings-item-desc" style={{ fontSize: '0.75rem' }}>{t.paydown.doubleUpDesc}</div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={doubleUp}
                        onChange={(e) => setDoubleUp(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  {doubleUp && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label className="form-label">
                        <span>{t.paydown.doubleUpFrequency}</span>
                        <span className="form-label-val">{doubleUpFrequencyLabel}</span>
                      </label>
                      {/* Interval between double-ups, in payments: 1 = every payment (most frequent),
                          ppy × term = once per term (least frequent). */}
                      <input
                        type="range"
                        className="slider-input"
                        min={1}
                        max={maxDoubleUpInterval}
                        step={1}
                        value={doubleUpEvery}
                        onChange={(e) => setDoubleUpEvery(Math.min(maxDoubleUpInterval, Math.max(1, parseInt(e.target.value) || 1)))}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                        {t.paydown.doubleUpTimesPerYear.replace('{n}', String(doubleUpTimesPerYear))}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', lineHeight: 1.4 }}>
                        {t.paydown.doubleUpDistribution}
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment Increase Percent */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>{t.paydown.annualIncreasePercent}</span>
                    <span className="form-label-val">{formatLocalePercent(paymentIncreasePercent || 0, locale)}</span>
                  </label>
                  <div className="form-input-wrapper">
                    <Percent size={14} className="form-input-suffix" />
                    <FormattedNumericInput
                      className="form-input form-input-with-suffix"
                      value={paymentIncreasePercent}
                      onChange={(val) => setPaymentIncreasePercent(val)}
                      isDecimal={true}
                    />
                  </div>
                </div>

                {/* Payment Increase Fixed */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>{t.paydown.annualIncreaseDollar}</span>
                    <span className="form-label-val">{formatLocaleCurrency(paymentIncreaseFixed || 0, locale)}</span>
                  </label>
                  <div className="form-input-wrapper">
                    <DollarSign size={14} className="form-input-prefix" />
                    <FormattedNumericInput
                      className="form-input form-input-with-prefix"
                      value={paymentIncreaseFixed}
                      onChange={(val) => setPaymentIncreaseFixed(val)}
                    />
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>

      {/* Amortization Schedule Table */}
      <div className="card mt-4">
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          {t.paydown.yearlyBreakdowns}
        </h3>
        <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t.paydown.yearCol}</th>
                <th className="text-right">{t.paydown.regularPayments}</th>
                <th className="text-right">{t.paydown.extraPrepayments}</th>
                <th className="text-right">{t.paydown.interestPaid}</th>
                <th className="text-right">{t.paydown.principalPaid}</th>
                <th className="text-right">{t.paydown.endingBalance}</th>
              </tr>
            </thead>
            <tbody>
              {/* Aggregate schedule by year */}
              {(() => {
                const ppy = getPaymentsPerYear(effPaymentFrequency);
                const yearlyRows = [];
                let yearInterest = 0;
                let yearRegularPrincipal = 0;
                let yearExtra = 0;
                let yearPayments = 0;
                
                for (let i = 0; i < results.schedule.length; i++) {
                  const p = results.schedule[i];
                  yearInterest += p.interest;
                  yearRegularPrincipal += p.principal;
                  yearExtra += p.lumpSum + p.doubleUpAmount;
                  yearPayments += p.payment;
                  
                  // If end of year or final period
                  if ((i + 1) % ppy === 0 || i === results.schedule.length - 1) {
                    const yearNum = Math.floor(i / ppy) + 1;
                    yearlyRows.push(
                      <tr key={yearNum}>
                        <td>{t.paydown.yearCol} {yearNum}</td>
                        <td className="text-right">{formatLocaleCurrency(yearPayments, locale)}</td>
                        <td className="text-right" style={{ color: yearExtra > 0 ? 'var(--color-accent)' : 'inherit' }}>
                          {yearExtra > 0 ? `+${formatLocaleCurrency(yearExtra, locale)}` : formatLocaleCurrency(0, locale)}
                        </td>
                        <td className="text-right" style={{ color: 'var(--color-danger)' }}>
                          {formatLocaleCurrency(yearInterest, locale)}
                        </td>
                        <td className="text-right" style={{ color: 'var(--color-success)' }}>
                          {formatLocaleCurrency(yearRegularPrincipal + yearExtra, locale)}
                        </td>
                        <td className="text-right" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                          {formatLocaleCurrency(p.endingBalance, locale)}
                        </td>
                      </tr>
                    );
                    // Reset year accumulators
                    yearInterest = 0;
                    yearRegularPrincipal = 0;
                    yearExtra = 0;
                    yearPayments = 0;
                  }
                }
                
                return yearlyRows;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
