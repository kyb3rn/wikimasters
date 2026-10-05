import { SortControl } from '@/ui/controls';
import { FRIEND_ORDER_LABELS, FRIEND_SORT_OPTIONS, FRIEND_SORT_ORDER, type FriendsSort } from './sort';

export interface FriendSortControlProps {
  readonly value: FriendsSort;
  readonly onChange: (sort: FriendsSort) => void;
  readonly class?: string;
}

/** Tri d'une liste d'amis (page Amis, « Choisir un ami », « Nouveau message ») : par nom ou par date d'amitié, et son sens. */
export function FriendSortControl({ value, onChange, class: extra }: FriendSortControlProps) {
  return (
    <SortControl
      ariaLabel="Trier les amis"
      class={extra}
      value={value.sort}
      options={FRIEND_SORT_OPTIONS}
      order={value.order}
      orderLabel={FRIEND_ORDER_LABELS[value.sort][value.order]}
      onChange={(next) => {
        const sort = FRIEND_SORT_OPTIONS.find((option) => option.value === next)?.value;
        // Un autre tri part dans son sens habituel.
        if (sort && sort !== value.sort) onChange({ sort, order: FRIEND_SORT_ORDER[sort] });
      }}
      onOrderChange={(order) => onChange({ ...value, order })}
    />
  );
}
