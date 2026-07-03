import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Percent, Sparkles } from 'lucide-react';
import { calculateAmortization, getPaymentsPerYear, calculateRegularPayment } from '../utils/mortgageMath';
import type { MortgageInputs, PaymentFrequency } from '../utils/mortgageMath';
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

export const PaydownSimulator: React.FC<PaydownSimulatorProps> = ({ initialProfile, onSaveProfile }) => {
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
  const [paymentIncreasePercent, setPaymentIncreasePercent] = useState<number>(initialProfile?.prepayments?.paymentIncreasePercent || 0);
  const [paymentIncreaseFixed, setPaymentIncreaseFixed] = useState<number>(initialProfile?.prepayments?.paymentIncreaseFixed || 0);

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
        paymentIncreasePercent,
        paymentIncreaseFixed
      } : undefined
    };
    return calculateAmortization(inputs);
  }, [principal, interestRate, amortizationYears, amortizationMonths, paymentFrequency, maturityDate, confirmedPayment, originalPrincipal, originalAmortizationYears, originalAmortizationMonths, originalTermYears, showPrepayments, lumpSumAmount, doubleUp, paymentIncreasePercent, paymentIncreaseFixed]);

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
      paymentIncreasePercent,
      paymentIncreaseFixed
    } : undefined;
    
    const initPrepay = initialProfile.prepayments;

    const prepaymentsEqual = (!prepay && !initPrepay) || (
      !!prepay && !!initPrepay &&
      prepay.lumpSumAmount === initPrepay.lumpSumAmount &&
      prepay.doubleUp === initPrepay.doubleUp &&
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
    showPrepayments, lumpSumAmount, doubleUp, paymentIncreasePercent, paymentIncreaseFixed, initialProfile
  ]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
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
          paymentIncreasePercent,
          paymentIncreaseFixed
        } : undefined
      });
      
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    }, 450);
  };

  // Line Chart Data
  const chartData = useMemo(() => {
    // Generate data points for chart (e.g. plot ending balance at the end of each year)
    const labels: string[] = ['Year 0'];
    const baselineDataPoints: number[] = [principal];
    const prepaymentDataPoints: number[] = [principal];

    const maxYears = amortizationYears;
    
    // Find baseline balances at the end of each year
    const baselinePpy = baselineResults.schedule.length / baselineResults.yearsToPayoff;
    for (let y = 1; y <= maxYears; y++) {
      labels.push(`Yr ${y}`);
      
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
          label: 'Baseline (No Prepayments)',
          data: baselineDataPoints,
          borderColor: 'rgba(148, 163, 184, 0.6)',
          backgroundColor: 'rgba(148, 163, 184, 0.1)',
          borderDash: [5, 5],
          tension: 0.2,
          fill: false,
        },
        {
          label: 'With Prepayments / Frequency Shift',
          data: prepaymentDataPoints,
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.2,
          fill: true,
        }
      ]
    };
  }, [principal, amortizationYears, results, baselineResults]);

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

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>Paydown Simulator</h2>
        <p style={{ fontSize: '0.95rem' }}>Adjust mortgage parameters and simulate prepayment strategies to see interest and time savings.</p>
      </div>

      <div className="grid-main">
        {/* Inputs panel */}
        <div className="card flex flex-col gap-4">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            Mortgage Parameters
          </h3>
          
          {/* Group 1: Current Term & Balance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
              Current Balance & Payments
            </h4>

            {/* Remaining Principal */}
            <div className="form-group">
              <label className="form-label">
                <span>Remaining Mortgage Balance</span>
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
              <input 
                type="range" 
                className="slider-input" 
                min="50000" 
                max="2000000" 
                step="10000"
                value={principal} 
                onChange={(e) => setPrincipal(parseInt(e.target.value))}
              />
            </div>

            {/* Interest Rate */}
            <div className="form-group">
              <label className="form-label">
                <span>Annual Interest Rate (Compounded Semi-Annually)</span>
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
              <input 
                type="range" 
                className="slider-input" 
                min="1" 
                max="15" 
                step="0.05"
                value={interestRate} 
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
              />
            </div>

            {/* Remaining Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>Remaining Amortization</span>
                <span className="form-label-val">{amortizationYears} Yrs, {amortizationMonths} Mos</span>
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={amortizationYears} 
                    onChange={(e) => setAmortizationYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 25)))}
                    placeholder="Years"
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Yrs</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={amortizationMonths} 
                    onChange={(e) => setAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                    placeholder="Months"
                    style={{ paddingRight: '2.2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Mos</span>
                </div>
              </div>
              <input 
                type="range" 
                className="slider-input" 
                min="1" 
                max="30" 
                step="1"
                value={amortizationYears} 
                onChange={(e) => setAmortizationYears(parseInt(e.target.value))}
              />
            </div>

            {/* Frequency */}
            <div className="form-group">
              <label className="form-label">Payment Frequency</label>
              <select 
                className="form-select" 
                value={paymentFrequency} 
                onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
              >
                <option value="monthly">Monthly</option>
                <option value="semi_monthly">Semi-Monthly</option>
                <option value="regular_bi_weekly">Regular Bi-Weekly</option>
                <option value="accelerated_bi_weekly">Accelerated Bi-Weekly (Acc. 26/yr)</option>
                <option value="regular_weekly">Regular Weekly</option>
                <option value="accelerated_weekly">Accelerated Weekly (Acc. 52/yr)</option>
              </select>
            </div>

            {/* Confirmed Payment */}
            <div className="form-group">
              <label className="form-label flex justify-between align-center">
                <span>Confirmed Payment Override</span>
                <span className="form-label-val" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Calculated: ${calculatedRegularPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                Leave empty or 0 to use the calculated regular payment.
              </span>
            </div>
          </div>

          {/* Group 2: Current Term Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Current Term Timeline
            </h4>

            {/* Maturity Date */}
            <div className="form-group">
              <label className="form-label">Current Term Maturity Date</label>
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
              Original parameters (for tracking)
            </h4>

            {/* Original Principal */}
            <div className="form-group">
              <label className="form-label">
                <span>Original Mortgage Amount</span>
                {originalPrincipal > 0 && <span className="form-label-val">${originalPrincipal.toLocaleString()}</span>}
              </label>
              <div className="form-input-wrapper">
                <DollarSign size={16} className="form-input-prefix" />
                <input 
                  type="number" 
                  className="form-input form-input-with-prefix" 
                  placeholder="e.g. 500000"
                  value={originalPrincipal || ''} 
                  onChange={(e) => setOriginalPrincipal(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Original Amortization */}
            <div className="form-group">
              <label className="form-label">
                <span>Original Amortization</span>
                {(originalAmortizationYears > 0 || originalAmortizationMonths > 0) && (
                  <span className="form-label-val">{originalAmortizationYears} Yrs, {originalAmortizationMonths} Mos</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Years"
                    value={originalAmortizationYears || ''} 
                    onChange={(e) => setOriginalAmortizationYears(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Yrs</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Months"
                    value={originalAmortizationMonths || ''} 
                    onChange={(e) => setOriginalAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                    style={{ paddingRight: '2.2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Mos</span>
                </div>
              </div>
            </div>

            {/* Original Term */}
            <div className="form-group">
              <label className="form-label">Original Term Length</label>
              <select 
                className="form-select" 
                value={originalTermYears} 
                onChange={(e) => setOriginalTermYears(parseInt(e.target.value) || 0)}
              >
                <option value="0">Not Tracked</option>
                <option value="1">1 Year</option>
                <option value="2">2 Years</option>
                <option value="3">3 Years</option>
                <option value="4">4 Years</option>
                <option value="5">5 Years</option>
                <option value="7">7 Years</option>
                <option value="10">10 Years</option>
              </select>
            </div>
          </div>

          {/* Prepayments Toggle Button */}
          <div>
            <button 
              type="button" 
              className="btn btn-secondary w-full justify-between" 
              onClick={() => setShowPrepayments(!showPrepayments)}
            >
              <span>Simulate Extra Prepayments</span>
              {showPrepayments ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {/* Prepayments Drawer */}
          {showPrepayments && (
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
              
              {/* Lump Sum */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>Annual Anniversary Lump Sum</span>
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
              </div>

              {/* Double Up */}
              <div className="settings-item" style={{ borderBottom: 'none', padding: '0.25rem 0' }}>
                <div className="settings-item-info">
                  <div className="settings-item-title" style={{ fontSize: '0.9rem' }}>Double-Up Payments</div>
                  <div className="settings-item-desc" style={{ fontSize: '0.75rem' }}>Add 100% of base payment directly to principal every period</div>
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

              {/* Payment Increase Percent */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>Annual Payment Increase (%)</span>
                  <span className="form-label-val">{paymentIncreasePercent}%</span>
                </label>
                <input 
                  type="range" 
                  className="slider-input" 
                  min="0" 
                  max="20" 
                  step="0.5"
                  value={paymentIncreasePercent} 
                  onChange={(e) => setPaymentIncreasePercent(parseFloat(e.target.value))}
                />
              </div>

              {/* Payment Increase Fixed */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>Annual Payment Increase ($)</span>
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

          <button 
            type="button" 
            className="btn btn-primary w-full mt-4" 
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            style={{
              background: showSuccess ? 'var(--color-success)' : undefined,
              borderColor: showSuccess ? 'var(--color-success)' : undefined,
              transition: 'all 0.3s ease',
            }}
          >
            {isSaving ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  marginRight: '0.5rem'
                }} />
                Saving...
              </>
            ) : showSuccess ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', animation: 'scaleUp 0.2s ease-out' }}>
                ✓ Profile Saved!
              </span>
            ) : (
              'Save as Active Profile'
            )}
          </button>
        </div>

        {/* Charts & Outcomes Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Comparison Cards */}
          <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
            
            {/* Standard Metrics */}
            <div className="card">
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Baseline Outcome
              </h4>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                ${baselineResults.totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Total Interest Paid over {baselineResults.yearsToPayoff.toFixed(1)} years
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                Reg. Payment: <strong>${baselineResults.schedule[0]?.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </div>

            {/* Prepayment Metrics */}
            <div className="card card-accent">
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Active Plan Outcome
              </h4>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                ${results.totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Total Interest Paid over {results.yearsToPayoff.toFixed(1)} years
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                Plan Payment: <strong>${results.schedule[0]?.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </div>

          </div>

          {/* Optimization Callout */}
          {hasPrepaymentsActive && (
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              <Sparkles size={20} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Optimization Success!</strong>
                <span style={{ fontSize: '0.85rem' }}>
                  By applying these prepayments, you shave <strong>{results.yearsSaved.toFixed(1)} years</strong> off your mortgage length and save <strong style={{ color: 'var(--color-success)' }}>${results.interestSaved.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> in lifetime interest!
                </span>
              </div>
            </div>
          )}

          {/* Graph Card */}
          <div className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Balance Projection</h3>
            <div style={{ flexGrow: 1, position: 'relative', height: '240px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

        </div>
      </div>

      {/* Amortization Schedule Table */}
      <div className="card mt-4">
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          Yearly Amortization Breakdowns
        </h3>
        <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th className="text-right">Regular Payments</th>
                <th className="text-right">Extra Prepayments</th>
                <th className="text-right">Interest Paid</th>
                <th className="text-right">Principal Paid</th>
                <th className="text-right">Ending Balance</th>
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
                        <td>Year {yearNum}</td>
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
