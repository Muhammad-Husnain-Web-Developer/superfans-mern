import { Fragment, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useScrollMemory } from '../../utils/useScrollMemory';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { fetchProfile, fetchProfilePosts, type ProfileData, type ProfilePost } from '../../api/profiles';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { observeNewVideos } from '../../utils/video';
import { useAuth } from '../../context/AuthContext';
import { GuestHeader, ProfileSidebar } from './ProfileSidebar';
import { VolumeButton } from '../../components/VolumeButton';
import { useRegisterModal } from '../../components/RegisterModal';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { Bio, EarnSection, PostItem, ProfilePageFooter } from './Profile';
import { AddPostHost } from './AddPostHost';
import { ControlPanelHost } from './ControlPanelHost';
import '../../styles/profile-page.css';
import '../../styles/posts-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';

interface FeedAd {
  id: number;
  media: string;
  link: string;
}

/** "Super Ads" tile injected after every 21st post (user_posts.blade.php). */
function AdItem({ ad }: { ad: FeedAd }) {
  const { t: tUi } = useTranslation('ui');
  const frame: React.CSSProperties = { borderRadius: 26, border: '7px solid lightgray', width: '100%' };
  return (
    <div className="work-item">
      <a href={ad.link} target="_blank" rel="noreferrer">
        <p className="feed_posts_heading_p" style={{ position: 'relative', width: '70%', margin: 'auto' }}>
          <span>Super Ads</span>
        </p>
        {isVideoFile(ad.media) ? (
          <div className="video-wrapper" style={{ position: 'relative', width: '100%' }}>
            <video
              className="autoplay-video"
              id={`video-ad-${ad.id}`}
              style={{ maxWidth: '100%', ...frame }}
              loop
              muted
              playsInline
            >
              <source src={assetImage(ad.media)} type={videoMime(ad.media)} />
            </video>
            <VolumeButton videoId={`video-ad-${ad.id}`} />
          </div>
        ) : (
          <img src={assetImage(ad.media)} alt={tUi('alt_ad')} className="img-responsive" style={frame} />
        )}
      </a>
    </div>
  );
}

/**
 * All-posts page —Â port of user_posts.blade.php (/posts/:usernameUrl).
 * Same sidebar as the wall; header without cover (gray-bordered avatar),
 * full grid with an ad tile after every 21st post.
 */
export function Posts() {
  useLayoutPageStyles();
  /* /user/posts and /influencer/posts show the viewer's own posts and carry no
     param, exactly as Laravel serves those URLs. */
  const { usernameUrl: routeUsername } = useParams();
  const { t: tUi } = useTranslation('ui');
  /* AddPostModal sends the poster here with a fresh stamp. Without it, adding a post while
     already on this page would navigate to the route it is already on, and nothing would
     refetch — the new post would need a manual reload, which is the complaint. */
  const { state: navState } = useLocation();
  const postAdded = (navState as { postAdded?: number } | null)?.postAdded;
  const { t } = useTranslation('content');
  const { user: authUser } = useAuth();
  const usernameUrl = routeUsername ?? authUser?.usernameUrl ?? '';
  const registerModal = useRegisterModal();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [ads, setAds] = useState<FeedAd[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [addPostOpen, setAddPostOpen] = useState(false);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  /* come back from the viewer beside the post that was opened, not at the top */
  useScrollMemory(state === 'ok' && posts.length > 0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([
      fetchProfile(usernameUrl),
      fetchProfilePosts(usernameUrl),
      api
        .get<{ success: boolean; data: FeedAd[] }>('/ads/random?count=5')
        .then((r) => r.data.data)
        .catch(() => [] as FeedAd[]),
    ])
      .then(([p, ps, adList]) => {
        if (cancelled) return;
        setProfile(p);
        setPosts(ps);
        setAds(adList);
        setState('ok');
        document.title = `Superfans | ${p.usernameUrl}`;
      })
      .catch(() => {
        if (!cancelled) setState('notfound');
      });
    return () => {
      cancelled = true;
    };
  }, [usernameUrl, postAdded]);

  /* observer-driven playback for grid videos (blade parity) */
  useEffect(() => {
    observeNewVideos();
  }, [posts]);

  if (state === 'loading') return null;
  if (state === 'notfound' || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: '20vh 20px', fontFamily: 'Roboto, sans-serif' }}>
        <h1 style={{ fontSize: '4em', color: '#da1212' }}>404</h1>
        <p>{tUi('not_found')}</p>
      </div>
    );
  }

  const isOwner = authUser?.usernameUrl === profile.usernameUrl;
  /* Access rule from user_posts.blade: the owner sees all; otherwise a post is locked
     (blue24) only when it is hidden (visible==0) AND the viewer lacks access — access
     means subscribed (influencer profile) or following (fan profile). Guests have no
     access, so for them hidden posts lock and visible posts show. */
  const viewerHasAccess = profile.role === 'influencer' ? profile.viewerSubscribed : profile.viewerFollowing;
  let adIndex = 0;

  return (
    <div id="fh5co-page">
      <PageLoader />
      <NavToggle />
      <MobileFooterMenu />

      {/* header sits at page level, exactly like the blade's @include before @yield */}
      <GuestHeader usernameUrl={profile.usernameUrl} />

      {/* the sidebar's own menu items — without these two the Add Post and Control Panel
          entries called nothing at all on this page */}
      <ProfileSidebar
        profile={profile}
        onAddPost={() => setAddPostOpen(true)}
        onControlPanel={() => setControlPanelOpen(true)}
      />
      <AddPostHost open={addPostOpen} onClose={() => setAddPostOpen(false)} />
      <ControlPanelHost open={controlPanelOpen} onClose={() => setControlPanelOpen(false)} />

      <div id="fh5co-main">
        <div className="fh5co-narrow-content" style={{ paddingTop: 40 }}>
          <center>
            {/* avatar —Â gray border on this page (the wall uses white) */}
            {/* the ring follows the control panel's Profile picture border:
                user/posts.blade.php:1016 and influencer/posts.blade.php:1045 gate it on
                `Auth::user()->profile_picture_border_status == '1'`. Those are the viewer's
                OWN posts pages (/user/posts, /influencer/posts — no route param); the
                someone-else blade (influencer/user_posts.blade.php:1308) draws no border. */}
            {profile.profilePicture ? (
              <img
                src={assetImage(profile.profilePicture)}
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 74,
                  ...(!routeUsername && profile.profilePictureBorderStatus === '1'
                    ? { border: '4px solid #d3d3d3' }
                    : null),
                }}
                alt=""
              />
            ) : (
              <img
                src="/assets/images/SUPERHEROINA.svg"
                style={{ width: 92, height: 92, borderRadius: 74 }}
                alt=""
              />
            )}

            <br />
            <br />
            <b style={{ color: 'gray' }}>
              {profile.name}
              {profile.bio && <Bio bio={profile.bio} />}
            </b>

            <span>
              @{profile.usernameUrl}{' '}
              {profile.verified && (
                <img
                  src={assetImage('verified.png')}
                  alt={tUi('alt_verified')}
                  width={18}
                  height={18}
                  style={{ position: 'relative', bottom: 1, display: 'inline-block' }}
                />
              )}
            </span>
            <br />
            <br />

            {/* guest follow button (no green mail button on this page) */}
            {!authUser && (
              <>
                {profile.role === 'influencer' ? (
                  <span
                    className="btn btn-primary btn-outline"
                    onClick={() => registerModal.open()}
                    style={{ width: 226 }}
                  >
                    <img
                      src="/assets/images/SUPERHEROINA.svg"
                      style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
                      alt=""
                    />
                    {t('follow', { defaultValue: 'Follow' })} <b>+</b> | <b>${profile.priceOfSubscription ?? ''}</b>
                  </span>
                ) : (
                  <>
                    <span
                      className="btn btn-primary btn-outline"
                      onClick={() => registerModal.open()}
                      style={{ width: 226 }}
                    >
                      <img
                        src="/assets/images/SUPERHEROINA.svg"
                        style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
                        alt=""
                      />
                      {t('follow', { defaultValue: 'Follow' })} <b>+</b>
                    </span>
                    <br />
                  </>
                )}
              </>
            )}

            <h2
              className="fh5co-heading animate-box"
              style={{ fontFamily: "'Roboto Slab', serif", color: '#dd2110' }}
            ></h2>
          </center>

          <div className="row animate-box" style={{ display: 'flex', flexWrap: 'wrap' }}>
            {posts.length > 0 ? (
              posts.map((post, index) => {
                const showAd = (index + 1) % 21 === 0 && adIndex < ads.length;
                const ad = showAd ? ads[adIndex++] : null;
                return (
                  <Fragment key={post.id}>
                    {ad && <AdItem ad={ad} />}
                    <PostItem
                      post={post}
                      locked={!isOwner && !post.visible && !viewerHasAccess}
                      author={{
                        usernameUrl: profile.usernameUrl,
                        profilePicture: profile.profilePicture,
                        verified: profile.verified,
                      }}
                      /* The posts-grid blades (user_posts / influencer_posts) have no report
                         control at all — reporting only exists on the feed and the full-screen
                         post viewer. So the grid never shows it. */
                      showReport={false}
                    />
                  </Fragment>
                );
              })
            ) : (
              <div className="col-12" style={{ width: '100%' }}>
                <p style={{ textAlign: 'center', color: 'rgba(0, 0, 0, 0.5)' }}>
                  <img
                    src={assetImage('time_icon.PNG')}
                    style={{ marginTop: -7, height: 32, width: 25, display: 'inline-block' }}
                    alt=""
                  />{' '}
                  No hay posts todabía &nbsp;&nbsp;
                </p>
              </div>
            )}
          </div>
          <br />
        </div>

        <EarnSection />
        <ProfilePageFooter profile={profile} />
      </div>
    </div>
  );
}
