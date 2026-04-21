'use client';

import {
  Button,
  Callout,
  Card,
  CardBox,
  H2,
  Inline,
  Input,
  Stack,
  Text,
} from '@amboss/design-system';
import { useState } from 'react';

export default function DemoPage() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');

  return (
    <Stack space="m">
      <H2>Try it out</H2>
      <Card title="Interactive demo" titleAs="h3">
        <CardBox>
          <Stack space="m">
            <Text color="secondary">
              This card uses real DS components — Input, Button, Callout, Stack. Type a
              name and click the button.
            </Text>
            <Inline space="s" vAlignItems="bottom">
              <Input
                label="Your name"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                onClick={() =>
                  setGreeting(name.trim() ? `Hello, ${name}!` : 'Hello, world!')
                }
              >
                Say hello
              </Button>
            </Inline>
            {greeting && <Callout type="success" text={greeting} />}
          </Stack>
        </CardBox>
      </Card>
    </Stack>
  );
}
