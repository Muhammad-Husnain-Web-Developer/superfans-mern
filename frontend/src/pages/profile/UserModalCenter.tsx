import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
import { soundEffectsEnabled, setSoundEffectsEnabled } from '../../utils/soundEffects';
import { playModalOpenSound } from '../../utils/modalSounds';
import { useCropUpload } from './ControlPanelCropModal';

/**
 * Fan control panel — port of `#userModalCenter` in **layouts/footer.blade.php**
 * (the modal the `/user`-family pages render, which extend `layouts.main`). It is a
 * different, fuller modal than the one on the profile page (`layouts_direct_user`):
 * it adds a cover-colour select, gender/birth/country, the Super Ads link and the
 * Redsys "request verified account" block, and drops bank/PayPal/Instagram.
 */
export function UserModalCenter({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('content');
  const { t: tNav } = useTranslation('nav');
  /* wording this app added, which lang/*.php never had a line for */
  const { t: tUi } = useTranslation('ui');
  const { setUser } = useAuth();

  const [bio, setBio] = useState(profile.bio ?? '');
  const [soundOn, setSoundOn] = useState(soundEffectsEnabled());
  const [coverColor, setCoverColor] = useState(profile.coverPicture ? '' : profile.coverColor ?? '');
  const [username, setUsername] = useState(profile.usernameUrl ?? '');
  const [borderStatus, setBorderStatus] = useState(profile.profilePictureBorderStatus ?? '0');
  const [footerCredits, setFooterCredits] = useState(profile.footerNameUsername ?? 'name');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile.name ?? '');
  const [surname, setSurname] = useState(profile.surname ?? '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [birth, setBirth] = useState(profile.birth ?? '');
  const [country, setCountry] = useState(profile.country ?? '');

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

  /* selecting a profile/cover picture opens the cropper (250 min, 1095×1080 output) */
  const { onFileChange, cropNode } = useCropUpload((filename, kind) => {
    void save(
      kind === 'profile' ? { profilePicture: filename } : { coverPicture: filename },
      kind === 'profile' ? 'Profile picture updated' : 'Cover picture updated',
    );
  });

  /* the client's pop, fired from the panel's own mount so it lands with the panel
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
  const atNetworkLimit = profile.networkDetails.length >= 3;
  const availableNetworks = allNetworks.filter((n) => !takenIds.has(n.id));

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

  /**
   * verified-account request → the active payment provider's hosted checkout. The server
   * returns a URL; we redirect the browser there (Stripe today, swappable later).
   */
  function requestVerified(plan: 'quinzenal' | 'monthly') {
    api
      .post<{ url?: string }>('/payments/verified', { plan })
      .then(({ data }) => {
        if (data.url) window.location.href = data.url;
        else setFlash({ ok: false, text: tUi('payments_not_configured') });
      })
      .catch(() => setFlash({ ok: false, text: tUi('verification_start_failed') }));
  }

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

  const textField = (label: string, value: string, onChange: (v: string) => void, placeholder = '') => (
    <div className="form-group" style={{ display: 'flex' }}>
      <label style={{ color: 'white' }}>{label} </label>
      <input
        type="text"
        className="form-control"
        style={{ background: 'white', height: 40 }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );

  return (
    <div
      className="modal fade in"
      id="userModalCenter"
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
        className="modal-dialog modal-dialog-centered control-panel-dialog"
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
              <img src="/assets/images/superman2.png" style={{ display: 'inline-block', height: 51 }} alt="" />
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
            {/* ---------- profile info ---------- */}
            <h3 style={H3}>{t('profile_info')}</h3>

            <div className="custom-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              <label style={{ marginBottom: 10, color: 'white', fontSize: 16 }}>{t('profile_picture')}</label>
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
              <label style={{ marginBottom: 10, color: 'white', fontSize: 16 }}>{t('cover_picture')}</label>
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

            {/* cover colour — a select that saves immediately on change (blade auto-submits) */}
            <label htmlFor="color_choice" style={{ marginBottom: 10, color: 'white', fontSize: 14 }}>
              {t('select_cover_color')}
            </label>
            <select
              id="color_choice"
              value={coverColor}
              onChange={(e) => {
                setCoverColor(e.target.value);
                void save({ coverColor: e.target.value }, 'Cover color editted successfully');
              }}
              style={{
                marginBottom: 15,
                padding: 8,
                width: '100%',
                boxSizing: 'border-box',
                color: 'white',
                backgroundColor: '#333',
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
              required
            >
              <option value="" disabled>
                {tUi('select_color')}
              </option>
              <option value="yellow">{tUi('color_yellow')}</option>
              <option value="purple">{tUi('color_purple')}</option>
            </select>

            <div style={{ marginTop: 20 }}>
              {row(
                textField(t('username_url'), username, setUsername),
                () => void save({ usernameUrl: username }, 'Username/url editted successfully'),
              )}
            </div>

            {/* profile picture border */}
            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                <div className="col-md-9">
                  <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('profile_picture_border')}</label>
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
                  <button type="button" className="save_btn" style={SAVE_BTN} onClick={() => void save({ profilePictureBorderStatus: borderStatus })}>
                    {t('save_button_cpanel')}
                  </button>
                </div>
              </div>
            </div>

            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('footer_credits')}</label>
              <select className="form-control" style={SELECT_STYLE} value={footerCredits} onChange={(e) => setFooterCredits(e.target.value)}>
                <option style={{ color: 'black' }} value="name">{t('name')}</option>
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

            {/* ---------- networks ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{tUi('networks_heading')}</h3>

            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('first_network')}</label>
              <select className="form-control" name="first_network" style={SELECT_STYLE} value={firstNetwork} onChange={(e) => setFirstNetwork(e.target.value)}>
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
                {atNetworkLimit ? (
                  <option>{tUi('networks_limit_standard')}</option>
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

            {!atNetworkLimit && (
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

            {/* ---------- payments (earnings only; bank/paypal commented out in the blade) ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{t('payments')}</h3>
            <div className="container-fluid" style={{ paddingLeft: 0 }}>
              <div className="row pb-3">
                <div className="col-xs-6">
                  <div className="form-group" style={{ display: 'flex' }}>
                    <span style={{ color: '#fff', fontWeight: 900 }}>{t('earnings_video_views')} $0.00</span>
                  </div>
                </div>
                <div className="col-xs-6" style={{ textAlign: 'end', paddingRight: 22 }}>
                  <button type="button" className="launch_sub_modal save_btn" style={SAVE_BTN}>
                    {t('notavailable10k_button')}
                  </button>
                </div>
              </div>
            </div>

            {/* ---------- account info ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{t('account_info')}</h3>

            {row(textField(t('email'), email, setEmail), () => void save({ email }, 'Email editted successfully'), 'email', 20)}
            {row(textField(t('password'), password, setPassword), () => void save({ password }, 'Password editted successfully'), 'password', 20)}
            {row(textField(t('name'), name, setName), () => void save({ name }, 'Name editted successfully'), 'name', 20)}
            {row(textField(t('surname'), surname, setSurname), () => void save({ surname }, 'Surname editted successfully'), 'surname', 20)}

            {/* gender — a select in the blade */}
            {row(
              <div className="form-group" style={{ display: 'flex' }}>
                <label htmlFor="gender" style={{ color: 'white', marginRight: 10 }}>{t('gender')}</label>
                <select id="gender" className="form-control" style={{ background: 'white', height: 40 }} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="" disabled>{tUi('select_gender')}</option>
                  <option value="Man">{tUi('gender_man')}</option>
                  <option value="Woman">{tUi('gender_woman')}</option>
                  <option value="Trans">{tUi('gender_trans')}</option>
                  <option value="Binary">{tUi('gender_binary')}</option>
                </select>
              </div>,
              () => void save({ gender }, 'Gender editted successfully'),
              'gender',
              20,
            )}
            {row(textField(t('birth'), birth, setBirth, 'e.g. 7, Oct 1996'), () => void save({ birth }, 'Birth editted successfully'), 'birth', 20)}
            {row(textField(t('country'), country, setCountry, 'e.g. Spain'), () => void save({ country }, 'Country editted successfully'), 'country', 20)}

            {/* ---------- relations ---------- */}
            <hr style={HR} />
            <h3 style={H3}>{t('my_subscriptions')}</h3>
            {subscriptions.length === 0 ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'white' }}>{tUi('no_subscriptions')}</p>
            ) : (
              subscriptions.map((s) => <RelationTile key={s.id} username={s.usernameUrl} picture={s.profilePicture} />)
            )}

            <hr style={HR} />
            <h3 style={H3}>{t('my_followerships')}</h3>
            {followerships.length === 0 ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'white' }}>{tUi('no_followerships')}</p>
            ) : (
              followerships.map((f) => (
                <RelationTile
                  key={f.id}
                  username={f.usernameUrl}
                  picture={f.profilePicture}
                  onDelete={() =>
                    void api.delete(`/me/followership/${f.id}`).then(() => {
                      setFollowerships((prev) => prev.filter((x) => x.id !== f.id));
                    })
                  }
                />
              ))
            )}

            <hr style={HR} />
            {/* ---------- SOUND EFFECTS ----------
                The client asked for a master switch over every button sound in
                the app — the network slider's arrows, the like and hate on every
                wall. The preference is stored on the account (see /me/settings and
                utils/soundEffects.ts) so it is the same on every device. The black
                button is the live one, so Yes/No reads at a glance.
                David asked for it directly above SUPER ADS CENTER, under
                the subscriptions and following lists. */}
            <h3 style={{ ...H3, textAlign: 'center' }}>SOUND EFFECTS:</h3>
            <div className="container-fluid" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div className="row pb-3">
                <div className="col-md-12" style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSoundOn(true);
                      setSoundEffectsEnabled(true);
                    }}
                    style={{
                      ...SAVE_BTN,
                      marginRight: 10,
                      background: soundOn ? '#000' : '#fff',
                      color: soundOn ? '#fff' : 'red',
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
                      background: soundOn ? '#fff' : '#000',
                      color: soundOn ? 'red' : '#fff',
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* ---------- super ads ---------- */}
            <hr style={HR} />
            <h3 style={{ ...H3, textAlign: 'center' }}>{t('superadscenter')}</h3>
            <center>
              <a
                href="/super-ads"
                target="_BLANK"
                rel="noreferrer"
                className="btn save_btn redirect_solicitar"
                style={{ background: 'transparent', color: 'white', border: '2px solid white' }}
              >
                {t('superadscenterbutton')}
              </a>
            </center>

            {/* ---------- become a creator (only above 0 followers) ---------- */}
            {profile.noOfFollowers > 0 && (
              <>
                <hr style={HR} />
                <h3 style={{ ...H3, textAlign: 'center' }}>{t('creator_transform')}</h3>
                <p style={{ ...H3, textAlign: 'center' }}>{t('creator_info')}</p>
                <center>
                  <button
                    type="button"
                    className="btn save_btn"
                    style={{ background: 'transparent', color: 'white', border: '2px solid white' }}
                    disabled={profile.noOfFollowers < 10000}
                    onClick={() =>
                      void api
                        .post('/me/request-creator-account')
                        .then(() => {
                          setFlash({ ok: true, text: tUi('creator_granted') });
                          onSaved();
                        })
                        .catch(() => setFlash({ ok: false, text: tUi('request_failed') }))
                    }
                  >
                    {t('request_creator')}
                  </button>
                  <br />
                </center>
              </>
            )}

            {/* ---------- instagram growth ---------- */}
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

            {/* ---------- request verified account (Redsys) ---------- */}
            <hr style={HR} />
            <h3 style={{ ...H3, textAlign: 'center' }}>
              <img src="/assets/images/verified.png" width={24} alt={tUi('verified_badge_alt')} style={{ position: 'relative', bottom: 2 }} />{' '}
              {t('verified_account_request')}
            </h3>
            <center>
              {profile.verified ? (
                <button
                  type="button"
                  className="btn save_btn"
                  style={{ background: 'transparent', color: 'white', border: '2px solid white', padding: '0 10px' }}
                  onClick={() =>
                    void api
                      .delete('/payments/redsys/verified')
                      .then(() => {
                        setFlash({ ok: true, text: tUi('verification_cancelled') });
                        onSaved();
                      })
                      .catch(() => setFlash({ ok: false, text: tUi('verification_cancel_failed') }))
                  }
                >
                  {t('unsubscribe')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn save_btn"
                    style={{ background: 'transparent', color: 'white', border: '2px solid white', padding: '0 10px' }}
                    onClick={() => requestVerified('quinzenal')}
                  >
                    {tUi('plan_fortnightly')}
                  </button>{' '}
                  <button
                    type="button"
                    className="btn save_btn"
                    style={{ background: 'transparent', color: 'white', border: '2px solid white', padding: '0 10px' }}
                    onClick={() => requestVerified('monthly')}
                  >
                    {tUi('plan_monthly')}
                  </button>
                </>
              )}
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
          <div className="modal-dialog modal-dialog-centered control-panel-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 20, background: 'red', padding: 15 }}>
              <div className="container-fluid" style={{ paddingLeft: 0 }}>
                <div className="row pb-3">
                  <div className="col-md-9">
                    <div className="form-group" style={{ display: 'flex' }}>
                      <label style={{ color: 'white' }}>{editNetwork.name} </label>
                      <input type="text" className="form-control" style={{ background: 'white', height: 40 }} value={editNetworkUrl} onChange={(e) => setEditNetworkUrl(e.target.value)} />
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
    </div>
  );
}