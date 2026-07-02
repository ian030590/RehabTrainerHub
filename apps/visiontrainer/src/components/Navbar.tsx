import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { downloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { useActiveUser } from '../utils/useActiveUser';
import { useT } from '../i18n';

const navLinkClass = ({ isActive }: { isActive: boolean }) => `navbar-link ${isActive ? 'active' : ''}`;
const logoStyle = { width: 'auto', objectFit: 'contain' } as const;

export function Navbar() {
  const { t } = useT();
  const user = useActiveUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloadingScores, setIsDownloadingScores] = useState(false);

  const toggleMenu = () => setIsOpen((open) => !open);
  const closeMenu = () => setIsOpen(false);
  const handleDownloadScores = async () => {
    if (isDownloadingScores) return;

    setIsDownloadingScores(true);
    try {
      const downloaded = await downloadAllTrainingRecordsCsv(t);
      if (!downloaded) {
        window.alert(t('nav.noScores'));
      }
      closeMenu();
    } catch (error) {
      console.error('Unable to download training scores.', error);
      window.alert(t('nav.scoresDownloadError'));
    } finally {
      setIsDownloadingScores(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand" onClick={closeMenu}>
          <img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="Vision Trainer Logo" height="22" style={logoStyle} />
          {t('nav.brand')}
        </NavLink>

        <button className="navbar-toggle" onClick={toggleMenu} aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        <div className={`navbar-menu ${isOpen ? 'is-open' : ''}`}>
          <div className="navbar-links">
            <NavLink
              to="/"
              end
              className={navLinkClass}
              onClick={closeMenu}
            >
              {t('nav.trainingList')}
            </NavLink>
            <NavLink
              to="/assessment"
              className={navLinkClass}
              onClick={closeMenu}
            >
              {t('nav.assessment')}
            </NavLink>
            <NavLink
              to="/settings"
              className={navLinkClass}
              onClick={closeMenu}
            >
              {t('nav.settings')}
            </NavLink>
            <NavLink
              to="/credits"
              className={navLinkClass}
              onClick={closeMenu}
            >
              {t('nav.credits')}
            </NavLink>
            <NavLink
              to="/links"
              className={navLinkClass}
              onClick={closeMenu}
            >
              {t('nav.links')}
            </NavLink>
          </div>

          <div className="navbar-tools">
            <div className="navbar-records">
              <button
                type="button"
                className="btn btn-primary btn-sm navbar-download-btn"
                onClick={handleDownloadScores}
                disabled={isDownloadingScores}
                aria-busy={isDownloadingScores}
              >
                {t('nav.downloadScores')}
              </button>
              <span className="navbar-backup-reminder">{t('nav.scoresBackupReminder')}</span>
            </div>

            <div className="navbar-user">
              {user ? (
                <>
                  <span className="navbar-user-dot" />
                  <span>{user}</span>
                </>
              ) : (
                <span style={{ color: 'var(--warning)' }}>{t('nav.noUser')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {isOpen && <div className="navbar-overlay" onClick={closeMenu} />}
    </nav>
  );
}
