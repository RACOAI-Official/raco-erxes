import { INotificationDocument } from 'erxes-api-shared/core-modules';
import { IContext } from '~/connectionResolvers';

export default {
  __resolveReference({ _id }: INotificationDocument, { models, user }: IContext) {
    if (!user?._id) return null;
    return models.Notifications.findOne({ _id, userId: user._id });
  },
  async fromUser(
    { fromUserId }: INotificationDocument,
    _: undefined,
    { models }: IContext,
  ) {
    return await models.Users.findOne({ _id: fromUserId });
  },

  async emailDelivery(
    { _id }: INotificationDocument,
    _: undefined,
    { models }: IContext,
  ) {
    return await models.EmailDeliveries.findOne({ notificationId: _id });
  },
};
