import { letters, recallCount } from './logic/letterMemory';

// Four slots for the answer, filled left to right.
export function LetterEntry({ entry, en }: { entry: string[]; en: boolean }) {
  return <div className="lm-entry" aria-label={en ? `Your answer: ${entry.join(' ') || 'empty'}` : `你的答案：${entry.join(' ') || '尚未輸入'}`}>
    {Array.from({ length: recallCount }, (_, index) => <span key={index} className="lm-slot" data-filled={entry[index] ? true : undefined}>{entry[index] ?? ''}</span>)}
  </div>;
}

// A–Z plus Delete and Clear fill a 7 by 4 grid. The tutorial scene shows the same keys as inert copies.
export function LetterPad({ en, active, full, inert, onLetter, onBack, onClear }: {
  en: boolean; active: boolean; full: boolean; inert?: boolean;
  onLetter?: (letter: string) => void; onBack?: () => void; onClear?: () => void;
}) {
  const keys: { key: string; label: string; name?: string; className: string; disabled: boolean; run: () => void }[] = [...letters].map(letter => ({ key: letter, label: letter, className: 'lm-key', disabled: !active || full, run: () => onLetter?.(letter) }));
  // The delete key shows a symbol so it fits a phone-width key in both languages; its name is spoken in words.
  keys.push({ key: 'back', label: '⌫', name: en ? 'Delete' : '刪除', className: 'lm-key lm-back', disabled: !active, run: () => onBack?.() },
    { key: 'clear', label: en ? 'Clear' : '清除', className: 'lm-key lm-clear', disabled: !active, run: () => onClear?.() });
  return <div className="lm-keypad">
    {keys.map(item => inert ? <span key={item.key} className={item.className} data-letter={item.key.length === 1 ? item.key : undefined} aria-label={item.name}>{item.label}</span>
      : <button key={item.key} type="button" className={item.className} data-letter={item.key.length === 1 ? item.key : undefined} aria-label={item.name} disabled={item.disabled}
        onClick={item.run}>{item.label}</button>)}
  </div>;
}
