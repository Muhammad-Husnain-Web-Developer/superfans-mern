import { createElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { localeLogo } from '../auth/AuthShell';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';

export interface MerchProduct {
  name: string;
  color: string;
  tag: string;
  price: number;
  image: string;
  slug: string;
  extraImages?: string[];
  height?: string;
}

const MONO =
  'Consolas, Menlo, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace, serif';

/**
 * blade parity: the category is derived from the product name, and the socks test
 * looks for 'suck' — a typo in the original, so SuperSocks gets no category and the
 * 🧦 anchor has no target. Kept as-is; fixing it would change the live behaviour.
 */
function categoryOf(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('top')) return 'tops';
  if (l.includes('cap')) return 'caps';
  if (l.includes('hoodie')) return 'hoodies';
  if (l.includes('shirt')) return 'shirt';
  if (l.includes('cup')) return 'cups';
  if (l.includes('suck')) return 'socks';
  return '';
}

/** Product catalogue — port of merchandising/index.blade.php (a standalone Bootstrap 4 page). */
export function Merchandising() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/merchandising.css']);
  const { t, i18n } = useTranslation('content');
  const [products, setProducts] = useState<MerchProduct[]>([]);
  const { t: tUi } = useTranslation('ui');

  useEffect(() => {
    document.title = 'Superfans | Merchandising';
    api
      .get<{ data: MerchProduct[] }>('/merchandising')
      .then(({ data }) => setProducts(data.data))
      .catch(() => setProducts([]));
  }, []);

  return (
    <div className="container">
      <a href="/">
        {/* localeLogo already returns a full path — do not wrap it in assetImage */}
        <img src={localeLogo(i18n.language)} alt="Superfans Logo" className="logo" />
      </a>

      <h2 id="influencerTitle">{tUi('merch_loading')}</h2>

      <div className="btn-group" style={{ gap: 10, marginBottom: 10 }}>
        <a href="#top" className="btn-rank btn-all">👙</a>
        <a href="#hoodies" className="btn-rank">🧥</a>
        <a href="#shirt" className="btn-rank">👕</a>
      </div>
      <div className="btn-group" style={{ gap: 10 }}>
        <a href="#caps" className="btn-rank">🧢</a>
        <a href="#socks" className="btn-rank">🧦</a>
        <a href="#cups" className="btn-rank">☕</a>
      </div>

      <div className="container py-5">
        <h2
          style={{
            fontFamily: MONO,
            textAlign: 'left',
            fontSize: '1.29em',
          }}
          dangerouslySetInnerHTML={{ __html: t('mar_head') }}
        />

        <br />
        <br />

        <div className="d-flex flex-wrap justify-content-center">
          {products.map((product) => (
            <a
              key={product.slug}
              href={`/merchandising/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', color: '#111' }}
            >
              <article
                id="influencerDestacado"
                style={{
                  display: 'inline-block',
                  width: 247,
                  border: '1px solid #444',
                  backgroundColor: '#f1f1f1',
                  borderRadius: 24,
                  padding: 9,
                  textAlign: 'left',
                  fontFamily: MONO,
                  marginBottom: 11,
                  marginRight: 11,
                  position: 'relative',
                }}
              >
                <img
                  src={assetImage(`merch/${product.image}`)}
                  alt={product.name}
                  style={{
                    width: '100%',
                    borderTopLeftRadius: 19,
                    borderTopRightRadius: 19,
                    border: '1px solid #444',
                    ...(product.height ? { height: product.height } : {}),
                  }}
                />

                <div id={categoryOf(product.name) || undefined} style={{ position: 'relative', width: '100%', margin: '0 auto' }}>
                  <div style={{ marginTop: 15 }}>
                    <b style={{ fontSize: '1.1em', fontFamily: MONO, color: '#111' }}>{product.name}</b>
                    {/* the blade uses a literal <font> tag; createElement keeps the same DOM */}
                    {createElement('font', { style: { fontSize: '0.74em', color: '#999' } }, ` | ${product.color}`)}
                    <br />
                    <b style={{ fontSize: '0.80em', color: '#999', position: 'relative', bottom: 7 }}>
                      {product.tag}
                    </b>
                  </div>

                  <p
                    style={{
                      marginTop: 10,
                      marginBottom: 0,
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      border: '5px solid black',
                      color: '#c3c3c3',
                      backgroundColor: '#585858',
                      fontFamily: MONO,
                      paddingLeft: 4,
                      paddingRight: 7,
                      paddingTop: 9,
                      fontSize: 14,
                      width: '75%',
                      position: 'relative',
                      overflowX: 'hidden',
                      overflowY: 'hidden',
                    }}
                  >
                    <span style={{ width: 20, height: 20, background: '#585858', position: 'absolute', zIndex: 2, left: 0 }}></span>
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        display: 'inline-block',
                        marginRight: 5,
                        zIndex: 3,
                        position: 'relative',
                        left: 5,
                        top: -4,
                        fontSize: '1.4em',
                      }}
                    >
                      🛒
                    </span>
                    <span style={{ display: 'inline-block', fontSize: 15, width: '78%', position: 'relative', left: 4 }}>
                      <marquee behavior="scroll" direction="left" scrollAmount={5}>
                        OFFER: {t('price')}
                        {product.price}.00
                        {t('pricee')}
                      </marquee>
                    </span>
                  </p>
                </div>
              </article>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
