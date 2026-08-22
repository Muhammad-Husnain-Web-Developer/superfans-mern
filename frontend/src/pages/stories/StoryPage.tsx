import { useNavigate, useParams } from 'react-router-dom';
import { StoryViewer } from '../../components/stories/StoryViewer';

/**
 * The address "Share url Storie" hands out: /stories/{handle}. Closing it steps back where
 * there is something to step back to, and otherwise lands on that creator's profile rather
 * than a blank screen — the same rule the post viewer follows.
 */
export function StoryPage() {
  const { usernameUrl = '' } = useParams();
  const navigate = useNavigate();

  const leave = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(`/${usernameUrl}`);
  };

  return <StoryViewer usernameUrl={usernameUrl} onClose={leave} onFinished={leave} />;
}
