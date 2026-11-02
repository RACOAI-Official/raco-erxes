import { redis } from 'erxes-api-shared/utils';
import { IModels } from '~/connectionResolvers';
import {
  createWidgetSurveyToken,
  getWidgetSurveySelection,
  submitWidgetSurveyVote,
} from './widgetVoting';
import { refreshSurveyTallies } from './utils';

jest.mock('erxes-api-shared/utils', () => ({
  redis: { set: jest.fn(), get: jest.fn(), incr: jest.fn(), expire: jest.fn() },
}));
jest.mock('./utils', () => ({
  getSnapshotSteps: (snapshot: { steps: unknown[] }) => snapshot.steps,
  isSurveyClosed: (snapshot: { expiry?: string }) =>
    Boolean(
      snapshot.expiry && new Date(snapshot.expiry).getTime() <= Date.now(),
    ),
  refreshSurveyTallies: jest.fn(),
}));
jest.mock('./ticketAutomation', () => ({
  runSurveyTicketAutomation: jest.fn(),
}));

const input = {
  integrationId: 'integration',
  conversationId: 'conversation',
  messageId: 'message',
  token: 'a'.repeat(64),
  optionIds: ['yes'],
};
const snapshot = () => ({
  surveyId: 'survey',
  steps: [
    {
      stepId: 'step',
      question: 'Question',
      answers: [{ id: 'yes' }, { id: 'no' }],
      allowMultiselect: false,
    },
  ],
});
const fixtures = () => ({
  Conversations: {
    findOne: jest.fn().mockResolvedValue({ customerId: 'customer' }),
  },
  Integrations: {
    findOne: jest.fn().mockResolvedValue({ _id: 'integration' }),
  },
  ConversationMessages: {
    findOne: jest.fn().mockResolvedValue({ extraData: { survey: snapshot() } }),
  },
  Surveys: { findOne: jest.fn().mockResolvedValue({ _id: 'survey' }) },
  SurveyVotes: {
    castVote: jest.fn(),
    getMessageVote: jest.fn().mockResolvedValue({ optionIds: ['yes'] }),
  },
});
let fixturesValue: ReturnType<typeof fixtures>;
const models = () => fixturesValue as unknown as IModels;
beforeEach(() => {
  jest.clearAllMocks();
  fixturesValue = fixtures();
  (redis.get as jest.Mock).mockResolvedValue(
    JSON.stringify({
      subdomain: 'tenant',
      integrationId: 'integration',
      conversationId: 'conversation',
    }),
  );
  (redis.incr as jest.Mock).mockResolvedValue(1);
  (refreshSurveyTallies as jest.Mock).mockResolvedValue({
    _id: 'message',
    extraData: { survey: snapshot() },
  });
});
it('issues an unguessable expiring token and stores only its hash in the key', async () => {
  const token = await createWidgetSurveyToken(
    'tenant',
    'integration',
    'conversation',
  );
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(redis.set).toHaveBeenCalledWith(
    expect.not.stringContaining(token),
    expect.any(String),
    'EX',
    2592000,
  );
});
it.each(['wrong', '', 'b'.repeat(63)])(
  'rejects malformed capability %s before database access',
  async (token) => {
    await expect(
      submitWidgetSurveyVote(models(), 'tenant', { ...input, token }),
    ).rejects.toThrow('Survey session');
    expect(fixturesValue.Conversations.findOne).not.toHaveBeenCalled();
  },
);
it('rejects expired or missing tokens', async () => {
  (redis.get as jest.Mock).mockResolvedValue(null);
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', input),
  ).rejects.toThrow('Survey session');
});
it.each([{ conversationId: 'foreign' }, { integrationId: 'foreign' }])(
  'rejects a capability reused for another target',
  async (other) => {
    await expect(
      submitWidgetSurveyVote(models(), 'tenant', { ...input, ...other }),
    ).rejects.toThrow('Survey session');
    expect(fixturesValue.SurveyVotes.castVote).not.toHaveBeenCalled();
  },
);
it('rejects another tenant', async () => {
  await expect(
    submitWidgetSurveyVote(models(), 'foreign', input),
  ).rejects.toThrow('Survey session');
});
it('requires the message to belong to the capability conversation and be public', async () => {
  fixturesValue.ConversationMessages.findOne.mockResolvedValue(null);
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', input),
  ).rejects.toThrow('Survey session');
  expect(fixturesValue.ConversationMessages.findOne).toHaveBeenCalledWith({
    _id: 'message',
    conversationId: 'conversation',
    internal: false,
  });
});
it('rejects closed snapshots and archived survey definitions', async () => {
  fixturesValue.ConversationMessages.findOne.mockResolvedValue({
    extraData: { survey: { ...snapshot(), expiry: '2000-01-01' } },
  });
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', input),
  ).rejects.toThrow('closed');
  fixturesValue.ConversationMessages.findOne.mockResolvedValue({
    extraData: { survey: snapshot() },
  });
  fixturesValue.Surveys.findOne.mockResolvedValue(null);
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', input),
  ).rejects.toThrow('closed');
});
it.each([
  { optionIds: [] },
  { optionIds: ['unknown'] },
  { optionIds: ['yes', 'no'] },
])('rejects invalid selections %j', async ({ optionIds }) => {
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', { ...input, optionIds }),
  ).rejects.toThrow();
  expect(fixturesValue.SurveyVotes.castVote).not.toHaveBeenCalled();
});
it('requires a choice for every step', async () => {
  const survey = snapshot();
  survey.steps.push({
    ...survey.steps[0],
    stepId: 'second',
    answers: [{ id: 'second' }],
  });
  fixturesValue.ConversationMessages.findOne.mockResolvedValue({
    extraData: { survey },
  });
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', input),
  ).rejects.toThrow('every question');
});
it('casts a deduplicated vote under a server-derived voter and refreshes staff tallies', async () => {
  await submitWidgetSurveyVote(models(), 'tenant', {
    ...input,
    optionIds: ['yes', 'yes'],
  });
  expect(fixturesValue.SurveyVotes.castVote).toHaveBeenCalledWith({
    surveyId: 'survey',
    messageId: 'message',
    conversationId: 'conversation',
    voterId: 'widget:conversation',
    customerId: 'customer',
    optionIds: ['yes'],
  });
  expect(refreshSurveyTallies).toHaveBeenCalledWith(
    models(),
    'tenant',
    'message',
  );
});
it('returns only this session selection after reload', async () => {
  await expect(
    getWidgetSurveySelection(models(), 'tenant', input),
  ).resolves.toEqual({ optionIds: ['yes'] });
  expect(fixturesValue.SurveyVotes.getMessageVote).toHaveBeenCalledWith(
    'message',
    'widget:conversation',
  );
});
it('limits repeated submissions', async () => {
  (redis.incr as jest.Mock).mockResolvedValue(31);
  await expect(
    submitWidgetSurveyVote(models(), 'tenant', input),
  ).rejects.toThrow('Please wait');
  expect(fixturesValue.SurveyVotes.castVote).not.toHaveBeenCalled();
});
