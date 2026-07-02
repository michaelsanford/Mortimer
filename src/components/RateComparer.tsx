import React, { useState, useMemo } from 'react';
import { DollarSign, ShieldAlert, Sparkles } from 'lucide-react';
import { calculateRefinance, calculateRegularPayment, getPeriodInterestRate } from '../utils/mortgageMath';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface RateComparerProps {
  currentBalance: number;
  currentRate: number;
  currentAmortization: number;
}

export const RateComparer: React.FC<RateComparerProps> = ({ 
  currentBalance: defaultBalance, 
  currentRate: defaultRate,
  currentAmortization: defaultAmortization 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'renewal' | 'refinance'>('renewal');

  // Renewal states
  const [renewalBalance, setRenewalBalance] = useState<number>(defaultBalance || 400000);
  const [renewalAmortization, setRenewalAmortization] = useState<number>(defaultAmortization || 25);
  
  const [rateA, setRateA] = useState<number>(4.75);
  const [termA, setTermA] = useState<number>(5); // 5-year term
  
  const [rateB, setRateB] = useState<number>(5.15);
  const [termB, setTermB] = useState<number>(3); // 3-year term
  
  const [rateC, setRateC] = useState<number>(4.45);
  const [termC, setTermC] = useState<number>(5); // 5-year term

  // Refinance states
  const [refinanceBalance, setRefinanceBalance] = useState<number>(defaultBalance || 400000);
  const [refinanceCurrentRate, setRefinanceCurrentRate] = useState<number>(defaultRate || 5.85);
  const [refinanceRemainingTerm, setRefinanceRemainingTerm] = useState<number>(36); // 36 months left
  const [refinanceAmortization, setRefinanceAmortization] = useState<number>(defaultAmortization || 20);
  const [refinanceNewRate, setRefinanceNewRate] = useState<number>(4.49);
  const [refinancePenaltyType, setRefinancePenaltyType] = useState<'three_months_interest' | 'ird' | 'custom'>('ird');
  const [refinanceCustomPenalty, setRefinanceCustomPenalty] = useState<number>(0);
  const [refinanceFees, setRefinanceFees] = useState<number>(1500); // Legal, Appraisal

  // 1. Renewal calculations
  const renewalResults = useMemo(() => {
    // Helper to calculate term details
    const getTermDetails = (rate: number, termYears: number) => {
      const monthlyPayment = calculateRegularPayment(renewalBalance, rate, renewalAmortization, 'monthly');
      const monthlyRate = getPeriodInterestRate(rate, 'monthly');
      
      let balance = renewalBalance;
      let totalInterest = 0;
      let totalPrincipal = 0;
      const termMonths = termYears * 12;

      for (let m = 0; m < termMonths; m++) {
        const interest = balance * monthlyRate;
        let principalPaid = monthlyPayment - interest;
        if (principalPaid > balance) principalPaid = balance;
        
        totalInterest += interest;
        totalPrincipal += principalPaid;
        balance = Math.max(0, balance - principalPaid);
      }

      return {
        monthlyPayment,
        totalInterest,
        totalPrincipal,
        endingBalance: balance
      };
    };

    return {
      optionA: getTermDetails(rateA, termA),
      optionB: getTermDetails(rateB, termB),
      optionC: getTermDetails(rateC, termC),
    };
  }, [renewalBalance, renewalAmortization, rateA, termA, rateB, termB, rateC, termC]);

  // 2. Refinance calculations
  const refinanceResults = useMemo(() => {
    return calculateRefinance({
      currentBalance: refinanceBalance,
      currentRate: refinanceCurrentRate,
      remainingTermMonths: refinanceRemainingTerm,
      remainingAmortizationYears: refinanceAmortization,
      prepaymentPenaltyType: refinancePenaltyType,
      customPenaltyAmount: refinanceCustomPenalty,
      newRate: refinanceNewRate,
      refinanceFees
    });
  }, [refinanceBalance, refinanceCurrentRate, refinanceRemainingTerm, refinanceAmortization, refinancePenaltyType, refinanceCustomPenalty, refinanceNewRate, refinanceFees]);

  // Renewal Chart Data
  const renewalChartData = {
    labels: ['Option A (Offer 1)', 'Option B (Offer 2)', 'Option C (Offer 3)'],
    datasets: [
      {
        label: 'Interest Paid Over Selected Term',
        data: [
          renewalResults.optionA.totalInterest,
          renewalResults.optionB.totalInterest,
          renewalResults.optionC.totalInterest
        ],
        backgroundColor: [
          'rgba(99, 102, 241, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(59, 130, 246, 0.7)'
        ],
        borderColor: [
          'rgba(99, 102, 241, 1)',
          'rgba(168, 85, 247, 1)',
          'rgba(59, 130, 246, 1)'
        ],
        borderWidth: 1,
        borderRadius: 8,
      }
    ]
  };

  const renewalChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return 'Interest: ' + new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(context.parsed.y);
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
          callback: function(value: any) { return '$' + (value / 1000) + 'k'; }
        }
      }
    }
  };

  // Refinance Chart Data
  const refinanceChartData = {
    labels: ['Current Rate Plan', 'New Rate Plan'],
    datasets: [
      {
        label: 'Interest Cost Over Remaining Term',
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
            return 'Interest Cost: ' + new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(context.parsed.y);
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
          callback: function(value: any) { return '$' + (value / 1000) + 'k'; }
        }
      }
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>Rate Comparisons & Refinancing</h2>
        <p style={{ fontSize: '0.95rem' }}>Compare multiple mortgage offers side-by-side or evaluate the breaking penalty and net savings of refinancing.</p>
      </div>

      {/* Sub-tab selection */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`btn ${activeSubTab === 'renewal' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('renewal')}
        >
          Renewal Rate Comparer
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === 'refinance' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('refinance')}
        >
          Refinance Penalty & Break-Even
        </button>
      </div>

      {activeSubTab === 'renewal' ? (
        /* RENEWAL COMPARE PANEL */
        <div className="grid grid-cols-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
          {/* Inputs */}
          <div className="card flex flex-col gap-4">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              Renewal Parameters
            </h3>

            {/* Balance */}
            <div className="form-group">
              <label className="form-label">
                <span>Mortgage Balance to Renew</span>
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
            <div className="form-group">
              <label className="form-label">
                <span>Remaining Amortization</span>
                <span className="form-label-val">{renewalAmortization} Years</span>
              </label>
              <div className="form-input-wrapper">
                <input 
                  type="number" 
                  className="form-input" 
                  value={renewalAmortization} 
                  onChange={(e) => setRenewalAmortization(Math.max(1, Math.min(30, parseInt(e.target.value) || 25)))}
                />
              </div>
            </div>

            {/* Offer A */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>Offer 1 (Option A)</h4>
              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Interest Rate</label>
                  <input type="number" step="0.01" className="form-input" value={rateA} onChange={(e) => setRateA(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Term length</label>
                  <select className="form-select" value={termA} onChange={(e) => setTermA(parseInt(e.target.value))}>
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="4">4 Years</option>
                    <option value="5">5 Years</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Offer B */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', marginBottom: '0.5rem' }}>Offer 2 (Option B)</h4>
              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Interest Rate</label>
                  <input type="number" step="0.01" className="form-input" value={rateB} onChange={(e) => setRateB(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Term length</label>
                  <select className="form-select" value={termB} onChange={(e) => setTermB(parseInt(e.target.value))}>
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="4">4 Years</option>
                    <option value="5">5 Years</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Offer C */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-secondary)', marginBottom: '0.5rem' }}>Offer 3 (Option C)</h4>
              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Interest Rate</label>
                  <input type="number" step="0.01" className="form-input" value={rateC} onChange={(e) => setRateC(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Term length</label>
                  <select className="form-select" value={termC} onChange={(e) => setTermC(parseInt(e.target.value))}>
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="4">4 Years</option>
                    <option value="5">5 Years</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Renewal Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Renewal Comparison Results</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th style={{ color: 'var(--color-primary)' }}>Offer 1</th>
                      <th style={{ color: 'var(--color-accent)' }}>Offer 2</th>
                      <th style={{ color: 'var(--color-secondary)' }}>Offer 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Rate / Term</td>
                      <td><strong>{rateA.toFixed(2)}%</strong> ({termA} yr)</td>
                      <td><strong>{rateB.toFixed(2)}%</strong> ({termB} yr)</td>
                      <td><strong>{rateC.toFixed(2)}%</strong> ({termC} yr)</td>
                    </tr>
                    <tr>
                      <td>Monthly Payment</td>
                      <td>${renewalResults.optionA.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>${renewalResults.optionB.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>${renewalResults.optionC.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td>Interest Paid in Term</td>
                      <td style={{ color: 'var(--color-danger)' }}>${renewalResults.optionA.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td style={{ color: 'var(--color-danger)' }}>${renewalResults.optionB.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td style={{ color: 'var(--color-danger)' }}>${renewalResults.optionC.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                    <tr>
                      <td>Principal Paid in Term</td>
                      <td style={{ color: 'var(--color-success)' }}>${renewalResults.optionA.totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td style={{ color: 'var(--color-success)' }}>${renewalResults.optionB.totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td style={{ color: 'var(--color-success)' }}>${renewalResults.optionC.totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                    <tr>
                      <td>Ending Balance</td>
                      <td><strong>${renewalResults.optionA.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></td>
                      <td><strong>${renewalResults.optionB.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></td>
                      <td><strong>${renewalResults.optionC.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interest Chart */}
            <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Interest Cost Comparison</h3>
              <div style={{ flexGrow: 1, position: 'relative', height: '170px' }}>
                <Bar data={renewalChartData} options={renewalChartOptions} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* REFINANCE PENALTY PANEL */
        <div className="grid grid-cols-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
          {/* Inputs */}
          <div className="card flex flex-col gap-4">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              Refinance Parameters
            </h3>

            {/* Current Mortgage Info */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 0 }}>Current Mortgage</h4>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Outstanding Balance</label>
                <div className="form-input-wrapper">
                  <DollarSign size={14} className="form-input-prefix" />
                  <input type="number" className="form-input form-input-with-prefix" value={refinanceBalance} onChange={(e) => setRefinanceBalance(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Current Rate</label>
                  <input type="number" step="0.01" className="form-input" value={refinanceCurrentRate} onChange={(e) => setRefinanceCurrentRate(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Amortization Left (Yrs)</label>
                  <input type="number" className="form-input" value={refinanceAmortization} onChange={(e) => setRefinanceAmortization(Math.max(1, parseInt(e.target.value) || 20))} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Remaining Term (Months)</label>
                <input type="number" className="form-input" value={refinanceRemainingTerm} onChange={(e) => setRefinanceRemainingTerm(Math.max(1, parseInt(e.target.value) || 12))} />
              </div>
            </div>

            {/* New Deal Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', marginBottom: 0 }}>New Mortgage Offer</h4>

              <div className="flex gap-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>New Rate Offered</label>
                  <input type="number" step="0.01" className="form-input" value={refinanceNewRate} onChange={(e) => setRefinanceNewRate(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Appraisal & Legal Fees</label>
                  <input type="number" className="form-input" value={refinanceFees} onChange={(e) => setRefinanceFees(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Prepayment Penalty Method</label>
                <select className="form-select" value={refinancePenaltyType} onChange={(e) => setRefinancePenaltyType(e.target.value as any)}>
                  <option value="three_months_interest">3 Months Interest (Standard Variable)</option>
                  <option value="ird">Interest Rate Differential (IRD - Standard Fixed)</option>
                  <option value="custom">Custom Specified Penalty</option>
                </select>
              </div>

              {refinancePenaltyType === 'custom' && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Custom Penalty Amount</label>
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
                  Total Breaking Costs
                </h4>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-danger)' }}>
                  ${refinanceResults.totalClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Penalty: ${refinanceResults.estimatedPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 })} + Fees: ${refinanceFees.toLocaleString()}
                </div>
              </div>

              <div className="card">
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Monthly Savings
                </h4>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-success)' }}>
                  ${refinanceResults.monthlySavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} /mo
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Lowered regular payment cost
                </div>
              </div>
            </div>

            {/* Break-even banner */}
            <div className="card card-accent" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Break-Even Summary</h3>
              {refinanceResults.netSavingsOverTerm > 0 ? (
                <div className="flex align-center gap-4">
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>
                      Refinancing will save you <strong className="color-success">${refinanceResults.netSavingsOverTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> net over the remaining {refinanceRemainingTerm} months!
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      You recover your closing costs in <strong>{refinanceResults.breakEvenMonths.toFixed(1)} months</strong> of payments.
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
                      Refinancing is not recommended.
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      The prepayment breaking penalty exceeds your rate savings, resulting in a net loss of <strong>${Math.abs(refinanceResults.netSavingsOverTerm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> over the term.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="card" style={{ height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Interest Savings Comparison</h3>
              <div style={{ flexGrow: 1, position: 'relative', height: '140px' }}>
                <Bar data={refinanceChartData} options={refinanceChartOptions} />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
