import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Eraser, Percent, Sparkles, ShieldAlert, Calendar } from 'lucide-react';
import { calculateAmortization, getPaymentsPerYear, calculateRegularPayment, calculateTriggerRate } from '../utils/mortgageMath';
import type { MortgageInputs, PaymentFrequency } from '../utils/mortgageMath';
import { useI18n } from '../utils/i18n';
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

function useSystemTheme() {
  const [isDark, setIsDark] = useState(() => 
    !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isDark ? 'dark' : 'light';
}

interface PaydownSimulatorProps {
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

export const PaydownSimulator: React.FC<PaydownSimulatorProps> = ({ initialProfile, onSaveProfile, onNavigate }) => {
  const { t } = useI18n();
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
  const [principal, setPrincipal] = useState<number>(initialProfile?.principal || 450000);
  const [interestRate, setInterestRate] = useState<number>(initialProfile?.interestRate || 4.85);
  const [amortizationYears, setAmortizationYears] = useState<number>(initialProfile?.amortizationYears || 25);
  const [amortizationMonths, setAmortizationMonths] = useState<number>(initialProfile?.amortizationMonths || 0);
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(initialProfile?.paymentFrequency || 'monthly');
  const [maturityDate, setMaturityDate] = useState<string>(initialProfile?.maturityDate || '');
  
  // Custom Payment Override
  const [confirmedPayment, setConfirmedPayment] = useState<number>(initialProfile?.confirmedPayment || 0);

  // Rate Type and Variable Type
  const [rateType, setRateType] = useState<'fixed' | 'variable'>(initialProfile?.rateType || 'fixed');
  const [variableType, setVariableType] = useState<'vrm' | 'arm'>(initialProfile?.variableType || 'vrm');

  // Original Parameters
  const [originalPrincipal, setOriginalPrincipal] = useState<number>(initialProfile?.originalPrincipal || 0);
  const [originalAmortizationYears, setOriginalAmortizationYears] = useState<number>(initialProfile?.originalAmortizationYears || 0);
  const [originalAmortizationMonths, setOriginalAmortizationMonths] = useState<number>(initialProfile?.originalAmortizationMonths || 0);
  const [originalTermYears, setOriginalTermYears] = useState<number>(initialProfile?.originalTermYears || 0);

  // Household affordability (persisted globally; not used by the amortization math)
  const [householdIncome, setHouseholdIncome] = useState<number>(initialProfile?.householdIncome || 0);
  const [incomeType, setIncomeType] = useState<'gross' | 'net'>(initialProfile?.incomeType || 'gross');

  // Prepayments
  const [showPrepayments, setShowPrepayments] = useState<boolean>(
    !!(initialProfile?.prepayments && 
    (initialProfile.prepayments.lumpSumAmount > 0 || 
     initialProfile.prepayments.doubleUp || 
     initialProfile.prepayments.paymentIncreasePercent > 0 || 
     initialProfile.prepayments.paymentIncreaseFixed > 0))
  );
  
  const [lumpSumAmount, setLumpSumAmount] = useState<number>(initialProfile?.prepayments?.lumpSumAmount || 0);
  const [doubleUp, setDoubleUp] = useState<boolean>(initialProfile?.prepayments?.doubleUp || false);
  // Interval between double-ups, in payments. Defaults to once per year (ppy) for a fresh profile.
  const [doubleUpEvery, setDoubleUpEvery] = useState<number>(
    initialProfile?.prepayments?.doubleUpEvery || getPaymentsPerYear(initialProfile?.paymentFrequency || 'monthly')
  );
  const [paymentIncreasePercent, setPaymentIncreasePercent] = useState<number>(initialProfile?.prepayments?.paymentIncreasePercent || 0);
  const [paymentIncreaseFixed, setPaymentIncreaseFixed] = useState<number>(initialProfile?.prepayments?.paymentIncreaseFixed || 0);

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
  const effPrincipal = selectedOffer ? (initialProfile?.renewalBalance || principal) : principal;
  const effInterestRate = selectedOffer ? selectedOffer.rate : interestRate;
  const effAmortizationYears = selectedOffer ? (initialProfile?.renewalAmortizationYears || amortizationYears) : amortizationYears;
  const effAmortizationMonths = selectedOffer ? (initialProfile?.renewalAmortizationMonths !== undefined ? initialProfile.renewalAmortizationMonths : amortizationMonths) : amortizationMonths;
  const effPaymentFrequency = selectedOffer ? ((initialProfile?.rateComparerPaymentFrequency as PaymentFrequency) || paymentFrequency) : paymentFrequency;
  
  // Under offer renewal scenario, we don't have a direct maturity date (term starts at renewal time)
  const effMaturityDate = selectedOffer ? '' : maturityDate;
  const effConfirmedPayment = selectedOffer ? 0 : confirmedPayment;

  const effOriginalPrincipal = selectedOffer ? 0 : originalPrincipal;
  const effOriginalAmortizationYears = selectedOffer ? 0 : originalAmortizationYears;
  const effOriginalAmortizationMonths = selectedOffer ? 0 : originalAmortizationMonths;
  const effOriginalTermYears = selectedOffer ? selectedOffer.term : originalTermYears;

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
        lumpSumAmount,
        doubleUp,
        doubleUpEvery,
        paymentIncreasePercent,
        paymentIncreaseFixed
      } : undefined
    };
    return calculateAmortization(inputs);
  }, [effPrincipal, stressedRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, effMaturityDate, confirmedPaymentToUse, compoundingToUse, rateType, variableType, effOriginalPrincipal, effOriginalAmortizationYears, effOriginalAmortizationMonths, effOriginalTermYears, showPrepayments, lumpSumAmount, doubleUp, doubleUpEvery, paymentIncreasePercent, paymentIncreaseFixed]);

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
      confirmedPayment: confirmedPaymentToUse,
      compounding: compoundingToUse,
      prepayments: undefined
    });
  }, [effPrincipal, stressedRate, effAmortizationYears, effAmortizationMonths, effPaymentFrequency, confirmedPaymentToUse, compoundingToUse]);

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
      });

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
    onSaveProfile
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
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(context.parsed.y);
            }
            return label;
          }
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
            return '$' + (value / 1000) + 'k';
          }
        }
      }
    }
  };

  const hasPrepaymentsActive = showPrepayments && (lumpSumAmount > 0 || doubleUp || paymentIncreasePercent > 0 || paymentIncreaseFixed > 0 || effPaymentFrequency.includes('accelerated'));

  // Payments per year for the current frequency — drives the double-up interval slider.
  const ppy = getPaymentsPerYear(effPaymentFrequency);

  // Double-up interval slider bounds (in payments): 1 = every payment (most frequent),
  // ppy × term = once per term (least frequent, the "no less than 1/term" floor).
  // Term falls back to the full amortization when the original term isn't tracked.
  const doubleUpTermYears = effOriginalTermYears > 0 ? effOriginalTermYears : effAmortizationYears;
  const maxDoubleUpInterval = Math.max(1, Math.round(ppy * doubleUpTermYears));

  // Keep the double-up interval within [1, once-per-term] as frequency/term change.
  useEffect(() => {
    setDoubleUpEvery((prev) => Math.min(maxDoubleUpInterval, Math.max(1, prev)));
  }, [maxDoubleUpInterval]);

  // Human-friendly description of how often the double-up applies
  const doubleUpFrequencyLabel = useMemo(() => {
    if (doubleUpEvery >= maxDoubleUpInterval) return t.paydown.doubleUpOncePerTerm;
    if (doubleUpEvery <= 1) return t.paydown.everyPayment;
    return t.paydown.everyNPayments.replace('{n}', String(doubleUpEvery));
  }, [doubleUpEvery, maxDoubleUpInterval, t]);

  const doubleUpTimesPerYear = useMemo(() => {
    const times = ppy / Math.max(1, doubleUpEvery);
    return times >= 1 ? Math.round(times) : Math.round(times * 10) / 10;
  }, [ppy, doubleUpEvery]);

  // Reset all extra-payment inputs back to their defaults
  const clearExtraPayments = () => {
    setLumpSumAmount(0);
    setDoubleUp(false);
    setDoubleUpEvery(ppy);
    setPaymentIncreasePercent(0);
    setPaymentIncreaseFixed(0);
  };

  const downloadICSFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAnniversaryCalendar = () => {
    const events: string[] = [];
    const today = new Date();
    
    // Create 5 annual events for the term
    for (let year = 1; year <= 5; year++) {
      const eventDate = new Date(today.getFullYear() + year, today.getMonth(), today.getDate());
      const dateStr = eventDate.toISOString().split('T')[0].replace(/-/g, '');
      
      events.push([
        'BEGIN:VEVENT',
        `UID:prepayment-anniversary-${year}-${Date.now()}@mortimer`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `SUMMARY:Mortimer Mortgage Prepayment Anniversary`,
        `DESCRIPTION:Annual prepayment window. Maximize lump-sum contributions to reduce amortization.`,
        'END:VEVENT'
      ].join('\r\n'));
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mortimer//Mortgage Simulator//EN',
      events.join('\r\n'),
      'END:VCALENDAR'
    ].join('\r\n');

    downloadICSFile(icsContent, 'mortgage_prepayment_anniversaries.ics');
  };

  const handleExportPaymentCalendar = () => {
    const events: string[] = [];
    const today = new Date();
    
    const isVar = selectedOffer ? selectedOffer.type === 'variable' : (interestRateOffset > 0);
    const paymentTypeLabel = isVar ? t.paydown.approximateValueLabel : t.paydown.fixedValueLabel;
    const paymentAmt = results.schedule[0]?.payment || calculatedRegularPayment;
    const paymentAmtStr = paymentAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let currentDate = new Date(today);
    
    // Generate events for the next 1 year
    for (let step = 1; step <= ppy; step++) {
      if (effPaymentFrequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (effPaymentFrequency === 'semi_monthly') {
        currentDate.setDate(currentDate.getDate() + 15);
      } else if (effPaymentFrequency.includes('bi_weekly')) {
        currentDate.setDate(currentDate.getDate() + 14);
      } else if (effPaymentFrequency.includes('weekly')) {
        currentDate.setDate(currentDate.getDate() + 7);
      }
      
      const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
      
      events.push([
        'BEGIN:VEVENT',
        `UID:payment-reminder-${step}-${Date.now()}@mortimer`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `SUMMARY:Mortgage Payment Due: $${paymentAmtStr}`,
        `DESCRIPTION:Mortgage Payment reminder: $${paymentAmtStr} ${paymentTypeLabel}.`,
        'END:VEVENT'
      ].join('\r\n'));
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mortimer//Mortgage Simulator//EN',
      events.join('\r\n'),
      'END:VCALENDAR'
    ].join('\r\n');

    downloadICSFile(icsContent, 'mortgage_payment_schedule.ics');
  };

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
                    {offer.name} ({offer.rate.toFixed(2)}% - {offer.term} Yr {offer.type === 'fixed' ? t.rate.fixed : t.rate.variable})
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
                <span className="form-label-val">${effPrincipal.toLocaleString()}</span>
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <input 
                  type="number" 
                  className="form-input form-input-with-prefix" 
                  value={selectedOffer ? effPrincipal : principal} 
                  onChange={(e) => setPrincipal(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={!!selectedOffer}
                />
              </div>
            </div>

            {/* Interest Rate Type */}
            <div className="form-group">
              <label className="form-label">{t.paydown.rateType || 'Interest Rate Type'}</label>
              <select
                className="form-select"
                value={selectedOffer ? (selectedOffer.type === 'variable' ? 'variable' : 'fixed') : rateType}
                onChange={(e) => {
                  const val = e.target.value as 'fixed' | 'variable';
                  setRateType(val);
                }}
                disabled={!!selectedOffer}
              >
                <option value="fixed">{t.paydown.fixedRate || 'Fixed Rate'}</option>
                <option value="variable">{t.paydown.variableRate || 'Variable/Floating Rate'}</option>
              </select>
            </div>

            {/* Variable Type */}
            {(selectedOffer ? selectedOffer.type === 'variable' : rateType === 'variable') && (
              <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <label className="form-label">{t.paydown.variableType || 'Variable Type'}</label>
                <select
                  className="form-select"
                  value={selectedOffer ? (selectedOffer.variableType || 'vrm') : variableType}
                  onChange={(e) => {
                    const val = e.target.value as 'vrm' | 'arm';
                    setVariableType(val);
                  }}
                  disabled={!!selectedOffer}
                >
                  <option value="vrm">{t.paydown.vrmLabel || 'Fixed Payments (VRM - TD style)'}</option>
                  <option value="arm">{t.paydown.armLabel || 'Adjustable Payments (ARM - Scotiabank style)'}</option>
                </select>
              </div>
            )}

            {/* Interest Rate */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.annualRate}</span>
                <span className="form-label-val">{effInterestRate.toFixed(2)}%</span>
              </label>
              <div className="form-input-wrapper">
                <Percent size={16} className="form-input-suffix" />
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input form-input-with-suffix" 
                  value={selectedOffer ? effInterestRate : interestRate} 
                  onChange={(e) => setInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  disabled={!!selectedOffer}
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
                  <input 
                    type="number" 
                    className="form-input" 
                    value={selectedOffer ? effAmortizationYears : amortizationYears} 
                    onChange={(e) => setAmortizationYears(Math.max(1, parseInt(e.target.value) || 25))}
                    placeholder={t.paydown.years}
                    style={{ paddingRight: '2rem' }}
                    disabled={!!selectedOffer}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.yrs}</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={selectedOffer ? effAmortizationMonths : amortizationMonths} 
                    onChange={(e) => setAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
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
                  {t.paydown.calculated} ${calculatedRegularPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input form-input-with-prefix" 
                  placeholder={calculatedRegularPayment.toFixed(2)}
                  value={selectedOffer ? '' : (confirmedPayment || '')} 
                  onChange={(e) => setConfirmedPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                  disabled={!!selectedOffer}
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
                <input
                  type="number"
                  className="form-input form-input-with-prefix"
                  value={householdIncome || ''}
                  onChange={(e) => setHouseholdIncome(Math.max(0, parseInt(e.target.value) || 0))}
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
                {!selectedOffer && originalPrincipal > 0 && <span className="form-label-val">${originalPrincipal.toLocaleString()}</span>}
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <input 
                  type="number" 
                  className="form-input form-input-with-prefix" 
                  placeholder={t.paydown.originalAmountPlaceholder}
                  value={selectedOffer ? '' : (originalPrincipal || '')} 
                  onChange={(e) => setOriginalPrincipal(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={!!selectedOffer}
                />
              </div>
            </div>

            {/* Original Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.originalAmort}</span>
                {!selectedOffer && (originalAmortizationYears > 0 || originalAmortizationMonths > 0) && (
                  <span className="form-label-val">{originalAmortizationYears} {t.paydown.yrs}, {originalAmortizationMonths} {t.paydown.mos}</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder={t.paydown.years}
                    value={selectedOffer ? '' : (originalAmortizationYears || '')} 
                    onChange={(e) => setOriginalAmortizationYears(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ paddingRight: '2rem' }}
                    disabled={!!selectedOffer}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.yrs}</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder={t.paydown.months}
                    value={selectedOffer ? '' : (originalAmortizationMonths || '')} 
                    onChange={(e) => setOriginalAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
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

          {/* Variable Rate Stress Test Card */}
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
                  +{interestRateOffset.toFixed(2)}%
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
                <span>+0.00%</span>
                <span>+1.50%</span>
                <span>+3.00%</span>
              </div>
            </div>

            {/* Stressed Rate details */}
            {interestRateOffset > 0 && (
              <div style={{ background: 'var(--bg-badge)', borderRadius: '0.35rem', padding: '0.6rem 0.75rem', marginTop: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Stressed Interest Rate:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{stressedRate.toFixed(2)}%</strong>
                </div>
                {effVariableType === 'vrm' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Trigger Rate:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{triggerRate.toFixed(2)}%</strong>
                  </div>
                )}
                {effVariableType === 'arm' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stressed Payment:</span>
                    <strong style={{ color: 'var(--color-primary)' }}>
                      ${stressedPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      .replace('{offset}', interestRateOffset.toFixed(2))
                      .replace('{rate}', stressedRate.toFixed(2))
                      .replace('{triggerRate}', triggerRate.toFixed(2))}
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
                      .replace('{payment}', `$${stressedPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                      .replace('{diff}', `$${(stressedPayment - basePaymentForComp).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                  </span>
                </div>
              </div>
            )}
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
                  ${baselineResults.totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isTriggerRateReached ? (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{t.rate?.neverPayoff || 'Never Payoff'}</span>
                  ) : (
                    t.paydown.overYears.replace('{years}', baselineResults.yearsToPayoff.toFixed(1))
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  {t.paydown.regPayment} <strong>${baselineResults.schedule[0]?.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {/* Active Plan column */}
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t.paydown.activePlanOutcome}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                  ${results.totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isTriggerRateReached ? (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{t.rate?.neverPayoff || 'Never Payoff'}</span>
                  ) : (
                    t.paydown.overYears.replace('{years}', results.yearsToPayoff.toFixed(1))
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  {t.paydown.planPayment} <strong>${results.schedule[0]?.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
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
                    .replace('{years}', results.yearsSaved.toFixed(1))
                    .replace('{amount}', results.interestSaved.toLocaleString(undefined, { maximumFractionDigits: 2 }))}
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

          {/* Reminders & Calendar Sync Card */}
          <div className="card">
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} />
              <span>Reminders & Calendar Sync</span>
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Sync your mortgage payment schedules and anniversary prepayment reminders to your device calendar.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleExportAnniversaryCalendar}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}
              >
                <Calendar size={14} />
                <span>{t.paydown.exportMaturityCalendar}</span>
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleExportPaymentCalendar}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}
              >
                <Calendar size={14} />
                <span>{t.paydown.exportPaymentScheduler}</span>
              </button>
            </div>
          </div>

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
                    <span className="form-label-val">${lumpSumAmount.toLocaleString()}</span>
                  </label>
                  <div className="form-input-wrapper">
                    <DollarSign size={14} className="form-input-prefix" />
                    <input
                      type="number"
                      className="form-input form-input-with-prefix"
                      value={lumpSumAmount}
                      onChange={(e) => setLumpSumAmount(Math.max(0, parseInt(e.target.value) || 0))}
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
                    <span className="form-label-val">{paymentIncreasePercent}%</span>
                  </label>
                  <div className="form-input-wrapper">
                    <Percent size={14} className="form-input-suffix" />
                    <input
                      type="number"
                      step="0.5"
                      className="form-input form-input-with-suffix"
                      value={paymentIncreasePercent}
                      onChange={(e) => setPaymentIncreasePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                {/* Payment Increase Fixed */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>{t.paydown.annualIncreaseDollar}</span>
                    <span className="form-label-val">${paymentIncreaseFixed.toLocaleString()}</span>
                  </label>
                  <div className="form-input-wrapper">
                    <DollarSign size={14} className="form-input-prefix" />
                    <input
                      type="number"
                      className="form-input form-input-with-prefix"
                      value={paymentIncreaseFixed}
                      onChange={(e) => setPaymentIncreaseFixed(Math.max(0, parseInt(e.target.value) || 0))}
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
                        <td className="text-right">${yearPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right" style={{ color: yearExtra > 0 ? 'var(--color-accent)' : 'inherit' }}>
                          {yearExtra > 0 ? `+$${yearExtra.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                        </td>
                        <td className="text-right" style={{ color: 'var(--color-danger)' }}>
                          ${yearInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right" style={{ color: 'var(--color-success)' }}>
                          ${(yearRegularPrincipal + yearExtra).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                          ${p.endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
