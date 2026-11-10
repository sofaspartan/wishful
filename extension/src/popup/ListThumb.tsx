import { coverPaint, type ExtensionSession } from '../../../shared/types';
import { defaultCoverArt } from '../../../shared/constants';
import { COVER_ICON_ART } from '../../../src/components/CoverArt';
import { siteAsset } from '../api';

export function ListThumb({ list }: { list: ExtensionSession['lists'][number] }) {
  if (list.coverImage) {
    return (
      <span className="thumb">
        <img src={siteAsset(list.coverImage)} alt="" />
      </span>
    );
  }
  const art = list.coverArt ?? defaultCoverArt(list.kind);
  const paint = coverPaint(art);
  return (
    <span className={`thumb cover-bg-${art.backdrop}`} style={paint ? { background: paint } : undefined}>
      {COVER_ICON_ART[art.icon]}
    </span>
  );
}
