import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AppNotification,
  BoxDetail,
  BoxSummary,
  BrickfolioStatus,
  ListLink,
  PlayshelfStatus,
  ExtensionConnection,
  FriendProfileView,
  CirclePerson,
  FriendsOverview,
  Item,
  Priority,
  PublicBoxView,
  PublicProfileView,
  PublicWishlistView,
  SelfUser,
  WishlistDetail,
  WishlistSummary,
} from '../../shared/types';
import { get, post } from './api';

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
  circle: ['circle'] as const,
  extensionConnections: ['extension-connections'] as const,
  brickfolio: ['integrations', 'brickfolio'] as const,
  playshelf: ['integrations', 'playshelf'] as const,
  boxes: ['boxes'] as const,
  box: (id: string) => ['box', id] as const,
  publicBox: (code: string) => ['public-box', code] as const,
};

export function useBoxes(enabled = true) {
  return useQuery({
    queryKey: keys.boxes,
    queryFn: () => get<{ boxes: BoxSummary[] }>('/api/boxes').then((r) => r.boxes),
    enabled,
  });
}

export function useBox(id: string | undefined) {
  return useQuery({
    queryKey: keys.box(id ?? ''),
    queryFn: () => get<BoxDetail>(`/api/boxes/${id}`),
    enabled: Boolean(id),
  });
}

export function usePublicBox(code: string | undefined) {
  return useQuery({
    queryKey: keys.publicBox(code ?? ''),
    queryFn: () => get<PublicBoxView>(`/api/public/boxes/${code}`),
    enabled: Boolean(code),
    retry: (count, err) => ![403, 404, 429].includes((err as { status?: number }).status ?? 0) && count < 2,
  });
}

export type BrickfolioResponse = { status: BrickfolioStatus; changed: boolean };
export type PlayshelfResponse = { status: PlayshelfStatus; changed: boolean };

export function useBrickfolio(enabled = true) {
  return useQuery({
    queryKey: keys.brickfolio,
    queryFn: () => get<BrickfolioResponse>('/api/integrations/brickfolio').then((r) => r.status),
    enabled,
  });
}

export function usePlayshelf(enabled = true) {
  return useQuery({
    queryKey: keys.playshelf,
    queryFn: () => get<PlayshelfResponse>('/api/integrations/playshelf').then((r) => r.status),
    enabled,
  });
}

/** When a synced list opens, quietly pull the source if the last sync is old, then refresh. */
export function useStaleSync(link: ListLink | null | undefined) {
  const qc = useQueryClient();
  const provider = link?.provider;
  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    post<{ status: unknown; changed: boolean }>(`/api/integrations/${provider}/sync?ifStale=1`)
      .then((r) => {
        if (cancelled) return;
        qc.setQueryData(keys[provider], r.status);
        if (r.changed) invalidateContent(qc);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provider, qc]);
}

export function useExtensionConnections() {
  return useQuery({
    queryKey: keys.extensionConnections,
    queryFn: () => get<{ connections: ExtensionConnection[] }>('/api/extension/connections').then((r) => r.connections),
  });
}

export function useFriends(enabled = true) {
  return useQuery({
    queryKey: keys.friends,
    queryFn: () => get<FriendsOverview>('/api/friends'),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useCircle(enabled = true) {
  return useQuery({
    queryKey: keys.circle,
    queryFn: () => get<{ people: CirclePerson[] }>('/api/circle').then((r) => r.people),
    enabled,
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
  void qc.invalidateQueries({ queryKey: keys.boxes });
  void qc.invalidateQueries({ queryKey: ['box'] });
  if (wishlistIds.length) for (const id of wishlistIds) void qc.invalidateQueries({ queryKey: keys.wishlist(id) });
  else void qc.invalidateQueries({ queryKey: ['wishlist'] });
}

export const useInvalidate = () => {
  const qc = useQueryClient();
  return (wishlistIds?: string[]) => invalidateContent(qc, wishlistIds);
};
