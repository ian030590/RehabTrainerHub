import { useRef } from 'react';

export interface TrainingFilePickerButtonProps {
  accept: string;
  label: string;
  onFile: (file: File | undefined) => void;
}

export function TrainingFilePickerButton({ accept, label, onFile }: TrainingFilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button className="btn btn-secondary btn-sm training-file-picker-button" type="button" onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      <input
        ref={inputRef}
        className="training-file-picker-input"
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          onFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </>
  );
}
