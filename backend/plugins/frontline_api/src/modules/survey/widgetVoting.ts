import crypto from 'crypto';
import { redis } from 'erxes-api-shared/utils';
import { IModels } from '~/connectionResolvers';
import { ISurveySnapshot } from './@types/survey';
import {
  getSnapshotSteps,
  isSurveyClosed,
  refreshSurveyTallies,
} from './utils';
import { runSurveyTicketAutomation } from './ticketAutomation';

const keyFor = (token: string) =>
  `widget-survey:${crypto.createHash('sha256').update(token).digest('hex')}`;

export const createWidgetSurveyToken = async (
  subdomain: string,
  integrationId: string,
  conversationId: string,
) => {
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(
    keyFor(token),
    JSON.stringify({ subdomain, integrationId, conversationId }),
    'EX',
    30 * 86400,
  );
  return token;
};

export interface WidgetSurveyInput {
  integrationId: string;
  conversationId: string;
  messageId: string;
  token: string;
}

const resolveSurvey = async (
  models: IModels,
  subdomain: string,
  input: WidgetSurveyInput,
) => {
  const denied = () =>
    new Error('Survey session unavailable. Start a new conversation.');
  if (!/^[a-f0-9]{64}$/.test(input.token)) throw denied();
  const raw = await redis.get(keyFor(input.token));
  if (!raw) throw denied();
  const session = JSON.parse(raw) as {
    subdomain: string;
    integrationId: string;
    conversationId: string;
  };
  if (
    session.subdomain !== subdomain ||
    session.integrationId !== input.integrationId ||
    session.conversationId !== input.conversationId
  )
    throw denied();
  const conversation = await models.Conversations.findOne({
    _id: input.conversationId,
    integrationId: input.integrationId,
  });
  const integration = await models.Integrations.findOne({
    _id: input.integrationId,
    kind: 'messenger',
    isActive: { $ne: false },
  });
  const message = await models.ConversationMessages.findOne({
    _id: input.messageId,
    conversationId: input.conversationId,
    internal: false,
  });
  const snapshot = (
    message?.extraData as { survey?: ISurveySnapshot } | undefined
  )?.survey;
  if (!conversation || !integration || !snapshot) throw denied();
  return { conversation, snapshot };
};

export const getWidgetSurveySelection = async (
  models: IModels,
  subdomain: string,
  input: WidgetSurveyInput,
) => {
  await resolveSurvey(models, subdomain, input);
  const vote = await models.SurveyVotes.getMessageVote(
    input.messageId,
    `widget:${input.conversationId}`,
  );
  return { optionIds: vote?.optionIds || [] };
};

export const submitWidgetSurveyVote = async (
  models: IModels,
  subdomain: string,
  input: WidgetSurveyInput & { optionIds: string[] },
) => {
  const { conversation, snapshot } = await resolveSurvey(
    models,
    subdomain,
    input,
  );
  if (isSurveyClosed(snapshot)) throw new Error('This survey is closed');
  const survey = await models.Surveys.findOne({
    _id: snapshot.surveyId,
    status: 'active',
  });
  if (!survey) throw new Error('This survey is closed');
  if (!input.optionIds.length || input.optionIds.length > 100)
    throw new Error('Select an answer for every question');
  const selected = [...new Set(input.optionIds)];
  const steps = getSnapshotSteps(snapshot);
  const known = new Set(
    steps.flatMap((step) => step.answers.map((answer) => answer.id)),
  );
  if (selected.some((id) => !known.has(id)))
    throw new Error('Unknown survey option');
  for (const step of steps) {
    const choices = selected.filter((id) =>
      step.answers.some((answer) => answer.id === id),
    );
    if (!choices.length || (!step.allowMultiselect && choices.length !== 1))
      throw new Error('Select valid answers for every question');
  }
  const rateKey = `${keyFor(input.token)}:rate`;
  const count = await redis.incr(rateKey);
  if (count === 1) await redis.expire(rateKey, 60);
  if (count > 30) throw new Error('Please wait before submitting again');
  await models.SurveyVotes.castVote({
    surveyId: snapshot.surveyId,
    messageId: input.messageId,
    conversationId: input.conversationId,
    voterId: `widget:${input.conversationId}`,
    customerId: conversation.customerId,
    optionIds: selected,
  });
  const updated = await refreshSurveyTallies(
    models,
    subdomain,
    input.messageId,
  );
  await runSurveyTicketAutomation(
    models,
    subdomain,
    snapshot.surveyId,
    selected,
  );
  return updated;
};
