import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, ShieldAlert, Sparkles, Plus, Trash2 } from 'lucide-react';
import { calculateRefinance, calculateRegularPayment, getPeriodInterestRate } from '../utils/mortgageMath';
import type { MortgageInputs } from '../utils/mortgageMath';
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

interface Offer {
  id: string;
  name: string;
  rate: number;
  term: number;
  type: 'fixed' | 'variable';
}

interface RateComparerProps {
  profile: MortgageInputs | null;
  onSaveProfile?: (newProfile: MortgageInputs) => void;
}

const SaveStatusBadge: React.FC<{ status: 'saved' | 'pending' | 'saving' }> = ({ status }) => {
  const config = {
    saved: { color: 'var(--color-success)', text: 'Saved', bg: 'rgba(16, 185, 129, 0.08)' },
    pending: { color: 'var(--color-warning)', text: 'Pending', bg: 'rgba(245, 158, 11, 0.08)' },
    saving: { color: 'var(--color-primary)', text: 'Saving...', bg: 'rgba(99, 102, 241, 0.08)' }
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

const calculateRemainingMonths = (maturityDateStr: string) => {
  if (!maturityDateStr) return 36;
  const maturity = new Date(maturityDateStr);
  const today = new Date();
  const diffMonths = (maturity.getFullYear() - today.getFullYear()) * 12 + (maturity.getMonth() - today.getMonth());
  return Math.max(1, diffMonths);
};

export const RateComparer: React.FC<RateComparerProps> = ({ profile, onSaveProfile }) => {
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
      name: `Offer ${offers.length + 1}`,
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

  // 1. Renewal calculations
  const renewalResults = useMemo(() => {
    const renewalAmortization = renewalAmortizationYears + renewalAmortizationMonths / 12;

    // Helper to calculate term details
    const getTermDetails = (rate: number, termYears: number, type: 'fixed' | 'variable') => {
      const compounding = type === 'variable' ? 'monthly' : 'semi_annual';
      const monthlyPayment = calculateRegularPayment(renewalBalance, rate, renewalAmortization, 'monthly', compounding);
      const monthlyRate = getPeriodInterestRate(rate, 'monthly', compounding);
      
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

    return offers.map(o => ({
      ...o,
      results: getTermDetails(o.rate, o.term, o.type)
    }));
  }, [renewalBalance, renewalAmortizationYears, renewalAmortizationMonths, offers]);

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

  // Renewal Chart Data
  const renewalChartData = {
    labels: renewalResults.map(o => `${o.name} (${o.rate.toFixed(2)}% ${o.type === 'variable' ? 'Var' : 'Fix'})`),
    datasets: [
      {
        label: 'Interest Paid Over Selected Term',
        data: renewalResults.map(o => o.results.totalInterest),
        backgroundColor: renewalResults.map((_, i) => `hsla(${200 + (i * 35) % 160}, 75%, 65%, 0.7)`),
        borderColor: renewalResults.map((_, i) => `hsla(${200 + (i * 35) % 160}, 75%, 65%, 1)`),
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
              <span>Renewal Parameters</span>
              <SaveStatusBadge status={saveStatus} />
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
                <span className="form-label-val">{renewalAmortizationYears} Yrs, {renewalAmortizationMonths} Mos</span>
              </label>
              <div className="flex gap-2">
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={renewalAmortizationYears} 
                    onChange={(e) => setRenewalAmortizationYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 25)))}
                    placeholder="Years"
                    style={{ paddingRight: '2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Yrs</span>
                </div>
                <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={renewalAmortizationMonths} 
                    onChange={(e) => setRenewalAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                    placeholder="Months"
                    style={{ paddingRight: '2.2rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Mos</span>
                </div>
              </div>
            </div>

            {/* Dynamic Offers list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Interest Rate</label>
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
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Term</label>
                      <select 
                        className="form-select" 
                        value={offer.term} 
                        onChange={(e) => handleUpdateOffer(offer.id, 'term', parseInt(e.target.value) || 5)}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        <option value="1">1 Yr</option>
                        <option value="2">2 Yrs</option>
                        <option value="3">3 Yrs</option>
                        <option value="4">4 Yrs</option>
                        <option value="5">5 Yrs</option>
                        <option value="7">7 Yrs</option>
                        <option value="10">10 Yrs</option>
                      </select>
                    </div>
                    {/* Type */}
                    <div className="form-group w-full" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Compounding</label>
                      <select 
                        className="form-select" 
                        value={offer.type} 
                        onChange={(e) => handleUpdateOffer(offer.id, 'type', e.target.value as 'fixed' | 'variable')}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        <option value="fixed">Fixed</option>
                        <option value="variable">Variable</option>
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
                <span style={{ fontSize: '0.85rem' }}>Add Offer ({offers.length}/10)</span>
              </button>
            )}

          </div>

          {/* Renewal Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Renewal Comparison Results</h3>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {renewalResults.map((o, index) => (
                        <th 
                          key={o.id} 
                          style={{ 
                            color: `hsla(${200 + (index * 35) % 160}, 85%, 65%, 1)`,
                            textAlign: 'right',
                            minWidth: '100px'
                          }}
                        >
                          {o.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Rate / Term</td>
                      {renewalResults.map(o => (
                        <td key={o.id} style={{ textAlign: 'right' }}>
                          <strong>{o.rate.toFixed(2)}%</strong> ({o.term} Yr {o.type === 'variable' ? 'Var' : 'Fix'})
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>Monthly Payment</td>
                      {renewalResults.map(o => (
                        <td key={o.id} style={{ textAlign: 'right' }}>
                          ${o.results.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>Interest Paid in Term</td>
                      {renewalResults.map(o => (
                        <td key={o.id} style={{ color: 'var(--color-danger)', textAlign: 'right' }}>
                          ${o.results.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>Principal Paid in Term</td>
                      {renewalResults.map(o => (
                        <td key={o.id} style={{ color: 'var(--color-success)', textAlign: 'right' }}>
                          ${o.results.totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>Ending Balance</td>
                      {renewalResults.map(o => (
                        <td key={o.id} style={{ textAlign: 'right' }}>
                          <strong>${o.results.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                        </td>
                      ))}
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
              <span>Refinance Parameters</span>
              <SaveStatusBadge status={saveStatus} />
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
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Amortization Left</label>
                  <div className="flex gap-2">
                    <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={refinanceAmortizationYears} 
                        onChange={(e) => setRefinanceAmortizationYears(Math.max(1, Math.min(30, parseInt(e.target.value) || 20)))}
                        placeholder="Yrs"
                        style={{ paddingRight: '1.8rem', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Yrs</span>
                    </div>
                    <div className="form-input-wrapper w-full" style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={refinanceAmortizationMonths} 
                        onChange={(e) => setRefinanceAmortizationMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                        placeholder="Mos"
                        style={{ paddingRight: '2rem', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>Mos</span>
                    </div>
                  </div>
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
