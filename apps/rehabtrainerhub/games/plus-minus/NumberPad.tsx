// Phone-style number keys: 1 to 9, then delete, 0 and submit. The tutorial scene shows the same keys as inert copies.
export function NumberPad({ en, active, full, empty, inert, onDigit, onBack, onSubmit }: {
  en: boolean; active: boolean; full: boolean; empty: boolean; inert?: boolean;
  onDigit?: (digit: string) => void; onBack?: () => void; onSubmit?: () => void;
}) {
  const keys = [...'123456789'].map(digit => ({ key: digit, label: digit, name: undefined as string | undefined, className: 'pm-key', disabled: !active || full, run: () => onDigit?.(digit) }));
  // The delete key shows a symbol so it fits a phone-width key; its name is spoken in words.
  keys.push({ key: 'back', label: '⌫', name: en ? 'Delete' : '刪除', className: 'pm-key pm-back', disabled: !active || empty, run: () => onBack?.() },
    { key: '0', label: '0', name: undefined, className: 'pm-key', disabled: !active || full, run: () => onDigit?.('0') },
    { key: 'submit', label: en ? 'Submit' : '送出', name: undefined, className: 'pm-key pm-submit', disabled: !active || empty, run: () => onSubmit?.() });
  return <div className="pm-keypad">
    {keys.map(item => inert ? <span key={item.key} className={item.className} data-digit={/^\d$/.test(item.key) ? item.key : undefined} aria-label={item.name}>{item.label}</span>
      : <button key={item.key} type="button" className={item.className} data-digit={/^\d$/.test(item.key) ? item.key : undefined} aria-label={item.name}
        disabled={item.disabled} onClick={item.run}>{item.label}</button>)}
  </div>;
}

export function RuleLabel(condition: number, en: boolean) {
  return en ? ['Copy the number', 'Add 3', 'Subtract 3', 'Add 3, subtract 3, in turn'][condition + 1] : ['照抄數字', '每個加 3', '每個減 3', '加 3、減 3 輪流'][condition + 1];
}
