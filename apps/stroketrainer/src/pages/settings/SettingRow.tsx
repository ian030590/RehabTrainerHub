import { useState } from 'react';
import { useT } from '../../i18n';

/* ── Reusable Setting Row with Edit ── */
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
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const handleStartEdit = () => {
    setInputVal('');
    setEditing(true);
  };

  const handleConfirm = () => {
    onEdit(inputVal);
    setEditing(false);
  };

  return (
    <div className="setting-row">
      <div className="setting-info">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      {editing ? (
        <div className="setting-actions">
          <input
            className="input setting-edit-input"
            placeholder={editPlaceholder}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleConfirm}>{t('btn.confirm')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('btn.cancel')}</button>
        </div>
      ) : (
        <div className="setting-actions setting-value-actions">
          <span className="setting-value">{value}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleStartEdit}>{t('btn.edit')}</button>
        </div>
      )}
    </div>
  );
}
