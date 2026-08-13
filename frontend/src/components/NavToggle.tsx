import { useEffect, useState } from 'react';

/**
 * Mobile/tablet sidebar toggle — exact port of burgerMenu + mobileMenuOutsideClick
 * from public/assets/js/main.js:
 *   click  → toggles `offcanvas` on <body> and `active` on the toggle itself
 *   click outside #fh5co-aside / the toggle → closes it
 * The slide-in/out animation itself comes from the original style.css
 * (body.offcanvas #fh5co-aside { translateX(0) } etc.).
 */
/**
 * Closes the offcanvas menu the way the blade's own handlers do
 * (`body.removeClass('offcanvas')` + `.js-fh5co-nav-toggle.removeClass('active')`),
 * while keeping <NavToggle>'s React state in sync so the next click still opens it.
 */
export function closeOffcanvas() {
  document.body.classList.remove('offcanvas');
  document.dispatchEvent(new CustomEvent(OFFCANVAS_CLOSE));
}

const OFFCANVAS_CLOSE = 'fh5co:offcanvas-close';

export function NavToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onClose = () => setActive(false);
    document.addEventListener(OFFCANVAS_CLOSE, onClose);
    return () => document.removeEventListener(OFFCANVAS_CLOSE, onClose);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const aside = document.getElementById('fh5co-aside');
      const toggle = document.querySelector('.js-fh5co-nav-toggle');
      const inside =
        (aside && (aside === target || aside.contains(target))) ||
        (toggle && (toggle === target || toggle.contains(target)));
      if (!inside && document.body.classList.contains('offcanvas')) {
        document.body.classList.remove('offcanvas');
        setActive(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.body.classList.remove('offcanvas');
    };
  }, []);

  /* Drag the screen to work the menu, not just the icon (client request).
     Thresholds come from the app's own swipe helper, assets/js/swipe.js: a swipe
     counts at 30px and only after 100ms, which is its guard against accidental
     flicks. Opening is limited to the left edge so it cannot fire while the user
     is dragging the network slider on the world page. Offcanvas itself only
     exists below 768px in style.css:260, so the gesture stops there too. */
  useEffect(() => {
    const EDGE = 60;
    const MIN_DISTANCE = 30;
    const MIN_DURATION = 100;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = Date.now();
      tracking = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (window.innerWidth > 768) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Date.now() - startedAt < MIN_DURATION) return;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return;

      const isOpen = document.body.classList.contains('offcanvas');
      if (!isOpen && dx > 0 && startX <= EDGE) {
        document.body.classList.add('offcanvas');
        setActive(true);
      } else if (isOpen && dx < 0) {
        document.body.classList.remove('offcanvas');
        setActive(false);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    if (document.body.classList.contains('offcanvas')) {
      document.body.classList.remove('offcanvas');
      setActive(false);
    } else {
      document.body.classList.add('offcanvas');
      setActive(true);
    }
  }

  return (
    <a
      href="#"
      className={`js-fh5co-nav-toggle fh5co-nav-toggle${active ? ' active' : ''}`}
      onClick={toggle}
    >
      <i></i>
    </a>
  );
}
