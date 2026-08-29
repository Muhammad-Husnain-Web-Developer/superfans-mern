import { useEffect, useState } from 'react';
import { CountrySelect, CitySelect } from './CountryCityFields';

/**
 * Target-audience location — port of the country/city picker in the ads modal. Kept to a
 * single country + city (the Laravel version supports multiple via a pipe-joined hidden
 * field); the backend stores the resulting country/city on the Ad.
 *
 * Both are lists now: the city offered is one of the chosen country's own, and until a
 * country is chosen there is nothing to choose from, so the city box stays shut.
 */
export function LocationPicker({ onChange }: { onChange: (country: string, city: string) => void }) {
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    onChange(country, city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, city]);

  return (
    <div className="w-75 mx-auto my-3">
      <div className="d-flex" style={{ gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="w-100 text-left" style={{ fontSize: 16 }}>
            Country
          </label>
          <CountrySelect
            value={country}
            required
            onChange={(c) => {
              setCountry(c);
              /* the old country's city cannot belong to the new one */
              setCity('');
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="w-100 text-left" style={{ fontSize: 16 }}>
            City
          </label>
          <CitySelect country={country} value={city} onChange={setCity} />
        </div>
      </div>
    </div>
  );
}
