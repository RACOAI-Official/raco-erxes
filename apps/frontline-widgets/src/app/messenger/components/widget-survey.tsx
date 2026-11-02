import { gql, useMutation, useQuery } from '@apollo/client';
import { useAtomValue } from 'jotai';
import { Button } from 'erxes-ui';
import { useEffect, useState } from 'react';
import { integrationIdAtom } from '../states';
import { IMessage, IWidgetSurvey } from '../types';

const SELECTION = gql`
  query widgetsSurveySelection(
    $integrationId: String!
    $conversationId: String!
    $messageId: String!
    $token: String!
  ) {
    widgetsSurveySelection(
      integrationId: $integrationId
      conversationId: $conversationId
      messageId: $messageId
      token: $token
    )
  }
`;
const VOTE = gql`
  mutation widgetsSurveyVote(
    $integrationId: String!
    $conversationId: String!
    $messageId: String!
    $token: String!
    $optionIds: [String!]!
  ) {
    widgetsSurveyVote(
      integrationId: $integrationId
      conversationId: $conversationId
      messageId: $messageId
      token: $token
      optionIds: $optionIds
    ) {
      _id
      extraData
    }
  }
`;

export const WidgetSurvey = ({
  message,
  survey,
}: {
  message: IMessage;
  survey: IWidgetSurvey;
}) => {
  const integrationId = useAtomValue(integrationIdAtom);
  const [token] = useState(() => {
    try {
      return (
        localStorage.getItem(`widget-survey:${message.conversationId}`) || ''
      );
    } catch {
      return '';
    }
  });
  const variables = {
    integrationId,
    conversationId: message.conversationId,
    messageId: message._id,
    token,
  };
  const {
    data,
    loading: reading,
    error: readError,
  } = useQuery<{ widgetsSurveySelection: { optionIds: string[] } }>(SELECTION, {
    variables,
    skip: !token,
    fetchPolicy: 'network-only',
  });
  const [vote, { loading, error }] = useMutation(VOTE);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data?.widgetsSurveySelection) {
      setSelected(data.widgetsSurveySelection.optionIds);
      setSaved(data.widgetsSurveySelection.optionIds.length > 0);
    }
  }, [data]);
  const steps = survey.steps?.length
    ? survey.steps
    : [
        {
          stepId: survey.surveyId,
          question: survey.question,
          answers: survey.answers,
          allowMultiselect: survey.allowMultiselect,
        },
      ];
  const closed =
    Boolean(survey.results?.isFinalized) ||
    Boolean(survey.expiry && new Date(survey.expiry).getTime() <= Date.now());
  const valid = steps.every((step) =>
    step.answers.some((answer) => selected.includes(answer.id)),
  );
  const disabled = closed || !token || reading || loading || Boolean(readError);
  return (
    <section
      aria-label="Survey"
      className="rounded-xl border bg-background p-3 space-y-3 text-foreground"
    >
      {steps.map((step) => (
        <fieldset key={step.stepId} className="space-y-2">
          <legend className="text-sm font-medium">{step.question}</legend>
          {step.answers.map((answer) => (
            <Button
              key={answer.id}
              variant={selected.includes(answer.id) ? 'secondary' : 'outline'}
              aria-pressed={selected.includes(answer.id)}
              disabled={disabled}
              className="w-full justify-start whitespace-normal h-auto py-2"
              onClick={() => {
                setSaved(false);
                setSelected((current) =>
                  step.allowMultiselect
                    ? current.includes(answer.id)
                      ? current.filter((id) => id !== answer.id)
                      : [...current, answer.id]
                    : [
                        ...current.filter(
                          (id) =>
                            !step.answers.some((option) => option.id === id),
                        ),
                        answer.id,
                      ],
                );
              }}
            >
              {answer.text}
            </Button>
          ))}
        </fieldset>
      ))}
      {!token && (
        <p className="text-xs">
          Start a new conversation to answer this survey securely.
        </p>
      )}
      {closed && <p role="status">This survey is closed.</p>}
      {(error || readError) && (
        <p role="alert">{error?.message || readError?.message}</p>
      )}
      {saved && <p role="status">Your answer has been saved.</p>}
      <Button
        disabled={disabled || !valid || saved}
        onClick={async () => {
          try {
            await vote({
              variables: { ...variables, optionIds: selected },
              refetchQueries: [{ query: SELECTION, variables }],
            });
            setSaved(true);
          } catch {
            /* Mutation error is rendered above. */
          }
        }}
      >
        {loading ? 'Saving…' : 'Submit answer'}
      </Button>
    </section>
  );
};
