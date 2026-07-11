import { useState } from 'react';

export interface EditableSettingRowProps {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  editLabel: string;
  editPlaceholder: string;
  onEdit: (value: string) => void;
  title: string;
  value: string;
}

export function EditableSettingRow({
  cancelLabel,
  confirmLabel,
  description,
  editLabel,
  editPlaceholder,
  onEdit,
  title,
  value,
}: EditableSettingRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const startEditing = () => {
    setInputValue('');
    setEditing(true);
  };

  const confirmEdit = () => {
    onEdit(inputValue);
    setEditing(false);
  };

  return (
    <div className="setting-row">
      <div className="setting-info">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {editing ? (
        <div className="setting-actions">
          <input
            className="input setting-edit-input"
            placeholder={editPlaceholder}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirmEdit();
              if (event.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={confirmEdit} type="button">
            {confirmLabel}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} type="button">
            {cancelLabel}
          </button>
        </div>
      ) : (
        <div className="setting-actions setting-value-actions">
          <span className="setting-value">{value}</span>
          <button className="btn btn-ghost btn-sm" onClick={startEditing} type="button">
            {editLabel}
          </button>
        </div>
      )}
    </div>
  );
}
