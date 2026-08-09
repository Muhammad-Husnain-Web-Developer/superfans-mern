import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { fetchSubscribers, type SubscriberRow } from '../../api/profiles';

const MONO =
  "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif";

/**
 * Subscriber / follower list — port of #subcriberlistmodal (footer.blade.php L1926): a red
 * dialog with the superman icon + "Followers" title and one white card per subscriber/follower
 * (avatar + @username, plus a trash icon for the profile owner to remove them).
 */
export function SubscriberListModal({
  usernameUrl,
  open,
  onClose,
  onChanged,
}: {
  usernameUrl: string;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t } = useTranslation('content');
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || !usernameUrl) return;
    setLoaded(false);
    fetchSubscribers(usernameUrl)
      .then((d) => {
        setRows(d.list);
        setIsOwner(d.isOwner);
      })
      .catch(() => setRows([]))
      .finally(() => setLoaded(true));
  }, [open, usernameUrl]);

  if (!open) return null;

  function remove(row: SubscriberRow) {
    if (!window.confirm('Confirm delete subscription? - Yes or No')) return;
    api
      .delete(`/me/incoming/${row.type}/${row.id}`)
      .then(() => {
        setRows((rs) => rs.filter((r) => r.id !== row.id));
        onChanged?.();
      })
      .catch(() => undefined);
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 1288912889,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: 20,
          background: 'red',
          width: 500,
          maxWidth: 'calc(100% - 20px)',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '0 12px 16px',
        }}
      >
        {/* header */}
        <div style={{ position: 'relative', paddingTop: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ position: 'absolute', right: 6, top: 4, background: 'none', border: 0, fontSize: 45, color: '#fff', lineHeight: 1, cursor: 'pointer' }}
            aria-label="Close"
          >
            ×
          </button>
          <div style={{ textAlign: 'center', marginTop: 35, marginBottom: 10 }}>
            <img src={assetImage('superman2.png')} style={{ display: 'inline-block', height: 51 }} alt="" />
            <h5 style={{ fontSize: 30, textAlign: 'center', color: '#fff', display: 'inline-block', margin: '0 0 0 6px' }}>
              {t('followers', { defaultValue: 'Followers' })}
            </h5>
          </div>
        </div>

        {/* body */}
        <div style={{ textAlign: 'center' }}>
          {loaded && rows.length === 0 ? (
            <p style={{ margin: 0, textAlign: 'center', color: '#fff' }}>
              This user have no subscribers or followers yet
            </p>
          ) : (
            rows.map((r) => (
              <div key={r.id} style={{ background: '#fff', padding: '10px 5px', display: 'inline-block', margin: 10, borderRadius: 4, minWidth: 160 }}>
                <p style={{ margin: 0, display: 'flex', alignItems: 'center', color: '#333', fontWeight: 'bold', fontFamily: MONO }}>
                  <img
                    src={r.profilePicture ? assetImage(r.profilePicture) : assetImage('output-onlinepngtools (2).png')}
                    style={{ maxWidth: 32, height: 32, borderRadius: 35, marginRight: 6 }}
                    alt=""
                  />
                  {r.usernameUrl}
                </p>
                {isOwner && (
                  <div style={{ textAlign: 'right', marginBottom: -25, marginRight: -13 }}>
                    <span onClick={() => remove(r)} title="Delete" style={{ cursor: 'pointer' }}>
                      <i className="far fa-trash-alt" style={{ color: 'black' }}></i>
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
