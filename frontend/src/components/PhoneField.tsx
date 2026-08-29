import { useEffect, useRef } from 'react';
import intlTelInput, { type Iti } from 'intl-tel-input';
import utilsScript from 'intl-tel-input/build/js/utils.js?url';
import 'intl-tel-input/build/css/intlTelInput.css';
import '../styles/phone-field.css';

/**
 * The phone field with a country picker beside it — the one control every form that asks for
 * a number should use.
 *
 * The blades do this with intl-tel-input, the same 18.2.0 they pull from cdnjs, and always
 * with the same two options: the dial code shown apart from the input, and the client's own
 * eight preferred countries at the top of the list (auth/register_i.blade.php:695,
 * auth/business_register.blade.php:813, ads/index.blade.php:999). They then read
 * `iti.getNumber()` into a hidden field on every input/change/countrychange and submit that.
 *
 * This carries the same behaviour: the visible input holds what the user types, and `onChange`
 * hands the caller the full international number, which is what the API stores.
 */

/** the order the blades put at the top of the list */
const PREFERRED = ['us', 'gb', 'in', 'ca', 'au', 'es', 'it', 'de'];

export function PhoneField({
  value,
  onChange,
  className,
  placeholder,
  required,
  id,
  name,
}: {
  /** the full international number held by the form */
  value: string;
  onChange: (fullNumber: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  name?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<Iti | null>(null);
  /* the handler is read through a ref so the plugin is set up once and never torn down
     mid-typing, which would drop the country the user picked */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const iti = intlTelInput(input, {
      separateDialCode: true,
      preferredCountries: PREFERRED,
      /* getNumber() returns an empty string without this, which is why the hidden field in
         some of the blades stays empty; the script ships with the package rather than being
         fetched from a CDN at runtime */
      utilsScript,
      /* the utils script would otherwise put an example number in the field and lose the
         wording each form was given — the blades keep their own placeholder */
      autoPlaceholder: 'off',
    });
    itiRef.current = iti;

    const emit = () => {
      const full = iti.getNumber();
      if (full) {
        onChangeRef.current(full);
        return;
      }
      /* utils not in yet: keep the dial code in front of what has been typed so a fast
         typist's first keystrokes are not lost */
      const dial = iti.getSelectedCountryData().dialCode ?? '';
      const typed = input.value.trim();
      onChangeRef.current(typed ? `+${dial}${typed.replace(/^\+?/, '')}` : '');
    };

    input.addEventListener('input', emit);
    input.addEventListener('change', emit);
    input.addEventListener('countrychange', emit);

    return () => {
      input.removeEventListener('input', emit);
      input.removeEventListener('change', emit);
      input.removeEventListener('countrychange', emit);
      iti.destroy();
      itiRef.current = null;
    };
  }, []);

  /* a number the form already holds — an edit form, or a value restored after a failed
     submit — is put back through the plugin so the right flag is shown with it */
  useEffect(() => {
    const iti = itiRef.current;
    const input = inputRef.current;
    if (!iti || !input) return;
    if (!value || value === iti.getNumber()) return;
    iti.setNumber(value);
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="tel"
      className={className}
      placeholder={placeholder}
      required={required}
    />
  );
}
