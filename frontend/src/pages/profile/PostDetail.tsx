import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { fetchProfile, type ProfileData } from '../../api/profiles';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { GuestHeader, ProfileSidebar } from './ProfileSidebar';
import { SwalResult } from './Profile';
import { useRegisterModal } from '../../components/RegisterModal';
import { PostReportButton } from '../../components/PostReportButton';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import '../../styles/profile-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';

interface PostDetailData {
  id: string;
  imageVideo: string | null;
  thumbnail: string | null;
  visible: boolean;
  likesTotal: number;
  viewerLiked: boolean;
  canView: boolean;
  prevId: string | null;
  nextId: string | null;
  influencer: {
    id: string;
    name: string;
    usernameUrl: string | null;
    role: string;
    priceOfSubscription: number | null;
  } | null;
}

/**
 * Post detail —Â port of post_detail.blade.php (/post/:id).
 * Owner/subscriber sees the media + Like button; everyone else the locked
 * tile with the Subscribe/Follow CTA. Prev | grid | Next pagination below.
 */
export function PostDetail() {
  useLayoutPageStyles();
  const { id = '' } = useParams();
  const { t } = useTranslation('content');
  const { user: authUser } = useAuth();
  const registerModal = useRegisterModal();

  const [post, setPost] = useState<PostDetailData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [swal, setSwal] = useState<{ icon?: 'success' | 'error'; title: string; text?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api
      .get<{ success: boolean; data: PostDetailData }>(`/posts/${id}`)
      .then(async (r) => {
        const detail = r.data.data;
        const prof = detail.influencer?.usernameUrl
          ? await fetchProfile(detail.influencer.usernameUrl)
          : null;
        if (cancelled) return;
        setPost(detail);
        setProfile(prof);
        setState('ok');
        void api.post(`/posts/${id}/visit`).catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setState('notfound');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Re-pull the post (+profile) so the media unlocks after a successful follow. */
  async function refetch() {
    const r = await api.get<{ success: boolean; data: PostDetailData }>(`/posts/${id}`);
    const detail = r.data.data;
    const prof = detail.influencer?.usernameUrl
      ? await fetchProfile(detail.influencer.usernameUrl)
      : profile;
    setPost(detail);
    setProfile(prof);
  }

  /* Locked-post CTA. Guests → register modal (Laravel's #register_Modal). Logged-in
     viewers → free follow for a user-role creator (Swal "Followed Successfully",
     then the post unlocks), or Stripe subscribe checkout for a paid influencer. */
  function onLockedCta() {
    if (!authUser) {
      registerModal.open();
      return;
    }
    if (!post?.influencer || busy) return;
    if (post.influencer.role === 'influencer') {
      setBusy(true);
      api
        .post<{ url?: string }>(`/payments/subscribe/${post.influencer.id}`)
        .then(({ data }) => {
          if (data.url) window.location.href = data.url;
          else setBusy(false);
        })
        .catch(() => setBusy(false));
      return;
    }
    setBusy(true);
    api
      .post(`/me/follow/${post.influencer.id}`)
      .then(() => refetch())
      .then(() => setSwal({ title: 'Followed Successfully' }))
      .catch(() => setSwal({ icon: 'error', title: 'Something went wrong' }))
      .finally(() => setBusy(false));
  }

  function toggleLike() {
    if (!post) return;
    api
      .post<{ success: boolean; data: { status: string; likesTotal: number } }>(
        `/posts/${post.id}/like-toggle`,
      )
      .then((r) =>
        setPost({
          ...post,
          viewerLiked: r.data.data.status === 'post liked',
          likesTotal: r.data.data.likesTotal,
        }),
      )
      .catch(() => undefined);
  }

  if (state === 'loading') return null;
  if (state === 'notfound' || !post || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: '20vh 20px', fontFamily: 'Roboto, sans-serif' }}>
        <h1 style={{ fontSize: '4em', color: '#da1212' }}>404</h1>
        <p>Not Found</p>
      </div>
    );
  }

  const media = post.imageVideo;
  const frame: React.CSSProperties = { borderRadius: 26, border: '7px solid lightgray' };
  const username = post.influencer?.usernameUrl ?? '';

  return (
    <div id="fh5co-page">
      <PageLoader />
      <NavToggle />
      <MobileFooterMenu />

      <GuestHeader usernameUrl={username} />
      <ProfileSidebar profile={profile} />

      <div id="fh5co-main">
        <div className="fh5co-narrow-content">
          <div className="row">
            <div className="col-md-12 animate-box">
              <figure className="text-center image-hover-wrapper" style={{ position: 'relative' }}>
                <center>
                  {post.canView && media ? (
                    isVideoFile(media) ? (
                      <video
                        controls
                        loop
                        autoPlay
                        muted
                        playsInline
                        controlsList="nodownload"
                        style={{ maxWidth: '100%' }}
                        poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
                      >
                        <source src={assetImage(media)} type={videoMime(media)} />
                      </video>
                    ) : (
                      <img
                        src={assetImage(media)}
                        className="img-responsive"
                        style={{ ...frame, maxWidth: '100%', maxHeight: 411, display: 'inline-block' }}
                        alt=""
                      />
                    )
                  ) : (
                    <img
                      src={assetImage('blue24.png')}
                      className="img-responsive"
                      style={{ ...frame, display: 'inline-block' }}
                      alt=""
                    />
                  )}
                </center>
                {post.canView && media && <PostReportButton postId={post.id} />}
              </figure>
            </div>

            <center>
              {post.canView ? (
                /* Like button (auth viewers who can see the post) */
                <span
                  className="btn btn-primary btn-outline like_post"
                  onClick={toggleLike}
                  style={{ width: 292, cursor: 'pointer' }}
                >
                  <img
                    src="/assets/images/SUPERHEROINA.svg"
                    style={{ width: '15.47%', position: 'relative', left: -7, display: 'inline-block' }}
                    alt=""
                  />{' '}
                  Like{' '}
                  <b>
                    <i
                      className={post.viewerLiked ? 'icon-heart' : 'icon-heart-o'}
                      aria-hidden="true"
                    ></i>
                  </b>
                </span>
              ) : (
                /* Subscribe/Follow CTA (guests + non-subscribed) */
                <a
                  className="btn-m btn btn-primary btn-outline"
                  style={{ cursor: busy ? 'wait' : 'pointer' }}
                  onClick={onLockedCta}
                >
                  <img
                    src="/assets/images/SUPERHEROINA.svg"
                    style={{ width: 38, position: 'relative', left: -7, display: 'inline-block' }}
                    alt=""
                  />
                  {post.influencer?.role === 'influencer' ? (
                    <>
                      {t('subscribe', { defaultValue: 'Subscribe' })} <b>+</b>{' '}
                      {t('to_see_post', { defaultValue: 'to see the post' })} |{' '}
                      <b>${post.influencer.priceOfSubscription ?? ''}</b>
                    </>
                  ) : (
                    <>
                      {t('follow', { defaultValue: 'Follow' })} <b>+</b>{' '}
                      {t('to_see_post', { defaultValue: 'to see the post' })}
                    </>
                  )}
                </a>
              )}
            </center>
          </div>

          {/* Anterior | grid | Siguiente */}
          <div className="row work-pagination animate-box">
            <div className="col-md-8 col-md-offset-2 col-sm-12 col-sm-offset-0">
              <div className="col-md-4 col-sm-4 col-xs-4 text-center">
                {post.prevId ? (
                  <Link to={`/post/${post.prevId}`}>
                    <i className="icon-long-arrow-left"></i> <span>Anterior</span>
                  </Link>
                ) : (
                  <p>
                    <i className="icon-long-arrow-left"></i> <span>Anterior</span>
                  </p>
                )}
              </div>
              <div className="col-md-4 col-sm-4 col-xs-4 text-center">
                <Link to={`/posts/${username}`}>
                  <i className="icon-th-large"></i>
                </Link>
              </div>
              <div className="col-md-4 col-sm-4 col-xs-4 text-center">
                {post.nextId ? (
                  <Link to={`/post/${post.nextId}`}>
                    <span>Siguiente</span> <i className="icon-long-arrow-right"></i>
                  </Link>
                ) : (
                  <p>
                    <span>Siguiente</span> <i className="icon-long-arrow-right"></i>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {swal && <SwalResult {...swal} onClose={() => setSwal(null)} />}
    </div>
  );
}
