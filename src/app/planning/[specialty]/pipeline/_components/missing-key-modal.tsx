'use client';

import { Modal } from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import type { ProviderId } from '@/lib/workflows/lib/llm';

const PROVIDER_LABEL: Record<ProviderId, string> = {
  google: 'Google (Gemini)',
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
};

export function MissingKeyModal({
  open,
  provider,
  onClose,
}: {
  open: boolean;
  provider: ProviderId | null;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!open || !provider) return null;
  return (
    <Modal
      header="API key required"
      isDismissible
      size="m"
      actionButton={{
        text: 'Open Settings',
        onClick: () => {
          onClose();
          router.push('/settings');
        },
      }}
      secondaryButton={{ text: 'Cancel', onClick: () => onClose() }}
      onAction={(action) => {
        if (action === 'cancel') onClose();
      }}
    >
      <Modal.Text>
        You picked a <strong>{PROVIDER_LABEL[provider]}</strong> model, but no API key is
        configured for that provider. Add one in Settings, or pick a model from a provider
        whose key you've already saved.
      </Modal.Text>
    </Modal>
  );
}
