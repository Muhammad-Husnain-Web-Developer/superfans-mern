import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { fetchFeed, type FeedPost } from '../../api/profiles';
import { assetImage, isVideoFile, formatNumber, videoMime } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';
import { rememberScroll, useScrollMemory } from '../../utils/useScrollMemory';
import { api } from '../../api/client';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { GuestHeader } from '../profile/ProfileSidebar';
import { WorldSidebar } from './World';
import '../../styles/world-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';
import { ControlPanelHost } from '../profile/ControlPanelHost';
import { AddPostHost } from '../profile/AddPostHost';

/**
 * Feed — port of user/feed.blade.php. A centred header (avatar · name · @user · Subscribe ·
 * "My Feed / Superfans World") followed by a grid of cards for every post from the people the
 * viewer subscribes to and follows. Each card shows the author heading (@username + avatar +
 * verified), the media in a rounded "phone" frame, a hover report control and a 👁️ view count.
 */
export function UserFeed() {
  useLayoutPageStyles();
  const { t } = useTranslation('content');
  const { user: authUser, loading } = useAuth();
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [addPostOpen, setAddPostOpen] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [ready, setReady] = useState(false);
  /* come back from the viewer beside the post that was opened, as the wall and
     the world feed do */
  useScrollMemory(ready && posts.length > 0);

  useEffect(() => {
    document.title = 'Superfans | Feed';
    if (loading) return;
    if (!authUser) {
      setReady(true);
      return;
    }
    fetchFeed()
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setReady(true));
  }, [authUser, loading]);

  return (
    <div id="fh5co-page">
      <style>{`
        .feed-head-title{font-family:'Roboto Slab',serif;color:#dd2110}
        .feed_posts_heading_img{max-width:25px;border-radius:50%;margin-right:6px;vertical-align:middle}
        .feed_posts_heading_p{padding:10px;margin-bottom:0;font-size:14px;font-weight:600;position:relative;top:25px}
        .feed-card-media{border-radius:26px;border:7px solid lightgray;width:100%;max-height:411px;object-fit:cover;cursor:pointer}
        @keyframes feedScrollLeft{0%{transform:translateX(50%)}100%{transform:translateX(-100%)}}
      `}</style>
      <PageLoader />
      <NavToggle />
      <MobileFooterMenu />

      <GuestHeader usernameUrl="" />
      <WorldSidebar
        onControlPanel={() => setControlPanelOpen(true)}
        onAddPost={() => setAddPostOpen(true)}
        section={t('my_feed', { defaultValue: 'MY FEED' })}
        activeNav="feed"
      />
      <ControlPanelHost open={controlPanelOpen} onClose={() => setControlPanelOpen(false)} />
      <AddPostHost open={addPostOpen} onClose={() => setAddPostOpen(false)} />

      <div id="fh5co-main">
        <div className="fh5co-narrow-content">
          {/* Header: avatar · name · @username · Subscribe · title */}
          <center>
            <img
              src={authUser?.profilePicture ? assetImage(authUser.profilePicture) : assetImage('output-onlinepngtools (2).png')}
              style={{ width: 92, height: 92, borderRadius: 74 }}
              alt=""
            />
            <br />
            <br />
            <b>{authUser?.name}</b>
            <br />@{authUser?.usernameUrl}
            <br />
            <br />
            <span
              className="btn btn-primary btn-outline"
              style={{ width: 226, cursor: 'pointer' }}
              onClick={() => setControlPanelOpen(true)}
            >
              <img
                src="/assets/images/SUPERHEROINA.svg"
                style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
                alt=""
              />
              {t('subscribe', { defaultValue: 'Subscribe' })} <b>+</b>
            </span>
            <h2 className="fh5co-heading animate-box feed-head-title">
              <br />
              <span>"{t('feed_of_me', { defaultValue: 'My Feed' })} <br /> Superfans World"</span>
            </h2>
          </center>

          <div className="row animate-box" style={{ display: 'flex', flexWrap: 'wrap' }}>
            {ready && posts.length === 0 ? (
              <div style={{ textAlign: 'center', width: '100%' }} />
            ) : (
              posts.map((post) => <FeedCard key={post.id} post={post} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One feed tile: author heading, media, report, 👁️ views. Click → full-screen viewer. */
function FeedCard({ post }: { post: FeedPost }) {
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heart, setHeart] = useState(false);
  const [views, setViews] = useState(post.viewsTotal);
  const media = post.imageVideo;
  const author = post.author;

  function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setHeart(true);
      setTimeout(() => setHeart(false), 600);
      api
        .post<{ success: boolean; data: { likesTotal: number } }>(`/posts/${post.id}/like-toggle`)
        .then((r) => setViews(r.data.data.likesTotal))
        .catch(() => undefined);
    } else {
      /* noted in the click itself: once the double-click window has closed the
         page is laid out for the viewer and the position reads 0 */
      rememberScroll(); // so closing the viewer returns to this row
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        navigate(`/user/post_detail/${post.id}`);
      }, 350);
    }
  }

  // Author heading + any tagged users, scrolling if tagged (marquee) like the blade.
  const tagged = post.tags.filter(Boolean);
  const heading =
    tagged.length > 0 ? (
      <p className="feed_posts_heading_p" style={{ overflow: 'hidden', width: '70%', height: 55, marginBottom: 12 }}>
        <span style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: 'feedScrollLeft 10s linear infinite' }}>
          <a
            href={`/${author.usernameUrl ?? ''}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); rememberScroll(); if (author.usernameUrl) navigate(`/${author.usernameUrl}`); }}
            style={{ color: 'black', display: 'inline-flex', alignItems: 'center', marginRight: 10, textDecoration: 'none' }}
          >
            <img className="feed_posts_heading_img" src={author.profilePicture ? assetImage(author.profilePicture) : assetImage('output-onlinepngtools (2).png')} alt="" />
            <span>@</span>{author.usernameUrl}
          </a>
          {author.verified && <img src={assetImage('verified.png')} alt="Verified" width={18} height={18} style={{ position: 'relative', bottom: 2 }} />}
          {tagged.map((tag, i) => {
            const pic = post.taggedProfilePictures[i];
            if (!pic) return null;
            return (
              <a
                key={tag}
                href={`/${tag.trim()}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); rememberScroll(); navigate(`/${tag.trim()}`); }}
                style={{ color: 'black', display: 'inline-flex', alignItems: 'center', marginRight: 10, textDecoration: 'none' }}
              >
                <img className="feed_posts_heading_img" src={assetImage(pic.trim())} alt="" />
                <span>@{tag.trim()}</span>
              </a>
            );
          })}
        </span>
      </p>
    ) : (
      <p
        className="feed_posts_heading_p feed_posts_heading_pi"
        style={{ cursor: 'pointer', marginBottom: 12 }}
        onClick={(e) => { e.stopPropagation(); rememberScroll(); if (author.usernameUrl) navigate(`/${author.usernameUrl}`); }}
      >
        <img className="feed_posts_heading_img" src={author.profilePicture ? assetImage(author.profilePicture) : assetImage('output-onlinepngtools (2).png')} alt="" />
        <span>@</span>{author.usernameUrl}
      </p>
    );

  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item image-hover-wrapper" onClick={onClick} style={{ position: 'relative', cursor: 'pointer' }}>
      <div className={`animated-heart${heart ? ' show' : ''}`} id={`heart-${post.id}`}></div>
      {heading}
      <div className="image-hover-wrapper" style={{ position: 'relative', width: '100%' }}>
        {media && isVideoFile(media) ? (
          <video
            className="feed-card-media"
            controls
            loop
            muted
            playsInline
            poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
          >
            <source src={assetImage(media)} type={videoMime(media)} />
          </video>
        ) : (
          <img
            src={media ? assetImage(media) : LOCKED_POST_IMAGE}
            className="feed-card-media img-responsive"
            alt="Nueva Modelo Superfans - ¡Bienvenid@ a mi Portfolio!"
          />
        )}
      </div>
      <center style={{ display: 'block', marginTop: 4 }}>
        <b>
          <a className="post_stats" style={{ fontSize: '0.69em' }}>
            <span className="eye-icon">👁️</span> <span className="number_of_post_likes">{formatNumber(views)}</span>
          </a>
        </b>
      </center>
    </div>
  );
}
