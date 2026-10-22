// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import { motion } from 'framer-motion';
import { Button, Card, PageContainer } from 'erxes-ui';
import { IconSun, IconKeyboard } from '@tabler/icons-react';
import { PageHeader, currentOrganizationState } from 'ui-modules';
import { useAtomValue } from 'jotai';

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const Feature = ({ icon, title, description }: FeatureProps) => (
  <div className="flex items-start space-x-3">
    <div className="mt-1 rounded-lg bg-primary/10 p-2">{icon}</div>
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

export const OnBoarding = () => {
  const organization = useAtomValue(currentOrganizationState);
  const features: FeatureProps[] = [
    {
      icon: <IconSun className="h-4 w-4" />,
      title: 'Your customer workspace',
      description: 'Keep customers, companies, and your team’s work connected.',
    },
    {
      icon: <IconKeyboard className="h-4 w-4" />,
      title: 'Keyboard Shortcuts',
      description: 'Navigate Raco AI with built-in keyboard shortcuts.',
    },
    {
      icon: <IconSun className="h-4 w-4" />,
      title: 'Dark & Light Mode',
      description: 'Choose the theme that suits your preference, by default.',
    },
  ];

  return (
    <PageContainer>
      <PageHeader>
        <PageHeader.Start />
      </PageHeader>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-4xl mx-auto">
            <Card.Header>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2 text-center"
              >
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome to{' '}
                  {organization?.orgCustomOnboarding
                    ? organization?.orgShortName || 'your organization'
                    : 'Raco AI'}{' '}
                  CRM
                </h1>
                <p className="text-muted-foreground">
                  Connect AI to your operations.
                </p>
              </motion.div>
            </Card.Header>
            <Card.Content className="space-y-8">
              <p className="text-center text-muted-foreground">
                Raco AI brings your contacts, companies, tasks, and AI-assisted
                workflows together in a self-hosted CRM built on erxes.
              </p>

              <div className="grid gap-6 md:grid-cols-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.5 }}
                  >
                    <Feature {...feature} />
                  </motion.div>
                ))}
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-center">
                  What to Expect?
                </h2>
                <p className="text-center text-muted-foreground">
                  Start with your contacts, organize your projects, and build
                  reusable automations around the way your team works.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-center">
                  Your Feedback Shapes{' '}
                  {organization?.orgCustomOnboarding
                    ? organization?.orgShortName || 'your organization'
                    : 'Raco AI'}
                </h2>
                <p className="text-center text-muted-foreground">
                  Your input is essential! Share your thoughts and help us
                  refine this new experience.
                </p>
                <div className="flex justify-center gap-4">
                  <Button
                    variant="default"
                    onClick={() =>
                      window.open(
                        'https://racoai.io/contact',
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  >
                    Contact Raco AI
                  </Button>
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground italic">
                Custom software. Applied AI. Built around your team.
              </p>
            </Card.Content>
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
};
