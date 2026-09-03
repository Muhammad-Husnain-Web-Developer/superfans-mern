import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const geoRouter = Router();

/**
 * Countries and their cities, for every form that asks where somebody is.
 *
 * Laravel pulled this off countriesnow.space from the browser — every country in the world,
 * and on picking one, that country's whole city list. We serve the same thing from the
 * `country-state-city` dataset instead, so the form does not depend on a third party being up
 * and the browser only ever downloads the one country it asked for (the full set is 148k
 * cities — far too much to ship in the bundle).
 *
 * The dataset is loaded on the first request rather than at boot: it costs ~80 MB of memory,
 * which a server nobody has opened the ads form on should not be paying.
 */

interface CountryDto {
  name: string;
  iso2: string;
}

let countriesCache: CountryDto[] | null = null;
const citiesCache = new Map<string, string[]>();

async function dataset() {
  return import('country-state-city');
}

async function allCountries(): Promise<CountryDto[]> {
  if (!countriesCache) {
    const { Country } = await dataset();
    countriesCache = Country.getAllCountries()
      .map((c) => ({ name: c.name, iso2: c.isoCode }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return countriesCache;
}

/** Accepts either the ISO code the select sends or the country name stored on old records. */
async function resolveIso(country: string): Promise<string | null> {
  const wanted = country.trim();
  if (!wanted) return null;
  const list = await allCountries();
  if (/^[A-Za-z]{2}$/.test(wanted)) {
    const code = wanted.toUpperCase();
    return list.some((c) => c.iso2 === code) ? code : null;
  }
  const match = list.find((c) => c.name.toLowerCase() === wanted.toLowerCase());
  return match ? match.iso2 : null;
}

/** Reference data changes about never, so let the browser keep it for a day. */
function cacheForADay(res: { set: (k: string, v: string) => void }) {
  res.set('Cache-Control', 'public, max-age=86400');
}

geoRouter.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const data = await allCountries();
    cacheForADay(res);
    res.json({ success: true, data });
  }),
);

geoRouter.get(
  '/cities',
  asyncHandler(async (req, res) => {
    const iso = await resolveIso(String(req.query.country ?? ''));
    if (!iso) {
      res.json({ success: true, data: [] });
      return;
    }

    let cities = citiesCache.get(iso);
    if (!cities) {
      const { City } = await dataset();
      /* the dataset repeats a name once per region (two Springfields, two Guadalajaras),
         and the form only stores the name — so one entry each, alphabetically */
      cities = [...new Set(City.getCitiesOfCountry(iso)?.map((c) => c.name) ?? [])].sort((a, b) =>
        a.localeCompare(b),
      );
      citiesCache.set(iso, cities);
    }

    cacheForADay(res);
    res.json({ success: true, data: cities });
  }),
);
