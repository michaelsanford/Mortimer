import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Eraser, Percent, Sparkles } from 'lucide-react';
import { calculateAmortization, getPaymentsPerYear, calculateRegularPayment } from '../utils/mortgageMath';
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

interface PaydownSimulatorProps {
  initialProfile: MortgageInputs | null;
  onSaveProfile: (profile: MortgageInputs) => void;
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

export const PaydownSimulator: React.FC<PaydownSimulatorProps> = ({ initialProfile, onSaveProfile }) => {
  const { t } = useI18n();

  // Local state for inputs
  const [principal, setPrincipal] = useState<number>(initialProfile?.principal || 450000);
  const [interestRate, setInterestRate] = useState<number>(initialProfile?.interestRate || 4.85);
  const [amortizationYears, setAmortizationYears] = useState<number>(initialProfile?.amortizationYears || 25);
  const [amortizationMonths, setAmortizationMonths] = useState<number>(initialProfile?.amortizationMonths || 0);
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(initialProfile?.paymentFrequency || 'monthly');
  const [maturityDate, setMaturityDate] = useState<string>(initialProfile?.maturityDate || '');
  
  // Custom Payment Override
  const [confirmedPayment, setConfirmedPayment] = useState<number>(initialProfile?.confirmedPayment || 0);

  // Original Parameters
  const [originalPrincipal, setOriginalPrincipal] = useState<number>(initialProfile?.originalPrincipal || 0);
  const [originalAmortizationYears, setOriginalAmortizationYears] = useState<number>(initialProfile?.originalAmortizationYears || 0);
  const [originalAmortizationMonths, setOriginalAmortizationMonths] = useState<number>(initialProfile?.originalAmortizationMonths || 0);
  const [originalTermYears, setOriginalTermYears] = useState<number>(initialProfile?.originalTermYears || 0);

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
  const [doubleUpEvery, setDoubleUpEvery] = useState<number>(initialProfile?.prepayments?.doubleUpEvery || 1);
  const [paymentIncreasePercent, setPaymentIncreasePercent] = useState<number>(initialProfile?.prepayments?.paymentIncreasePercent || 0);
  const [paymentIncreaseFixed, setPaymentIncreaseFixed] = useState<number>(initialProfile?.prepayments?.paymentIncreaseFixed || 0);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'saving'>('saved');

  const saveStatusLabels = useMemo(() => ({
    saved: t.paydown.saved,
    pending: t.paydown.pending,
    saving: t.paydown.saving,
  }), [t]);

  const calculatedRegularPayment = useMemo(() => {
    const principalForPayment = originalPrincipal && originalPrincipal > 0 ? originalPrincipal : principal;
    const amortizationForPayment = originalAmortizationYears && originalAmortizationYears > 0 
      ? originalAmortizationYears + (originalAmortizationMonths || 0) / 12 
      : amortizationYears + (amortizationMonths || 0) / 12;
    return calculateRegularPayment(principalForPayment, interestRate, amortizationForPayment, paymentFrequency);
  }, [principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, originalPrincipal, originalAmortizationYears, originalAmortizationMonths]);

  // Amortization results
  const results = useMemo(() => {
    const inputs: MortgageInputs = {
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
      prepayments: showPrepayments ? {
        lumpSumAmount,
        doubleUp,
        doubleUpEvery,
        paymentIncreasePercent,
        paymentIncreaseFixed
      } : undefined
    };
    return calculateAmortization(inputs);
  }, [principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, maturityDate, confirmedPayment, originalPrincipal, originalAmortizationYears, originalAmortizationMonths, originalTermYears, showPrepayments, lumpSumAmount, doubleUp, doubleUpEvery, paymentIncreasePercent, paymentIncreaseFixed]);

  const baselineResults = useMemo(() => {
    // Standard baseline (always without prepayments, regular frequency)
    const baseFreq = paymentFrequency.includes('accelerated')
      ? (paymentFrequency === 'accelerated_bi_weekly' ? 'regular_bi_weekly' : 'regular_weekly')
      : paymentFrequency;

    return calculateAmortization({
      principal,
      interestRate,
      amortizationYears,
      amortizationMonths,
      paymentFrequency: baseFreq,
      confirmedPayment,
      prepayments: undefined
    });
  }, [principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, confirmedPayment]);

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
      !prepaymentsEqual
    );
  }, [
    principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, maturityDate, confirmedPayment,
    originalPrincipal, originalAmortizationYears, originalAmortizationMonths, originalTermYears,
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
    showPrepayments, lumpSumAmount, doubleUp, doubleUpEvery, paymentIncreasePercent, paymentIncreaseFixed,
    onSaveProfile
  ]);

  // Line Chart Data
  const chartData = useMemo(() => {
    // Generate data points for chart (e.g. plot ending balance at the end of each year)
    const labels: string[] = [t.paydown.year0];
    const baselineDataPoints: number[] = [principal];
    const prepaymentDataPoints: number[] = [principal];

    const maxYears = amortizationYears;
    
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
  }, [principal, amortizationYears, results, baselineResults, t]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#e2e8f0',
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
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { 
          color: '#94a3b8',
          callback: function(value: any) {
            return '$' + (value / 1000) + 'k';
          }
        }
      }
    }
  };

  const hasPrepaymentsActive = showPrepayments && (lumpSumAmount > 0 || doubleUp || paymentIncreasePercent > 0 || paymentIncreaseFixed > 0 || paymentFrequency.includes('accelerated'));

  // Payments per year for the current frequency — bounds the double-up interval slider (max once per year)
  const ppy = getPaymentsPerYear(paymentFrequency);

  // Keep the double-up interval at a sane floor (at least every payment)
  useEffect(() => {
    setDoubleUpEvery((prev) => Math.max(1, prev));
  }, [ppy]);

  // Human-friendly description of how often the double-up applies
  const doubleUpFrequencyLabel = useMemo(() => {
    if (doubleUpEvery <= 1) return t.paydown.everyPayment;
    return t.paydown.everyNPayments.replace('{n}', String(doubleUpEvery));
  }, [doubleUpEvery, t]);

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

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t.paydown.title}</h2>
        <p style={{ fontSize: '0.95rem' }}>{t.paydown.subtitle}</p>
      </div>

      <div className="grid-main">
        {/* Inputs panel */}
        <div className={`card flex flex-col gap-4 card-${saveStatus}`}>
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
                <span className="form-label-val">${principal.toLocaleString()}</span>
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <input 
                  type="number" 
                  className="form-input form-input-with-prefix" 
                  value={principal} 
                  onChange={(e) => setPrincipal(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Interest Rate */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.annualRate}</span>
                <span className="form-label-val">{interestRate.toFixed(2)}%</span>
              </label>
              <div className="form-input-wrapper">
                <Percent size={16} className="form-input-suffix" />
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input form-input-with-suffix" 
                  value={interestRate} 
                  onChange={(e) => setInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Remaining Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.remainingAmort}</span>
                <span className="form-label-val">{amortizationYears} {t.paydown.yrs}, {amortizationMonths} {t.paydown.mos}</span>
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={amortizationYears} 
                    onChange={(e) => setAmortizationYears(Math.max(1, parseInt(e.target.value) || 25))}
                    placeholder={t.paydown.years}
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.yrs}</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={amortizationMonths} 
                    onChange={(e) => setAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                    placeholder={t.paydown.months}
                    style={{ paddingRight: '2.2rem' }}
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
                value={paymentFrequency} 
                onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
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
                  value={confirmedPayment || ''} 
                  onChange={(e) => setConfirmedPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                {t.paydown.paymentOverrideHint}
              </span>
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
                value={maturityDate} 
                onChange={(e) => setMaturityDate(e.target.value)} 
                style={{ colorScheme: 'dark' }}
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
                {originalPrincipal > 0 && <span className="form-label-val">${originalPrincipal.toLocaleString()}</span>}
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <input 
                  type="number" 
                  className="form-input form-input-with-prefix" 
                  placeholder={t.paydown.originalAmountPlaceholder}
                  value={originalPrincipal || ''} 
                  onChange={(e) => setOriginalPrincipal(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Original Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>{t.paydown.originalAmort}</span>
                {(originalAmortizationYears > 0 || originalAmortizationMonths > 0) && (
                  <span className="form-label-val">{originalAmortizationYears} {t.paydown.yrs}, {originalAmortizationMonths} {t.paydown.mos}</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder={t.paydown.years}
                    value={originalAmortizationYears || ''} 
                    onChange={(e) => setOriginalAmortizationYears(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{t.paydown.yrs}</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder={t.paydown.months}
                    value={originalAmortizationMonths || ''} 
                    onChange={(e) => setOriginalAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                    style={{ paddingRight: '2.2rem' }}
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
                value={originalTermYears} 
                onChange={(e) => setOriginalTermYears(parseInt(e.target.value) || 0)}
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
                  ${baselineResults.totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t.paydown.overYears.replace('{years}', baselineResults.yearsToPayoff.toFixed(1))}
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
                  {t.paydown.overYears.replace('{years}', results.yearsToPayoff.toFixed(1))}
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
                      {/* Interval between double-up payments: 1 = every payment */}
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        value={doubleUpEvery}
                        onChange={(e) => setDoubleUpEvery(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                        {t.paydown.doubleUpTimesPerYear.replace('{n}', String(doubleUpTimesPerYear))}
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
                const ppy = getPaymentsPerYear(paymentFrequency);
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
