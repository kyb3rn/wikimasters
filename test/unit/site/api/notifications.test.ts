import { describe, expect, it } from 'vitest';
import { readNotificationsMarkRead } from '@/site/api';
import { netRequest } from '../../support';

const PATH = '/api/notifications';

describe('notifications', () => {
  it('lit les notifications marquées lues', () => {
    expect(readNotificationsMarkRead(netRequest(PATH, { method: 'PATCH', body: { ids: ['n1', 'n2'] } }))).toEqual(['n1', 'n2']);
    expect(readNotificationsMarkRead(netRequest(PATH, { method: 'PATCH', body: {} }))).toBe('all');
    expect(readNotificationsMarkRead(netRequest(PATH, { method: 'PATCH', body: { ids: [1] } }))).toBeUndefined();
    expect(readNotificationsMarkRead(netRequest(PATH, { method: 'PATCH', body: 'pas du json' }))).toBeUndefined();
    expect(readNotificationsMarkRead(netRequest(PATH))).toBeUndefined();
  });
});
