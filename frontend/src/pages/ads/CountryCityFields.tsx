import { COUNTRIES, citiesFor } from '../../data/countryCities';

/**
 * The country and city dropdowns, wherever Super Ads asks for a place.
 *
 * The city was a free-text box, so an advertiser could aim at a city that is not in the
 * country they picked, or spell one two different ways. It is a list now, and the list is
 * whatever the chosen country holds — which also means the city box has nothing to offer
 * until a country is chosen, so until then it is disabled and says so.
 *
 * They are two separate controls rather than one block because the two forms that use them
 * lay their fields out differently — the ad modal side by side, the profile in a Bootstrap
 * grid — and each should keep its own layout.
 */

export function CountrySelect({
  value,
  onChange,
  className = 'form-control form-control-sm',
  required = false,
}: {
  value: string;
  /** the city is cleared here: one from the old country belongs to nowhere in the new one */
  onChange: (country: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <select
      className={className}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      data-field="country"
    >
      <option value="">Select a country</option>
      {COUNTRIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function CitySelect({
  country,
  value,
  onChange,
  className = 'form-control form-control-sm',
}: {
  country: string;
  value: string;
  onChange: (city: string) => void;
  className?: string;
}) {
  /* a city saved before this dropdown existed is kept on the list, so opening the form
     again does not quietly change what the advertiser had chosen */
  const cities = citiesFor(country, value);

  return (
    <select
      className={className}
      value={value}
      disabled={!country}
      onChange={(e) => onChange(e.target.value)}
      title={country ? undefined : 'Choose a country first'}
      data-field="city"
    >
      <option value="">{country ? 'Select a city' : 'Select a country first'}</option>
      {cities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
