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

  /* Drag anywhere on the page to work the menu, as main.blade.php:1727 does:
     below 760px, with no modal open, a horizontal move of more than 100px opens
     the menu going right and closes it going left. The listeners sit on <body>,
     which is what the blade watches, and screenX is the coordinate it reads.

     This used to take its numbers from assets/js/swipe.js -- 30px past a 100ms
     timer, and only from the leftmost 60px -- but no blade ever loads that file.
     Starting the drag inside a 60px strip is the movement the client is
     describing; without it the longer 100px reaches far more of the screen. */
  useEffect(() => {
    const MIN_DISTANCE = 100;
    let touchStartX = 0;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (touch) touchStartX = touch.screenX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      if (window.innerWidth >= 760) return;
      /* a swipe over an open modal belongs to the modal, not to the menu */
      if (document.querySelector('.modal.in')) return;

      const dx = touch.screenX - touchStartX;
      if (Math.abs(dx) <= MIN_DISTANCE) return;

      const isOpen = document.body.classList.contains('offcanvas');
      if (dx > 0 && !isOpen) {
        document.body.classList.add('offcanvas');
        setActive(true);
      } else if (dx < 0 && isOpen) {
        document.body.classList.remove('offcanvas');
        setActive(false);
      }
    };

    document.body.addEventListener('touchstart', onTouchStart, { passive: true });
    document.body.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.body.removeEventListener('touchstart', onTouchStart);
      document.body.removeEventListener('touchend', onTouchEnd);
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
