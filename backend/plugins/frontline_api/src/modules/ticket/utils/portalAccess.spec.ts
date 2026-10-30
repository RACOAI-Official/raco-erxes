import type { IContext } from '~/connectionResolvers';
import { cpTicketQueries } from '../graphql/resolvers/queries/clientPortal';
import { cpTicketMutations } from '../graphql/resolvers/mutations/clientPortal';
import { portalTicketAuthor } from './portalAccess';

jest.mock('erxes-api-shared/utils', () => ({
  markResolvers: jest.fn(),
  defaultPaginate: (query: unknown) => query,
  graphqlPubsub: { publish: jest.fn() },
  sendTRPCMessage: jest.fn(),
}));
jest.mock('@/ticket/utils', () => ({ generateFilter: async () => ({}) }));
jest.mock('@/ticket/utils/cpNotifications', () => ({
  notifyTicketOwner: jest.fn(),
}));

const own = { _id: 'ticket-a', createdBy: 'cp:customer-a' };
const findOne = jest.fn();
const find = jest.fn();
const countDocuments = jest.fn();
const updateTicket = jest.fn();
const createNote = jest.fn();
const noteFind = jest.fn();
const context = {
  subdomain: 'tenant-a',
  clientPortal: { _id: 'portal-a' },
  cpUser: {
    _id: 'user-a',
    clientPortalId: 'portal-a',
    erxesCustomerId: 'customer-a',
  },
  models: {
    Ticket: { findOne, find, countDocuments, updateTicket },
    Note: { createNote, find: noteFind },
  },
} as unknown as IContext;

beforeEach(() => {
  jest.clearAllMocks();
  findOne.mockImplementation(async ({ _id, createdBy }) =>
    _id === own._id && createdBy === own.createdBy ? own : null,
  );
});

describe('portal ticket ownership', () => {
  it('rejects app-token-only access', () => {
    expect(() =>
      portalTicketAuthor({ clientPortal: { _id: 'portal-a' } }),
    ).toThrow('Sign in');
  });
  it('rejects a portal/session mismatch', () => {
    expect(() =>
      portalTicketAuthor({
        clientPortal: { _id: 'portal-b' },
        cpUser: { _id: 'user-a', clientPortalId: 'portal-a' },
      }),
    ).toThrow('Sign in');
  });
  it('supports users without a linked customer', () => {
    expect(
      portalTicketAuthor({
        clientPortal: { _id: 'p' },
        cpUser: { _id: 'u', clientPortalId: 'p' },
      }),
    ).toBe('cp:u');
  });
  it('returns the signed-in user ticket', async () => {
    await expect(
      cpTicketQueries.cpGetTicket(undefined, { _id: 'ticket-a' }, context),
    ).resolves.toEqual(own);
  });
  it('denies another user ticket and hides its existence', async () => {
    await expect(
      cpTicketQueries.cpGetTicket(undefined, { _id: 'ticket-b' }, context),
    ).rejects.toThrow('Ticket not found');
  });
  it('overrides forged list ownership', async () => {
    await cpTicketQueries.cpGetTickets(
      undefined,
      { filter: { createdBy: 'victim' } },
      context,
    );
    expect(find).toHaveBeenCalledWith({ createdBy: 'cp:customer-a' });
  });
  it('scopes count even when no ownership filter is supplied', async () => {
    await cpTicketQueries.cpGetTicketTotalCount(undefined, {}, context);
    expect(countDocuments).toHaveBeenCalledWith({ createdBy: 'cp:customer-a' });
  });
  it('denies reading notes from another user ticket', async () => {
    await expect(
      cpTicketQueries.cpTicketGetNotes(
        undefined,
        { ticketId: 'ticket-b' },
        context,
      ),
    ).rejects.toThrow('Ticket not found');
    expect(noteFind).not.toHaveBeenCalled();
  });
  it('denies writing notes to another user ticket', async () => {
    await expect(
      cpTicketMutations.cpTicketCreateNote(
        undefined,
        { contentId: 'ticket-b', content: 'forged' },
        context,
      ),
    ).rejects.toThrow('Ticket not found');
    expect(createNote).not.toHaveBeenCalled();
  });
  it('allows a note on the owned ticket and derives its author', async () => {
    await cpTicketMutations.cpTicketCreateNote(
      undefined,
      { contentId: 'ticket-a', content: 'reply' },
      context,
    );
    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        doc: expect.objectContaining({
          createdBy: 'cp:customer-a',
          isInternal: false,
        }),
      }),
    );
  });
  it('denies updating another user ticket', async () => {
    await expect(
      cpTicketMutations.cpUpdateTicket(undefined, { _id: 'ticket-b' }, context),
    ).rejects.toThrow('Ticket not found');
    expect(updateTicket).not.toHaveBeenCalled();
  });
  it('preserves ownership when the owner updates a ticket', async () => {
    await cpTicketMutations.cpUpdateTicket(
      undefined,
      { _id: 'ticket-a', createdBy: 'cp:victim' },
      context,
    );
    expect(updateTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        doc: { _id: 'ticket-a', createdBy: 'cp:customer-a' },
      }),
    );
  });
});
