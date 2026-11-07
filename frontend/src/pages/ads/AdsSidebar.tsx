import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { SwAdsLoader } from '../../components/SwAdsLoader';
import { SuperAdsMobileNotice } from '../../components/SuperAdsMobileNotice';
import { AdsFlipLogo } from '../../components/FlipLogo';

/** Fixed left nav for the Super-Ads area — port of resources/views/ads/sidebar.blade.php. */
export function AdsSidebar({
  active,
  onLoaderComplete,
}: {
  active?: 'center' | 'my-ads' | 'clients' | 'info' | 'more-tools';
  onLoaderComplete?: () => void;
}) {
  const { user } = useAuth();
  const [modal, setModal] = useState<null | 'search' | 'config' | 'help'>(null);

  return (
    <div className="ads-sidebar">
      {/* the blade puts the loading screen at the head of the sidebar partial */}
      <SwAdsLoader onComplete={onLoaderComplete} />
      <center>
        <Link className="side_logo" to="/super-ads">
          {/* the heading turns with the banner, so it lives inside the card */}
          <AdsFlipLogo />
        </Link>
      </center>

      <div className="upper-links">
        <Link to="/super-ads" className={active === 'center' ? 'active' : undefined}>Create Campaign</Link>
        <Link to="/super-ads/my-ads" className={active === 'my-ads' ? 'active' : undefined}>My Ads</Link>
        <a href="#" onClick={(e) => { e.preventDefault(); setModal('search'); }}> Locations</a>
        <Link to="/super-ads/potential-clients" className={active === 'clients' ? 'active' : undefined}>Potential Clients</Link>
        <Link to="/super-ads/information" className={active === 'info' ? 'active' : undefined}>Inform Ads</Link>
        <Link to="/super-ads/more-tools" className={active === 'more-tools' ? 'active' : undefined}> More Tools</Link>
      </div>

      <div className="footer-links">
        <a href="#" onClick={(e) => { e.preventDefault(); setModal('search'); }}>🔍 Search</a>
        <a href="#" onClick={(e) => { e.preventDefault(); setModal('config'); }}>⚙️ Configuration</a>
        <a href="#" onClick={(e) => { e.preventDefault(); setModal('help'); }}>❓ Help</a>
      </div>

      {/* David, 5 Oct 2026: "Change logout button per our logout button (smaller)." The
          blade's own sidebar has this as a fourth plain-text row too (sidebar.blade.php:173,
          "⏻ Logout") — this is his own deviation, not a porting gap. "Our logout button" is
          the round red power-off circle every other sidebar already carries
          (ProfileSidebar.tsx's `.power-btn`, from parity.css) — `ads-power-btn` here is that
          same shape sized down, since he asked for smaller than the 35px original. */}
      <div className="ads-power-btn-row">
        <Link className="btn btn-danger power-btn ads-power-btn" to="/business/logout" title="Logout">
          <i className="fa fa-power-off" aria-hidden="true"></i>
        </Link>
      </div>

      {modal && <AdsModal type={modal} user={user} onClose={() => setModal(null)} />}

      {/* The purple "use a computer" notice the client asked for — shown once per
          browser session on any Super Ads page when the screen is a phone. It
          portals to <body> itself, so its place here is only for readability. */}
      <SuperAdsMobileNotice />
    </div>
  );
}

/** The three sidebar utility modals (Search "Under Development", Configuration account info, Help). */
function AdsModal({
  type,
  user,
  onClose,
}: {
  type: 'search' | 'config' | 'help';
  user: ReturnType<typeof useAuth>['user'];
  onClose: () => void;
}) {
  const { t: tUi } = useTranslation('ui');
  const titles = { search: '🔍 Search', config: '⚙️ Configuration', help: '❓ Help' } as const;

  return createPortal(
    <>
      <div className="modal-backdrop fade show" style={{ display: 'block', zIndex: 10400 }} onClick={onClose}></div>
      <div className="modal fade show" tabIndex={-1} role="dialog" style={{ display: 'block', zIndex: 10500 }}>
        <div className="modal-dialog" role="document" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{titles[type]}</h5>
              <button type="button" className="close" onClick={onClose} aria-label={tUi('close')}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            {type === 'search' && (
              <div className="modal-body" style={{ textAlign: 'center', padding: 30 }}>
                <h4>⚙️ Under Development</h4>
                <p style={{ marginTop: 15, color: '#666' }}>This feature is currently being developed.</p>
                <p style={{ color: '#666' }}>Stay tuned for upcoming updates!</p>
              </div>
            )}

            {type === 'config' && (
              <div className="modal-body">
                <h6 style={{ marginBottom: 15 }}>📋 Account Information</h6>
                <div style={{ background: '#f8f9fa', padding: 15, borderRadius: 5 }}>
                  <p style={{ marginBottom: 10 }}><strong>Account Name:</strong> {user?.name ?? 'N/A'}</p>
                  <p style={{ marginBottom: 10 }}><strong>Email:</strong> {user?.email ?? 'N/A'}</p>
                  <p style={{ marginBottom: 10 }}><strong>Username:</strong> {user?.usernameUrl ?? 'N/A'}</p>
                  <p style={{ marginBottom: 10 }}><strong>Account Type:</strong> {user?.role ?? 'User'}</p>
                  <p style={{ marginBottom: 0 }}><strong>Member Since:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A'}</p>
                </div>
              </div>
            )}

            {type === 'help' && (
              <div className="modal-body" style={{ textAlign: 'center' }}>
                <h5 style={{ marginBottom: 20 }}>📞 Contact Support</h5>
                <div style={{ background: '#f8f9fa', padding: 20, borderRadius: 5, textAlign: 'left' }}>
                  <p style={{ marginBottom: 15 }}><strong>📧 Email:</strong> <a href="mailto:superfansworldapp@gmail.com">superfansworldapp@gmail.com</a></p>
                  <p style={{ marginBottom: 15 }}><strong>📞 Phone:</strong> +34 610 607 896</p>
                  <hr />
                  <p style={{ marginBottom: 10 }}><strong>🕐 Office Hours:</strong></p>
                  <ul style={{ paddingLeft: 20, color: '#666' }}>
                    <li>Monday to Friday: 8AM to 11PM</li>
                    <li>Saturdays: 9AM to 14:00PM</li>
                  </ul>
                </div>
                <p style={{ marginTop: 15, color: '#666' }}>We're here to help! Don't hesitate to reach out.</p>
              </div>
            )}

            {/* <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div> */}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
