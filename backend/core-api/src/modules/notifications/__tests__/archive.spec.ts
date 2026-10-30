import type { IContext } from '~/connectionResolvers';
import { cursorPaginate } from 'erxes-api-shared/utils';
import { notificationQueries } from '../graphql/resolver/queries';
import { notificationTrpcRouter } from '../trpc';

jest.mock('erxes-api-shared/utils', () => ({
  cursorPaginate: jest.fn(),
  graphqlPubsub: { publish: jest.fn() },
  USER_ROLES: { SYSTEM: 'system' },
}), { virtual: true });
jest.mock('~/utils/email/ramp', () => ({ getStatus: jest.fn() }));
jest.mock('~/utils/email', () => ({ sendEmail: jest.fn() }));
jest.mock('~/modules/notifications/utils', () => ({ initFirebase: jest.fn() }));
jest.mock('@/organization/settings/utils/configs', () => ({ getConfig: jest.fn() }), { virtual: true });
jest.mock('firebase-admin', () => ({ apps: [] }), { virtual: true });

type Row = {
  _id: string;
  userId: string;
  isRead: boolean;
  isArchived?: boolean;
  expiresAt?: Date | null;
};
type Selector = Record<string, unknown>;
const matches = (row: Row, selector: Selector): boolean =>
  Object.entries(selector).every(([key, value]) => {
    if (key === '$or') {
      return (value as Selector[]).some((part) => matches(row, part));
    }
    const actual = row[key as keyof Row];
    if (value && typeof value === 'object') {
      if ('$ne' in value) return actual !== value.$ne;
      if ('$gt' in value) return actual instanceof Date && actual > (value.$gt as Date);
      if ('$in' in value) return (value.$in as unknown[]).includes(actual);
      if ('$nin' in value) return !(value.$nin as unknown[]).includes(actual);
    }
    return value === null ? actual == null : actual === value;
  });

describe('active notification queries', () => {
  let context: IContext;
  let rows: Row[];
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [
      { _id: 'legacy', userId: 'support', isRead: false },
      { _id: 'active', userId: 'support', isRead: false, isArchived: false, expiresAt: null },
      { _id: 'archived', userId: 'support', isRead: false, isArchived: true },
      { _id: 'expired', userId: 'support', isRead: false, expiresAt: new Date(0) },
      { _id: 'foreign', userId: 'sales', isRead: false },
    ];
    const find = jest.fn(async (selector: Selector) => rows.filter((row) => matches(row, selector)));
    const countDocuments = jest.fn(async (selector: Selector) => rows.filter((row) => matches(row, selector)).length);
    context = {
      user: { _id: 'support' },
      models: { Notifications: { find, countDocuments } },
    } as unknown as IContext;
    jest.mocked(cursorPaginate).mockImplementation(async ({ query }) => {
      const list = rows.filter((row) => matches(row, query));
      return { list, totalCount: list.length, pageInfo: {} };
    });
  });

  it('excludes archived, expired, and foreign rows while retaining legacy rows', async () => {
    const result = await notificationQueries.notifications(undefined, {}, context);
    expect(result.list.map((row) => row._id)).toEqual(['legacy', 'active']);
    expect(result.totalCount).toBe(2);
  });

  it('cannot reintroduce archived records through prioritized IDs', async () => {
    const result = await notificationQueries.notifications(undefined, {
      ids: ['active', 'archived', 'foreign'], limit: 10,
    }, context);
    expect(result.list.map((row) => row._id)).toEqual(['active', 'legacy']);
    expect(result.totalCount).toBe(2);
  });

  it('excludes archived notifications from unread counts', async () => {
    expect(await notificationQueries.unreadNotificationsCount(undefined, undefined, context)).toBe(2);
  });
});

describe('new activity on grouped notifications', () => {
  it('clears the archive flag on an updated notification', async () => {
    const findOneAndUpdate = jest.fn(async (_selector: Selector, doc: Selector) => ({
      toObject: () => doc,
    }));
    const caller = notificationTrpcRouter.createCaller({
      subdomain: 'audit',
      models: {
        Notifications: {
          findOneAndUpdate,
          find: () => ({ lean: async () => [] }),
        },
      },
    } as unknown as Parameters<typeof notificationTrpcRouter.createCaller>[0]);
    await caller.notifications.create({
      userIds: ['support'],
      data: { kind: 'user', allowMultiple: false, contentType: 'frontline:inbox', contentTypeId: 'audit' },
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { contentTypeId: 'audit', contentType: 'frontline:inbox', userId: 'support' },
      expect.objectContaining({ isArchived: false, isRead: false }),
      { new: true, upsert: true },
    );
  });
});
