/**
 * Cloche du site imitée : son état est celui d'un fournisseur React (liste, puis actions plus bas), lu par le
 * script sur le fiber de la cloche ; la pastille (texte de la cloche) suit le nombre de non lues, comme chez lui.
 * `__push(notification)` fait arriver une notification, comme le temps réel ; `__fetches` compte les relectures.
 * Dans un bloc : s'ajoute au script d'un autre faux site sans heurter ses noms.
 */
export const fakeBellProvider = (list: readonly unknown[]): string => `
{
const state = { list: ${JSON.stringify(list)} };
window.__fetches = 0;
const bell = document.querySelector('button[aria-label="Notifications"]');
const rerender = () => {
  const unread = state.list.filter((n) => !n.read).length;
  bell.textContent = unread > 0 ? '🔔' + unread : '🔔';
};
const actions = {
  markAsRead(ids) { state.list = state.list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)); rerender(); },
  markAllAsRead() { state.list = state.list.map((n) => ({ ...n, read: true })); rerender(); },
  fetchNotifications() { window.__fetches++; },
};
const listFiber = { memoizedProps: { get value() { return state.list; } }, return: null };
const actionsFiber = { memoizedProps: { value: actions }, return: listFiber };
bell['__reactFiber$test'] = { memoizedProps: {}, stateNode: bell, return: actionsFiber };
window.__push = (n) => { state.list = [n, ...state.list]; rerender(); };
rerender();
}
`;
