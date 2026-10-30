import type { IContext } from '~/connectionResolvers';
import { graphqlPubsub } from 'erxes-api-shared/utils';
import { notificationMutations } from '../graphql/resolver/mutations';
import { notificationQueries } from '../graphql/resolver/queries';
import notificationReferences from '../graphql/customResolvers/notification';
import subscriptions from '../../../apollo/subscription';
import type { INotificationDocument } from 'erxes-api-shared/core-modules';

jest.mock('erxes-api-shared/utils', () => ({
  graphqlPubsub: { publish: jest.fn() },
}), { virtual: true });
jest.mock('~/utils/email/ramp', () => ({ release: jest.fn() }));
jest.mock('graphql-subscriptions', () => ({ withFilter: jest.fn() }));

type Selector = Record<string, unknown>;
type Notification = {
  _id: string;
  userId: string;
  isRead: boolean;
  isArchived: boolean;
  priority: 'low';
  type: 'low';
  readAt?: Date;
};

const filters = {
  status: 'all' as const,
  priority: 'low' as const,
  type: 'low' as const,
  fromDate: '',
  endDate: '',
  module: '',
  fromUserId: '',
  ids: [] as string[],
};

describe('notification recipient ownership', () => {
  let rows: Notification[];
  let context: IContext;
  let updateOne: jest.Mock;
  let updateMany: jest.Mock;

  const matches = (row: Notification, selector: Selector) =>
    Object.entries(selector).every(([key, value]) => {
      const actual = row[key as keyof Notification];
      if (value && typeof value === 'object' && '$in' in value) {
        return (value.$in as unknown[]).includes(actual);
      }
      if (value && typeof value === 'object' && '$nin' in value) {
        return !(value.$nin as unknown[]).includes(actual);
      }
      return actual === value;
    });

  beforeEach(() => {
    jest.clearAllMocks();
    rows = [
      { _id: 'own', userId: 'support', isRead: false, isArchived: false, priority: 'low', type: 'low' },
      { _id: 'foreign', userId: 'sales', isRead: false, isArchived: false, priority: 'low', type: 'low' },
    ];
    const update = async (selector: Selector, changes: Selector) => {
      for (const row of rows.filter((item) => matches(item, selector))) {
        Object.assign(row, changes.$set || changes);
      }
    };
    updateOne = jest.fn(update);
    updateMany = jest.fn(update);
    context = {
      subdomain: 'audit-tenant',
      user: { _id: 'support' },
      models: {
        Notifications: {
          findOne: jest.fn(async (selector: Selector) =>
            rows.find((row) => matches(row, selector)),
          ),
          find: jest.fn((selector: Selector) => ({
            distinct: async () =>
              rows.filter((row) => matches(row, selector)).map((row) => row._id),
          })),
          updateOne,
          updateMany,
        },
      },
    } as unknown as IContext;
  });

  it.each(['markNotificationAsRead', 'archiveNotification'] as const)(
    '%s rejects another recipient without updates or events',
    async (operation) => {
      await expect(
        notificationMutations[operation](undefined, { _id: 'foreign' }, context),
      ).rejects.toThrow('Not found notification');
      expect(updateOne).not.toHaveBeenCalled();
      expect(graphqlPubsub.publish).not.toHaveBeenCalled();
      expect(rows[1]).toMatchObject({ isRead: false, isArchived: false });
    },
  );

  it.each(['foreign', 'missing'])('denies notification detail for %s', async (_id) => {
    await expect(
      notificationQueries.notificationDetail(undefined, { _id }, context),
    ).rejects.toThrow('Not found notification');
  });

  it('allows recipient notification detail', async () => {
    await expect(
      notificationQueries.notificationDetail(undefined, { _id: 'own' }, context),
    ).resolves.toMatchObject({ _id: 'own', userId: 'support' });
  });

  it.each(['own', 'foreign'])('scopes notification references for %s', async (_id) => {
    const result = await notificationReferences.__resolveReference(
      { _id } as INotificationDocument, context,
    );
    expect(result?._id).toBe(_id === 'own' ? 'own' : undefined);
  });

  it.each(['notificationInserted', 'notificationRead', 'notificationArchived'] as const)(
    '%s authorizes recipients and isolates tenant topics',
    (operation) => {
      const asyncIterator = jest.fn();
      const resolver = subscriptions.generateResolvers({ asyncIterator })[operation];
      expect(() => resolver.subscribe(undefined, { userId: 'sales' }, {
        subdomain: 'audit-tenant', user: { _id: 'support' },
      })).toThrow('Not authorized');
      expect(() => resolver.subscribe(undefined, { userId: 'support' }, {
        subdomain: 'audit-tenant',
      })).toThrow('Not authorized');
      expect(asyncIterator).not.toHaveBeenCalled();
      resolver.subscribe(undefined, { userId: 'support' }, {
        subdomain: 'audit-tenant', user: { _id: 'support' },
      });
      resolver.subscribe(undefined, {}, {
        subdomain: 'other-tenant', user: { _id: 'support' },
      });
      expect(asyncIterator.mock.calls).toEqual([
        [`${operation}:audit-tenant:support`],
        [`${operation}:other-tenant:support`],
      ]);
    },
  );

  it('also rejects an already-read foreign notification', async () => {
    rows[1].isRead = true;
    await expect(
      notificationMutations.markNotificationAsRead(undefined, { _id: 'foreign' }, context),
    ).rejects.toThrow('Not found notification');
    expect(graphqlPubsub.publish).not.toHaveBeenCalled();
  });

  it('allows recipient reads, records time, and preserves idempotence', async () => {
    await notificationMutations.markNotificationAsRead(undefined, { _id: 'own' }, context);
    expect(rows[0].isRead).toBe(true);
    expect(rows[0].readAt).toBeInstanceOf(Date);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'own', userId: 'support' },
      { $set: { isRead: true, readAt: expect.any(Date) } },
    );
    await notificationMutations.markNotificationAsRead(undefined, { _id: 'own' }, context);
    expect(updateOne).toHaveBeenCalledTimes(1);
    expect(graphqlPubsub.publish).toHaveBeenCalledTimes(1);
  });

  it('allows recipient archiving', async () => {
    await notificationMutations.archiveNotification(undefined, { _id: 'own' }, context);
    expect(rows[0].isArchived).toBe(true);
    expect(rows[1].isArchived).toBe(false);
  });

  it.each([false, true])('bulk archive scopes updates and events, archiveAll=%s', async (archiveAll) => {
    await notificationMutations.archiveNotifications(undefined, {
      ids: ['own', 'foreign'], archiveAll, filters,
    }, context);
    expect(rows[0].isArchived).toBe(true);
    expect(rows[1].isArchived).toBe(false);
    expect(updateMany.mock.calls[0][0]).toMatchObject({ userId: 'support' });
    expect(graphqlPubsub.publish).toHaveBeenCalledWith('notificationArchived:audit-tenant:support', {
      notificationArchived: { userId: 'support', notificationIds: ['own'] },
    });
  });

  it.each([
    { label: 'explicit IDs', ids: ['own', 'foreign'] },
    { label: 'all matching notifications', ids: [] },
  ])('bulk read scopes updates and emitted IDs for $label', async ({ ids }) => {
    await notificationMutations.markAsReadNotifications(undefined, { ...filters, ids }, context);
    expect(rows[0].isRead).toBe(true);
    expect(rows[1].isRead).toBe(false);
    expect(updateMany.mock.calls[0][0]).toMatchObject({ userId: 'support' });
    expect(graphqlPubsub.publish).toHaveBeenCalledWith('notificationRead:audit-tenant:support', {
      notificationRead: { userId: 'support', notificationIds: ['own'] },
    });
  });

  it('read-all preserves status filters', async () => {
    rows[1].userId = 'support';
    await notificationMutations.markAsReadNotifications(undefined, {
      ...filters, status: 'unread', ids: [],
    }, context);
    expect(rows.every((row) => row.isRead)).toBe(true);
    expect(updateMany.mock.calls[0][0]).toMatchObject({ isRead: false, userId: 'support' });
  });

  it('archive-all preserves excluded IDs', async () => {
    rows[1].userId = 'support';
    await notificationMutations.archiveNotifications(undefined, {
      ids: [], archiveAll: true, filters: { ...filters, ids: ['foreign'] },
    }, context);
    expect(rows[0].isArchived).toBe(true);
    expect(rows[1].isArchived).toBe(false);
  });
});
