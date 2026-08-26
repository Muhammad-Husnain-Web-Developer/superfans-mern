import { useEffect, useState } from 'react';
import '../styles/nav-toggle.css';

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

  /* Drag the page to work the menu, below 760px, as main.blade.php:1727 does.
     The blade only reads the finger where it is lifted and asks for 100px of
     travel before it acts on anything, which is the "you have to move a lot of
     finger" the client is describing: a short or quick drag does nothing at
     all, and nothing moves under the finger to say the menu is coming.

     The panel now follows the finger from the first pixels and is released on
     whichever comes first -- a fifth of its width, or a flick. Nothing here is
     a threshold to cross before the menu reacts. */
  useEffect(() => {
    const PANEL = 270; // style.css:107 — the sidebar's width, and its travel
    const INTENT = 6; // px of horizontal lead before the drag is ours
    const RELEASE = PANEL * 0.1; // 27px — a tenth of the way is a clear intent
    const FLICK = 0.2; // px/ms — a quick drag carries on its own, however short

    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let lastX = 0;
    let lastAt = 0;
    let dragging = false;
    let decided = false;
    let openAtStart = false;
    let panels: HTMLElement[] = [];

    const held = () =>
      [
        document.getElementById('fh5co-aside'),
        document.getElementById('fh5co-main'),
        document.querySelector<HTMLElement>('.fh5co-nav-toggle'),
      ].filter((el): el is HTMLElement => el !== null);

    /** Slide everything to `shift` px along its travel, 0…PANEL. */
    const paint = (shift: number) => {
      for (const el of panels) {
        const base = el.id === 'fh5co-aside' ? -PANEL : 0;
        el.style.transition = 'none';
        el.style.transform = `translateX(${base + shift}px)`;
      }
    };

    /** Hand the elements back to the stylesheet, which animates the rest. */
    const release = (open: boolean) => {
      for (const el of panels) {
        el.style.transition = '';
        el.style.transform = '';
      }
      document.body.classList.toggle('offcanvas', open);
      setActive(open);
      panels = [];
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (window.innerWidth >= 760) return;
      /* a swipe over an open modal belongs to the modal, not to the menu */
      if (document.querySelector('.modal.in')) return;
      startX = lastX = touch.clientX;
      startY = touch.clientY;
      startedAt = lastAt = Date.now();
      openAtStart = document.body.classList.contains('offcanvas');
      dragging = true;
      decided = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!decided) {
        /* wait until the finger has said which way it is going, so a scroll
           down the page is never mistaken for a reach at the menu */
        if (Math.abs(dy) > Math.abs(dx)) {
          dragging = false;
          return;
        }
        if (Math.abs(dx) < INTENT) return;
        if (dx > 0 === openAtStart) {
          dragging = false; // pushing further open, or further closed
          return;
        }
        decided = true;
        panels = held();
      }

      lastX = touch.clientX;
      lastAt = Date.now();
      const shift = openAtStart ? PANEL + dx : dx;
      paint(Math.max(0, Math.min(PANEL, shift)));
      /* the page must not scroll sideways under a drag we have taken over */
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      if (!decided) return;

      const touch = e.changedTouches[0];
      const endX = touch ? touch.clientX : lastX;
      const dx = endX - startX;
      const elapsed = Math.max(1, Date.now() - startedAt);
      const speed = Math.abs(dx) / elapsed;
      const recent = Math.abs(endX - lastX) / Math.max(1, Date.now() - lastAt);

      const far = Math.abs(dx) >= RELEASE;
      const flicked = speed >= FLICK || recent >= FLICK;
      const carries = far || flicked;

      release(openAtStart ? !carries : carries);
    };

    const onTouchCancel = () => {
      if (decided) release(openAtStart);
      dragging = false;
    };

    document.body.addEventListener('touchstart', onTouchStart, { passive: true });
    document.body.addEventListener('touchmove', onTouchMove, { passive: false });
    document.body.addEventListener('touchend', onTouchEnd, { passive: true });
    document.body.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      document.body.removeEventListener('touchstart', onTouchStart);
      document.body.removeEventListener('touchmove', onTouchMove);
      document.body.removeEventListener('touchend', onTouchEnd);
      document.body.removeEventListener('touchcancel', onTouchCancel);
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
      {/* The client's own artwork for the handle — the tab and the bar inside it are the
          one image, so nothing here is drawn in CSS any more. It ships with the frontend,
          beside the other brand pieces, rather than in the Laravel asset folder that only
          exists on the server. */}
      <img src="/brand/sidebar-menu.png" alt="" className="nav-toggle-grip" draggable={false} />
    </a>
  );
}
