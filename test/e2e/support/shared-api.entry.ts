// Modules du socle assemblés pour une page de test vide (`bundleSharedApi`) : leurs effets sur le DOM se vérifient
// dans un vrai navigateur, sans le faux site ni le script entier.
export { h } from 'preact';
export { createSlot, createSlots, mountUi } from '@/ui/mount';
export { lockControl } from '@/ui/lock';
export { isModalOpen, leaveSmoothly, Modal, openConfirm } from '@/ui/modal';
export { Listbox } from '@/ui/controls';
export { layers } from '@/ui/theme';
export { hasIcon, isOwn, siteButtons } from '@/site/dom';
export { isSiteModalOpen } from '@/site/modals';
export { findUnderlinedTabBars } from '@/site/tabs';
export { placeRarityFilter } from '@/services/list-search/rarity-filter';
export { placeHeaderItem } from '@/services/header-items';
export { HEADER_RANKS } from '@/site/header';
export { soleMainChild } from '@/site/page-spinner';
export { STAMPS, stampFace } from '@/ui/stamp';
