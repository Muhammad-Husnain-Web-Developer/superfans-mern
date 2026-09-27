import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { NetworkDetail, ProfileData } from '../../api/profiles';
import {
  H3,
  HR,
  SAVE_BTN,
  FILE_INPUT,
  FILE_SAVE_BTN,
  SELECT_STYLE,
  RelationTile,
  type RelationRow,
  type SocialNetworkOption,
} from './ControlPanelModal';
import { useCropUpload } from './ControlPanelCropModal';
import { soundEffectsEnabled, setSoundEffectsEnabled } from '../../utils/soundEffects';
import { playModalOpenSound } from '../../utils/modalSounds';
import { SubscriberListModal } from './SubscriberListModal';

/**
 * Creator control panel — port of #exampleModalCenter's `@else` branch
 * (layouts_direct_user/footer.blade.php L3532-4560), i.e. the modal an
 * influencer sees. It differs from the fan one by adding the posts uploader,
 * subscription price, earnings, bank/PayPal payouts and the Super Ads /
 * SuperCalls links, and by dropping "become a creator".
 *
 * Note the blade's ordering quirk: the profile-picture border and footer credits
 * sit *under* the NETWORKS heading here, unlike in the fan modal.
 */
export function InfluencerControlPanelModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('content');
  const { t: tUi } = useTranslation('ui');
  const { t: tNav } = useTranslation('nav');
  const { setUser } = useAuth();

  const [bio, setBio] = useState(profile.bio ?? '');
  const [soundOn, setSoundOn] = useState(soundEffectsEnabled());
  const [username, setUsername] = useState(profile.usernameUrl ?? '');
  const [price, setPrice] = useState(String(profile.priceOfSubscription ?? ''));
  const [borderStatus, setBorderStatus] = useState(profile.profilePictureBorderStatus ?? '0');
  const [footerCredits, setFooterCredits] = useState(profile.footerNameUsername ?? 'name');
  const [instagramLink, setInstagramLink] = useState(profile.instagramLink ?? '');
  const [bankAccount, setBankAccount] = useState(profile.bankAccount ?? '');
  const [paypalAccount, setPaypalAccount] = useState(profile.paypalAccount ?? '');

  /* blade: round(earnings, 2), then append '.00' when the result has no decimal point */
  const [earnings, setEarnings] = useState(Math.round((profile.earnings ?? 0) * 100) / 100);
  const earningsDisplay = String(earnings).includes('.') ? String(earnings) : `${earnings}.00`;
  /* the client asked for this line beside the total: "Update in panels — Earnings of
     Video Ads". It is a breakdown, not a second purse — the total above is still what a
     withdrawal draws on, and this says how much of it came from Super Video. */
  const videoAds = Math.round((profile.videoAdsEarnings ?? 0) * 100) / 100;
  const videoAdsDisplay = String(videoAds).includes('.') ? String(videoAds) : `${videoAds}.00`;
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [subListOpen, setSubListOpen] = useState(false);
  // partnership — waits with the video-views row abov
  const [partnershipOpen, setPartnershipOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile.name ?? '');
  const [surname, setSurname] = useState(profile.surname ?? '');

  const [firstNetwork, setFirstNetwork] = useState(
    profile.networkDetails[0] ? String(profile.networkDetails[0].id) : '',
  );
  const [allNetworks, setAllNetworks] = useState<SocialNetworkOption[]>([]);
  const [newNetworkId, setNewNetworkId] = useState('');
  const [networkUrl, setNetworkUrl] = useState('');
  const [editNetwork, setEditNetwork] = useState<NetworkDetail | null>(null);
  const [editNetworkUrl, setEditNetworkUrl] = useState('');

  const [subscriptions, setSubscriptions] = useState<RelationRow[]>([]);
  const [followerships, setFollowerships] = useState<RelationRow[]>([]);

  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const { onFileChange, cropNode } = useCropUpload((filename, kind) => {
    void save(
      kind === 'profile' ? { profilePicture: filename } : { coverPicture: filename },
      kind === 'profile' ? 'Profile picture updated' : 'Cover picture updated',
    );
  });

  /* the client's woosh, fired from the panel's own mount so it lands with the panel
     however it was opened — sidebar item, phone footer or the profile page's button */
  useEffect(() => {
    playModalOpenSound();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    api
      .get<{ data: SocialNetworkOption[] }>('/social-networks')
      .then(({ data }) => setAllNetworks(data.data))
      .catch(() => setAllNetworks([]));
    api
      .get<{ data: { subscriptions: RelationRow[]; followerships: RelationRow[] } }>(
        '/me/control-panel-lists',
      )
      .then(({ data }) => {
        setSubscriptions(data.data.subscriptions);
        setFollowerships(data.data.followerships);
      })
      .catch(() => {});
  }, []);

  const takenIds = new Set(profile.networkDetails.map((n) => n.id));
  const availableNetworks = allNetworks.filter((n) => !takenIds.has(n.id));
  /* creators have no 3-network cap (unlike fans): the blade gates purely on
     $left_social_networks, i.e. whether any network is still unclaimed. */
  const noneLeft = availableNetworks.length === 0;

  useEffect(() => {
    if (!newNetworkId && availableNetworks.length) {
      const first = availableNetworks[0];
      setNewNetworkId(String(first.id));
      if (first.defaultAddress) setNetworkUrl(first.defaultAddress);
    }
  }, [availableNetworks, newNetworkId]);

  async function save(patch: Record<string, unknown>, successText = 'Updated successfully') {
    try {
      const { data } = await api.patch<{ success: boolean; data: Parameters<typeof setUser>[0] }>(
        '/me/settings',
        patch,
      );
      if (data.data) setUser(data.data);
      setFlash({ ok: true, text: successText });
      onSaved();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Update failed';
      setFlash({ ok: false, text: msg });
    }
  }

  async function addNetwork() {
    if (!newNetworkId) return;
    try {
      await api.post('/me/networks', { networkId: Number(newNetworkId), url: networkUrl });
      setFlash({ ok: true, text: tUi('network_added') });
      onSaved();
    } catch {
      setFlash({ ok: false, text: tUi('network_add_failed') });
    }
  }

  /* blade: a col-md-9 field beside a col-md-3 save button */
  const row = (field: ReactNode, onSave: () => void, key?: string, marginTop = 0) => (
    <div className="container-fluid" style={{ paddingLeft: 0, marginTop }} key={key}>
      <div className="row pb-3">
        <div className="col-md-9">{field}</div>
        <div className="col-md-3" style={{ textAlign: 'end', paddingRight: 22 }}>
          <button type="button" className="save_btn" style={SAVE_BTN} onClick={onSave}>
            {t('save_button_cpanel', { defaultValue: 'Save' })}
          </button>
        </div>
      </div>
    </div>
  );

  const textField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    extra?: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div className="form-group" style={{ display: 'flex' }}>
      <label style={{ color: 'white', whiteSpace: extra?.type === 'number' ? 'nowrap' : undefined }}>
        {label}{' '}
      </label>
      <input
        type="text"
        className="form-control"
        style={{ background: 'white', height: 40 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        {...extra}
      />
    </div>
  );

  const linkButton = (href: string, label: string) => (
    <center>
      <a
        href={href}
        target="_BLANK"
        rel="noreferrer"
        className="btn save_btn redirect_solicitar"
        style={{ background: 'transparent', color: 'white', border: '2px solid white' }}
      >
        {label}
      </a>
    </center>
  );

  return (
    <div
      className="modal fade in"
      id="exampleModalCenter"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="exampleModalCenterTitle"
      style={{
        zIndex: 123122,
        display: 'block',
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        style={{ margin: '30px auto', maxWidth: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content" style={{ borderRadius: 20, background: 'red' }}>
          <div className="modal-header" style={{ border: 0, display: 'block', padding: 15 }}>
            <button
              type="button"
              className="close d-block"
              aria-label={tUi('close')}
              onClick={onClose}
              style={{
                fontSize: 45,
                opacity: 1,
                color: 'white',
                background: 'transparent',
                border: 0,
                float: 'right',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div style={{ textAlign: 'center', marginTop: 35 }}>
              <img
                src="/assets/images/superman2.png"
                style={{ display: 'inline-block', height: 51 }}
                alt=""
              />
              <h5
                className="modal-title"
                style={{ fontSize: 30, textAlign: 'center', color: 'white', display: 'inline-block' }}
              >
                {tNav('control_panel', { defaultValue: 'Control panel' })}:
              </h5>
            </div>
          </div>

          <div className="modal-body" style={{ border: 0, padding: 15 }}>
            {flash && (
              <div
                style={{
                  background: flash.ok ? '#fff' : '#fff3cd',
                  color: flash.ok ? 'red' : '#856404',
                  padding: '8px 12px',
                  marginBottom: 12,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              >
                {flash.text}
              </div>
            )}

            {/* ---------- bio ---------- */}
            <div style={{ marginTop: 20 }}>
              <label htmlFor="bio" style={{ color: 'white' }}>
                {t('bio', { defaultValue: 'Bio' })}
              </label>
              <div className="container-fluid" style={{ paddingLeft: 0 }}>
                <div className="row pb-3">
                  <div className="col-md-9">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                      <textarea
                        className="form-control"
                        id="bio"
                        rows={3}
                        placeholder={t('bio_placeholder', { defaultValue: '' })}
                        style={{ background: 'white' }}
                        maxLength={290}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        required
                      />
                      <small id="charCount" style={{ color: bio.length > 290 ? 'red' : 'white', marginTop: 5 }}>
                        {bio.length} / 290
                      </small>
                    </div>
                  </div>
                  <div className="col-md-3" style={{ paddingRight: 22 }}>
                    <button type="button" className="save_btn" style={SAVE_BTN} onClick={() => void save({ bio })}>
                      {t('save_button_cpanel')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <br />
            {/* ---------- SOUND EFFECTS ----------
                The client asked for a master switch over every button sound in
                the app — the network slider's arrows, the like and hate on every
                wall. The white button is the live one, so Yes/No reads at a
                glance. Saved to localStorage the moment it is pressed. */}
            <h3 style={H3}>SOUND EFFECTS:</h3>
            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                <div className="col-md-12">
                  <button
                    type="button"
                    onClick={() => {
                      setSoundOn(true);
                      setSoundEffectsEnabled(true);
                    }}
                    style={{
                      ...SAVE_BTN,
                      marginRight: 10,
                      background: soundOn ? '#fff' : '#000',
                      color: soundOn ? 'red' : '#fff',
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSoundOn(false);
                      setSoundEffectsEnabled(false);
                    }}
                    style={{
                      ...SAVE_BTN,
                      background: soundOn ? '#000' : '#fff',
                      color: soundOn ? '#fff' : 'red',
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* ---------- profile info ---------- */}
            <h3 style={H3}>{t('profile_info', { defaultValue: 'Profile info' })}</h3>

            <div className="custom-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              <label style={{ marginBottom: 10, color: 'white', fontSize: 14 }}>{t('profile_picture')}</label>
              <input
                type="file"
                className="custom-file-input profile_picture"
                style={FILE_INPUT}
                accept="image/*"
                onChange={(e) => onFileChange('profile', e.target.files?.[0] ?? null)}
              />
              <button type="button" className="save_btn" style={FILE_SAVE_BTN}>
                {t('save_button_cpanel')}
              </button>
            </div>

            <div className="custom-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              <label style={{ marginBottom: 10, color: 'white', fontSize: 14 }}>{t('cover_picture')}</label>
              <input
                type="file"
                className="custom-file-input cover_picture"
                style={FILE_INPUT}
                accept="image/*"
                onChange={(e) => onFileChange('cover', e.target.files?.[0] ?? null)}
              />
              <button type="button" className="save_btn" style={FILE_SAVE_BTN}>
                {t('save_button_cpanel')}
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              {row(
                textField(t('username_url'), username, setUsername),
                () => void save({ usernameUrl: username }, 'Username/url editted successfully'),
              )}
            </div>

            {/* subscription price — creator only */}
            {row(
              textField(t('price_fee'), price, setPrice, { type: 'number', step: '0.01', min: '0.50' }),
              () => void save({ priceOfSubscription: price }, 'Price editted successfully'),
              'price',
              20,
            )}

            <hr style={HR} />
            <h3 style={H3}>{tUi('networks_heading')}</h3>

            {/* blade quirk: border + footer credits live under the NETWORKS heading here */}
            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                <div className="col-md-9">
                  <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>
                    {t('profile_picture_border', { defaultValue: 'Profile picture border' })}
                  </label>
                  {[
                    ['1', 'Yes'],
                    ['0', 'No'],
                  ].map(([value, label]) => (
                    <div className="form-check" style={{ display: 'inline-block' }} key={value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="profile_picture_border_status"
                        value={value}
                        checked={borderStatus === value}
                        onChange={() => setBorderStatus(value)}
                      />
                      <label className="form-check-label" style={{ color: 'white' }}>
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="col-md-3" style={{ textAlign: 'end', paddingRight: 22 }}>
                  <button
                    type="button"
                    className="save_btn"
                    style={SAVE_BTN}
                    onClick={() => void save({ profilePictureBorderStatus: borderStatus })}
                  >
                    {t('save_button_cpanel')}
                  </button>
                </div>
              </div>
            </div>

            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('footer_credits')}</label>
              <select
                className="form-control"
                style={SELECT_STYLE}
                value={footerCredits}
                onChange={(e) => setFooterCredits(e.target.value)}
              >
                <option style={{ color: 'black' }} value="name">{tUi('name_plain')}</option>
                <option style={{ color: 'black' }} value="username">{tUi('username')}</option>
              </select>
              <button
                type="button"
                className="save_btn"
                style={{ ...SAVE_BTN, position: 'relative', height: 'fit-content', marginRight: 21 }}
                onClick={() => void save({ footerNameUsername: footerCredits }, tUi('footer_content_saved'))}
              >
                {t('save_button_cpanel')}
              </button>
            </div>

            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('first_network')}</label>
              <select
                className="form-control"
                name="first_network"
                style={SELECT_STYLE}
                value={firstNetwork}
                onChange={(e) => setFirstNetwork(e.target.value)}
              >
                {profile.networkDetails.map((n) => (
                  <option style={{ color: 'black' }} value={String(n.id)} key={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="save_btn"
                style={{ ...SAVE_BTN, position: 'relative', height: 'fit-content', marginRight: 21 }}
                onClick={() =>
                  void api
                    .patch('/me/first-network', { firstNetwork })
                    .then(() => {
                      setFlash({ ok: true, text: tUi('network_reordered') });
                      onSaved();
                    })
                    .catch(() => setFlash({ ok: false, text: tUi('network_reorder_failed') }))
                }
              >
                {t('save_button_cpanel')}
              </button>
            </div>

            {profile.networkDetails.length > 0 && (
              <div>
                {profile.networkDetails.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="networkmodal"
                    onClick={() => {
                      setEditNetwork(n);
                      setEditNetworkUrl(n.link ?? '');
                    }}
                    style={{
                      background: 'white',
                      color: 'red',
                      padding: '3px 15px',
                      fontWeight: 'bold',
                      border: 0,
                      outline: 0,
                      position: 'relative',
                      height: 'fit-content',
                      marginRight: 21,
                      marginTop: 10,
                      marginBottom: 10,
                    }}
                  >
                    {n.name}
                    <i className="fa fa-edit" style={{ marginLeft: 5, fontSize: 17 }} aria-hidden="true"></i>
                  </button>
                ))}
              </div>
            )}

            <h3 style={H3}>{t('add_network')}</h3>
            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('choose_network')}</label>
              <select
                className="form-control"
                id="network_id"
                name="network_id"
                style={SELECT_STYLE}
                value={newNetworkId}
                onChange={(e) => {
                  setNewNetworkId(e.target.value);
                  const picked = availableNetworks.find((n) => String(n.id) === e.target.value);
                  if (picked?.defaultAddress) setNetworkUrl(picked.defaultAddress);
                }}
              >
                {noneLeft ? (
                  <option>{tUi('networks_all_taken')}</option>
                ) : (
                  availableNetworks.map((n) => (
                    <option className="network_option" value={String(n.id)} style={{ color: 'black' }} key={n.id}>
                      {n.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="save_btn"
                style={{ ...SAVE_BTN, position: 'relative', height: 'fit-content', marginRight: 21, visibility: 'hidden' }}
              >
                {t('save_button_cpanel')}
              </button>
            </div>

            {!noneLeft && (
              <div className="container-fluid" style={{ paddingLeft: 0 }}>
                <div className="row pb-3">
                  <div className="col-md-9">
                    <div className="form-group" style={{ display: 'flex' }}>
                      <label style={{ color: 'white' }}>{t('network_url')} </label>
                      <input
                        type="text"
                        className="form-control"
                        id="network_url_input"
                        style={{ background: 'white', height: 40 }}
                        value={networkUrl}
                        onChange={(e) => setNetworkUrl(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-3" style={{ textAlign: 'end', paddingRight: 22 }}>
                    <button type="button" className="save_btn" style={SAVE_BTN} onClick={addNetwork}>
                      {t('add_button_cpanel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------- payments (creator payouts) ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{t('payments')}</h3>

            {/* earnings is read-only in the blade (the input is commented out): a
                label with the rounded balance beside a withdraw button. */}
            <div className="container-fluid" style={{ paddingLeft: 0, marginTop: 20 }}>
              <div className="row pb-3">
                <div className="col-xs-6">
                  <div className="form-group" style={{ display: 'flex' }}>
                    <label style={{ color: 'white' }}>
                      {t('earnings')} ${earningsDisplay}
                    </label>
                  </div>
                </div>
                <div className="col-xs-6" style={{ textAlign: 'end', paddingRight: 22 }}>
                  <button type="button" className="save_btn" style={SAVE_BTN} onClick={() => setWithdrawOpen(true)}>
                    {t('withdraw_button_cpanel', { defaultValue: 'Withdraw money' })}
                  </button>
                </div>
              </div>
            </div>

            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                <div className="col-xs-12">
                  <div className="form-group" style={{ display: 'flex' }}>
                    <label style={{ color: 'white' }}>
                      {tUi('video_ads_earnings')} ${videoAdsDisplay}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                {/* <div className="col-xs-6">
                  <div className="form-group" style={{ display: 'flex' }}>
                    <label style={{ color: 'white' }}>{t('subscriber_history')}</label>
                  </div>
                </div> */}
                <div className="col-xs-6" style={{ textAlign: 'end', paddingRight: 22 }}>
                  {/* <button
                    type="button"
                    className="launch_subscriber_list_modal launch_sub_modal save_btn"
                    style={SAVE_BTN}
                    onClick={() => setSubListOpen(true)}
                  >
                    {t('see_all_button_cpanel')}
                  </button> */}
                </div>
              </div>
            </div>

          {}

            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                <div className="col-xs-6">
                  <div className="form-group" style={{ display: 'flex' }}>
                    <span style={{ color: '#fff', fontWeight: 900 }}>
                      {t('earnings_video_views')} $0.00
                    </span>
                  </div>
                </div>
                <div className="col-xs-6" style={{ textAlign: 'end', paddingRight: 22 }}>
                  <button type="button" style={PARTNERSHIP_BTN} onClick={() => setPartnershipOpen(true)}>
                    <span>{t('notavailable10k_title2')}</span>
                    <hr style={{ marginTop: 0, marginBottom: 0 }} />
                    {t('notavailable10k_button')}
                  </button>
                </div>
              </div>
            </div>

            <h3 style={H3}>{t('payment_methods')}</h3>

            {row(
              textField(t('bank_account'), bankAccount, setBankAccount),
              () => void save({ bankAccount }, 'Bank account editted successfully'),
              'bank',
              20,
            )}
            {row(
              textField(t('paypal'), paypalAccount, setPaypalAccount),
              () => void save({ paypalAccount }, 'Paypal account editted successfully'),
              'paypal',
              20,
            )}

            {/* ---------- account ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{t('account_info')}</h3>

            {row(textField(t('email'), email, setEmail), () => void save({ email }, 'Email editted successfully'), 'email', 20)}
            {row(textField(t('password'), password, setPassword), () => void save({ password }, 'Password editted successfully'), 'password', 20)}
            {row(textField(t('name'), name, setName), () => void save({ name }, 'Name editted successfully'), 'name', 20)}
            {row(textField(t('surname'), surname, setSurname), () => void save({ surname }, 'Surname editted successfully'), 'surname', 20)}
            {row(
              textField('Instagram link:', instagramLink, setInstagramLink),
              () => void save({ instagramLink }, 'Instagram link editted successfully'),
              'instagram',
              20,
            )}

            {/* ---------- relations ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{t('my_subscriptions')}</h3>
            {subscriptions.length === 0 ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'white' }}>{tUi('no_subscriptions')}</p>
            ) : (
              subscriptions.map((s) => (
                <Fragment key={s.id}>
                  <RelationTile username={s.usernameUrl} picture={s.profilePicture} />{' '}
                </Fragment>
              ))
            )}

            <hr style={HR} />
            <h3 style={H3}>{t('my_followerships')}</h3>
            {followerships.length === 0 ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'white' }}>{tUi('no_followerships')}</p>
            ) : (
              followerships.map((f) => (
                <Fragment key={f.id}>
                <RelationTile
                  username={f.usernameUrl}
                  picture={f.profilePicture}
                  onDelete={() =>
                    void api.delete(`/me/followership/${f.id}`).then(() => {
                      setFollowerships((prev) => prev.filter((x) => x.id !== f.id));
                    })
                  }
                />{' '}
                </Fragment>
              ))
            )}

            {/* ---------- creator-only promos ---------- */}
            <hr style={HR} />
            <h3 style={{ ...H3, textAlign: 'center' }}>{t('superadscenter')}</h3>
            {linkButton('/super-ads', t('superadscenterbutton'))}

            <hr style={HR} />
            <h3 style={{ ...H3, textAlign: 'center' }}>{t('supercalls_request')}</h3>
            {linkButton('https://app.superfans.world/superfanscalls/', t('solicitar'))}

            <hr style={HR} />
            <h3 style={{ ...H3, textAlign: 'center' }}>{t('instagram_growth')}</h3>
            <center>
              <a
                href={`mailto:superfansworldapp@gmail.com?subject=Hire%20a%20Manager&body=Hi,%20I'm%20${profile.usernameUrl}%20and%20I%20want%20to%20hire%20a%20Manager%20of%20Social%20Networks%20that%20help%20me%20to%20fix%20my%20Influencer%20Career%20and%20help%20me%20to%20be%20famous.`}
                className="btn save_btn"
                style={{ background: 'transparent', color: 'white', border: '2px solid white' }}
              >
                {t('contratar')}
              </a>
            </center>
          </div>
        </div>
      </div>

      {/* per-network URL editor */}
      {editNetwork && (
        <div
          className="modal fade in"
          style={{ zIndex: 123123, display: 'block', position: 'fixed', inset: 0, overflowY: 'auto', background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setEditNetwork(null)}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ margin: '30px auto', maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 20, background: 'red', padding: 15 }}>
              <div className="container-fluid" style={{ paddingLeft: 0 }}>
                <div className="row pb-3">
                  <div className="col-md-9">
                    <div className="form-group" style={{ display: 'flex' }}>
                      <label style={{ color: 'white' }}>{editNetwork.name} </label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ background: 'white', height: 40 }}
                        value={editNetworkUrl}
                        onChange={(e) => setEditNetworkUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-3" style={{ textAlign: 'end', paddingRight: 22 }}>
                    <button
                      type="button"
                      className="save_btn"
                      style={SAVE_BTN}
                      onClick={() =>
                        void api
                          .patch(`/me/networks/${editNetwork.id}`, { url: editNetworkUrl })
                          .then(() => {
                            setFlash({ ok: true, text: tUi('network_url_updated') });
                            setEditNetwork(null);
                            onSaved();
                          })
                          .catch(() => setFlash({ ok: false, text: tUi('network_update_failed') }))
                      }
                    >
                      {t('save_button_cpanel')}
                    </button>
                  </div>
                </div>
              </div>
              <span
                className="delete save_btn"
                onClick={() =>
                  void api.delete(`/me/networks/${editNetwork.id}`).then(() => {
                    setFlash({ ok: true, text: tUi('network_deleted') });
                    setEditNetwork(null);
                    onSaved();
                  })
                }
                style={{
                  background: 'white',
                  color: 'red',
                  padding: '6px 15px',
                  fontWeight: 'bold',
                  border: 0,
                  outline: 0,
                  textDecoration: 'none',
                  display: 'block',
                  width: 'fit-content',
                  marginLeft: 'auto',
                  marginRight: 5,
                  marginTop: 10,
                  cursor: 'pointer',
                }}
              >
                {t('delete_button_cpanel')}
              </span>
            </div>
          </div>
        </div>
      )}

      {cropNode}

      {withdrawOpen && (
        <WithdrawModal
          earnings={earnings}
          hasPayout={!!bankAccount && !!paypalAccount}
          onClose={() => setWithdrawOpen(false)}
          onDone={(newBalance) => {
            setEarnings(newBalance);
            setWithdrawOpen(false);
            setFlash({ ok: true, text: tUi('withdraw_sent') });
          }}
        />
      )}

      <SubscriberListModal
        usernameUrl={profile.usernameUrl ?? ''}
        open={subListOpen}
        onClose={() => setSubListOpen(false)}
      />

       {partnershipOpen && <PartnershipModal onClose={() => setPartnershipOpen(false)} />} 
    </div>
  );
}


/** The black two-line button beside the video-views figure (.open-btn in the blade). */
const PARTNERSHIP_BTN: React.CSSProperties = {
  background: '#000000',
  color: '#ffffff',
  padding: '3px 15px',
  fontWeight: 'bold',
  border: 0,
  outline: 0,
};

/**
 * "Ask Partnership" — port of #askPartnershipOverlay in layouts_influencer/footer.blade.php.
 *
 * The blade also carries a stray "Send Welcome Email" link to example@email.com inside this
 * box; it is placeholder debris, not something a creator should be shown, so it is left out.
 */
/**
 * "Ask Partnership" — port of #askPartnershipOverlay in layouts_influencer/footer.blade.php.
 */
function PartnershipModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('content');
  const { user } = useAuth();

  const emailSubject = encodeURIComponent('Partnership for generate incomes Ads in Video');
  const emailBody = encodeURIComponent(
    `Hello,👋 my name is ${user?.name || '......'} and  I request a Partnership for activate the Tool of EARNINGS WITH ADS.`
  );
  const mailtoLink = `mailto:superfansworldapp@gmail.com?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 999999999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 380,
          padding: '28px 22px',
          borderRadius: 7,
          textAlign: 'center',
          position: 'relative',
          color: '#fff',
          background: '#8a2be2',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 14, fontSize: 24, cursor: 'pointer', opacity: 0.7 }}
        >
          &times;
        </span>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 18, color: 'white' }}>
          {t('notavailable10k_title')}
        </h3>
        <p style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 14, fontWeight: 600 }}>
          {t('notavailable10k_message')}
        </p>

        {/* OK Button – opens email with pre-filled subject & body */}
        <a
          href={mailtoLink}
          onClick={() => setTimeout(onClose, 300)}
          style={{
            display: 'inline-block',
            marginTop: 18,
            background: 'limegreen',
            color: 'white',
            padding: '10px 40px',
            fontSize: '0.9em',
            fontWeight: 600,
            cursor: 'pointer',
            border: '3px solid green',
            fontFamily:
              'Consolas, Menlo, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
            textDecoration: 'none',
            transition: 'background-color 0.5s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'green';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'limegreen';
          }}
        >
          OK
        </a>
      </div>
    </div>
  );
}

/** Withdraw-earnings modal — port of #withdraw_earnings_modal (≥$50, payout method set). */
function WithdrawModal({
  earnings,
  hasPayout,
  onClose,
  onDone,
}: {
  earnings: number;
  hasPayout: boolean;
  onClose: () => void;
  onDone: (newBalance: number) => void;
}) {
  const { t } = useTranslation('content');
  const { t: tUi } = useTranslation('ui');
  const display = String(earnings).includes('.') ? String(earnings) : `${earnings}.00`;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { data } = await api.post<{ earnings: number }>('/me/withdraw-earnings', { amount });
      onDone(Math.round((data.earnings ?? 0) * 100) / 100);
    } catch (e2) {
      setErr(isAxiosError(e2) ? (e2.response?.data as { message?: string })?.message ?? 'Withdrawal failed.' : 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="sf-modal-scrim"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div className="sf-modal-pop" onClick={(e) => e.stopPropagation()} style={{ background: 'red', borderRadius: 20, color: '#fff', width: '100%', maxWidth: 480, padding: 28, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: 18, top: 10, fontSize: 40, color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src="/assets/images/superman2.png" alt="" style={{ height: 51 }} />
          <h5 style={{ fontSize: 28, color: '#fff', marginTop: 8 }}>{t('withdraw_title_cpanel', { defaultValue: 'Withdraw Earnings' })}</h5>
        </div>

        <label style={{ color: '#fff', marginTop: 10, display: 'block' }}>{t('earnings')} ${display}</label>

        {earnings < 50 ? (
          <p style={{ color: '#fff' }}>{tUi('withdraw_min_balance')}</p>
        ) : !hasPayout ? (
          <p style={{ color: '#fff' }}>{tUi('withdraw_no_method')}</p>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 16 }}>
            <p style={{ color: '#fff' }}>
              {tUi('withdraw_select_amount')}
              <br />
              {tUi('withdraw_max_available')}${display})
            </p>
            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <label style={{ color: '#fff', margin: 0 }}>{tUi('amount_label')}</label>
              <input
                type="number"
                step="0.01"
                max={earnings}
                className="form-control"
                style={{ background: '#fff', height: 40 }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <button type="submit" className="save_btn" style={{ background: '#fff', color: 'red', padding: '3px 15px', fontWeight: 'bold', border: 0, whiteSpace: 'nowrap' }} disabled={busy}>
                {t('withdraw_button1_cpanel', { defaultValue: '💳 Withdraw' })}
              </button>
            </div>
            {err && <p style={{ color: '#ffe0e0', marginTop: 10 }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
