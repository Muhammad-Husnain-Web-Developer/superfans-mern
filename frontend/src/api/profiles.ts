import { api } from './client';

export interface NetworkDetail {
  id: number;
  name: string;
  image: string;
  feedImage: string;
  link: string;
}

export interface ProfileData {
  id: string;
  name: string;
  surname: string | null;
  role: string;
  usernameUrl: string;
  bio: string | null;
  profilePicture: string | null;
  coverPicture: string | null;
  coverColor: string;
  verified: boolean;
  vip: boolean;
  chatToggle: boolean;
  noOfFollowers: number;
  priceOfSubscription: number | null;
  /** a creator who charges also offers a free Follow beside Subscribe (their own choice) */
  freeFollow?: boolean;
  networks: string[];
  networkProfileLinks: string[];
  networkDetails: NetworkDetail[];
  followersTotal: number;
  likesTotal: number;
  /** the profile's own eye total, summed over its posts */
  viewsTotal?: number;
  viewerHasBlocked: boolean;
  viewerIsBlockedBy: boolean;
  viewerFollowing: boolean;
  viewerSubscribed: boolean;
  /** the blade's `hasPaidInfluencer` — this viewer bought priority access to the inbox */
  viewerPremium?: boolean;
  /** owner-only payout fields (absent for other viewers) */
  earnings?: number;
  /** the Super Video ads share of it, shown as its own line in the control panel */
  videoAdsEarnings?: number;
  bankAccount?: string | null;
  paypalAccount?: string | null;
  instagramLink: string | null;
  footerNameUsername: string | null;
  profilePictureBorderStatus: string | null;
  /** ESTADO — the dot beside this profile's @nickname. */
  presence?: import('../context/AuthContext').UserPresence;
  birth?: string | null;
  gender?: string | null;
  country: string | null;
  categories: string[];
  postsCount: number;
  createdAt: string;
}

export interface ProfilePost {
  id: string;
  imageVideo: string | null;
  thumbnail: string | null;
  noOfLikes: number;
  /** the eye: real impressions plus whatever the growth bot and the seed put there */
  views?: number;
  /** real ❤️/💩 rows plus the admin-typed seed — the wall pill runs on these */
  likesCount?: number;
  hatesCount?: number;
  likePercent?: number | null;
  viewerLiked?: boolean;
  viewerHated?: boolean;
  visible: boolean;
  tags: string[];
  taggedProfilePictures: string[];
  createdAt: string;
}

export async function fetchProfile(usernameUrl: string): Promise<ProfileData> {
  const { data } = await api.get<{ success: boolean; data: ProfileData }>(
    `/profiles/${encodeURIComponent(usernameUrl)}`,
  );
  return data.data;
}

export async function fetchProfilePosts(usernameUrl: string): Promise<ProfilePost[]> {
  const { data } = await api.get<{ success: boolean; data: ProfilePost[] }>(
    `/profiles/${encodeURIComponent(usernameUrl)}/posts`,
  );
  return data.data;
}

export interface FeedPost {
  id: string;
  imageVideo: string | null;
  thumbnail: string | null;
  tags: string[];
  taggedProfilePictures: string[];
  viewsTotal: number;
  /** the rating pill's inputs, same shape the wall and the world feed carry */
  likesCount?: number;
  hatesCount?: number;
  likePercent?: number | null;
  viewerLiked?: boolean;
  viewerHated?: boolean;
  author: {
    id: string;
    usernameUrl: string | null;
    profilePicture: string | null;
    verified: boolean;
  };
}

/** Feed — posts from the viewer's subscriptions + followerships (me/feed). */
export async function fetchFeed(): Promise<FeedPost[]> {
  const { data } = await api.get<{ success: boolean; data: FeedPost[] }>('/me/feed');
  return data.data;
}

export interface SubscriberRow {
  id: string;
  type: 'subscription' | 'followership';
  usernameUrl: string;
  profilePicture: string | null;
}

/** Subscriber/follower list of a profile (subcriberlistmodal). */
export async function fetchSubscribers(
  usernameUrl: string,
): Promise<{ isOwner: boolean; list: SubscriberRow[] }> {
  const { data } = await api.get<{ success: boolean; data: { isOwner: boolean; list: SubscriberRow[] } }>(
    `/profiles/${encodeURIComponent(usernameUrl)}/subscribers`,
  );
  return data.data;
}
