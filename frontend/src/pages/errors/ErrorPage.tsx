import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localeLogo } from '../auth/AuthShell';
import './error-page.css';

/**
 * The error screens from resources/views/errors/*.blade.php — same logo, same
 * wording, same "Volver" control.
 *
 * The blades link error_pages/css/*, a directory that does not exist in the
 * Laravel public folder, so those pages render in the browser's default serif
 * with a bare blue link. The content is reproduced as-is; the styling is the
 * app's own (Roboto/Montserrat, the red outline button used across the site),
 * which is what the client asked for.
 */
export function ErrorPage({
  title,
  message,
  documentTitle,
}: {
  title: string;
  message: ReactNode;
  documentTitle: string;
}) {
  const { i18n } = useTranslation();
  const { t: tUi } = useTranslation('ui');

  useEffect(() => {
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  return (
    <div className="error-page">
      <a className="error-page-logo-link" href="/">
        <img src={localeLogo(i18n.resolvedLanguage ?? 'en')} alt="Superworld" className="error-page-logo" />
      </a>

      <h2 className="error-page-title">{title}</h2>
      <h3 className="error-page-message">{message}</h3>

      <button type="button" className="error-page-back" onClick={() => window.history.go(-1)}>
        {tUi('go_back_label')}
      </button>

      <hr className="error-page-rule" />
    </div>
  );
}

/** errors/404.blade.php */
export function NotFoundPage() {
  return (
    <ErrorPage
      documentTitle="Superfans | 404 Not Found"
      title="404 Not Found"
      /* the blade's second line, "El servidor no encontró la ruta requerida",
         is dropped at the client's request */
      message="¡Ups! La página o perfil de usuario que estabas buscando no ha sido encontrada."
    />
  );
}

/** errors/419.blade.php — the session the blade calls "caducada" */
export function PageExpiredPage() {
  const { t: tUi } = useTranslation('ui');
  return (
    <ErrorPage
      documentTitle="Superfans | Page Expired"
      title={tUi('page_expired_title')}
      message={
        <>
          Superworld es una red social protegida, por seguridad las páginas caducan muy rápido.
          <br />
          <br />
          {tUi('login_again')}
        </>
      }
    />
  );
}

/** errors/403.blade.php — the business-only ad screen */
export function AdNotAvailablePage() {
  const { t: tUi } = useTranslation('ui');
  return (
    <ErrorPage
      documentTitle="Superfans | Ad not available"
      title={tUi('ad_not_available')}
      message="🏢 This ad is only available to businesses."
    />
  );
}
