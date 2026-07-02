import React, { useState, useMemo } from 'react';
import { DollarSign, CheckSquare, Square, ShieldAlert, Sparkles, Plus } from 'lucide-react';
import { calculateHELOC, calculateRegularPayment } from '../utils/mortgageMath';

interface HELOCPlannerProps {
  currentHomeValue: number;
  currentBalance: number;
}

interface RenoItem {
  id: string;
  name: string;
  cost: number;
  selected: boolean;
}

export const HELOCPlanner: React.FC<HELOCPlannerProps> = ({
  currentHomeValue: defaultHomeValue,
  currentBalance: defaultBalance
}) => {
  // Financial inputs
  const [homeValue, setHomeValue] = useState<number>(defaultHomeValue || 650000);
  const [mortgageBalance, setMortgageBalance] = useState<number>(defaultBalance || 350000);
  const [helocPrimeRate, setHelocPrimeRate] = useState<number>(5.95); // Canada Prime rate default
  const [helocPremium, setHelocPremium] = useState<number>(0.5); // Prime + 0.5% is standard

  // Custom addition states
  const [customRenoName, setCustomRenoName] = useState<string>('');
  const [customRenoCost, setCustomRenoCost] = useState<number>(0);

  // Reno Checklist
  const [renoItems, setRenoItems] = useState<RenoItem[]>([
    { id: 'kitchen', name: 'Kitchen Remodel', cost: 35000, selected: false },
    { id: 'bathroom', name: 'Bathroom Remodel', cost: 15000, selected: false },
    { id: 'basement', name: 'Basement Finishing', cost: 30000, selected: false },
    { id: 'roof', name: 'Roof Replacement', cost: 12000, selected: false },
    { id: 'hvac', name: 'HVAC / Heat Pump Upgrades', cost: 15000, selected: false },
    { id: 'landscaping', name: 'Landscaping & Deck', cost: 10000, selected: false }
  ]);

  // Toggle selection
  const handleToggleItem = (id: string) => {
    setRenoItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  // Add custom reno item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRenoName.trim() || customRenoCost <= 0) return;
    
    const newItem: RenoItem = {
      id: 'custom_' + Date.now(),
      name: customRenoName,
      cost: customRenoCost,
      selected: true
    };
    
    setRenoItems(prev => [...prev, newItem]);
    setCustomRenoName('');
    setCustomRenoCost(0);
  };

  // Calculations
  const renoTotal = useMemo(() => {
    return renoItems.reduce((sum, item) => item.selected ? sum + item.cost : sum, 0);
  }, [renoItems]);

  const helocRate = helocPrimeRate + helocPremium;

  const helocDetails = useMemo(() => {
    return calculateHELOC({
      homeValue,
      currentMortgageBalance: mortgageBalance
    });
  }, [homeValue, mortgageBalance]);

  // Total LTV after adding Reno to mortgage / HELOC
  const ltvAfterReno = useMemo(() => {
    const totalBorrowing = mortgageBalance + renoTotal;
    return (totalBorrowing / homeValue) * 100;
  }, [mortgageBalance, renoTotal, homeValue]);

  // Estimate borrowing costs for Reno total
  const borrowingCosts = useMemo(() => {
    if (renoTotal <= 0) return { interestOnlyMonthly: 0, amortizedMonthly: 0 };
    
    // 1. Interest Only HELOC cost
    // Monthly Interest = Balance * rate / 12
    const interestOnlyMonthly = renoTotal * (helocRate / 100 / 12);
    
    // 2. Amortized Mortgage addition cost (e.g. rolled into mortgage at 4.75% for 20 years)
    const amortizedMonthly = calculateRegularPayment(renoTotal, 4.75, 20, 'monthly');
    
    return {
      interestOnlyMonthly,
      amortizedMonthly
    };
  }, [renoTotal, helocRate]);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>Reno & Equity Planner</h2>
        <p style={{ fontSize: '0.95rem' }}>Estimate the cost of upcoming home renovations and see how they can be financed using a Home Equity Line of Credit (HELOC).</p>
      </div>

      <div className="grid-heloc">
        {/* Left Side: Reno Checklist & Equity inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Equity Inputs */}
          <div className="card flex flex-col gap-4">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              Property Equity Details
            </h3>

            <div className="flex gap-4">
              {/* Home Value */}
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>Home Market Value</span>
                  <span className="form-label-val">${homeValue.toLocaleString()}</span>
                </label>
                <div className="form-input-wrapper">
                  <DollarSign size={14} className="form-input-prefix" />
                  <input 
                    type="number" 
                    className="form-input form-input-with-prefix" 
                    value={homeValue} 
                    onChange={(e) => setHomeValue(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              {/* Balance */}
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>Outstanding Mortgage</span>
                  <span className="form-label-val">${mortgageBalance.toLocaleString()}</span>
                </label>
                <div className="form-input-wrapper">
                  <DollarSign size={14} className="form-input-prefix" />
                  <input 
                    type="number" 
                    className="form-input form-input-with-prefix" 
                    value={mortgageBalance} 
                    onChange={(e) => setMortgageBalance(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>
            </div>

            {/* HELOC Rates setting */}
            <div className="flex gap-4">
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Canada Prime Rate</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={helocPrimeRate} 
                  onChange={(e) => setHelocPrimeRate(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>HELOC Premium (+%)</label>
                <input 
                  type="number" 
                  step="0.05" 
                  className="form-input" 
                  value={helocPremium} 
                  onChange={(e) => setHelocPremium(parseFloat(e.target.value) || 0)} 
                />
              </div>
            </div>
          </div>

          {/* Reno Checklist Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Renovation Checklist
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {renoItems.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleToggleItem(item.id)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.75rem 1rem', 
                    background: item.selected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)', 
                    border: '1px solid', 
                    borderColor: item.selected ? 'var(--color-primary)' : 'var(--border-color)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="flex align-center gap-2">
                    {item.selected ? (
                      <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} />
                    ) : (
                      <Square size={18} style={{ color: 'var(--text-muted)' }} />
                    )}
                    <span style={{ fontWeight: 500, color: item.selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {item.name}
                    </span>
                  </div>
                  <strong style={{ fontFamily: 'var(--font-heading)' }}>
                    ${item.cost.toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>

            {/* Custom Addition Form */}
            <form onSubmit={handleAddCustomItem} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Add Custom Project</h4>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  placeholder="Project Name (e.g. Pool)" 
                  className="form-input" 
                  style={{ flexGrow: 2 }}
                  value={customRenoName}
                  onChange={(e) => setCustomRenoName(e.target.value)}
                />
                <div className="form-input-wrapper" style={{ flexGrow: 1 }}>
                  <DollarSign size={14} className="form-input-prefix" />
                  <input 
                    type="number" 
                    placeholder="Cost" 
                    className="form-input form-input-with-prefix" 
                    value={customRenoCost || ''}
                    onChange={(e) => setCustomRenoCost(parseInt(e.target.value) || 0)}
                  />
                </div>
                <button type="submit" className="btn btn-secondary" style={{ padding: '0.75rem' }}>
                  <Plus size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Calculations, HELOC capacity, Borrowing Cost */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* HELOC Capacity Summary */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Canadian Equity Capacity</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.25rem 0' }}>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Current LTV ratio:</span>
                <span style={{ fontWeight: 600 }}>{helocDetails.currentLtvPercent}%</span>
              </div>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Projected LTV ratio:</span>
                <span style={{ fontWeight: 600 }}>{ltvAfterReno.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Legal HELOC Limit (65%):</span>
                <span style={{ fontWeight: 600 }}>${helocDetails.maxHelocLtvAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Borrowing Limit (80%):</span>
                <span style={{ fontWeight: 600 }}>${helocDetails.maxTotalLtvAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between align-center" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>HELOC Capacity Available:</span>
                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                  ${helocDetails.maxAvailableHeloc.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Warning if LTV is too high */}
            {helocDetails.currentLtvPercent > 80 ? (
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <ShieldAlert size={20} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>HELOC Locked</strong>
                  <span style={{ fontSize: '0.75rem' }}>
                    Your current mortgage exceeds 80% of your home's value. You must pay down your mortgage balance to unlock HELOC borrowing.
                  </span>
                </div>
              </div>
            ) : helocDetails.maxAvailableHeloc < renoTotal ? (
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <ShieldAlert size={20} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Insufficient Capacity</strong>
                  <span style={{ fontSize: '0.75rem' }}>
                    Your selected renovation budget (${renoTotal.toLocaleString()}) exceeds your available HELOC borrowing capacity (${helocDetails.maxAvailableHeloc.toLocaleString()}).
                  </span>
                </div>
              </div>
            ) : (
              <div className="alert alert-info" style={{ margin: 0, background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <Sparkles size={20} style={{ color: 'var(--color-success)' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-success)' }}>Equity Verified</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Your property has sufficient equity to cover the planned projects using a HELOC.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Financing Cost Card */}
          <div className="card card-accent">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Financing Cost Estimation</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Cost estimates for borrowing the selected <strong>${renoTotal.toLocaleString()}</strong> budget:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Option A: Interest-Only HELOC */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
                <div className="flex justify-between align-center mb-4">
                  <strong style={{ fontSize: '0.95rem' }}>Interest-Only HELOC</strong>
                  <span className="badge badge-info">{helocRate.toFixed(2)}% Rate</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                  ${borrowingCosts.interestOnlyMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}> / month</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Interest only. The principal balance remains outstanding until repaid in lump sums.
                </p>
              </div>

              {/* Option B: Roll into Mortgage */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
                <div className="flex justify-between align-center mb-4">
                  <strong style={{ fontSize: '0.95rem' }}>Roll into Amortized Mortgage</strong>
                  <span className="badge badge-success">4.75% (20 Yr Refi)</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-success)' }}>
                  ${borrowingCosts.amortizedMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}> / month</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Fully amortized payment. Pays off interest and the principal over a 20-year term.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
