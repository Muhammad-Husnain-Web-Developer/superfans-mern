import { useEffect, useState } from 'react';

const COUNTRIES = [
  'Spain', 'United States', 'United Kingdom', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru',
  'France', 'Germany', 'Italy', 'Portugal', 'Brazil', 'Canada', 'Netherlands', 'Belgium', 'Ireland',
  'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Poland', 'Australia',
];

/**
 * Target-audience location — port of the country/city picker in the ads modal. Kept to a
 * single country + city (the Laravel version supports multiple via a pipe-joined hidden
 * field); the backend stores the resulting country/city on the Ad.
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
          <label className="w-100 text-left" style={{ fontSize: 16 }}>Country</label>
          <select className="form-control form-control-sm" value={country} onChange={(e) => setCountry(e.target.value)} required>
            <option value="">Select a country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="w-100 text-left" style={{ fontSize: 16 }}>City</label>
          <input className="form-control form-control-sm" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
