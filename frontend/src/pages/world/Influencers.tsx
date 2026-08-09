import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { GuestHeader } from '../profile/ProfileSidebar';
import { WorldSidebar } from './World';
import '../../styles/world-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';
import { ControlPanelHost } from '../profile/ControlPanelHost';

interface InfluencerCard {
  id: string;
  usernameUrl: string;
  name: string;
  profilePicture: string | null;
  verified: boolean;
}

/**
 * All-influencers grid — port of user/influencers.blade.php: one bordered card per
 * creator (92×92 round avatar or coverYellow fallback + name), linking to the profile.
 */
export function Influencers() {
  useLayoutPageStyles();
  const { t: tNav } = useTranslation('nav');
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerCard[]>([]);

  useEffect(() => {
    document.title = 'Superfans | Influencers';
    api
      .get<{ data: InfluencerCard[] }>('/users/influencers')
      .then(({ data }) => setInfluencers(data.data))
      .catch(() => setInfluencers([]));
  }, []);

  return (
    <div id="fh5co-page">
      <PageLoader />
      <NavToggle />
      <MobileFooterMenu />

      <GuestHeader usernameUrl="" />
      <WorldSidebar onControlPanel={() => setControlPanelOpen(true)} section={tNav('wall', { defaultValue: 'Wall' })} />
      <ControlPanelHost open={controlPanelOpen} onClose={() => setControlPanelOpen(false)} />

      <div id="fh5co-main">
        <div className="fh5co-narrow-content">
          <div className="row">
            {influencers.map((inf) => (
              <div className="col-md-4" key={inf.id}>
                <div
                  className="col-12 card my-2"
                  style={{ textAlign: 'center', boxShadow: '0px 0px 2px 3px #e78267' }}
                >
                  <Link to={`/${inf.usernameUrl}`}>
                    <img
                      src={assetImage(inf.profilePicture ?? 'coverYellow.png')}
                      style={{ marginTop: 30, borderRadius: 70, height: 92, width: 92 }}
                      alt=""
                    />
                  </Link>
                  <Link to={`/${inf.usernameUrl}`}>
                    <h4 style={{ textAlign: 'center', marginTop: 30, paddingBottom: 30 }}>{inf.name}</h4>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
