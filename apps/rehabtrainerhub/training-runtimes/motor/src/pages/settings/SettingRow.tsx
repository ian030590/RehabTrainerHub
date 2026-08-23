import { EditableSettingRow } from '@rehab-trainer/ui/components/EditableSettingRow';
import { useT } from '../../i18n';

export function SettingRow({
  title,
  desc,
  value,
  onEdit,
  editPlaceholder,
}: {
  title: string;
  desc: string;
  value: string;
  onEdit: (val: string) => void;
  editPlaceholder: string;
}) {
  const { t } = useT();

  return (
    <EditableSettingRow
      title={title}
      description={desc}
      value={value}
      onEdit={onEdit}
      editPlaceholder={editPlaceholder}
      confirmLabel={t('btn.confirm')}
      cancelLabel={t('btn.cancel')}
      editLabel={t('btn.edit')}
    />
  );
}
