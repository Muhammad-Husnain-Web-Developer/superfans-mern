import { useEffect, useRef, useState } from 'react';

/**
 * select2 multi-select lookalike — renders select2's own DOM structure so the
 * real select2 CSS (loaded in index.html, same CDN version as the blade) styles
 * it identically: white box, 1px #aaa border, 4px radius, tag chips with ×.
 * The blade keeps the native <select multiple> hidden behind it; we do the same
 * so form semantics stay intact.
 */
export function Select2Multi({
  id,
  options,
  selected,
  onChange,
  placeholder = '',
}: {
  id?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const available = options.filter((o) => !selected.includes(o));

  return (
    <span ref={boxRef} style={{ position: 'relative', display: 'block' }}>
      {/* hidden native select — keeps the value accessible like the blade does */}
      <select
        id={id}
        multiple
        value={selected}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <span className="select2 select2-container select2-container--default" dir="ltr" style={{ width: '100%' }}>
        <span className="selection">
          <span
            className="select2-selection select2-selection--multiple"
            role="combobox"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ cursor: 'text' }}
          >
            <ul className="select2-selection__rendered">
              {selected.map((item) => (
                <li key={item} className="select2-selection__choice" title={item}>
                  <span
                    className="select2-selection__choice__remove"
                    role="presentation"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(selected.filter((s) => s !== item));
                    }}
                  >
                    ×
                  </span>
                  {item}
                </li>
              ))}
              <li className="select2-search select2-search--inline">
                <input
                  className="select2-search__field"
                  type="search"
                  placeholder={selected.length === 0 ? placeholder : ''}
                  readOnly
                  style={{ width: 100 }}
                />
              </li>
            </ul>
          </span>
        </span>
      </span>

      {open && available.length > 0 && (
        <span
          className="select2-container select2-container--default select2-container--open"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1051 }}
        >
          <span className="select2-dropdown select2-dropdown--below" style={{ position: 'static', width: '100%' }}>
            <span className="select2-results">
              <ul className="select2-results__options" role="listbox">
                {available.map((o) => (
                  <li
                    key={o}
                    className="select2-results__option"
                    role="option"
                    onClick={() => {
                      onChange([...selected, o]);
                      setOpen(false);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {o}
                  </li>
                ))}
              </ul>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
