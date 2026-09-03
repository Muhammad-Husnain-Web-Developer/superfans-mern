import { useMemo } from 'react';
import { useCities, useCountries } from '../../data/geo';

/**
 * The country and city dropdowns, wherever Super Ads asks for a place.
 *
 * The city was a free-text box, so an advertiser could aim at a city that is not in the
 * country they picked, or spell one two different ways ("Malaga" / "Málaga"). Both are lists
 * now: every country in the world on the first, and on the second whatever cities that
 * country holds, fetched from /api/geo when it is chosen — which also means the city box has
 * nothing to offer until a country is chosen, so until then it is disabled and says so.
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
  const countries = useCountries();

  /* the options are built once per list, not once per keystroke elsewhere in the form:
     React sees the same elements back and leaves the whole subtree alone */
  const options = useMemo(
    () =>
      countries.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      )),
    [countries],
  );

  return (
    <select
      className={className}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      data-field="country"
    >
      <option value="">Select a country</option>
      {/* a country saved before this list existed is kept, so reopening the form does not
          quietly blank what the advertiser had chosen */}
      {value && !countries.includes(value) && <option value={value}>{value}</option>}
      {options}
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
  const { cities, loading } = useCities(country);

  /* a city saved before this dropdown existed is kept on the list, so opening the form
     again does not quietly change what the advertiser had chosen */
  const kept = value && !cities.includes(value) ? value : '';

  const options = useMemo(
    () =>
      cities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      )),
    [cities],
  );

  return (
    <select
      className={className}
      value={value}
      disabled={!country}
      onChange={(e) => onChange(e.target.value)}
      title={country ? undefined : 'Choose a country first'}
      data-field="city"
    >
      <option value="">
        {!country ? 'Select a country first' : loading ? 'Loading cities…' : 'Select a city'}
      </option>
      {kept && <option value={kept}>{kept}</option>}
      {options}
    </select>
  );
}
