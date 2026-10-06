import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage, formatPrice } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { usePaymentReturn } from '../../utils/usePaymentReturn';
import { localeLogo } from '../auth/AuthShell';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { ALL_COUNTRIES as COUNTRIES } from '../../data/countries';
import type { MerchProduct } from './Merchandising';

const MONO =
  'Consolas, Menlo, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace, serif';

interface InfluencerOption {
  id: string;
  usernameUrl: string;
  verified: boolean;
}

/**
 * Product page — port of merchandising/show.blade.php. Shows the product (with an
 * image carousel when it has extra images), the price, and the shipping form with
 * the referring-creator autocomplete.
 *
 * Checkout itself goes through Redsys in Laravel; that gateway is a later milestone,
 * so submitting reports that payments are not configured yet rather than pretending.
 */
export function MerchandisingShow() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/merchandising-show.css']);
  const { slug = '' } = useParams();
  const { i18n } = useTranslation('content');
  const { t: tAuth } = useTranslation('auth');
  const { user: authUser } = useAuth();
  const { t: tUi } = useTranslation('ui');

  const [product, setProduct] = useState<MerchProduct | null>(null);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [slide, setSlide] = useState(0);

  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [address, setAddress] = useState('');
  const [referrer, setReferrer] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const paymentStatus = usePaymentReturn();

  useEffect(() => {
    api
      .get<{ data: { product: MerchProduct; influencers: InfluencerOption[] } }>(
        `/merchandising/${slug}`,
      )
      .then(({ data }) => {
        setProduct(data.data.product);
        setInfluencers(data.data.influencers);
        document.title = `Superfans | ${data.data.product.name}`;
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <div className="container py-5 text-center">{tUi('product_not_found')}</div>;
  if (!product) return null;

  const images = [product.image, ...(product.extraImages ?? [])];
  const suggestions = referrer.trim()
    ? influencers
        .filter((i) => i.usernameUrl.toLowerCase().includes(referrer.trim().toLowerCase()))
        .slice(0, 10)
    : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setNotice('Redirecting to secure checkout…');
    api
      .post<{ url?: string }>('/payments/merch/checkout', {
        slug: product.slug,
        amount: product.price,
        email: email || undefined,
        referredInfluencerId: referrerId || undefined,
      })
      .then(({ data }) => {
        if (data.url) window.location.href = data.url;
        else setNotice('Payments are not configured yet.');
      })
      .catch(() => setNotice('Could not start checkout. Please try again.'));
  }

  return (
    <div className="product-container">
      <a href="/">
        <img
          src={localeLogo(i18n.language)}
          alt={tUi('alt_logo')}
          className="mb-4"
          style={{ maxWidth: 200, display: 'block', margin: '0 auto' }}
        />
      </a>

      <h2 className="text-center mb-3">{product.name}</h2>
      <p className="text-center tag">
        Color: {product.color} | {product.tag}
      </p>

      {images.length > 1 ? (
        <div id={`carousel-${product.slug}`} className="carousel slide mb-4">
          <div className="carousel-inner">
            {images.map((img, i) => (
              <div className={`carousel-item${i === slide ? ' active' : ''}`} key={img}>
                <img
                  src={assetImage(`merch/${img}`)}
                  className="d-block w-100 product-image"
                  alt={product.name}
                />
              </div>
            ))}
          </div>
          <button
            className="carousel-control-prev"
            type="button"
            onClick={() => setSlide((s) => (s - 1 + images.length) % images.length)}
          >
            <span className="carousel-control-prev-icon custom-carousel-icon"></span>
          </button>
          <button
            className="carousel-control-next"
            type="button"
            onClick={() => setSlide((s) => (s + 1) % images.length)}
          >
            <span className="carousel-control-next-icon custom-carousel-icon"></span>
          </button>
        </div>
      ) : (
        <img
          src={assetImage(`merch/${product.image}`)}
          alt={product.name}
          className="product-image mt-3 mb-4"
        />
      )}

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
          width: '100%',
          maxWidth: 400,
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
          <marquee id="price-display" behavior="scroll" direction="left" scrollAmount={5}>
            OFFER: {formatPrice(product.price, 2)}
          </marquee>
        </span>
      </p>

      <br />
      <br />

      <form id="payment-form" onSubmit={submit}>
        <input type="hidden" id="amount" name="amount" value={product.price * 100} readOnly />
        <input type="hidden" name="product_id" value={product.slug} readOnly />

        {!authUser && (
          <div className="form-group required">
            <label htmlFor="email">{tUi('email_address')}</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}

        <div className="form-group required">
          <label htmlFor="country">{tUi('country_label')}</label>
          <select
            id="country"
            className="form-control country-select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          >
            <option value="">{tUi('select_country')}</option>
            {COUNTRIES.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group required">
          <label htmlFor="city">{tUi('city_label')}</label>
          <input
            type="text"
            id="city"
            className="form-control"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </div>

        <div className="form-group required">
          <label htmlFor="zip">{tUi('zip_code')}</label>
          <input
            type="text"
            id="zip"
            className="form-control"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            required
          />
        </div>

        <div className="form-group required">
          <label htmlFor="address">{tUi('shipping_address')}</label>
          <input
            type="text"
            id="address"
            className="form-control"
            placeholder={tUi('address_example')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        <p>
          <img src={assetImage('cardesecurity.png')} style={{ width: 50 }} alt="" />
          {tUi('redsys_secure')}
        </p>

        <div className="form-group" style={{ position: 'relative' }}>
          <label>
            {tAuth('referrer')}
            <span className="tooltip-container">
              ⓘ
              <span
                className="tooltip-text"
                dangerouslySetInnerHTML={{ __html: tAuth('referral_info') }}
              />
            </span>
          </label>
          <input
            type="text"
            id="referred_influencer"
            placeholder={tAuth('referrer_username_placeholder')}
            className="form-control"
            autoComplete="off"
            value={referrer}
            onChange={(e) => {
              setReferrer(e.target.value);
              setReferrerId('');
            }}
          />
          <input type="hidden" id="referred_influencer_id" value={referrerId} readOnly />
          <div id="influencer-suggestion-box" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10000 }}>
            <ul
              id="influencer-suggestions"
              style={{
                listStyle: 'none',
                padding: 0,
                background: '#fff',
                display: suggestions.length ? 'block' : 'none',
                maxHeight: 150,
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  style={{ padding: '6px 10px', cursor: 'pointer' }}
                  onClick={() => {
                    setReferrer(s.usernameUrl);
                    setReferrerId(s.id);
                  }}
                >
                  @{s.usernameUrl}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {(paymentStatus || notice) && (
          <p style={{ textAlign: 'center', color: '#856404', background: '#fff3cd', padding: 10 }}>
            {paymentStatus?.message ?? notice}
          </p>
        )}

        <div className="row">
          <div className="col-12 text-center">
            <button
              id="pay-button"
              className="btn btn-success"
              type="submit"
              style={{
                paddingRight: 22,
                paddingLeft: 22,
                backgroundColor: 'limegreen',
                borderColor: 'limegreen',
                color: '#fff',
                fontFamily: MONO,
                fontSize: '1.17em',
                textDecoration: 'none',
                border: '3px solid green',
                borderRadius: 'unset',
              }}
            >
              <span id="pay-text">
                <b>
                  Pay {formatPrice(product.price, 2)}{' '}
                </b>
              </span>
            </button>
          </div>
        </div>
      </form>

      <a href="/merchandising" className="back-link" style={{ textDecoration: 'none' }}>
        ← Back to Merchandising
      </a>
    </div>
  );
}
