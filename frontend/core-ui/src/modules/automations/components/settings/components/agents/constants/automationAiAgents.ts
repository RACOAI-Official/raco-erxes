// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
export type TAiAgentKind = {
  type: string;
  label: string;
  description: string;
  image?: string;
};

export const AI_AGENT_KINDS: TAiAgentKind[] = [
  {
    type: 'openai',
    label: 'Raco LLM',
    description: 'Use the server-configured Raco LLM and optional Gemini fallback.',
    image: 'raco-icon.svg',
  },
  {
    type: 'cloudflare-ai-gateway',
    label: 'Cloudflare AI Gateway',
    description: 'Use the platform-managed AI Gateway or override it.',
    image: 'cloudflare.webp',
  },
  {
    type: 'kimi',
    label: 'Kimi',
    description: 'Connect Moonshot Kimi with organization-owned credentials.',
    image: 'kimi.webp',
  },
  {
    type: 'kimi-code',
    label: 'Kimi for Code',
    description:
      'Connect Moonshot Kimi for Code with organization-owned credentials.',
    image: 'kimi.webp',
  },
  {
    type: 'grok',
    label: 'Grok',
    description: 'Connect xAI Grok with organization-owned credentials.',
    image: 'grok.webp',
  },
];

export const getAiAgentKind = (type?: string | null) => {
  return AI_AGENT_KINDS.find((kind) => kind.type === type) || AI_AGENT_KINDS[0];
};
