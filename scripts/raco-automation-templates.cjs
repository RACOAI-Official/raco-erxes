// Raco AI modification, 2026-10-21: install editable local workflow templates.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

const email = (label, subject, paragraphs) => ({
  type: 'sendEmail',
  label,
  config: {
    type: 'default',
    fromEmailPlaceHolder: '',
    replyToEmail: '',
    sender: '',
    toEmailsPlaceHolders: '{{ input.primaryEmail }}',
    ccEmailsPlaceHolders: '',
    subject,
    content: paragraphs.map((text) => `<p>${text}</p>`).join(''),
    html: paragraphs.map((text) => `<p>${text}</p>`).join(''),
  },
});
const delay = (days) => ({
  type: 'delay', label: `Wait ${days} days`,
  config: { value: String(days), type: 'day' },
});
const greeting = 'Hi {{ input.firstName }},';
const templates = [
  {
    name: 'Raco AI · Welcome series',
    description: 'For a new customer: welcome immediately, then offer help after 3 days.',
    steps: [
      email('Welcome customer', 'Welcome to Raco AI', [greeting, 'Thank you for joining us. We look forward to helping you reach your goals.', 'Reply with the main thing you would like to accomplish so we can help you get started.']),
      delay(3),
      email('Offer getting-started help', 'How is getting started going?', [greeting, 'Have you had a chance to get started?', 'Reply with any questions or tell us where you are stuck. We are happy to help.']),
    ],
  },
  {
    name: 'Raco AI · Lead follow-up',
    description: 'For a new inquiry: acknowledge interest, follow up after 2 days, and close the loop 5 days later.',
    steps: [
      email('Acknowledge inquiry', 'Thank you for your interest', [greeting, 'Thank you for getting in touch.', 'What are you looking to achieve, and what is your ideal timeline? Reply here and we can discuss the next step.']),
      delay(2),
      email('Follow up on inquiry', 'Would a conversation help?', [greeting, 'I wanted to follow up on your inquiry.', 'If you would like to talk through your requirements, reply with a time that works for you.']),
      delay(5),
      email('Close the loop', 'Should we keep this conversation open?', [greeting, 'I am checking in once more about your inquiry.', 'If now is not the right time, no action is needed. If you would still like help, reply whenever you are ready.']),
    ],
  },
  {
    name: 'Raco AI · Customer onboarding',
    description: 'For a newly onboarded customer: collect goals, check progress after 1 day, then review the first week 6 days later.',
    steps: [
      email('Collect onboarding goals', 'Let us plan your first week', [greeting, 'To help you get started, reply with your main goal and the people who should be involved.', 'We will use those details to agree on the first useful milestone.']),
      delay(1),
      email('Check onboarding progress', 'Anything blocking your first step?', [greeting, 'How is your first step going?', 'If access, setup, or an unanswered question is slowing you down, reply and we will help.']),
      delay(6),
      email('Review the first week', 'Your first-week check-in', [greeting, 'What has worked well this week, and what still needs attention?', 'Reply with your progress and we can agree on the next milestone.']),
    ],
  },
  {
    name: 'Raco AI · Feedback request',
    description: 'After a customer milestone: wait 7 days, then ask for feedback by email.',
    steps: [delay(7), email('Ask for feedback', 'How was your experience?', [greeting, 'We would like to hear how things have gone for you.', 'What worked well, and what is one thing we could improve? A short reply is enough.'])],
  },
  {
    name: 'Raco AI · Customer re-engagement',
    description: 'Use with a quiet-customer audience: wait 30 days, then send one check-in. The delay alone does not detect inactivity; configure the audience and exit conditions.',
    steps: [delay(30), email('Reconnect with customer', 'Would you like to pick up where we left off?', [greeting, 'It has been a while since we last connected.', 'Are your priorities still the same? Reply if you would like help with your next step.'])],
  },
].map(({ steps, ...template }) => {
  const actions = steps.map((step) => ({ ...step, id: randomUUID() }));
  actions.forEach((action, index) => {
    if (actions[index + 1]) action.nextActionId = actions[index + 1].id;
  });
  return {
    ...template,
    description: `${template.description} Before activation: choose a matching customer trigger, configure a verified sender/reply-to in every email step, and review the wording.`,
    actions,
    entryActionId: actions[0].id,
    inputs: { primaryEmail: '{{ trigger.primaryEmail }}', firstName: '{{ trigger.firstName }}' },
  };
});

const validate = () => {
  assert.equal(new Set(templates.map(({ name }) => name)).size, 5);
  for (const template of templates) {
    assert.equal(template.entryActionId, template.actions[0].id);
    template.actions.forEach((action, index) => {
      assert.equal(action.nextActionId, template.actions[index + 1]?.id);
      assert.ok(['sendEmail', 'delay'].includes(action.type));
      if (action.type === 'sendEmail') {
        assert.equal(action.config.html, action.config.content);
        assert.equal(action.config.toEmailsPlaceHolders, '{{ input.primaryEmail }}');
      } else assert.ok(Number(action.config.value) > 0);
    });
  }
};

const main = async () => {
  validate();
  if (process.argv.includes('--check')) {
    process.stdout.write('PASS: 5 templates, action chains, recipient bindings, email bodies, and delays.\n');
    return;
  }
  const credentials = JSON.parse(readFileSync(join(__dirname, '../.raco-local-credentials.json'), 'utf8'));
  let cookie = '';
  const request = async (query, variables = {}) => {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001', Cookie: cookie },
      body: JSON.stringify({ query, variables }),
    });
    const result = await response.json();
    if (!response.ok || result.errors) {
      const messages = (result.errors || []).map(({ message }) => message).join('; ');
      throw new Error(`CRM template request failed (${response.status}): ${messages}`);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) cookie = cookies.map((value) => value.split(';')[0]).join('; ');
    return result.data;
  };
  const login = await request('mutation racoTemplatesLogin($email: String!, $password: String!) { login(email: $email, password: $password) }', credentials);
  assert.equal(login.login, 'loggedIn');
  const listQuery = 'query racoTemplatesList { automationWorkflowTemplates { _id name description entryActionId actions inputs } }';
  const existing = (await request(listQuery)).automationWorkflowTemplates;
  for (const template of templates) {
    if (existing.some(({ name }) => name === template.name)) {
      process.stdout.write(`Kept existing: ${template.name}\n`);
      continue;
    }
    await request('mutation racoTemplatesCreate($name: String!, $description: String, $entryActionId: String, $actions: JSON, $inputs: JSON) { automationWorkflowTemplatesAdd(name: $name, description: $description, entryActionId: $entryActionId, actions: $actions, inputs: $inputs) { _id } }', template);
    process.stdout.write(`Created: ${template.name}\n`);
  }
  const saved = (await request(listQuery)).automationWorkflowTemplates;
  for (const template of templates) {
    const match = saved.find(({ name }) => name === template.name);
    assert.ok(match?.actions.length, `Missing template: ${template.name}`);
    assert.ok(match.actions.some(({ id }) => id === match.entryActionId));
  }
  process.stdout.write('PASS: all 5 saved workflow templates are available through the authenticated CRM API. No automations activated.\n');
};
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
