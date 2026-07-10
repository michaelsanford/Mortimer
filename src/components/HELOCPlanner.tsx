import React, { useState, useMemo } from 'react';
import { DollarSign, CheckSquare, Square, ShieldAlert, Sparkles, Plus, Trash2 } from 'lucide-react';
import { calculateHELOC, calculateRegularPayment } from '../utils/mortgageMath';
import { useI18n } from '../utils/i18n';
import { FormattedNumericInput } from './FormattedNumericInput';
import { formatLocaleCurrency, formatLocaleNumber, formatLocalePercent } from '../utils/formatters';

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
  const { t, locale } = useI18n();

  // Financial inputs
  const [homeValue, setHomeValue] = useState<number | ''>(defaultHomeValue || 650000);
  const [mortgageBalance, setMortgageBalance] = useState<number | ''>(defaultBalance || 350000);
  const [helocPrimeRate, setHelocPrimeRate] = useState<number | ''>(5.95); // Canada Prime rate default
  const [helocPremium, setHelocPremium] = useState<number | ''>(0.5); // Prime + 0.5% is standard

  // Custom addition states
  const [customRenoName, setCustomRenoName] = useState<string>('');
  const [customRenoCost, setCustomRenoCost] = useState<number | ''>('');

  // Reno Checklist
  const [renoItems, setRenoItems] = useState<RenoItem[]>([
    { id: 'kitchen', name: t.heloc.kitchen, cost: 35000, selected: false },
    { id: 'bathroom', name: t.heloc.bathroom, cost: 15000, selected: false },
    { id: 'basement', name: t.heloc.basement, cost: 30000, selected: false },
    { id: 'roof', name: t.heloc.roof, cost: 12000, selected: false },
    { id: 'hvac', name: t.heloc.hvac, cost: 15000, selected: false },
    { id: 'landscaping', name: t.heloc.landscaping, cost: 10000, selected: false }
  ]);

  // Toggle selection
  const handleToggleItem = (id: string) => {
    setRenoItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  // Update item field
  const handleUpdateItem = (id: string, field: 'name' | 'cost', value: any) => {
    setRenoItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    setRenoItems(prev => prev.filter(item => item.id !== id));
  };

  // Add custom reno item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRenoName.trim() || customRenoCost === '' || customRenoCost <= 0) return;
    
    const newItem: RenoItem = {
      id: 'custom_' + Date.now(),
      name: customRenoName,
      cost: customRenoCost,
      selected: true
    };
    
    setRenoItems(prev => [...prev, newItem]);
    setCustomRenoName('');
    setCustomRenoCost('');
  };

  // Move item up in the list
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setRenoItems(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  // Move item down in the list
  const handleMoveDown = (index: number) => {
    if (index === renoItems.length - 1) return;
    setRenoItems(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  // Effective parameters for math calculations
  const effHomeValue = homeValue === '' ? 0 : homeValue;
  const effMortgageBalance = mortgageBalance === '' ? 0 : mortgageBalance;
  const effPrimeRate = helocPrimeRate === '' ? 0 : helocPrimeRate;
  const effPremium = helocPremium === '' ? 0 : helocPremium;

  // Calculations
  const helocDetails = useMemo(() => {
    return calculateHELOC({
      homeValue: effHomeValue,
      currentMortgageBalance: effMortgageBalance
    });
  }, [effHomeValue, effMortgageBalance]);

  // Compute prioritized items and funded status
  const prioritizedRenoItems = useMemo(() => {
    let remainingCapacity = helocDetails.maxAvailableHeloc;
    return renoItems.map(item => {
      if (!item.selected) {
        return { ...item, fundingStatus: 'unselected' as const, fundedAmount: 0 };
      }
      if (remainingCapacity <= 0) {
        return { ...item, fundingStatus: 'unfunded' as const, fundedAmount: 0 };
      }
      if (remainingCapacity >= item.cost) {
        remainingCapacity -= item.cost;
        return { ...item, fundingStatus: 'fully_funded' as const, fundedAmount: item.cost };
      } else {
        const funded = remainingCapacity;
        remainingCapacity = 0;
        return { ...item, fundingStatus: 'partially_funded' as const, fundedAmount: funded };
      }
    });
  }, [renoItems, helocDetails.maxAvailableHeloc]);

  const renoTotal = useMemo(() => {
    return renoItems.reduce((sum, item) => item.selected ? sum + item.cost : sum, 0);
  }, [renoItems]);

  const helocRate = effPrimeRate + effPremium;

  // Total LTV after adding Reno to mortgage / HELOC
  const ltvAfterReno = useMemo(() => {
    const totalBorrowing = effMortgageBalance + renoTotal;
    return effHomeValue > 0 ? (totalBorrowing / effHomeValue) * 100 : 0;
  }, [effMortgageBalance, renoTotal, effHomeValue]);

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
        <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t.heloc.title}</h2>
        <p style={{ fontSize: '0.95rem' }}>{t.heloc.subtitle}</p>
      </div>

      <div className="grid-heloc">
        {/* Left Side: Reno Checklist & Equity inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Equity Inputs */}
          <div className="card flex flex-col gap-4">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              {t.heloc.propertyEquity}
            </h3>

            <div className="flex gap-4">
              {/* Home Value */}
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>{t.heloc.homeValue}</span>
                  <span className="form-label-val">{formatLocaleCurrency(homeValue || 0, locale)}</span>
                </label>
                <div className="form-input-wrapper">
                  <DollarSign size={14} className="form-input-prefix" />
                  <FormattedNumericInput 
                    className="form-input form-input-with-prefix" 
                    value={homeValue} 
                    onChange={(val) => setHomeValue(val)}
                  />
                </div>
              </div>

              {/* Balance */}
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>{t.heloc.outstandingMortgage}</span>
                  <span className="form-label-val">{formatLocaleCurrency(mortgageBalance || 0, locale)}</span>
                </label>
                <div className="form-input-wrapper">
                  <DollarSign size={14} className="form-input-prefix" />
                  <FormattedNumericInput 
                    className="form-input form-input-with-prefix" 
                    value={mortgageBalance} 
                    onChange={(val) => setMortgageBalance(val)}
                  />
                </div>
              </div>
            </div>

            {/* HELOC Rates setting */}
            <div className="flex gap-4">
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.heloc.primeRate}</label>
                <FormattedNumericInput 
                  className="form-input" 
                  value={helocPrimeRate} 
                  onChange={(val) => setHelocPrimeRate(val)} 
                  isDecimal={true}
                />
              </div>
              <div className="form-group w-full" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t.heloc.helocPremium}</label>
                <FormattedNumericInput 
                  className="form-input" 
                  value={helocPremium} 
                  onChange={(val) => setHelocPremium(val)} 
                  isDecimal={true}
                />
              </div>
            </div>
          </div>

          {/* Reno Checklist Card */}
          <div className="card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {t.heloc.renoChecklist}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {prioritizedRenoItems.map((item, index) => (
                <div 
                  key={item.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.5rem 0.75rem', 
                    background: item.selected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-badge)', 
                    border: '1px solid', 
                    borderColor: item.selected ? 'var(--color-primary)' : 'var(--border-color)',
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s ease',
                    gap: '0.75rem'
                  }}
                >
                  <div className="flex align-center gap-2" style={{ flexGrow: 1, minWidth: 0 }}>
                    {/* Reorder Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        style={{ padding: '1px 4px', fontSize: '0.65rem', minHeight: 'auto', opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                        title={t.heloc.moveUp}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === prioritizedRenoItems.length - 1}
                        style={{ padding: '1px 4px', fontSize: '0.65rem', minHeight: 'auto', opacity: index === prioritizedRenoItems.length - 1 ? 0.3 : 1, cursor: index === prioritizedRenoItems.length - 1 ? 'not-allowed' : 'pointer' }}
                        title={t.heloc.moveDown}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Checkbox wrapper */}
                    <div 
                      className="heloc-checkbox"
                      onClick={() => handleToggleItem(item.id)} 
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {item.selected ? (
                        <CheckSquare size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      ) : (
                        <Square size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                    </div>
                    {/* Editable Name */}
                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                      <input 
                        type="text" 
                        className="project-name-input"
                        value={item.name} 
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                        style={{ 
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: item.selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: 500,
                          fontSize: '0.9rem',
                          padding: '0.15rem 0',
                          width: '100%',
                          borderBottom: '1px dashed transparent'
                        }}
                        onFocus={(e) => e.target.style.borderBottomColor = 'var(--border-color)'}
                        onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
                      />
                      
                      {item.selected && (
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.1rem 0.35rem', 
                              borderRadius: '0.25rem', 
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              background: 
                                item.fundingStatus === 'fully_funded' ? 'rgba(16, 185, 129, 0.15)' : 
                                item.fundingStatus === 'partially_funded' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: 
                                item.fundingStatus === 'fully_funded' ? 'var(--color-success)' : 
                                item.fundingStatus === 'partially_funded' ? 'var(--color-warning)' : 'var(--color-danger)'
                            }}
                          >
                            {item.fundingStatus === 'fully_funded' ? t.heloc.fullyFunded : 
                             item.fundingStatus === 'partially_funded' ? `${t.heloc.partiallyFunded} (${formatLocaleCurrency(Math.round(item.fundedAmount), locale)})` : t.heloc.unfunded}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {t.heloc.priority} #{index + 1}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex align-center gap-3">
                    {/* Editable Cost */}
                    <div className="flex align-center" style={{ gap: '0.25rem', width: '100px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>$</span>
                      <FormattedNumericInput 
                        value={item.cost} 
                        onChange={(val) => handleUpdateItem(item.id, 'cost', val === '' ? 0 : val)}
                        style={{ 
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-primary)',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          textAlign: 'right',
                          width: '100%',
                          borderBottom: '1px dashed transparent'
                        }}
                        onFocus={(e) => e.target.style.borderBottomColor = 'var(--border-color)'}
                        onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
                      />
                    </div>
                    {/* Delete button */}
                    <button 
                      type="button" 
                      className="heloc-delete-btn"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--color-danger)', 
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Addition Form */}
            <form onSubmit={handleAddCustomItem} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{t.heloc.addCustom}</h4>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  placeholder={t.heloc.projectName} 
                  className="form-input" 
                  style={{ flexGrow: 2 }}
                  value={customRenoName}
                  onChange={(e) => setCustomRenoName(e.target.value)}
                />
                <div className="form-input-wrapper" style={{ flexGrow: 1 }}>
                  <DollarSign size={14} className="form-input-prefix" />
                  <FormattedNumericInput 
                    placeholder={t.heloc.cost} 
                    className="form-input form-input-with-prefix" 
                    value={customRenoCost}
                    onChange={(val) => setCustomRenoCost(val)}
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
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t.heloc.equityCapacity}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.25rem 0' }}>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.heloc.currentLtv}</span>
                <span style={{ fontWeight: 600 }}>{formatLocalePercent(helocDetails.currentLtvPercent, locale)}</span>
              </div>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.heloc.projectedLtv}</span>
                <span style={{ fontWeight: 600 }}>{formatLocalePercent(ltvAfterReno, locale)}</span>
              </div>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.heloc.helocLimit65}</span>
                <span style={{ fontWeight: 600 }}>{formatLocaleCurrency(helocDetails.maxHelocLtvAmount, locale)}</span>
              </div>
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.heloc.borrowingLimit80}</span>
                <span style={{ fontWeight: 600 }}>{formatLocaleCurrency(helocDetails.maxTotalLtvAmount, locale)}</span>
              </div>
              <div className="flex justify-between align-center" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{t.heloc.helocCapacity}</span>
                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                  {formatLocaleCurrency(helocDetails.maxAvailableHeloc, locale)}
                </strong>
              </div>
            </div>

            {/* Warning if LTV is too high */}
            {helocDetails.currentLtvPercent > 80 ? (
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <ShieldAlert size={20} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>{t.heloc.helocLocked}</strong>
                  <span style={{ fontSize: '0.75rem' }}>
                    {t.heloc.helocLockedDesc}
                  </span>
                </div>
              </div>
            ) : helocDetails.maxAvailableHeloc < renoTotal ? (
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <ShieldAlert size={20} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>{t.heloc.insufficientCapacity}</strong>
                  <span style={{ fontSize: '0.75rem' }}>
                    {t.heloc.insufficientCapacityDesc.replace('{budget}', formatLocaleCurrency(renoTotal, locale)).replace('{capacity}', formatLocaleCurrency(helocDetails.maxAvailableHeloc, locale))}
                  </span>
                </div>
              </div>
            ) : (
              <div className="alert alert-info" style={{ margin: 0, background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <Sparkles size={20} style={{ color: 'var(--color-success)' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-success)' }}>{t.heloc.equityVerified}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {t.heloc.equityVerifiedDesc}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Financing Cost Card */}
          <div className="card card-accent">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.heloc.financingCost}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {t.heloc.financingCostDesc.replace('{amount}', formatLocaleCurrency(renoTotal, locale))}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Option A: Interest-Only HELOC */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
                <div className="flex justify-between align-center mb-4">
                  <strong style={{ fontSize: '0.95rem' }}>{t.heloc.interestOnlyHeloc}</strong>
                  <span className="badge badge-info">{formatLocalePercent(helocRate, locale)} {t.heloc.rate}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                  {formatLocaleCurrency(borrowingCosts.interestOnlyMonthly, locale)}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}> {t.heloc.perMonth}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  {t.heloc.interestOnlyNote}
                </p>
              </div>

              {/* Option B: Roll into Mortgage */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
                <div className="flex justify-between align-center mb-4">
                  <strong style={{ fontSize: '0.95rem' }}>{t.heloc.rollIntoMortgage}</strong>
                  <span className="badge badge-success">{t.heloc.refiRate}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-success)' }}>
                  {formatLocaleCurrency(borrowingCosts.amortizedMonthly, locale)}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}> {t.heloc.perMonth}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  {t.heloc.amortizedNote}
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
