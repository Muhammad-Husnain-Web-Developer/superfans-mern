/**
 * The countries Super Ads targets, and the cities inside each one.
 *
 * The city used to be typed by hand, which let two advertisers aim at the same place under
 * two spellings ("Malaga" / "Málaga") and let anybody target a city that is not in the
 * country they picked. Both lists live here so the ad form and the advertiser's profile
 * form offer exactly the same choices.
 *
 * These are the principal cities of each country, not every town: enough to aim an ad,
 * short enough to pick from. Spain and Latin America carry more of them, since that is
 * where the audience is. A city the client asks for is one line to add.
 */

export const COUNTRY_CITIES: Record<string, string[]> = {
  Spain: [
    'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma',
    'Las Palmas de Gran Canaria', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo',
    'Gijón', 'Granada', 'A Coruña', 'Vitoria-Gasteiz', 'Elche', 'Santa Cruz de Tenerife',
    'Oviedo', 'Badalona', 'Cartagena', 'Terrassa', 'Jerez de la Frontera', 'Sabadell',
    'Móstoles', 'Alcalá de Henares', 'Pamplona', 'Fuenlabrada', 'Almería', 'San Sebastián',
    'Leganés', 'Santander', 'Castellón de la Plana', 'Burgos', 'Albacete', 'Alcorcón',
    'Getafe', 'Salamanca', 'Huelva', 'Logroño', 'Badajoz', 'Tarragona', 'León', 'Cádiz',
    'Lleida', 'Marbella', 'Dos Hermanas', 'Torrejón de Ardoz', 'Girona', 'Ibiza',
  ],
  'United States': [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio',
    'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus',
    'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Boston', 'Nashville',
    'Las Vegas', 'Portland', 'Miami', 'Atlanta', 'Orlando', 'Washington DC', 'Detroit',
  ],
  'United Kingdom': [
    'London', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol',
    'Glasgow', 'Edinburgh', 'Leicester', 'Coventry', 'Cardiff', 'Belfast', 'Nottingham',
    'Newcastle upon Tyne', 'Brighton', 'Southampton', 'Oxford', 'Cambridge', 'Aberdeen',
  ],
  Mexico: [
    'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez',
    'Zapopan', 'Mérida', 'Querétaro', 'Cancún', 'Toluca', 'Chihuahua', 'Aguascalientes',
    'San Luis Potosí', 'Hermosillo', 'Culiacán', 'Saltillo', 'Morelia', 'Veracruz', 'Puerto Vallarta',
  ],
  Argentina: [
    'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'San Miguel de Tucumán',
    'Mar del Plata', 'Salta', 'Santa Fe', 'San Juan', 'Resistencia', 'Neuquén', 'Bariloche',
    'Corrientes', 'Posadas', 'Bahía Blanca',
  ],
  Colombia: [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Bucaramanga',
    'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Villavicencio', 'Pasto', 'Armenia',
  ],
  Chile: [
    'Santiago', 'Valparaíso', 'Concepción', 'Viña del Mar', 'Antofagasta', 'La Serena',
    'Temuco', 'Rancagua', 'Iquique', 'Puerto Montt', 'Arica', 'Talca',
  ],
  Peru: [
    'Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco', 'Huancayo', 'Iquitos',
    'Tacna', 'Chimbote', 'Callao',
  ],
  France: [
    'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg',
    'Bordeaux', 'Lille', 'Rennes', 'Toulon', 'Grenoble', 'Cannes', 'Saint-Étienne',
  ],
  Germany: [
    'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf',
    'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nuremberg',
  ],
  Italy: [
    'Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari',
    'Catania', 'Venice', 'Verona', 'Messina', 'Padua',
  ],
  Portugal: [
    'Lisbon', 'Porto', 'Vila Nova de Gaia', 'Amadora', 'Braga', 'Funchal', 'Coimbra',
    'Setúbal', 'Almada', 'Faro', 'Aveiro', 'Albufeira',
  ],
  Brazil: [
    'São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte',
    'Manaus', 'Curitiba', 'Recife', 'Porto Alegre', 'Goiânia', 'Belém', 'Florianópolis',
    'Campinas', 'Natal',
  ],
  Canada: [
    'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg',
    'Quebec City', 'Hamilton', 'Halifax', 'Victoria',
  ],
  Netherlands: [
    'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg',
    'Almere', 'Breda', 'Nijmegen',
  ],
  Belgium: [
    'Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven',
  ],
  Ireland: ['Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda'],
  Switzerland: [
    'Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Lucerne', 'Lugano',
  ],
  Austria: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt'],
  Sweden: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro'],
  Norway: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen', 'Tromsø'],
  Denmark: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'],
  Poland: [
    'Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Katowice',
    'Lublin', 'Białystok',
  ],
  Australia: [
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra',
    'Hobart', 'Darwin', 'Newcastle',
  ],
};

/** The country dropdown, in the order the list above is written. */
export const COUNTRIES = Object.keys(COUNTRY_CITIES);

/**
 * The cities to offer for a country. A value already saved against the ad or the profile is
 * kept even when it is not on the list — an advertiser who typed their own city before this
 * dropdown existed should not have it quietly changed the next time the form is opened.
 */
export function citiesFor(country: string, keep?: string): string[] {
  const list = COUNTRY_CITIES[country] ?? [];
  if (keep && keep.trim() && !list.includes(keep)) return [keep, ...list];
  return list;
}
