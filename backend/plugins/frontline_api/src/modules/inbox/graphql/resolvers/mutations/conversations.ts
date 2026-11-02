import { IConversationDocument } from '@/inbox/@types/conversations';
import {
  AUTOMATED_REPLY_STATUS,
  AUTO_BOT_MESSAGES,
  CONVERSATION_STATUSES,
} from '@/inbox/db/definitions/constants';
import { convertConversation } from '@/inbox/services/conversationConvert';
import { IConversationConvert } from '@/inbox/@types/conversationConvert';
import { graphqlPubsub, markResolvers } from 'erxes-api-shared/utils';
import type { IContext, IModels } from '~/connectionResolvers';
import { createNotifications } from '~/utils/notifications';
import {
  getAutomatedReplyReason,
  getAutomatedReplyStatus,
  publishUnreadCountsSafely,
} from './conversationAutomation';
import { sendFacebookAutomatedReplyControlMessage } from '@/integrations/facebook/services/automatedReplyControl';
import {
  publishConversationsChanged,
  sendNotifications,
} from './conversationNotifications';
import { conversationMessageMutations } from './conversationMessageMutations';
import { authorizeConversationAction } from '@/inbox/utils/authorizeConversationAction';

export { dispatchConversationToService } from './conversationAutomation';
export {
  conversationNotifReceivers,
  publishConversationsChanged,
  publishMessage,
  sendNotifications,
} from './conversationNotifications';

const getConversationById = async (models: IModels, selector) => {
  const oldConversations = await models.Conversations.find(selector).lean();
  const oldConversationById = {};
  for (const conversation of oldConversations) {
    oldConversationById[conversation._id] = conversation;
  }
  return { oldConversationById, oldConversations };
};

export const conversationMutations = {
  ...conversationMessageMutations,

  async conversationsAssign(
    _root,
    {
      conversationIds,
      assignedUserId,
    }: { conversationIds: string[]; assignedUserId: string },
    context: IContext,
  ) {
    await authorizeConversationAction(context, 'conversationsAssign', conversationIds);
    const { user, models, subdomain } = context;
    const conversations: IConversationDocument[] =
      await models.Conversations.assignUserConversation(
        conversationIds,
        assignedUserId,
      );

    publishConversationsChanged(subdomain, conversationIds, 'assigneeChanged');

    await sendNotifications(subdomain, {
      user,
      conversations,
      type: 'conversationAssigneeChange',
    });

    if (assignedUserId && assignedUserId !== user?._id) {
      await createNotifications({
        contentType: 'inbox',
        contentTypeId: conversationIds?.[0],
        fromUserId: user?._id,
        subdomain,
        notificationType: 'inboxAssignee',
        userIds: [assignedUserId],
        action: 'assignee',
      });
    }
    return conversations;
  },

  async conversationsUnassign(
    _root,
    { _ids }: { _ids: string[] },
    context: IContext,
  ) {
    await authorizeConversationAction(context, 'conversationsUnassign', _ids);
    const { user, models, subdomain } = context;
    const { oldConversations } = await getConversationById(models, {
      _id: { $in: _ids },
    });
    const updatedConversations =
      await models.Conversations.unassignUserConversation(_ids);

    await sendNotifications(subdomain, {
      user,
      conversations: oldConversations,
      type: 'unassign',
    });

    publishConversationsChanged(subdomain, _ids, 'assigneeChanged');

    return updatedConversations;
  },

  async conversationsChangeStatus(
    _root,
    { _ids, status }: { _ids: string[]; status: string },
    context: IContext,
  ) {
    await authorizeConversationAction(context, 'conversationsChangeStatus', _ids);
    const { user, models, subdomain } = context;
    await models.Conversations.changeStatusConversation(_ids, status, user._id);

    publishConversationsChanged(subdomain, _ids, status);

    const updatedConversations = await models.Conversations.find({
      _id: { $in: _ids },
    });

    await sendNotifications(subdomain, {
      user,
      conversations: updatedConversations,
      type: 'conversationStateChange',
    });

    return updatedConversations;
  },
  async conversationsResolve(
    _root,
    params: { ids: string[] },
    context: IContext,
  ) {
    if (!params.ids?.length) {
      throw new Error('conversationIds parameter is required');
    }
    await authorizeConversationAction(context, 'conversationsResolve', params.ids);
    const { user, models } = context;

    const updateFields = {
      status: CONVERSATION_STATUSES.CLOSED,
      closedUserId: user._id,
      closedAt: new Date(),
    };

    const result = await models.Conversations.updateMany(
      { _id: { $in: params.ids } },
      { $set: updateFields },
    );

    return result.modifiedCount || 0;
  },

  async conversationMarkAsRead(
    _root,
    { _id }: { _id: string },
    context: IContext,
  ) {
    await authorizeConversationAction(context, 'showConversations', [_id]);
    const { user, models, subdomain } = context;
    const conversation = await models.Conversations.markAsReadConversation(
      _id,
      user._id,
    );

    if (conversation.integrationId) {
      await publishUnreadCountsSafely({
        conversationId: _id,
        integrationId: conversation.integrationId,
        userIds: [user._id],
        models,
        subdomain,
      });
    }

    return conversation;
  },

  async changeConversationOperator(
    _root,
    { _id, operatorStatus }: { _id: string; operatorStatus: string },
    context: IContext,
  ) {
    await authorizeConversationAction(context, 'conversationsAssign', [_id]);
    const { models } = context;
    const message = await models.ConversationMessages.createMessage({
      conversationId: _id,
      botData: [
        {
          type: 'text',
          text: AUTO_BOT_MESSAGES.CHANGE_OPERATOR,
        },
      ],
      fromBot: true,
    });
    await graphqlPubsub.publish(
      `conversationMessageInserted:${message.conversationId}`,
      {
        conversationMessageInserted: message,
      },
    );

    return models.Conversations.updateOne(
      { _id },
      { $set: { operatorStatus } },
    );
  },

  async conversationSetAutomatedReplyControl(
    _root,
    {
      _id,
      status,
      reason,
      pausedUntil,
    }: { _id: string; status: string; reason?: string; pausedUntil?: Date },
    context: IContext,
  ) {
    await authorizeConversationAction(context, 'conversationMessageAdd', [_id]);
    const { models, subdomain, user } = context;
    const conversation = await models.Conversations.getConversation(_id);

    if (!conversation.automatedReplyControl) {
      throw new Error(
        'Automated reply control is not enabled for this conversation',
      );
    }

    const automatedReplyStatus = getAutomatedReplyStatus(status);
    const automatedReplyReason = getAutomatedReplyReason(reason);
    const shouldSendHandoffMessage =
      automatedReplyStatus === AUTOMATED_REPLY_STATUS.HUMAN_ACTIVE &&
      conversation.automatedReplyControl.status ===
        AUTOMATED_REPLY_STATUS.ACTIVE;
    const shouldSendActiveMessage =
      automatedReplyStatus === AUTOMATED_REPLY_STATUS.ACTIVE &&
      conversation.automatedReplyControl.status !==
        AUTOMATED_REPLY_STATUS.ACTIVE;

    if (shouldSendHandoffMessage || shouldSendActiveMessage) {
      await sendFacebookAutomatedReplyControlMessage({
        models,
        subdomain,
        conversation,
        status: automatedReplyStatus,
      });
    }

    await models.Conversations.setAutomatedReplyControl(_id, {
      status: automatedReplyStatus,
      pausedUntil: pausedUntil ? new Date(pausedUntil) : undefined,
      reason: automatedReplyReason,
      updatedBy: user?._id,
    });

    return models.Conversations.getConversation(_id);
  },

  async conversationConvertToCard(
    _root,
    params: IConversationConvert,
    context: IContext,
  ) {
    const { user, models, subdomain, checkPermission } = context;
    await authorizeConversationAction(context, 'conversationConvertToCard', [params._id]);

    return convertConversation(
      { models, subdomain, user, checkPermission },
      params,
    );
  },

  async conversationEditCustomFields(
    _root,
    {
      _id,
      propertiesData,
      customFieldsData,
    }: {
      _id: string;
      propertiesData?: Record<string, unknown>;
      customFieldsData?: Record<string, unknown>;
    },
    context: IContext,
  ) {
    const { models } = context;
    await authorizeConversationAction(context, 'conversationEditCustomFields', [_id]);
    if (propertiesData == null && customFieldsData == null) {
      throw new Error('propertiesData or customFieldsData is required');
    }
    await models.Conversations.updateConversation(_id, {
      propertiesData: propertiesData ?? customFieldsData,
    });
    return models.Conversations.getConversation(_id);
  },
};
markResolvers(conversationMutations, {
  wrapperConfig: {
    skipPermission: true,
  },
});
