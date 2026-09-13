import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GemAsset, GemCategory, GemFilterId } from '../data/editor-models';
import { GemPickerItem } from '../gem-picker-item/gem-picker-item';

/**
 * The gem catalogue: category tabs and the picker grid. Shared as-is between
 * the desktop side panel and the mobile bottom sheet — both render this same
 * component against the same store signals. The "new gem" size control used
 * to live here too; it's now the toolbar's Size popover instead, so it's
 * available identically whether the sidebar or the mobile sheet is showing.
 */
@Component({
  selector: 'app-gem-library',
  imports: [GemPickerItem],
  templateUrl: './gem-library.html',
  styleUrl: './gem-library.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemLibrary {
  readonly assets = input.required<readonly GemAsset[]>();
  readonly categories = input.required<readonly GemCategory[]>();
  readonly activeCategory = input.required<GemFilterId>();
  readonly activeAssetId = input.required<string>();

  readonly categoryChange = output<GemFilterId>();
  readonly assetChange = output<string>();

  readonly filteredAssets = computed(() => {
    const category = this.activeCategory();
    const assets = this.assets();
    return category === 'all' ? assets : assets.filter((asset) => asset.category === category);
  });
}
