/**
 * Autoplay-video system — exact port of the world.blade.php scripts:
 *
 * 1. IntersectionObserver (threshold 0.5) drives ALL play/pause — videos have
 *    no autoplay attribute:
 *    - Desktop (>991px): if a visible video is unmuted, only IT plays and every
 *      other video is paused+muted. Otherwise only the FIRST visible video
 *      plays, with `muted = isGlobalMuted` (so after unmuting once, the one
 *      playing video keeps sound as you scroll). No visible videos → all pause.
 *    - Mobile: each video entering view plays with the global mute state,
 *      leaving view pauses it.
 * 2. toggleMute: desktop unmute → only that video has sound (all others
 *    muted+paused); mute → just mutes it. Mobile → global toggle. Persisted to
 *    localStorage('video_muted').
 */

let isGlobalMuted = true; // blade initializes to muted on every page load
let observer: IntersectionObserver | null = null;

function updateVideoIcon(video: HTMLVideoElement): void {
  const icon = video.closest('.video-wrapper')?.querySelector('.volume-btn i');
  if (!icon) return;
  if (video.muted) {
    icon.classList.remove('fa-volume-up');
    icon.classList.add('fa-volume-mute');
  } else {
    icon.classList.remove('fa-volume-mute');
    icon.classList.add('fa-volume-up');
  }
}

function getObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        (entry.target as HTMLElement).dataset.intersecting = String(entry.isIntersecting);
      });

      const isDesktop = window.innerWidth > 991;
      const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('.autoplay-video'));

      if (isDesktop) {
        const visibleVideos = allVideos.filter((v) => v.dataset.intersecting === 'true');
        const unmutedVideo = visibleVideos.find((v) => !v.muted);

        if (unmutedVideo) {
          allVideos.forEach((v) => {
            if (v === unmutedVideo) {
              v.play().catch(() => {});
            } else {
              v.pause();
              v.muted = true;
              updateVideoIcon(v);
            }
          });
        } else if (visibleVideos.length > 0) {
          const firstToPlay = visibleVideos[0];
          allVideos.forEach((v) => {
            if (v === firstToPlay) {
              v.muted = isGlobalMuted;
              v.play().catch(() => {});
              updateVideoIcon(v);
            } else {
              v.pause();
            }
          });
        } else {
          allVideos.forEach((v) => v.pause());
        }
      } else {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.muted = isGlobalMuted;
            updateVideoIcon(video);
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      }
    },
    { threshold: 0.5 },
  );
  return observer;
}

/** Observe every not-yet-observed .autoplay-video (blade: observeVideos / window.observeNewVideos). */
export function observeNewVideos(): void {
  const obs = getObserver();
  document.querySelectorAll<HTMLVideoElement>('.autoplay-video').forEach((video) => {
    if (!video.dataset.observed) {
      video.dataset.observed = 'true';
      obs.observe(video);
    }
  });
}

export function toggleMute(event: { preventDefault(): void; stopPropagation(): void }, videoId: string): void {
  event.preventDefault();
  event.stopPropagation();

  const targetVideo = document.getElementById(videoId) as HTMLVideoElement | null;
  if (!targetVideo) return;
  const isDesktop = window.innerWidth > 991;

  if (isDesktop) {
    const becomingUnmuted = targetVideo.muted;
    if (becomingUnmuted) {
      document.querySelectorAll<HTMLVideoElement>('.autoplay-video').forEach((video) => {
        if (video.id === videoId) {
          video.muted = false;
          video.play().catch(() => {});
        } else {
          video.muted = true;
          video.pause();
        }
        updateVideoIcon(video);
      });
      isGlobalMuted = false;
    } else {
      targetVideo.muted = true;
      updateVideoIcon(targetVideo);
      isGlobalMuted = true;
    }
  } else {
    isGlobalMuted = !targetVideo.muted;
    document.querySelectorAll<HTMLVideoElement>('.autoplay-video').forEach((video) => {
      video.muted = isGlobalMuted;
      updateVideoIcon(video);
    });
  }

  localStorage.setItem('video_muted', String(isGlobalMuted));
}
