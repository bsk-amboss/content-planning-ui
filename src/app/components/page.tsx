'use client';

import {
  Badge,
  Card,
  CardBox,
  Column,
  Columns,
  H2,
  Stack,
  Text,
} from '@amboss/design-system';

function FeatureCard({
  title,
  description,
  badge,
  badgeColor,
}: {
  title: string;
  description: string;
  badge: string;
  badgeColor: 'green' | 'blue' | 'purple';
}) {
  return (
    <div className="card-fill">
      <Card title={title} titleAs="h3" outlined>
        <CardBox>
          <Stack space="s">
            <Badge text={badge} color={badgeColor} />
            <Text color="secondary">{description}</Text>
          </Stack>
        </CardBox>
      </Card>
    </div>
  );
}

export default function ComponentsPage() {
  return (
    <Stack space="m">
      <H2>What&apos;s included</H2>
      <Columns gap="m" vAlignItems="stretch">
        <Column size={[12, 6, 4]}>
          <FeatureCard
            title="Design System"
            description="Pre-wired with @amboss/design-system — Emotion SSR, ThemeProvider, and 80+ production components ready to use."
            badge="UI"
            badgeColor="blue"
          />
        </Column>
        <Column size={[12, 6, 4]}>
          <FeatureCard
            title="Agent-Ready"
            description="AGENTS.md and local DS docs let coding agents read authoritative component APIs instead of guessing."
            badge="AI"
            badgeColor="purple"
          />
        </Column>
        <Column size={[12, 6, 4]}>
          <FeatureCard
            title="App Router"
            description="Next.js App Router with TypeScript, Server Components by default, and Emotion SSR handled in a single registry."
            badge="Framework"
            badgeColor="green"
          />
        </Column>
      </Columns>
    </Stack>
  );
}
