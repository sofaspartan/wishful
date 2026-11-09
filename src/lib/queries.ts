import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AppNotification,
  FriendProfileView,
  FriendsOverview,
  Item,
  Priority,
  PublicProfileView,
  PublicWishlistView,
  SelfUser,
  WishlistDetail,
  WishlistSummary,
} from '../../shared/types';
import { get } from './api';

export const keys = {
  me: ['me'] as const,
  wishlists: ['wishlists'] as const,
  shared: ['shared'] as const,
  wishlist: (id: string) => ['wishlist', id] as const,
  items: ['items'] as const,
  notifications: ['notifications'] as const,
  publicList: (token: string) => ['public', token] as const,
  profile: (username: string) => ['profile', username] as const,
  friends: ['friends'] as const,
  friend: (id: string) => ['friend', id] as const,
};

export function useFriends(enabled = true) {
  return useQuery({
    queryKey: keys.friends,
    queryFn: () => get<FriendsOverview>('/api/friends'),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useFriendProfile(id: string | undefined) {
  return useQuery({
    queryKey: keys.friend(id ?? ''),
    queryFn: () => get<FriendProfileView>(`/api/friends/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => get<{ user: SelfUser | null }>('/api/auth/me').then((r) => r.user),
    staleTime: 5 * 60_000,
  });
}

export function useWishlists(enabled = true) {
  return useQuery({
    queryKey: keys.wishlists,
    queryFn: () => get<{ wishlists: WishlistSummary[] }>('/api/wishlists').then((r) => r.wishlists),
    enabled,
  });
}

export function useSharedWishlists(enabled = true) {
  return useQuery({
    queryKey: keys.shared,
    queryFn: () => get<{ wishlists: WishlistSummary[] }>('/api/shared').then((r) => r.wishlists),
    enabled,
  });
}

export function useWishlist(id: string | undefined) {
  return useQuery({
    queryKey: keys.wishlist(id ?? ''),
    queryFn: () => get<WishlistDetail>(`/api/wishlists/${id}`),
    enabled: Boolean(id),
  });
}

export function useItems(enabled = true) {
  return useQuery({
    queryKey: keys.items,
    queryFn: () => get<{ items: Item[]; priorities: Record<string, Priority> }>('/api/items'),
    enabled,
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => get<{ notifications: AppNotification[] }>('/api/notifications').then((r) => r.notifications),
    enabled,
    refetchInterval: 60_000,
  });
}

export function usePublicList(token: string | undefined) {
  return useQuery({
    queryKey: keys.publicList(token ?? ''),
    queryFn: () => get<PublicWishlistView>(`/api/public/lists/${token}`),
    enabled: Boolean(token),
    refetchInterval: 30_000,
    retry: (count, err) => ![403, 404].includes((err as { status?: number }).status ?? 0) && count < 2,
  });
}

export function usePublicProfile(username: string | undefined) {
  return useQuery({
    queryKey: keys.profile(username ?? ''),
    queryFn: () => get<PublicProfileView>(`/api/public/users/${username}`),
    enabled: Boolean(username),
    retry: false,
  });
}

/** Invalidate everything that may reflect list/item changes. */
export function invalidateContent(qc: QueryClient, wishlistIds: string[] = []) {
  void qc.invalidateQueries({ queryKey: keys.wishlists });
  void qc.invalidateQueries({ queryKey: keys.shared });
  void qc.invalidateQueries({ queryKey: keys.items });
  if (wishlistIds.length) for (const id of wishlistIds) void qc.invalidateQueries({ queryKey: keys.wishlist(id) });
  else void qc.invalidateQueries({ queryKey: ['wishlist'] });
}

export const useInvalidate = () => {
  const qc = useQueryClient();
  return (wishlistIds?: string[]) => invalidateContent(qc, wishlistIds);
};
