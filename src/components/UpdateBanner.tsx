import { RefreshCw } from 'lucide-react';

interface UpdateBannerProps {
  onReload: () => void;
}

/**
 * Slim banner that appears at the top of the page when a new version of the
 * app has been downloaded and is waiting to activate. The user can dismiss it
 * (stay on the current version until the next natural page load) or click
 * "Reload" to activate the update immediately.
 */
export function UpdateBanner({ onReload }: UpdateBannerProps) {
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-banner-content">
        <RefreshCw size={15} className="update-banner-icon" aria-hidden="true" />
        <span>A new version of Mortimer is ready.</span>
        <button
          type="button"
          className="update-banner-btn"
          onClick={onReload}
        >
          Reload now
        </button>
      </div>
    </div>
  );
}
