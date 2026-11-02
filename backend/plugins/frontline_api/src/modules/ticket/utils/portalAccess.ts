import type { IContext } from '~/connectionResolvers';

type PortalIdentity = {
  cpUser?: { _id?: string; erxesCustomerId?: string; clientPortalId?: string };
  clientPortal?: { _id?: string };
};

export const portalTicketAuthor = ({
  cpUser,
  clientPortal,
}: PortalIdentity) => {
  if (
    !cpUser?._id ||
    !clientPortal?._id ||
    cpUser.clientPortalId !== clientPortal._id
  ) {
    throw new Error('Sign in to access your tickets');
  }
  return `cp:${cpUser.erxesCustomerId || cpUser._id}`;
};

export const requirePortalTicket = async (
  context: IContext,
  ticketId: string,
) => {
  const createdBy = portalTicketAuthor(context);
  const ticket = await context.models.Ticket.findOne({
    _id: ticketId,
    createdBy,
  });
  if (!ticket) throw new Error('Ticket not found');
  return ticket;
};
