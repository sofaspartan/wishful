import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Star, StarOff } from 'lucide-react';
import type { FavoriteTargetType } from '../../shared/types';
import { del, errorMessage, post } from '../lib/api';
import { keys, useFavoriteIndex } from '../lib/queries';
import { MenuItem } from './ui/Menu';
import { useToast } from './ui/Toast';

/** Star / unstar from a ⋯ menu. */
export function FavoriteMenuItem({
  targetType,
  targetId,
  name,
}: {
  targetType: FavoriteTargetType;
  targetId: string;
  name?: string;
}) {
  const { data: index = [] } = useFavoriteIndex();
  const qc = useQueryClient();
  const toast = useToast();
  const entry = useMemo(
    () => index.find((f) => f.targetType === targetType && f.targetId === targetId),
    [index, targetType, targetId],
  );
  const starred = Boolean(entry);

  const toggle = async () => {
    try {
      if (starred && entry) {
        await del(`/api/favorites/${entry.id}`);
        toast.success(name ? `Removed “${name}” from Favorites` : 'Removed from Favorites');
      } else {
        await post('/api/favorites', { targetType, targetId });
        toast.success(name ? `Saved “${name}” to Favorites` : 'Saved to Favorites');
      }
      void qc.invalidateQueries({ queryKey: keys.favorites });
      void qc.invalidateQueries({ queryKey: keys.favoriteIndex });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <MenuItem icon={starred ? <StarOff size={16} /> : <Star size={16} />} onSelect={() => void toggle()}>
      {starred ? 'Remove from Favorites' : 'Add to Favorites'}
    </MenuItem>
  );
}
