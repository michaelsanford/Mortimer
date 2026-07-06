import React, { useMemo, useState } from 'react';
import { Landmark, TrendingDown, Clock, ShieldAlert, Award } from 'lucide-react';
import { calculateAmortization, calculateRemainingMonths } from '../utils/mortgageMath';
import type { MortgageInputs } from '../utils/mortgageMath';
import { useI18n } from '../utils/i18n';

interface DashboardProps {
  profile: MortgageInputs | null;
  onNavigate: (tab: string) => void;
  onSaveProfile: (profile: MortgageInputs) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, onNavigate, onSaveProfile }) => {
  const { t } = useI18n();

  // Onboarding Tour states
  const [onboardingMode, setOnboardingMode] = useState<'welcome' | 'tour'>('welcome');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [tourBalance, setTourBalance] = useState<number>(450000);
  const [tourRate, setTourRate] = useState<number>(4.85);
  const [tourAmortYears, setTourAmortYears] = useState<number>(25);
  const [tourAmortMonths, setTourAmortMonths] = useState<number>(0);
  const [tourFreq, setTourFreq] = useState<'monthly' | 'semi_monthly' | 'regular_bi_weekly' | 'accelerated_bi_weekly' | 'regular_weekly' | 'accelerated_weekly'>('monthly');

  // Amortization is recomputed only when the profile changes, not on every render.
  // Hooks must run unconditionally, so these are computed above the null-profile guard.
  const results = useMemo(
    () => (profile ? calculateAmortization(profile) : null),
    [profile]
  );
  const baseAmortization = useMemo(
    () => (profile ? calculateAmortization({ ...profile, prepayments: undefined }) : null),
    [profile]
  );

  if (!profile) {
    if (onboardingMode === 'welcome') {
      return (
        <div className="text-center" style={{ padding: '4rem 1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
          <div className="logo-icon mb-4" style={{ margin: '0 auto', width: '4rem', height: '4rem', borderRadius: '1rem' }}>
            <Landmark size={32} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{t.dashboard.welcome}</h2>
          <img 
            src="./flag-ca.svg" 
            alt={t.dashboard.canada} 
            style={{ width: '3.5rem', height: '1.75rem', display: 'block', margin: '0 auto 1.25rem', borderRadius: '0.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} 
          />
          <p style={{ maxWidth: '500px', margin: '0 auto 2rem', fontSize: '1.1rem' }}>
             {t.dashboard.privacyIntro}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={() => setOnboardingMode('tour')}
            >
              {t.dashboard.startTour}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => onNavigate('paydown')}
            >
              {t.dashboard.skipTour}
            </button>
          </div>
        </div>
      );
    }

    const totalSteps = 4;
    const handleNext = () => {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        onSaveProfile({
          principal: tourBalance,
          interestRate: tourRate,
          amortizationYears: tourAmortYears,
          amortizationMonths: tourAmortMonths,
          paymentFrequency: tourFreq,
        });
      }
    };

    const handlePrev = () => {
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
      }
    };

    return (
      <div style={{ maxWidth: '550px', margin: '2rem auto', animation: 'fadeIn 0.3s ease-out' }}>
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t.dashboard.tourTitle}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t.dashboard.stepLabel.replace('{current}', String(currentStep)).replace('{total}', String(totalSteps))}
            </span>
          </div>

          <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
            <div style={{ width: `${(currentStep / totalSteps) * 100}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
          </div>

          <div style={{ minHeight: '180px', marginBottom: '2rem' }}>
            {currentStep === 1 && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.dashboard.step1Title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{t.dashboard.step1Desc}</p>
                <div className="form-group">
                  <div className="form-input-wrapper" style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>$</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ paddingLeft: '2rem' }}
                      value={tourBalance} 
                      onChange={(e) => setTourBalance(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.dashboard.step2Title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{t.dashboard.step2Desc}</p>
                <div className="form-group">
                  <div className="form-input-wrapper" style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      style={{ paddingRight: '2rem' }}
                      value={tourRate} 
                      onChange={(e) => setTourRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>%</span>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.dashboard.step3Title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{t.dashboard.step3Desc}</p>
                <div className="flex gap-4">
                  <div className="form-group w-full">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.paydown.years}</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={tourAmortYears} 
                      onChange={(e) => setTourAmortYears(Math.max(1, parseInt(e.target.value) || 25))}
                    />
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{t.paydown.months}</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={tourAmortMonths} 
                      onChange={(e) => setTourAmortMonths(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t.dashboard.step4Title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{t.dashboard.step4Desc}</p>
                <div className="form-group">
                  <select 
                    className="form-select" 
                    value={tourFreq} 
                    onChange={(e) => setTourFreq(e.target.value as any)}
                  >
                    <option value="monthly">{t.paydown.monthly}</option>
                    <option value="semi_monthly">{t.paydown.semiMonthly}</option>
                    <option value="regular_bi_weekly">{t.paydown.biWeekly}</option>
                    <option value="accelerated_bi_weekly">{t.paydown.accBiWeekly}</option>
                    <option value="regular_weekly">{t.paydown.weekly}</option>
                    <option value="accelerated_weekly">{t.paydown.accWeekly}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handlePrev}
              disabled={currentStep === 1}
              style={{ opacity: currentStep === 1 ? 0.3 : 1 }}
            >
              {t.dashboard.prevStep}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setOnboardingMode('welcome')}
              >
                {t.dashboard.skipTour}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleNext}
              >
                {currentStep === totalSteps ? t.dashboard.completeTour : t.dashboard.nextStep}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // profile is non-null past the guard above, so the memoized results are too.
  if (!results || !baseAmortization) return null;

  const totalPrincipal = profile.principal;

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

  const hasOriginalPrincipal = !!(profile.originalPrincipal && profile.originalPrincipal > 0);
  const overallPaidPercent = hasOriginalPrincipal
    ? Math.min(100, Math.max(0, ((profile.originalPrincipal! - profile.principal) / profile.originalPrincipal!) * 100))
    : year1PaidPercent;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t.dashboard.mortgageOverview}</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{t.dashboard.overviewDesc}</p>
        </div>
        {profile.maturityDate && (
          <div style={{ background: 'var(--bg-badge)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t.dashboard.termMaturity} <strong style={{ color: 'var(--text-primary)' }}>{new Date(profile.maturityDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 mb-4">
        {/* Progress Card */}
        <div className="card text-center flex flex-col align-center justify-between" style={{ minHeight: '260px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {hasOriginalPrincipal ? t.dashboard.overallProgress : t.dashboard.year1Progress}
          </h3>
          
          <div style={{ position: 'relative', width: '130px', height: '130px', margin: '1rem 0' }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle 
                cx="65" 
                cy="65" 
                r="55" 
                fill="transparent" 
                stroke="var(--progress-track)" 
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
                strokeDashoffset={345.5 - (345.5 * overallPaidPercent) / 100}
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
              {overallPaidPercent.toFixed(1)}%
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {hasOriginalPrincipal ? t.dashboard.ofOriginalPaid : t.dashboard.ofYear1Paid}
          </p>
        </div>

        {/* Core Stats Card */}
        <div className="card flex flex-col justify-between" style={{ minHeight: '260px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{t.dashboard.amortizationStats}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.dashboard.principal}</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                ${profile.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.dashboard.interestRate}</span>
              <span style={{ fontWeight: 600 }}>{profile.interestRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.dashboard.paymentFrequency}</span>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{paymentFrequencyLabel}</span>
            </div>
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.dashboard.regularPayment}</span>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}>
                ${results.schedule[0]?.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {profile.householdIncome ? (
              <div className="flex justify-between align-center">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.dashboard.householdIncome}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                  ${profile.householdIncome.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>({profile.incomeType === 'net' ? t.dashboard.incomeNet : t.dashboard.incomeGross})</span>
                </span>
              </div>
            ) : null}
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t.dashboard.amortizedOver} {profile.amortizationYears} {profile.amortizationYears !== 1 ? t.dashboard.years : t.dashboard.year}{profile.amortizationMonths ? ` ${t.dashboard.and} ${profile.amortizationMonths} ${profile.amortizationMonths !== 1 ? t.dashboard.months : t.dashboard.month}` : ''}
          </div>
        </div>

        {/* Savings Card */}
        <div className="card card-accent flex flex-col justify-between" style={{ minHeight: '260px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>{t.dashboard.optimizationSavings}</h3>
          
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
                        {timeSaved.toFixed(1)} {t.dashboard.years}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.dashboard.yearsSlipped}</div>
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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.dashboard.savedInInterest}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center" style={{ padding: '0.5rem 0' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  <Award size={36} style={{ opacity: 0.5, margin: '0 auto 0.5rem' }} />
                </div>
                <p style={{ fontSize: '0.85rem' }}>{t.dashboard.noPrepayments}</p>
              </div>
            )}
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm w-full"
            onClick={() => onNavigate('paydown')}
          >
            {t.dashboard.optimizePaydowns}
          </button>
        </div>
      </div>

      {/* Original vs Current Parameters Card */}
      {(profile.originalPrincipal || profile.originalAmortizationYears || profile.originalTermYears) ? (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            {t.dashboard.originalVsCurrent}
          </h3>
          <div className="grid grid-cols-3" style={{ gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Amount Progress */}
            {profile.originalPrincipal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="flex justify-between" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>{t.dashboard.mortgageBalance}</span>
                  <span>{((profile.originalPrincipal - profile.principal) / profile.originalPrincipal * 100).toFixed(1)}{t.dashboard.percentPaid}</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
                  ${profile.principal.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>{t.dashboard.of} ${profile.originalPrincipal.toLocaleString()}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, ((profile.originalPrincipal - profile.principal) / profile.originalPrincipal * 100)))}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>
                  {t.dashboard.paidOff} ${(profile.originalPrincipal - profile.principal).toLocaleString()}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '60px' }}>
                {t.dashboard.originalNotConfigured}
              </div>
            )}

            {/* Amortization Progress */}
            {profile.originalAmortizationYears ? (() => {
              const originalTotalMonths = (profile.originalAmortizationYears || 0) * 12 + (profile.originalAmortizationMonths || 0);
              const remainingTotalMonths = profile.amortizationYears * 12 + (profile.amortizationMonths || 0);
              const elapsedTotalMonths = Math.max(0, originalTotalMonths - remainingTotalMonths);
              const percentElapsed = originalTotalMonths > 0 ? (elapsedTotalMonths / originalTotalMonths * 100) : 0;
              
              const elapsedYears = Math.floor(elapsedTotalMonths / 12);
              const elapsedMonths = elapsedTotalMonths % 12;

              const displayRemaining = `${profile.amortizationYears} ${profile.amortizationYears !== 1 ? t.dashboard.yrs : t.dashboard.yr}` + (profile.amortizationMonths ? `, ${profile.amortizationMonths} ${profile.amortizationMonths !== 1 ? t.dashboard.mos : t.dashboard.mo}` : '');
              const displayOriginal = `${profile.originalAmortizationYears} ${profile.originalAmortizationYears !== 1 ? t.dashboard.yrs : t.dashboard.yr}` + (profile.originalAmortizationMonths ? `, ${profile.originalAmortizationMonths} ${profile.originalAmortizationMonths !== 1 ? t.dashboard.mos : t.dashboard.mo}` : '');

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="flex justify-between" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{t.dashboard.amortizationProgress}</span>
                    <span>{elapsedYears} {elapsedYears !== 1 ? t.dashboard.yrs : t.dashboard.yr}{elapsedMonths > 0 ? `, ${elapsedMonths} ${elapsedMonths !== 1 ? t.dashboard.mos : t.dashboard.mo}` : ''} {t.dashboard.elapsed}</span>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
                    {displayRemaining} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>{t.dashboard.of} {displayOriginal}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, percentElapsed))}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {t.dashboard.amortizationRemaining} {displayRemaining}
                  </div>
                </div>
              );
            })() : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '60px' }}>
                {t.dashboard.originalAmortNotConfigured}
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
                    <span>{t.dashboard.currentTermProgress}</span>
                    <span>{percentElapsed.toFixed(0)}{t.dashboard.percentElapsed}</span>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
                    {remainingMonths} {t.dashboard.months} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>{t.dashboard.of} {originalMonths} {t.dashboard.mos}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, percentElapsed))}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {t.dashboard.remaining} {remainingMonths} {t.dashboard.months} ({profile.originalTermYears} {t.dashboard.yrTerm})
                  </div>
                </div>
              );
            })() : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '60px' }}>
                {t.dashboard.originalTermNotConfigured}
              </div>
            )}

          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 mt-4">
        {/* Key Recommendations */}
        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            {t.dashboard.smartInsights}
          </h3>
          <ul style={{ paddingLeft: '1.25rem', margin: '1rem 0 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {interestSaved > 0 ? (
              <li style={{ fontSize: '0.95rem' }}>
                <strong className="color-success">{t.dashboard.greatJob}</strong> {t.dashboard.savingInterest.replace('${amount}', interestSaved.toLocaleString(undefined, { maximumFractionDigits: 2 }))}
              </li>
            ) : (
              <li style={{ fontSize: '0.95rem' }}>
                {t.dashboard.lumpSumTip} <strong>{t.dashboard.ofPrincipal}</strong> <strong>{t.dashboard.fourYears}</strong>.
              </li>
            )}
            {!profile.paymentFrequency.includes('accelerated') && (
              <li style={{ fontSize: '0.95rem' }}>
                {t.dashboard.accBiWeeklyTip} <strong>{t.dashboard.accBiWeekly}</strong> {t.dashboard.accBiWeeklyDesc} <strong>{t.dashboard.twoPointFiveYears}</strong> {t.dashboard.withoutBudgetPinch}
              </li>
            )}
            <li style={{ fontSize: '0.95rem' }}>
              {t.dashboard.interestRatio} <strong>{((results.totalInterestPaid / totalPrincipal) * 100).toFixed(0)}%</strong>. {t.dashboard.meansForEveryDollar.replace('${amount}', (results.totalInterestPaid / totalPrincipal).toFixed(2))}
            </li>
          </ul>
        </div>

        {/* Security / Privacy Card */}
        <div className="card">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            {t.dashboard.dataPrivacy}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <div className="flex gap-4 align-center">
              <div style={{ color: 'var(--color-primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <Landmark size={24} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>{t.dashboard.pipedaLoi25}</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.dashboard.privacyDesc}</span>
              </div>
            </div>
            <div className="flex gap-4 align-center">
              <div style={{ color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>{t.dashboard.disclaimerTitle}</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.dashboard.disclaimerText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
