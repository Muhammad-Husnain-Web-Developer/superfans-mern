import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ALL_COUNTRIES } from './countries';

/**
 * Countries and cities for the forms that ask where somebody is.
 *
 * Both come from `/api/geo` — every country in the world, and on picking one, that country's
 * whole city list (the same shape Laravel got from countriesnow.space, served from our own
 * dataset instead). The full set is 148k cities, so the city list is fetched per country
 * rather than shipped in the bundle.
 *
 * Each answer is kept for the life of the tab: a form reopened, or the second of the two forms
 * that use these, costs nothing. If the request fails the country dropdown falls back to the
 * checked-in list, so the form still works when the API does not.
 */

let countriesPromise: Promise<string[]> | null = null;
const cityCache = new Map<string, string[]>();

function fetchCountries(): Promise<string[]> {
  if (!countriesPromise) {
    countriesPromise = api
      .get<{ data: { name: string }[] }>('/geo/countries')
      .then((r) => r.data.data.map((c) => c.name))
      .catch(() => {
        countriesPromise = null; // a failed fetch should not be the answer forever
        return ALL_COUNTRIES;
      });
  }
  return countriesPromise;
}

/** Every country, alphabetically. Starts on the checked-in list so the select is never empty. */
export function useCountries(): string[] {
  const [countries, setCountries] = useState<string[]>(ALL_COUNTRIES);

  useEffect(() => {
    let live = true;
    void fetchCountries().then((list) => {
      if (live && list.length) setCountries(list);
    });
    return () => {
      live = false;
    };
  }, []);

  return countries;
}

/** The chosen country's cities. Empty until a country is picked, and while its list loads. */
export function useCities(country: string): { cities: string[]; loading: boolean } {
  const [cities, setCities] = useState<string[]>(() => cityCache.get(country) ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!country) {
      setCities([]);
      setLoading(false);
      return;
    }

    const cached = cityCache.get(country);
    if (cached) {
      setCities(cached);
      setLoading(false);
      return;
    }

    /* the country can change again before this lands — only the current one may set state */
    let live = true;
    setCities([]);
    setLoading(true);
    api
      .get<{ data: string[] }>('/geo/cities', { params: { country } })
      .then((r) => {
        cityCache.set(country, r.data.data);
        if (live) setCities(r.data.data);
      })
      .catch(() => {
        if (live) setCities([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [country]);

  return { cities, loading };
}
