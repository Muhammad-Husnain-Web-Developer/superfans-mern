import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { localeLogo } from './AuthShell';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { postLoginPath } from '../../utils/postLoginRedirect';
import './interests.css';

/**
 * INTERESTS — the screen that follows registration.
 *
 * David, 30 Sep 2026: "Add in Database users: interests (categories) / In WORLD we will
 * post only the interests of the people / But for the moment, add only this Screen after
 * register." So this screen and the field behind it are built; the WORLD filter he
 * describes is not, and nothing here assumes it yet.
 *
 * Laravel has no equivalent — there is no blade to match and the layout follows his
 * mockup: the locale's Supermundo logo, the question in quotes, the chips wrapped in
 * rows, and one dark Continuar button at the bottom right.
 *
 * What is stored is the slug, never the label on the chip. The labels are translated
 * into ten languages, so storing them would file a Spanish account under 'Fútbol' and
 * an English one under 'Football' — two names for one interest, which the feed filter
 * David is planning could not reconcile.
 *
 * Choosing nothing is allowed: Continuar saves an empty list and moves on. The screen
 * asks a favour, it does not hold the account hostage for an answer.
 */
const SLUGS = [
  'influencers', 'modelling', 'technology', 'luxury', 'youtuber',
  'food', 'tiktoker', 'football', 'music', 'trends', 'cinema',
  'sports', 'cars', 'animals', 'motorbikes', 'gamer', 'fitness',
  'travel', 'landscapes', 'racing', 'makeup', 'celebrities',
  'streamers', 'fashion', 'tutorials', 'conspiracies', 'popular_boys',
  'health', 'finance', 'popular_girls',
];

export function Interests() {
  /* the auth pages are standalone — Bootstrap 4 from the CDN, as AuthShell does, or the
     local Bootstrap 3 halves every rem on the page */
  useStandalonePageStyles([BOOTSTRAP4_CDN]);

  const { t: tUi } = useTranslation('ui');
  const { i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [picked, setPicked] = useState<string[]>(user?.interests ?? []);
  const [saving, setSaving] = useState(false);

  function toggle(slug: string) {
    setPicked((list) =>
      list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug],
    );
  }

  async function onContinue() {
    setSaving(true);
    try {
      const { data } = await api.patch<{ data: Parameters<typeof setUser>[0] }>(
        '/me/settings',
        { interests: picked },
      );
      if (data.data) setUser(data.data);
    } catch {
      /* The answer is a preference, not a gate. If the save fails the reader should
         still land on their wall rather than be stranded on a screen they cannot get
         past; they can set the same thing later from the control panel. */
    } finally {
      setSaving(false);
      navigate(postLoginPath(user?.role), { replace: true });
    }
  }

  return (
    <div className="interests-page">
      <img
        className="interests-logo"
        src={localeLogo(i18n.resolvedLanguage ?? 'en')}
        alt=""
      />

      <div className="interests-body">
        <h1 className="interests-title">{tUi('interests_title')}</h1>

        <div className="interests-chips">
          {SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              aria-pressed={picked.includes(slug)}
              className={`interests-chip${picked.includes(slug) ? ' is-picked' : ''}`}
              onClick={() => toggle(slug)}
            >
              {tUi(`interests.${slug}`)}
            </button>
          ))}
        </div>

        <div className="interests-actions">
          <button
            type="button"
            className="interests-continue"
            onClick={() => void onContinue()}
            disabled={saving}
          >
            ✨ {tUi('interests_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
