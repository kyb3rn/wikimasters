import { jsonSize, type DataSet } from '@/core/data';
import { LOCAL_NOTIFICATIONS_KEY, localNotifications, removeLocalNotifications } from './local';

/** Les notifications du script (liste de la cloche), dans la fenêtre Mémoire : pas exportées. */
export const localNotificationsData: DataSet = {
  id: 'notifications',
  name: 'Notifications du script',
  tab: 'Notifications',
  description: 'Les 50 dernières notifications du script, montrées avec celles du site dans la cloche.',
  storage: [LOCAL_NOTIFICATIONS_KEY],
  list() {
    return Promise.resolve(
      localNotifications().map((notification) => ({
        key: notification.id,
        title: notification.title ?? 'Notification',
        details: [notification.message, notification.read ? 'Lue' : 'Non lue'],
        date: notification.createdAt,
        bytes: jsonSize(notification),
      })),
    );
  },
  remove(keys) {
    removeLocalNotifications(keys);
    return Promise.resolve();
  },
  clear() {
    removeLocalNotifications(localNotifications().map((notification) => notification.id));
    return Promise.resolve();
  },
};
