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
