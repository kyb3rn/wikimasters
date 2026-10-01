import { defineSettings } from '@/core/settings';
import { navigateTo } from '@/site/router';
import { toast, type ToastAction, type ToastVariant } from '@/ui/toast';
import { addLocalNotification, markLocalRead, type LocalVariant } from './local';

export const notificationsSettings = defineSettings('notifications', {
  toasts: {
    type: 'boolean',
    label: 'Afficher chaque nouvelle notification en toast',
    description: 'Sans toast, elles restent dans la liste de la cloche.',
    default: true,
    primary: true,
  },
});

export interface NotificationToast {
  readonly message: string;
  readonly title?: string;
  readonly variant: ToastVariant;
  readonly action?: ToastAction;
}

/** Toast d'une notification (du site ou du script), en bas à droite, sauf si l'utilisateur les a coupés. */
export function toastNotification(notification: NotificationToast): void {
  if (!notificationsSettings.get('toasts')) return;
  toast.show({ ...notification, position: 'bottom-right' });
}

export interface NotifyOptions {
  readonly message: string;
  readonly title?: string;
  readonly variant?: LocalVariant;
  /** Page ouverte par le lien du toast et par un clic dans la liste. */
  readonly href?: string;
  readonly actionLabel?: string;
}

/**
 * Notification du script : ajoutée à la liste de la cloche (non lue), et montrée en toast. Les erreurs n'en sont
 * pas : elles restent de simples toasts (`toast.error`).
 */
export function notify(options: NotifyOptions): void {
  const notification = addLocalNotification({ ...options, variant: options.variant ?? 'info' });
  const { href } = notification;
  toastNotification({
    message: notification.message,
    ...(notification.title !== undefined && { title: notification.title }),
    variant: notification.variant,
    ...(href !== undefined && {
      action: {
        label: notification.actionLabel ?? 'Voir',
        onClick: () => {
          markLocalRead([notification.id]);
          navigateTo(href);
        },
      },
    }),
  });
}
