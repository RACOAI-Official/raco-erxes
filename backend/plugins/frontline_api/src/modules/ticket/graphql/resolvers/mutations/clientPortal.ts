import {
  portalTicketAuthor,
  requirePortalTicket,
} from '@/ticket/utils/portalAccess';
import { Resolver } from 'erxes-api-shared/core-types';
import {
  graphqlPubsub,
  markResolvers,
  sendTRPCMessage,
} from 'erxes-api-shared/utils';
import { IContext } from '~/connectionResolvers';
import { ITicketUpdate } from '~/modules/ticket/@types/ticket';
import { notifyTicketOwner } from '@/ticket/utils/cpNotifications';

export const cpTicketMutations: Record<string, Resolver> = {
  cpCreateTicket: async (
    _parent: undefined,
    params: ITicketUpdate,
    context: IContext,
  ) => {
    const { models, subdomain, cpUser } = context;
    const userId = portalTicketAuthor(context).slice(3);

    const ticket = await models.Ticket.addTicket(
      params,
      `cp:${userId}`,
      subdomain,
    );

    graphqlPubsub.publish(`ticketChanged:${ticket._id}`, {
      ticketChanged: { type: 'create', ticket },
    });

    graphqlPubsub.publish('ticketListChanged', {
      ticketListChanged: { type: 'create', ticket },
    });

    if (ticket && cpUser?._id && cpUser?.clientPortalId) {
      await notifyTicketOwner(subdomain, {
        ticket,
        owner: {
          cpUserId: cpUser._id,
          clientPortalId: cpUser.clientPortalId,
        },
        eventType: 'ticketCreated',
        title: 'We received your ticket',
        message: `${ticket.name || 'Your ticket'} — ticket number #${
          ticket.number
        }. The support team replies here.`,
        type: 'success',
        priority: 'low',
      });
    }

    if (ticket && userId) {
      await sendTRPCMessage({
        subdomain,
        pluginName: 'core',
        method: 'mutation',
        module: 'relation',
        action: 'createRelation',
        input: {
          relation: {
            entities: [
              {
                contentType: 'core:customer',
                contentId: userId,
              },
              {
                contentType: 'frontline:ticket',
                contentId: ticket._id,
              },
            ],
          },
        },
      });
    }

    return ticket;
  },

  cpUpdateTicket: async (
    _parent: undefined,
    params: ITicketUpdate,
    context: IContext,
  ) => {
    const { models, subdomain } = context;
    await requirePortalTicket(context, params._id);
    const userId = portalTicketAuthor(context).slice(3);

    return await models.Ticket.updateTicket({
      doc: { ...params, createdBy: `cp:${userId}` },
      userId: `cp:${userId}`,
      subdomain,
    });
  },

  cpTicketCreateNote: async (
    _parent: undefined,
    { content, contentId },
    context: IContext,
  ) => {
    const { models, subdomain } = context;
    await requirePortalTicket(context, contentId);
    const userId = portalTicketAuthor(context).slice(3);

    return models.Note.createNote({
      doc: {
        content,
        contentId,
        isInternal: false,
        createdBy: `cp:${userId}`,
      },
      subdomain,
      userId: `cp:${userId}`,
    });
  },
};

markResolvers(cpTicketMutations, {
  wrapperConfig: {
    forClientPortal: true,
  },
});
