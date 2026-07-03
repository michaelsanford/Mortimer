import React from 'react';
import { Landmark, TrendingDown, Clock, ShieldAlert, Award } from 'lucide-react';
import { calculateAmortization } from '../utils/mortgageMath';
import type { MortgageInputs } from '../utils/mortgageMath';

const calculateRemainingMonths = (maturityDateStr: string) => {
  if (!maturityDateStr) return 36;
  const maturity = new Date(maturityDateStr);
  const today = new Date();
  const diffMonths = (maturity.getFullYear() - today.getFullYear()) * 12 + (maturity.getMonth() - today.getMonth());
  return Math.max(1, diffMonths);
};

interface DashboardProps {
  profile: MortgageInputs | null;
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, onNavigate }) => {
  if (!profile) {
    return (
      <div className="text-center" style={{ padding: '4rem 1.5rem' }}>
        <div className="logo-icon mb-4" style={{ margin: '0 auto', width: '4rem', height: '4rem', borderRadius: '1rem' }}>
          <Landmark size={32} />
        </div>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Welcome to Mortimer</h2>
        <img 
          src="./flag-ca.svg" 
          alt="Canada" 
          style={{ width: '3.5rem', height: '1.75rem', display: 'block', margin: '0 auto 1.25rem', borderRadius: '0.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} 
        />
        <p style={{ maxWidth: '500px', margin: '0 auto 2rem', fontSize: '1.1rem' }}>
           Mortimer runs entirely in your browser with strict local privacy. Configure your current mortgage to unlock your dashboard and explore payment optimization strategies.
        </p>
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={() => onNavigate('paydown')}
        >
          Configure Mortgage Details
        </button>
      </div>
    );
  }

  // Calculate amortization details
  const results = calculateAmortization(profile);
  const totalPrincipal = profile.principal;
  
  // Calculate paid-off details
  // Let's assume the user starts fresh, or we can check the schedule.
  // In our simple dashboard, we show what is planned over the amortization.
  const baseAmortization = calculateAmortization({
    ...profile,
    prepayments: undefined
  });

  const timeSaved = baseAmortization.yearsToPayoff - results.yearsToPayoff;
  const interestSaved = baseAmortization.totalInterestPaid - results.totalInterestPaid;
  
  // Let's compute payment statistics
  const paymentFrequencyLabel = profile.paymentFrequency.replace(/_/g, ' ');

  // Compute a mock current progress (e.g. paid-off percentage based on cumulative principal vs total principal after year 1)
  // Let's look at year 1 progress to display something interesting.
  const ppy = results.schedule.length / results.yearsToPayoff;
  const endOfYear1Idx = Math.min(Math.round(ppy) - 1, results.schedule.length - 1);
  const endOfYear1Bal = endOfYear1Idx >= 0 ? results.schedule[endOfYear1Idx].endingBalance : totalPrincipal;
  const year1PrincipalPaid = totalPrincipal - endOfYear1Bal;
  const year1PaidPercent = Math.min(100, Math.round((year1PrincipalPaid / totalPrincipal) * 100));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>Mortgage Overview</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Here is a summary of your active paydown strategy.</p>
        </div>
        {profile.maturityDate && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Term Maturity: <strong style={{ color: 'var(--text-primary)' }}>{new Date(profile.maturityDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 mb-4">
        {/* Progress Card */}
        <div className="card text-center flex flex-col align-center justify-between" style={{ minHeight: '260px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Year 1 Progress</h3>
          
          <div style={{ position: 'relative', width: '130px', height: '130px', margin: '1rem 0' }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle 
                cx="65" 
                cy="65" 
                r="55" 
                fill="transparent" 
                stroke="rgba(255,255,255,0.05)" 
                strokeWidth="10" 
              />
              <circle 
                cx="65" 
                cy="65" 
                r="55" 
                fill="transparent" 
                stroke="url(#progressGrad)" 
                strokeWidth="10" 
                strokeDasharray={345.5}
                strokeDashoffset={345.5 - (345.5 * year1PaidPercent) / 100}
                strokeLinecap="round"
                transform="rotate(-90 65 65)"
              />
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-primary)" />
                  <stop offset="100%" stopColor="var(--color-secondary)" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              fontFamily: 'var(--font-heading)',
              fontSize: '1.5rem',
              fontWeight: 800
            }}>
              {year1PaidPercent}%
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            Of principal paid off in Year 1
          </p>
        </div>

        {/* Core Stats Card */}
        <div className="card flex flex-col justify-between" style={{ minHeight: '260px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Amortization Stats</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Principal:</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                ${profile.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Interest Rate:</span>
              <span style={{ fontWeight: 600 }}>{profile.interestRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Payment Frequency:</span>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{paymentFrequencyLabel}</span>
            </div>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Regular Payment:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}>
                ${results.schedule[0]?.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Amortized over {profile.amortizationYears} years
          </div>
        </div>

        {/* Savings Card */}
        <div className="card card-accent flex flex-col justify-between" style={{ minHeight: '260px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Optimization Savings</h3>
          
          <div style={{ margin: '1rem 0' }}>
            {timeSaved > 0 || interestSaved > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {timeSaved > 0 && (
                  <div className="flex align-center gap-4">
                    <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-accent)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                      <Clock size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-accent)' }}>
                        {timeSaved.toFixed(1)} Years
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Slipped off mortgage length</div>
                    </div>
                  </div>
                )}
                {interestSaved > 0 && (
                  <div className="flex align-center gap-4">
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                      <TrendingDown size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-success)' }}>
                        ${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saved in interest payments</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center" style={{ padding: '0.5rem 0' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  <Award size={36} style={{ opacity: 0.5, margin: '0 auto 0.5rem' }} />
                </div>
                <p style={{ fontSize: '0.85rem' }}>No prepayments configured yet. Use double-up or lump sum payments to save interest!</p>
              </div>
            )}
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm w-full"
            onClick={() => onNavigate('paydown')}
          >
            Optimize Paydowns
          </button>
        </div>
      </div>

      {/* Original vs Current Parameters Card */}
      {(profile.originalPrincipal || profile.originalAmortizationYears || profile.originalTermYears) ? (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Original vs. Current Progress
          </h3>
          <div className="grid grid-cols-3" style={{ gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Amount Progress */}
            {profile.originalPrincipal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="flex justify-between" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Mortgage Balance</span>
                  <span>{((profile.originalPrincipal - profile.principal) / profile.originalPrincipal * 100).toFixed(1)}% Paid</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
                  ${profile.principal.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>of ${profile.originalPrincipal.toLocaleString()}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, ((profile.originalPrincipal - profile.principal) / profile.originalPrincipal * 100)))}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>
                  Paid Off: ${(profile.originalPrincipal - profile.principal).toLocaleString()}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '60px' }}>
                Original amount tracking not configured.
              </div>
            )}

            {/* Amortization Progress */}
            {profile.originalAmortizationYears ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="flex justify-between" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Amortization Period</span>
                  <span>{profile.originalAmortizationYears - profile.amortizationYears} Yrs Progress</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
                  {profile.amortizationYears} Years <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>of {profile.originalAmortizationYears} Yrs</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, ((profile.originalAmortizationYears - profile.amortizationYears) / profile.originalAmortizationYears * 100)))}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Years Remaining: {profile.amortizationYears}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '60px' }}>
                Original amortization tracking not configured.
              </div>
            )}

            {/* Term Progress */}
            {profile.originalTermYears && profile.maturityDate ? (() => {
              const remainingMonths = calculateRemainingMonths(profile.maturityDate);
              const originalMonths = profile.originalTermYears * 12;
              const elapsedMonths = Math.max(0, originalMonths - remainingMonths);
              const percentElapsed = originalMonths > 0 ? (elapsedMonths / originalMonths * 100) : 0;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="flex justify-between" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>Current Term Progress</span>
                    <span>{percentElapsed.toFixed(0)}% Elapsed</span>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
                    {remainingMonths} Months <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>of {originalMonths} Mos</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, percentElapsed))}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Remaining: {remainingMonths} months ({profile.originalTermYears} Yr term)
                  </div>
                </div>
              );
            })() : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '60px' }}>
                Original term or maturity date not configured.
              </div>
            )}

          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 mt-4">
        {/* Key Recommendations */}
        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            Smart Mortgage Insights
          </h3>
          <ul style={{ paddingLeft: '1.25rem', margin: '1rem 0 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {interestSaved > 0 ? (
              <li style={{ fontSize: '0.95rem' }}>
                <strong className="color-success">Great job!</strong> Your custom prepayments are saving you <strong>${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> in interest charges over the life of your mortgage.
              </li>
            ) : (
              <li style={{ fontSize: '0.95rem' }}>
                Adding a modest annual lump sum of <strong>5%</strong> of your mortgage principal could reduce your amortization length by over <strong>4 years</strong>.
              </li>
            )}
            {!profile.paymentFrequency.includes('accelerated') && (
              <li style={{ fontSize: '0.95rem' }}>
                Switching from regular monthly payments to <strong>Accelerated Bi-Weekly</strong> payments behaves like making 1 extra payment per year, cutting down your mortgage duration by about <strong>2.5 years</strong> without feeling a major budget pinch.
              </li>
            )}
            <li style={{ fontSize: '0.95rem' }}>
              Your current mortgage has a lifetime interest-to-principal ratio of <strong>{((results.totalInterestPaid / totalPrincipal) * 100).toFixed(0)}%</strong>. This means for every dollar borrowed, you pay <strong>${(results.totalInterestPaid / totalPrincipal).toFixed(2)}</strong> in interest.
            </li>
          </ul>
        </div>

        {/* Security / Privacy Card */}
        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            Data Privacy & Regulations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <div className="flex gap-4 align-center">
              <div style={{ color: 'var(--color-primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <Landmark size={24} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>PIPEDA & Quebec Loi 25 Compliant</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mortimer does not collect, track, or share your financial data. Everything remains encrypted inside your browser.</span>
              </div>
            </div>
            <div className="flex gap-4 align-center">
              <div style={{ color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>Disclaimer</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mortimer is a general educational simulator. Calculations may vary slightly from your lender's system. Please consult a qualified mortgage agent before making decisions.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
