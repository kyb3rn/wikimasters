import { ProfileLink } from '@/services/profile-link';
import type { FriendOwner } from '@/site/global-collection';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';

export const MODAL_CSS = `
.wm-friend-owners-list { display: flex; flex-direction: column; gap: 8px; }
.wm-friend-owners-list .wm-profile-link:hover { text-decoration: none; }
.wm-friend-owners-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

export interface FriendOwnersModalProps {
  readonly cardTitle: string;
  readonly friends: readonly FriendOwner[];
  readonly onClose: () => void;
}

const countLabel = (count: number) => `${count} ami${count > 1 ? 's' : ''}`;

/** Amis qui ont la carte, chacun en lien vers son profil (lignes de la liste d'amis du site). */
export function FriendOwnersModal({ cardTitle, friends, onClose }: FriendOwnersModalProps) {
  return (
    <Modal title="Amis qui l'ont" subtitle={`${cardTitle} · ${countLabel(friends.length)}`} width={420} padded onClose={onClose}>
      <div class="wm-friend-owners-list">
        {friends.map((friend) => (
          <ProfileLink key={friend.id} username={friend.username} className={siteClass.friendRow}>
            <span class={siteClass.friendAvatar}>{friend.username.slice(0, 2).toUpperCase()}</span>
            <span class={`${siteClass.friendName} wm-friend-owners-name`}>{friend.username}</span>
          </ProfileLink>
        ))}
      </div>
    </Modal>
  );
}
