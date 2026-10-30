import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useMutation, useQuery } from '@apollo/client';
import { WidgetSurvey } from './widget-survey';
import { IMessage, IWidgetSurvey } from '../types';
import { ButtonHTMLAttributes } from 'react';

jest.mock('erxes-ui', () => ({
  Button: ({
    variant: _variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button data-variant={_variant} {...props} />
  ),
}));
jest.mock('jotai', () => ({ useAtomValue: () => 'integration' }));
jest.mock('../states', () => ({ integrationIdAtom: {} }));
jest.mock('@apollo/client', () => ({
  gql: jest.fn(),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));
const message = { _id: 'message', conversationId: 'conversation' } as IMessage;
const survey: IWidgetSurvey = {
  surveyId: 'survey',
  question: 'Did it work?',
  answers: [
    { id: 'yes', text: 'Yes' },
    { id: 'no', text: 'No' },
  ],
};
let vote: jest.Mock;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('widget-survey:conversation', 'secret');
  vote = jest.fn().mockResolvedValue({});
  (useMutation as jest.Mock).mockReturnValue([vote, { loading: false }]);
  (useQuery as jest.Mock).mockReturnValue({
    loading: false,
    data: { widgetsSurveySelection: { optionIds: [] } },
  });
});
it('requires selection then sends only selected option IDs and the private conversation capability', async () => {
  render(<WidgetSurvey message={message} survey={survey} />);
  expect(screen.getByText('Submit answer').hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByText('Yes'));
  fireEvent.click(screen.getByText('Submit answer'));
  await waitFor(() =>
    expect(vote).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          integrationId: 'integration',
          conversationId: 'conversation',
          messageId: 'message',
          token: 'secret',
          optionIds: ['yes'],
        },
      }),
    ),
  );
  expect(await screen.findByText('Your answer has been saved.')).toBeTruthy();
});
it('restores the persisted answer and prevents duplicate submit after reload', () => {
  (useQuery as jest.Mock).mockReturnValue({
    loading: false,
    data: { widgetsSurveySelection: { optionIds: ['yes'] } },
  });
  render(<WidgetSurvey message={message} survey={survey} />);
  expect(screen.getByText('Yes').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Submit answer').hasAttribute('disabled')).toBe(true);
});
it('never enables voting without a private token', () => {
  localStorage.clear();
  render(<WidgetSurvey message={message} survey={survey} />);
  expect(screen.getByText('Yes').hasAttribute('disabled')).toBe(true);
  expect(
    screen.getByText(
      'Start a new conversation to answer this survey securely.',
    ),
  ).toBeTruthy();
});
it('disables expired surveys and renders the reason', () => {
  render(
    <WidgetSurvey
      message={message}
      survey={{ ...survey, expiry: '2000-01-01' }}
    />,
  );
  expect(screen.getByText('Yes').hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('This survey is closed.')).toBeTruthy();
});
it('requires every step before enabling submission', () => {
  render(
    <WidgetSurvey
      message={message}
      survey={{
        ...survey,
        steps: [
          { stepId: 'one', question: 'First', answers: survey.answers },
          {
            stepId: 'two',
            question: 'Second',
            answers: [{ id: 'other', text: 'Second choice' }],
          },
        ],
      }}
    />,
  );
  fireEvent.click(screen.getByText('Yes'));
  expect(screen.getByText('Submit answer').hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByText('Second choice'));
  expect(screen.getByText('Submit answer').hasAttribute('disabled')).toBe(
    false,
  );
});

