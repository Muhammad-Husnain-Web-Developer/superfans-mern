import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { PageLoader } from '../../components/PageLoader';
import {
  BOOTSTRAP4_CDN,
  RANKINGS_FONTS,
  useStandalonePageStyles,
} from '../../components/StandalonePage';
import { localeLogo } from '../auth/AuthShell';

interface RankUser {
  usernameUrl: string;
  profilePicture: string | null;
  noOfFollowers: number;
}

interface LeaguesData {
  superMagic: RankUser[];
  superLeague: RankUser[];
  diamondLeague: RankUser[];
  emeraldLeague: RankUser[];
  goldLeague: RankUser[];
  silverLeague: RankUser[];
  bronzeLeague: RankUser[];
  totalUsers: number;
}

/** Port of the blade's formatFollowers(): 0 | 1.2K | 3.4M | 1.1B (PHP round). */
function formatFollowers(n: number): string {
  const num = Math.trunc(n) || 0;
  if (num === 0) return '0';
  if (num >= 1_000_000_000) return `${Math.round((num / 1_000_000_000) * 10) / 10}B`;
  if (num >= 1_000_000) return `${Math.round((num / 1_000_000) * 10) / 10}M`;
  if (num >= 1000) return `${Math.round((num / 1000) * 10) / 10}K`;
  return String(num);
}

const DEFAULT_AVATAR = 'output-onlinepngtools (2).png';

/** One table row — port of rankings/table.blade.php's <tr>. */
function RankRow({ rank, user }: { rank: number; user: RankUser }) {
  const longName = user.usernameUrl.length > 26;
  return (
    <tr>
      <td>{rank}</td>
      <td>
        <Link className="profile_tag" to={`/${user.usernameUrl}`}>
          <img
            src={assetImage(user.profilePicture ?? DEFAULT_AVATAR)}
            alt="Profile"
            width={40}
            height={40}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <span
            className="mobile-p"
            style={{
              marginBottom: 0,
              width: 'fit-content',
              marginLeft: 10,
              marginRight: 'auto',
              border: '5px solid black',
              color: '#c3c3c3',
              backgroundColor: '#585858',
              fontFamily:
                "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif",
              paddingLeft: 4,
              paddingRight: 7,
              paddingTop: 9,
              paddingBottom: 9,
              fontSize: 14,
              position: 'relative',
              overflowX: 'hidden',
              overflowY: 'hidden',
            }}
          >
            <span className="inline-m" style={{ fontSize: 15, width: 220, position: 'relative', left: 4 }}>
              {longName ? (
                <marquee
                  style={{ position: 'relative', top: 5, width: '99%' }}
                  behavior="scroll"
                  direction="left"
                  scrollAmount={5}
                >
                  {user.usernameUrl}
                </marquee>
              ) : (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      backgroundColor: '#0ed145',
                      display: 'inline-block',
                      marginRight: 5,
                      borderRadius: 30,
                      zIndex: 3,
                      position: 'relative',
                      left: 5,
                      top: 1,
                    }}
                  ></span>{' '}
                  {user.usernameUrl}
                </>
              )}
            </span>
          </span>
          <div
            className="show-on-mobile"
            style={{ display: 'block', fontSize: 15, color: 'gray', marginLeft: '10%' }}
          >
            {formatFollowers(user.noOfFollowers)} Followers
          </div>
        </Link>
      </td>
      <td className="hide-on-mobile">{formatFollowers(user.noOfFollowers)} Followers</td>
    </tr>
  );
}

/** League table — port of rankings/table.blade.php. */
function LeagueTable({ users, children }: { users: RankUser[]; children?: React.ReactNode }) {
  return (
    <div className="table-responsive">
      <table className="table table-striped text-center">
        <thead className="thead-light">
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th className="hide-on-mobile">Followers</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <RankRow key={`${u.usernameUrl}-${i}`} rank={i + 1} user={u} />
          ))}
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Rankings — port of rankings/index.blade.php (/rankings). */
export function Rankings() {
  const { t } = useTranslation('content');
  const { i18n } = useTranslation();
  /* The blade is standalone: Bootstrap 4 CDN + Anton/BBH fonts, no layout CSS.
     Its own <style> blocks (extracted to public/page-css/rankings.css) contain
     global element rules like `p { text-align: center }`, so they must load as a
     page-scoped link — bundling them would leak those rules to every page. */
  useStandalonePageStyles([BOOTSTRAP4_CDN, RANKINGS_FONTS, '/page-css/rankings.css']);
  const [data, setData] = useState<LeaguesData | null>(null);
  const [bronzeExtra, setBronzeExtra] = useState<RankUser[]>([]);
  const [bronzeOffset, setBronzeOffset] = useState(1020);
  const [bronzeDone, setBronzeDone] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    document.title = 'Rankings';
    api
      .get<{ success: boolean; data: LeaguesData }>('/rankings')
      .then((r) => setData(r.data.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!tooltipOpen) return;
    const close = () => setTooltipOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [tooltipOpen]);

  function loadMoreBronze() {
    api
      .get<{ success: boolean; data: RankUser[] }>(`/rankings/bronze?offset=${bronzeOffset}`)
      .then((r) => {
        if (r.status === 204 || r.data.data.length === 0) {
          setBronzeDone(true);
          return;
        }
        setBronzeExtra((prev) => [...prev, ...r.data.data]);
        setBronzeOffset((o) => o + 20);
      })
      .catch(() => setBronzeDone(true));
  }

  if (!data) return <PageLoader />;

  const leagues: [string, string, React.ReactNode, RankUser[]][] = [
    ['superMagic', '🦸🏻‍♀️', <>SUPER&nbsp; LEAGUE <span style={{ fontSize: '0.38em' }}>(Top 11)</span></>, data.superMagic],
    ['superLeague', '🪄', <>MAGIC LEAGUE <span style={{ fontSize: '0.38em' }}>(1st – 50th)</span></>, data.superLeague],
    ['diamondLeague', '💎', <>DIAMOND LEAGUE <span style={{ fontSize: '0.38em' }}>(51st – 150th)</span></>, data.diamondLeague],
    ['emeraldLeague', '', <>EMERALD LEAGUE <span style={{ fontSize: '0.38em' }}>(151st – 250th)</span></>, data.emeraldLeague],
    ['goldLeague', '🏅', <>GOLD LEAGUE (251st – 500th)</>, data.goldLeague],
    ['silverLeague', '🥈', <>SILVER LEAGUE (501st – 1000th)</>, data.silverLeague],
  ];

  return (
    <>
      <PageLoader />
      <div className="container">
        <a href="/">
          <img src={localeLogo(i18n.resolvedLanguage ?? 'en')} alt="Superfans Logo" className="logo" />
        </a>
        <div className="container">
          <h2 id="influencerTitle">
            🏆 {t('rankingtitle', { defaultValue: 'Rankings' })}
            <span
              className={`tooltip-container${tooltipOpen ? ' show' : ''}`}
              style={{ fontSize: 20, position: 'relative', bottom: 5 }}
              onClick={(e) => {
                e.stopPropagation();
                setTooltipOpen((v) => !v);
              }}
            >
              ⓘ
              <span
                className="tooltip-text"
                dangerouslySetInnerHTML={{ __html: t('rank_msg', { defaultValue: '' }) }}
              />
            </span>
          </h2>

          <div className="btn-group" style={{ gap: 10, marginBottom: 10 }}>
            <a href="#top" className="btn-rank btn-all">
              ALL
            </a>
            <a href="#superMagic" className="btn-rank">
              🦸🏻‍♀️
            </a>
            <a href="#superLeague" className="btn-rank">
              🪄
            </a>
            <a href="#diamondLeague" className="btn-rank">
              💎
            </a>
          </div>
          <div className="btn-group" style={{ gap: 10 }}>
            <a href="#emeraldLeague" className="btn-rank">
              <img src={assetImage('emerald.png')} alt="Emerald" style={{ width: 24 }} />
            </a>
            <a href="#goldLeague" className="btn-rank">
              🏅
            </a>
            <a href="#silverLeague" className="btn-rank">
              🥈
            </a>
            <a href="#bronzeLeague" className="btn-rank">
              🥉
            </a>
          </div>
          <br />

          {leagues.map(([id, emoji, title, users]) => (
            <div key={id}>
              <h2 id={id}>
                {id === 'emeraldLeague' ? (
                  <>
                    <img src={assetImage('emerald.png')} alt="Emerald" style={{ width: 24 }} />{' '}
                  </>
                ) : (
                  `${emoji} `
                )}
                {title}
              </h2>
              <LeagueTable users={users} />
              <br />
            </div>
          ))}

          <h2 id="bronzeLeague">🥉 BRONZE LEAGUE (1001st and beyond)</h2>
          <div className="table-responsive">
            <table className="table table-striped text-center">
              <thead className="thead-light">
                <tr>
                  <th>Rank</th>
                  <th>Username</th>
                  <th className="hide-on-mobile">Followers</th>
                </tr>
              </thead>
              <tbody id="bronze-table-body">
                {data.bronzeLeague.map((u, i) => (
                  <RankRow key={`bronze-${u.usernameUrl}-${i}`} rank={i + 1} user={u} />
                ))}
                {/* loaded rows keep the blade's odd numbering: index + (offset - 1020) + 5 */}
                {bronzeExtra.map((u, i) => (
                  <RankRow key={`extra-${u.usernameUrl}-${i}`} rank={(i % 20) + Math.floor(i / 20) * 20 + 5} user={u} />
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            {!bronzeDone && (
              <button id="load-more-bronze" className="btn btn-dark" onClick={loadMoreBronze}>
                SEE HIDDEN USERS
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
