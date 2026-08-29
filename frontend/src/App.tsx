import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { businessMayOpen } from './utils/businessAccess';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { RegisterFan } from './pages/auth/RegisterFan';
import { RegisterCreator } from './pages/auth/RegisterCreator';
import { CreatorConfirm } from './pages/auth/CreatorConfirm';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { BusinessLogin } from './pages/auth/BusinessLogin';
import { BusinessRegister } from './pages/auth/BusinessRegister';
import { Logout } from './pages/auth/Logout';
import { Profile } from './pages/profile/Profile';
import { NotFoundPage } from './pages/errors/ErrorPage';
import { Posts } from './pages/profile/Posts';
import { PostDetail } from './pages/profile/PostDetail';
import { PostFullscreen } from './pages/profile/PostFullscreen';
import { StoryPage } from './pages/stories/StoryPage';
import { World } from './pages/world/World';
import { Influencers } from './pages/world/Influencers';
import { UserFeed } from './pages/world/UserFeed';
import { Rankings } from './pages/rankings/Rankings';
import { News } from './pages/news/News';
import { NewsEdit } from './pages/news/NewsEdit';
import { Messages } from './pages/chat/Messages';
import { WatchLive } from './pages/stream/WatchLive';
import { StartStream } from './pages/stream/StartStream';
import { AdsCenter } from './pages/ads/AdsCenter';
import { MyAds } from './pages/ads/MyAds';
import { AdsInformation } from './pages/ads/AdsInformation';
import { PotentialClients } from './pages/ads/PotentialClients';
import { AdsType } from './pages/ads/AdsType';
import { AllAds } from './pages/ads/AllAds';
import { AdsPreview } from './pages/ads/AdsPreview';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminCoupons } from './pages/admin/AdminCoupons';
import { AdminModels } from './pages/admin/AdminModels';
import { AdminAssets } from './pages/admin/AdminAssets';
import { AdminPackages } from './pages/admin/AdminPackages';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminGrowth } from './pages/admin/AdminGrowth';
import { AllUsers } from './pages/admin/AllUsers';
import { AllUserPosts } from './pages/admin/AllUserPosts';
import { AdManagement } from './pages/admin/AdManagement';
import { Merchandising } from './pages/merch/Merchandising';
import { MerchandisingShow } from './pages/merch/MerchandisingShow';
import { RegisterModalProvider } from './components/RegisterModal';

/**
 * /user and /influencer are Laravel's "my wall" routes: they render the viewer's own
 * profile *at that URL* rather than redirecting to /{username}, so the address bar
 * matches the original app.
 */
function MyWall() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Profile wallVariant />;
}

/** /user/posts and /influencer/posts — the viewer's own posts grid. */
function MyPosts() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Posts />;
}

/** News management requires being logged in (Laravel routes are behind auth). */
function NewsGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * A business account is only allowed in the Super Ads Center. It already lands there when it
 * logs in (postLoginPath), and this sends it back if it reaches a World address any other
 * way — typed, bookmarked, or followed from an old link. A creator's public profile at
 * /{username} is the exception the client named.
 *
 * One watcher on the location rather than a wrapper around thirty routes, so a route added
 * later is covered without anybody remembering to wrap it.
 */
function BusinessScope() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading || user?.role !== 'business') return null;
  if (businessMayOpen(pathname)) return null;
  return <Navigate to="/super-ads" replace />;
}

/** Super-ads guard — Laravel's restrict_super_ads sends guests to the *business* login. */
function AdsGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/business/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RegisterModalProvider>
        <BusinessScope />
        <Routes>
          {/* Standalone auth pages — no app header/footer, exactly like the Blade pages */}
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="fan" element={<RegisterFan />} />
          <Route path="creador" element={<RegisterCreator />} />
          <Route path="creador/confirm" element={<CreatorConfirm />} />
          <Route path="password/reset" element={<ForgotPassword />} />
          <Route path="password/reset/:token" element={<ResetPassword />} />
          <Route path="business/login" element={<BusinessLogin />} />
          <Route path="business/register" element={<BusinessRegister />} />

          {/* /logout and /business/logout — session clear + redirect (HomeController@logout) */}
          <Route path="logout" element={<Logout />} />
          <Route path="business/logout" element={<Logout />} />

          {/* Landing: Laravel UserController@index simply redirects to /world */}
          <Route index element={<Navigate to="/world" replace />} />

          {/* All-posts page (user_posts.blade.php) */}
          <Route path="posts/:usernameUrl" element={<Posts />} />

          {/* Own wall (Laravel /user and /influencer activity pages) */}
          <Route path="user" element={<MyWall />} />
          <Route path="influencer" element={<MyWall />} />

          {/* Post detail (post_detail.blade.php) */}
          <Route path="post/:id" element={<PostDetail />} />

          {/* what "Share url Storie" copies — opens that creator's live stories */}
          <Route path="stories/:usernameUrl" element={<StoryPage />} />

          {/* World discovery feed (world.blade.php). Logged-in users reach the same
              component via /user/world and /influencer/world (the sidebar's links). */}
          <Route path="world" element={<World />} />
          <Route path="user/world" element={<World />} />
          <Route path="influencer/world" element={<World />} />
          <Route path="user/influencers" element={<Influencers />} />
          <Route path="influencer/influencers" element={<Influencers />} />
          <Route path="user/feed" element={<UserFeed />} />
          <Route path="influencer/feed" element={<UserFeed />} />
          {/* "my posts" — the sidebar links here; Laravel keeps these URLs */}
          <Route path="user/posts" element={<MyPosts />} />
          <Route path="influencer/posts" element={<MyPosts />} />

          {/* Laravel serves the same profile/posts/detail pages under prefixed URLs
              too (UserController@influencer_activity, user_posts, post_detail…), so
              those addresses resolve here instead of rendering nothing. */}
          {['user', 'influencer'].map((prefix) => (
            <Route key={prefix} path={prefix}>
              <Route path="influencer/:usernameUrl" element={<Profile />} />
              <Route path="user/:usernameUrl" element={<Profile />} />
              <Route path="influencer_posts/:usernameUrl" element={<Posts />} />
              <Route path="user_posts/:usernameUrl" element={<Posts />} />
              {/* all_user_posts is not one of these: routes/web.php:487 gives it a
                  POST and hands it to the owner's panel, not a public profile
                  grid. It is routed below, next to all_users. */}
              <Route path="post_detail/:id" element={<PostFullscreen />} />
            </Route>
          ))}

          {/* Rankings leagues (rankings/index.blade.php) */}
          {/* Chat (influencer/messages.blade.php) — full-screen, both roles */}
          <Route path="user/messages" element={<NewsGuard><Messages /></NewsGuard>} />
          <Route path="influencer/messages" element={<NewsGuard><Messages /></NewsGuard>} />

          {/* News management (influencer/news.blade.php) */}
          <Route path="influencer/news" element={<NewsGuard><News /></NewsGuard>} />
          <Route path="influencer/news/:id/edit" element={<NewsGuard><NewsEdit /></NewsGuard>} />
          <Route path="user/news" element={<NewsGuard><News /></NewsGuard>} />
          <Route path="user/news/:id/edit" element={<NewsGuard><NewsEdit /></NewsGuard>} />

          <Route path="rankings" element={<Rankings />} />
          <Route path="watch-live" element={<WatchLive />} />
          <Route path="start-stream/:room" element={<StartStream />} />
          <Route path="super-ads" element={<AdsGuard><AdsCenter /></AdsGuard>} />
          <Route path="super-ads/buy/:postId" element={<AdsGuard><AdsCenter /></AdsGuard>} />
          <Route path="super-ads/my-ads" element={<AdsGuard><MyAds /></AdsGuard>} />
          <Route path="super-ads/information" element={<AdsGuard><AdsInformation /></AdsGuard>} />
          <Route path="super-ads/potential-clients" element={<AdsGuard><PotentialClients /></AdsGuard>} />
          <Route path="super-ads/ad/:type" element={<AdsGuard><AdsType /></AdsGuard>} />
          <Route path="super-ads/all-ads" element={<AdsGuard><AllAds /></AdsGuard>} />
          {/* every ad in the system on one wall, so each type can be looked at */}
          <Route path="super-ads/preview" element={<AdsGuard><AdsPreview /></AdsGuard>} />
          <Route path="admin" element={<NewsGuard><AdminDashboard /></NewsGuard>} />
          <Route path="admin/users" element={<NewsGuard><AdminUsers /></NewsGuard>} />
          <Route path="admin/coupons" element={<NewsGuard><AdminCoupons /></NewsGuard>} />
          <Route path="admin/models" element={<NewsGuard><AdminModels /></NewsGuard>} />
          <Route path="admin/assets" element={<NewsGuard><AdminAssets /></NewsGuard>} />
          <Route path="admin/packages" element={<NewsGuard><AdminPackages /></NewsGuard>} />
          <Route path="admin/orders" element={<NewsGuard><AdminOrders /></NewsGuard>} />
          <Route path="admin/growth" element={<NewsGuard><AdminGrowth /></NewsGuard>} />
          {/* The owner's own panel, at the addresses the blade gives it
              (routes/web.php:470, :487) so his existing links keep working. */}
          <Route path="influencer/all_users" element={<NewsGuard><AllUsers /></NewsGuard>} />
          <Route path="influencer/all_user_posts/:id" element={<NewsGuard><AllUserPosts /></NewsGuard>} />
          <Route path="influencer/ads" element={<NewsGuard><AdManagement /></NewsGuard>} />
          {/* all-ads lives under super-ads here; the blade's address redirects to it */}
          <Route path="influencer/all-ads" element={<Navigate to="/super-ads/all-ads" replace />} />
          <Route path="merchandising" element={<Merchandising />} />
          <Route path="merchandising/:slug" element={<MerchandisingShow />} />

          {/* Vanity profile URLs — mirrors Laravel's Route::fallback → user_profile */}
          <Route path=":usernameUrl" element={<Profile />} />
          {/* anything deeper than one segment has no route at all — the blade
              would have served errors/404 here */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </RegisterModalProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
