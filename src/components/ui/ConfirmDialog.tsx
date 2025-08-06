import React from 'react';
import { SimpleDialog } from './SimpleDialog';
import { Spinner } from './Spinner';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading
}: ConfirmDialogProps) {
  return (
    <SimpleDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}