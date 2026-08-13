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
  networks: string[];
  networkProfileLinks: string[];
  networkDetails: NetworkDetail[];
  followersTotal: number;
  likesTotal: number;
  viewerHasBlocked: boolean;
  viewerIsBlockedBy: boolean;
  viewerFollowing: boolean;
  viewerSubscribed: boolean;
  /** owner-only payout fields (absent for other viewers) */
  earnings?: number;
  bankAccount?: string | null;
  paypalAccount?: string | null;
  instagramLink: string | null;
  footerNameUsername: string | null;
  profilePictureBorderStatus: string | null;
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
