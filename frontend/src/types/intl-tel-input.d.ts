/**
 * intl-tel-input 18.2.0 ships no types of its own — the version is pinned to the one the
 * Laravel app loads from cdnjs, so the country list and the markup are identical. Only the
 * pieces PhoneField uses are declared.
 */
declare module 'intl-tel-input' {
  export interface Iti {
    /** the full international number, e.g. "+34600112233" (needs the utils script) */
    getNumber(): string;
    /** the selected country, for the fallback when utils has not loaded */
    getSelectedCountryData(): { dialCode?: string; iso2?: string; name?: string };
    setNumber(value: string): void;
    destroy(): void;
  }

  export interface ItiOptions {
    separateDialCode?: boolean;
    preferredCountries?: string[];
    initialCountry?: string;
    utilsScript?: string;
    nationalMode?: boolean;
    autoPlaceholder?: 'polite' | 'aggressive' | 'off';
  }

  export default function intlTelInput(input: HTMLInputElement, options?: ItiOptions): Iti;
}

declare module 'intl-tel-input/build/js/utils.js?url' {
  const url: string;
  export default url;
}
