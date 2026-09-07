import { useT } from '../i18n/games';
import { AppDialog } from './AppDialog';

export interface MediaDeviceErrorDialogProps {
  title: string;
  titleId: string;
  message: string;
  onClose: () => void;
}

export function MediaDeviceErrorDialog({
  title,
  titleId,
  message,
  onClose,
}: MediaDeviceErrorDialogProps) {
  const { t } = useT();

  return (
    <AppDialog
      title={title}
      titleId={titleId}
      tone="error"
      actions={(
        <button className="btn btn-primary btn-lg" type="button" onClick={onClose}>
          {t('btn.confirm') || '確定'}
        </button>
      )}
    >
      <p>{message}</p>
    </AppDialog>
  );
}
