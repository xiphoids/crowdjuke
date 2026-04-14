"use client";

import { useEffect, useRef, useCallback } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Remove",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onCancel();
    },
    [onCancel],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      onClick={handleBackdropClick}
      className="fixed inset-0 m-auto h-fit w-fit animate-fade-in rounded-xl border border-white/10 bg-canvas-elevated p-0 text-text-primary shadow-2xl shadow-black/50 backdrop:bg-black/60"
    >
      <div className="flex min-w-[280px] max-w-sm flex-col gap-4 px-6 py-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-text-muted">{message}</p>
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-cyan/60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-action-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-action-red-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-red/60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
