import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { assetImage } from '../../utils/format';
import type { NetworkDetail, ProfileData } from '../../api/profiles';
import { useCropUpload } from './ControlPanelCropModal';
import { soundEffectsEnabled, setSoundEffectsEnabled } from '../../utils/soundEffects';
import { playModalOpenSound } from '../../utils/modalSounds';
/* .control-panel-dialog — the phone gutter, shared by all three panels: the other two
   import their shared pieces from this file, so importing it here loads it for them too. */
import '../../styles/footer-modals.css';
/**
 * Control panel — port of #exampleModalCenter (the `Auth::user()->role != "influencer"`
 * branch of layouts_direct_user/footer.blade.php).
 *
 * The blade posts one <form> per field to its own route; here each row calls
 * PATCH /api/me/settings with just that field, keeping the same rules
 * (bio ≤ 290 with live counter, unique username, "become creator" needs 10k
 * followers and only shows above 0 followers).
 */

export const H3: CSSProperties = {
  margin: 0,
  color: 'white',
  fontFamily: "'Rockwell Nova'",
  fontWeight: 800,
  marginTop: 20,
  marginBottom: 10,
};

export const SAVE_BTN: CSSProperties = {
  background: 'white',
  color: 'red',
  padding: '3px 15px',
  fontWeight: 'bold',
  border: 0,
  outline: 0,
  cursor: 'pointer',
};

export const FILE_INPUT: CSSProperties = {
  marginBottom: 15,
  padding: 8,
  width: '100%',
  boxSizing: 'border-box',
  color: 'white',
  backgroundColor: '#333',
  border: '1px solid #ccc',
  borderRadius: 4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const FILE_SAVE_BTN: CSSProperties = {
  padding: '8px 20px',
  backgroundColor: 'white',
  color: 'red',
  fontWeight: 'bold',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease',
  alignSelf: 'flex-start',
};

/* The blade draws these rules in a flat near-white (#eeeeee, footer.blade.php:2877 and
   every section after it). David wants the softer line he sees on the live site, so the
   rule is a translucent white instead and picks up the panel's red underneath. Only the
   three control panels use it, and all three sit on that red, so nothing else shifts. */
export const HR: CSSProperties = { borderTop: '6px solid rgb(234 204 45 / 31%)' };

export const SELECT_STYLE: CSSProperties = {
  color: 'white',
  border: '1px solid white',
  marginRight: 50,
};

export interface SocialNetworkOption {
  id: number;
  name: string;
  defaultAddress?: string;
}

export interface RelationRow {
  id: string;
  userId?: string;
  usernameUrl: string;
  profilePicture: string | null;
}

/** blade L3400-3462: a white pill with the counterpart's avatar, @username and a trash icon. */
export function RelationTile({
  username,
  picture,
  onDelete,
}: {
  username: string;
  picture: string | null;
  onDelete?: () => void;
}) {
  const monoFont =
    'Consolas, Menlo, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace, serif';
  return (
    <div style={{ background: 'white', padding: '10px 5px', display: 'inline-block', margin: 10 }}>
      <p style={{ margin: 0, color: '#333333', fontWeight: 'bold', fontFamily: monoFont }}>
        <img
          src={assetImage(picture ?? 'output-onlinepngtools (2).png')}
          style={{ maxWidth: 28 }}
          alt=""
        />{' '}
        <span>@</span>
        {username}
      </p>
      <div style={{ textAlign: 'right', marginBottom: -25, marginRight: -13 }}>
        <span
          className="delete"
          onClick={onDelete}
          style={{ cursor: onDelete ? 'pointer' : 'default' }}
        >
          <i className="far fa-trash-alt" style={{ cursor: 'pointer', color: 'black' }}></i>
        </span>
      </div>
    </div>
  );
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ControlPanelModal({
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
  const { setUser } = useAuth();
  const { t: tUi } = useTranslation('ui');

  const [bio, setBio] = useState(profile.bio ?? '');
    /* SOUND EFFECTS — gates every button sound in the app (slider arrows, like/hate). */
  const [soundOn, setSoundOn] = useState(soundEffectsEnabled());
  const [username, setUsername] = useState(profile.usernameUrl ?? '');
  const [borderStatus, setBorderStatus] = useState(profile.profilePictureBorderStatus ?? '0');
  const [footerCredits, setFooterCredits] = useState(profile.footerNameUsername ?? 'name');
  const [instagramLink, setInstagramLink] = useState(profile.instagramLink ?? '');
  const [firstNetwork, setFirstNetwork] = useState(
    profile.networkDetails[0] ? String(profile.networkDetails[0].id) : '',
  );
  const [allNetworks, setAllNetworks] = useState<SocialNetworkOption[]>([]);
  const [newNetworkId, setNewNetworkId] = useState('');
  const [networkUrl, setNetworkUrl] = useState('');
  const [subscriptions, setSubscriptions] = useState<RelationRow[]>([]);
  const [followerships, setFollowerships] = useState<RelationRow[]>([]);
  const [editNetwork, setEditNetwork] = useState<NetworkDetail | null>(null);
  const [editNetworkUrl, setEditNetworkUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile.name ?? '');
  const [surname, setSurname] = useState(profile.surname ?? '');
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

  /* blade: a standard account is limited to 3 networks, and the "add" select only
     offers the ones the user has not taken yet. */
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

  async function addNetwork() {
    if (!newNetworkId) return;
    try {
      await api.post('/me/networks', { networkId: Number(newNetworkId), url: networkUrl });
      setFlash({ ok: true, text: tUi('network_added') });
      onSaved();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        tUi('network_add_failed');
      setFlash({ ok: false, text: msg });
    }
  }

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
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Update failed';
      setFlash({ ok: false, text: msg });
    }
  }

  function validateBioLength(): boolean {
    if (bio.length > 290) {
      alert(tUi('bio_too_long'));
      return false;
    }
    return true;
  }

  /* blade: row with a col-md-9 field and a col-md-3 save button. The account-info
     forms (email/password/name/surname/instagram) additionally carry margin-top:20px. */
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
    type: 'text' | 'password' = 'text',
  ) => (
    <div className="form-group" style={{ display: 'flex' }}>
      <label style={{ color: 'white' }}>{label} </label>
      <input
        type={type}
        className="form-control"
        style={{ background: 'white', height: 40 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
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
              <img src={assetImage('superman2.png')} style={{ display: 'inline-block', height: 51 }} alt="" />
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
                    <button
                      type="button"
                      className="save_btn"
                      style={SAVE_BTN}
                      onClick={() => validateBioLength() && void save({ bio })}
                    >
                      {t('save_button_cpanel', { defaultValue: 'Save' })}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <br />
            {/* ---------- profile info ---------- */}
            <h3 style={H3}>{t('profile_info', { defaultValue: 'Profile info' })}</h3>

            <div
              className="custom-file"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}
            >
              <label style={{ marginBottom: 10, color: 'white', fontSize: 14 }}>
                {t('profile_picture', { defaultValue: 'Profile picture' })}
              </label>
              <input
                type="file"
                className="custom-file-input profile_picture"
                style={FILE_INPUT}
                accept="image/*"
                onChange={(e) => onFileChange('profile', e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="save_btn"
                style={FILE_SAVE_BTN}
                
              >
                {t('save_button_cpanel', { defaultValue: 'Save' })}
              </button>
            </div>

            <div
              className="custom-file"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}
            >
              <label style={{ marginBottom: 10, color: 'white', fontSize: 14 }}>
                {t('cover_picture', { defaultValue: 'Cover picture' })}
              </label>
              <input
                type="file"
                className="custom-file-input cover_picture"
                style={FILE_INPUT}
                accept="image/*"
                onChange={(e) => onFileChange('cover', e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="save_btn"
                style={FILE_SAVE_BTN}
                
              >
                {t('save_button_cpanel', { defaultValue: 'Save' })}
              </button>
            </div>

            {/* ---------- username / URL ---------- */}
            <div style={{ marginTop: 20 }}>
              {row(
                textField(t('username_url', { defaultValue: 'Username / URL' }), username, setUsername),
                () => void save({ usernameUrl: username }, 'Username/url editted successfully'),
              )}
            </div>

            {/* ---------- profile picture border ---------- */}
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
                    {t('save_button_cpanel', { defaultValue: 'Save' })}
                  </button>
                </div>
              </div>
            </div>

            {/* ---------- footer credits ---------- */}
            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('footer_credits')}</label>
              <select
                className="form-control"
                style={{ color: 'white', border: '1px solid white', marginRight: 50 }}
                value={footerCredits}
                onChange={(e) => setFooterCredits(e.target.value)}
              >
                <option style={{ color: 'black' }} value="name">
                  {tUi('name_plain')}
                </option>
                <option style={{ color: 'black' }} value="username">
                  {tUi('username')}
                </option>
              </select>
              <button
                type="button"
                className="save_btn"
                style={{ ...SAVE_BTN, position: 'relative', height: 'fit-content', marginRight: 21 }}
                onClick={() => void save({ footerNameUsername: footerCredits }, tUi('footer_content_saved'))}
              >
                {t('save_button_cpanel', { defaultValue: 'Save' })}
              </button>
            </div>

            <hr style={HR} />

            {/* ---------- networks (blade L2878-3106) ---------- */}
            <h3 style={H3}>{tUi('networks_heading')}</h3>

            {/* update_first_network — options are the user's OWN networks */}
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

            {/* one edit button per existing network (blade L2978-3015): opens that
                network's URL editor. */}
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

            {/* add_network — options are the networks NOT yet taken; a standard
                account is capped at 3, and the top save button is deliberately
                invisible in the blade (visibility: hidden) while still reserving space. */}
            <h3 style={H3}>{t('add_network')}</h3>
            <div className="custom-file" style={{ display: 'flex' }}>
              <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>{t('choose_network')} </label>
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
                    <option
                      className="network_option"
                      value={String(n.id)}
                      style={{ color: 'black' }}
                      key={n.id}
                    >
                      {n.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="save_btn"
                style={{
                  ...SAVE_BTN,
                  position: 'relative',
                  height: 'fit-content',
                  marginRight: 21,
                  visibility: 'hidden',
                }}
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
                        name="network_url"
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

            <hr style={HR} />
            {/* ---- PAYMENTS — TAKEN OUT, NOT DELETED ------------------------------------
                A fan is on the paying side of this platform: they never earn, which is why
                the blade gives them no earnings figure either, only the video-views
                placeholder that is hard-coded to $0.00 for everyone and says "Not available
                until 10K Subscribers" whatever the account. Both halves of the section said
                nothing, so the section goes. The admin refuses to set earnings on a
                non-creator now, so there is nothing here left to show.

            <h3 style={H3}>{t('payments')}</h3>

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
                  <button type="button" className="launch_sub_modal save_btn" style={SAVE_BTN}>
                    {t('notavailable10k_button')}
                  </button>
                </div>
              </div>
            </div>
            -------------------------------------------------------------------------- */}

            <hr style={HR} />
            <h3 style={H3}>{t('account_info')}</h3>

            {/* ---------- account (each form has margin-top:20px in the blade) ---------- */}
            {row(
              textField(t('email', { defaultValue: 'Email' }), email, setEmail),
              () => void save({ email }, 'Email editted successfully'),
              'email',
              20,
            )}
            {row(
              textField(t('password', { defaultValue: 'Password' }), password, setPassword),
              () => void save({ password }, 'Password editted successfully'),
              'password',
              20,
            )}
            {row(
              textField(t('name', { defaultValue: 'Name' }), name, setName),
              () => void save({ name }, 'Name editted successfully'),
              'name',
              20,
            )}
            {row(
              textField(t('surname', { defaultValue: 'Surname' }), surname, setSurname),
              () => void save({ surname }, 'Surname editted successfully'),
              'surname',
              20,
            )}
            {row(
              textField('Instagram link:', instagramLink, setInstagramLink),
              () => void save({ instagramLink }, 'Instagram link editted successfully'),
              'instagram',
              20,
            )}

            {/* ---------- my subscriptions ---------- */}
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

            {/* ---------- my followerships ---------- */}
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

            <hr style={HR} />
            {/* ---------- SOUND EFFECTS ----------
                The client asked for a master switch over every button sound in
                the app — the network slider's arrows, the like and hate on every
                wall. The black button is the live one, so Yes/No reads at a
                glance. Saved to localStorage the moment it is pressed. David
                asked for it directly above SUPER ADS CENTER, under the
                subscriptions and following lists. */}
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

            {/* ---------- become a creator (blade: only above 0 followers, enabled at 10k) ---------- */}
            {profile.noOfFollowers > 0 && (
              <>
                <hr style={HR} />
                <h3 style={{ ...H3, textAlign: 'center' }}>
                  {t('creator_transform', { defaultValue: 'Become a creator' })}
                </h3>
                <p style={{ ...H3, textAlign: 'center' }}>{t('creator_info', { defaultValue: '' })}</p>
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
                    {t('request_creator', { defaultValue: 'Request creator account' })}
                  </button>
                  <br />
                </center>
              </>
            )}

            {/* ---------- instagram growth (mailto a manager) ---------- */}
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

      {/* per-network URL editor (blade's #networkurl{name} modal) */}
      {editNetwork && (
        <div
          className="modal fade in"
          style={{
            zIndex: 123123,
            display: 'block',
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setEditNetwork(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered control-panel-dialog"
            onClick={(e) => e.stopPropagation()}
          >
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
    </div>
  );
}
