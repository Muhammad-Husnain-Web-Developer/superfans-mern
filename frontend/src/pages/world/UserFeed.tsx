import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { fetchFeed, type FeedPost } from '../../api/profiles';
import { assetImage, isVideoFile, formatNumber, likePercent, videoMime } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';
import { rememberScroll, useScrollMemory } from '../../utils/useScrollMemory';
import { observeNewVideos } from '../../utils/video';
import { api } from '../../api/client';
import { PageLoader } from '../../components/PageLoader';
import { PostHeading } from '../../components/PostHeading';
import { VolumeButton } from '../../components/VolumeButton';
import { RatingPill } from '../../components/RatingPill';
import { useRatingFeedback } from '../../utils/useRatingFeedback';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { StoriesStrip } from '../../components/stories/StoriesStrip';
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

  /* the observer only knows about videos that exist, so it is re-run whenever the feed
     changes — the same call the world feed and the profile grids make */
  useEffect(() => {
    observeNewVideos();
  }, [posts]);

  return (
    <div id="fh5co-page">
      <style>{`
        .feed-head-title{font-family:'Roboto Slab',serif;color:#dd2110}
        /* the handle strip is PostHeading's now — its own weight, marquee and blue tick
           come from post-heading.css, the same as the world feed and the walls */
        /* The column's 80px of head room was there for the avatar-and-title header, which
           the client took off this page; with the stories row moved above the column it
           left an empty band between the two. Only this page drops it — the rule lives in
           the page's own style block, which goes away with the page. */
        #fh5co-main > .fh5co-narrow-content{padding-top:0}
        .feed-card-media{border-radius:26px;border:7px solid lightgray;width:100%;max-height:411px;object-fit:cover;cursor:pointer}
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
        {/* Stories, Pas 7. Outside the narrow column on purpose: the client wants the row
            flush with the top of the page and running the full width, and that column is
            both inset on either side and padded 80px down from the top. The posts stay
            inside it, at the width they have always had. */}
        <StoriesStrip />

        <div className="fh5co-narrow-content">
          {/* The client asked for this header — avatar, name, handle, Subscribe and the
              "My Feed Superfans World" title — to come off the feed, so the page opens on
              the stories row. Kept here rather than deleted in case it is wanted back.

          [ Header: avatar · name · @username · Subscribe · title ]
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
          ] */}

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

/** One feed tile: author heading, media, report, and the same 👁️ views + rating row the
 *  world feed and the walls carry. Click → full-screen viewer. */
function FeedCard({ post }: { post: FeedPost }) {
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [heart, setHeart] = useState(false);
  const [views, setViews] = useState(post.viewsTotal);
  const [liked, setLiked] = useState(post.viewerLiked ?? false);
  const [hated, setHated] = useState(post.viewerHated ?? false);
  const [likeRows, setLikeRows] = useState(post.likesCount ?? 0);
  const [hateRows, setHateRows] = useState(post.hatesCount ?? 0);
  const feedback = useRatingFeedback();
  const media = post.imageVideo;
  const author = post.author;

  function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setHeart(true);
      setTimeout(() => setHeart(false), 600);
      doLike();
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

  // function doLike() {
  //   api
  //     .post<{ success: boolean; data: { status: string; likesTotal: number; likesCount: number; hatesCount: number } }>(
  //       `/posts/${post.id}/like-toggle`,
  //     )
  //     .then((r) => {
  //       const nowLiked = r.data.data.status === 'post liked';
  //       setLiked(nowLiked);
  //       if (nowLiked) setHated(false);
  //       setViews(r.data.data.likesTotal);
  //       setLikeRows(r.data.data.likesCount);
  //       setHateRows(r.data.data.hatesCount);
  //       feedback.onLiked();
  //     })
  //     .catch(() => undefined);
  // }


  // function doHate() {
  //   api
  //     .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
  //       `/me/hate/${post.id}`,
  //     )
  //     .then((r) => {
  //       const nowHated = r.data.data.status === 'post hated';
  //       setHated(nowHated);
  //       if (nowHated) setLiked(false);
  //       setLikeRows(r.data.data.likesCount);
  //       setHateRows(r.data.data.hatesCount);
  //       feedback.onHated();
  //     })
  //     .catch(() => undefined);
  // }
function doLike() {
  feedback.onLiked();

  const willBeLiked = !liked;
  setLiked(willBeLiked);
  if (willBeLiked) {
    setHated(false);
    setLikeRows((prev) => prev + 1);
    if (hated) setHateRows((prev) => prev - 1);
    setViews((prev) => prev + 1);
  } else {
    setLikeRows((prev) => prev - 1);
    setViews((prev) => prev - 1);
  }

  api
    .post<{ success: boolean; data: { status: string; likesTotal: number; likesCount: number; hatesCount: number } }>(
      `/posts/${post.id}/like-toggle`,
    )
    .then((r) => {
      const nowLiked = r.data.data.status === 'post liked';
      setLiked(nowLiked);
      if (nowLiked) setHated(false);
      setViews(r.data.data.likesTotal);
      setLikeRows(r.data.data.likesCount);
      setHateRows(r.data.data.hatesCount);
    })
    .catch(() => {
      // Revert
      setLiked(!willBeLiked);
      if (willBeLiked) {
        setLikeRows((prev) => prev - 1);
        if (hated) setHateRows((prev) => prev + 1);
        setViews((prev) => prev - 1);
      } else {
        setLikeRows((prev) => prev + 1);
        setViews((prev) => prev + 1);
      }
    });
}
function doHate() {
  feedback.onHated();

  const willBeHated = !hated;
  setHated(willBeHated);
  if (willBeHated) {
    setLiked(false);
    setHateRows((prev) => prev + 1);
    if (liked) setLikeRows((prev) => prev - 1);
  } else {
    setHateRows((prev) => prev - 1);
  }

  api
    .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
      `/me/hate/${post.id}`,
    )
    .then((r) => {
      const nowHated = r.data.data.status === 'post hated';
      setHated(nowHated);
      if (nowHated) setLiked(false);
      setLikeRows(r.data.data.likesCount);
      setHateRows(r.data.data.hatesCount);
    })
    .catch(() => {
      setHated(!willBeHated);
      if (willBeHated) {
        setHateRows((prev) => prev - 1);
        if (liked) setLikeRows((prev) => prev + 1);
      } else {
        setHateRows((prev) => prev + 1);
      }
    });
}
  /* The strip above the post is the shared one the world feed and the walls draw: bold
     handles, the blue tick on every verified name, and the marquee only when the row is
     actually too long for its slot. This page used to draw its own — which left an
     unverified-looking name on any post with no tags, and scrolled the tagged rows even
     when they fitted. */
  const taggedHandles = post.tags
    .map((name, i) => ({ usernameUrl: name.trim(), profilePicture: post.taggedProfilePictures[i]?.trim() || null }))
    .filter((h) => h.usernameUrl);

  return (
    /* the click belongs to the media, not to the card: the handle strip, the rating row
       and the white space around them are not the post, and opening the viewer from them
       is what the client reported. The world feed has always worked this way. */
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item image-hover-wrapper" style={{ position: 'relative' }}>
      <div className={`animated-heart${heart ? ' show' : ''}`} id={`heart-${post.id}`}></div>
      <PostHeading
        author={{
          usernameUrl: author.usernameUrl ?? '',
          profilePicture: author.profilePicture,
          verified: author.verified,
        }}
        tagged={taggedHandles}
      />
      <div
        className="image-hover-wrapper"
        style={{ position: 'relative', width: '100%', cursor: 'pointer' }}
        onClick={onClick}
      >
        {media && isVideoFile(media) ? (
          /* observeNewVideos drives these: muted playback starts when the card scrolls into
             view and stops when it leaves, with the app's own volume button over it — the
             world feed and the walls have always behaved this way, and only this page was
             left with a still frame and bare native controls. */
          <div className="video-wrapper" style={{ position: 'relative', width: '100%' }}>
            <video
              className="feed-card-media autoplay-video"
              id={`video-${post.id}`}
              controlsList="nodownload"
              loop
              muted
              playsInline
              poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
            >
              <source src={assetImage(media)} type={videoMime(media)} />
            </video>
            <VolumeButton videoId={`video-${post.id}`} variant="world" />
          </div>
        ) : (
          <img
            src={media ? assetImage(media) : LOCKED_POST_IMAGE}
            className="feed-card-media img-responsive"
            alt="Nueva Modelo Superfans - ¡Bienvenid@ a mi Portfolio!"
          />
        )}
      </div>
      <div className="stats-wrapper has-actions" onClick={(e) => e.stopPropagation()}>
        <div className="view-count">
          <span className="eye-icon">👁️</span>
          <span className="number_of_post_likes">{formatNumber(views)}</span>
        </div>
        <RatingPill
          pct={likePercent(likeRows, hateRows, post.likePercent)}
          liked={liked}
          hated={hated}
          beat={feedback.beat}
          bounce={feedback.bounce}
          onLike={doLike}
          onHate={doHate}
        />
      </div>
    </div>
  );
}
