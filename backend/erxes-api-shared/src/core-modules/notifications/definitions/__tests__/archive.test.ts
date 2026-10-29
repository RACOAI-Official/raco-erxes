import { Mongoose } from 'mongoose';
import { notificationSchema } from '../notifications';

const mongoose = new Mongoose();
const Notification = mongoose.model('NotificationArchiveTest', notificationSchema);
const base = { title: 'Audit', message: 'Synthetic notification', userId: 'support' };

describe('notification archive schema', () => {
  it('defaults new notifications to active', () => {
    expect(new Notification(base).isArchived).toBe(false);
  });

  it('retains an explicit archive flag through serialization and hydration', () => {
    const saved = new Notification({ ...base, isArchived: true }).toObject();
    expect(saved.isArchived).toBe(true);
    expect(Notification.hydrate(saved).isArchived).toBe(true);
  });

  it('accepts legacy notifications without an archive field', () => {
    expect(Notification.hydrate(base).isArchived).toBe(false);
  });
});
