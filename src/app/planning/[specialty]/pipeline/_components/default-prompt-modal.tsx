'use client';

import { Modal } from '@amboss/design-system';

export function DefaultPromptModal({
  open,
  onClose,
  title,
  subHeader,
  text,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subHeader?: string;
  text: string;
}) {
  if (!open) return null;
  return (
    <Modal
      header={title}
      subHeader={subHeader}
      size="l"
      isDismissible
      actionButton={{ text: 'Close', onClick: () => onClose() }}
      onAction={() => onClose()}
    >
      <Modal.Stack>
        <pre
          style={{
            background: 'var(--color-gray-50, #f8f8f8)',
            border: '1px solid var(--color-gray-200, #e5e5e5)',
            borderRadius: 4,
            padding: 12,
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            maxHeight: '60vh',
            overflowY: 'auto',
            margin: 0,
          }}
        >
          {text}
        </pre>
      </Modal.Stack>
    </Modal>
  );
}
