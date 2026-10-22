import { categoryLabels, exemplars, wordLabels, type Category } from './logic/keepTrack';

// One row per target category with its five words. The rows stay on screen during the words as the target reminder,
// and open for answers after the last word. After practice, reveal marks the right word and a wrong pick.
export function AnswerRows({ targets, en, choices, active, reveal, example, inert, onChoose }: {
  targets: Category[]; en: boolean; choices: Partial<Record<Category, string>>; active: boolean;
  reveal?: Partial<Record<Category, string>>; example?: Category; inert?: boolean; onChoose?: (category: Category, word: string) => void;
}) {
  const language = en ? 'en' : 'zh';
  return <div className="kt-answer" data-count={targets.length}>
    {targets.map(category => <section key={category} className="kt-row" data-category={category} data-tutorial={category === example ? 'example' : undefined}
      aria-label={categoryLabels[category][language]}>
      <h3 className="kt-category">{categoryLabels[category][language]}</h3>
      <div className="kt-options">
        {exemplars[category].map(word => {
          const chosen = choices[category] === word;
          const mark = reveal ? reveal[category] === word ? 'correct' : chosen ? 'wrong' : undefined : undefined;
          const text = wordLabels[word][language];
          return inert ? <span key={word} className="kt-option" data-word={word} data-chosen={chosen || undefined} data-mark={mark}>{text}</span>
            : <button key={word} type="button" className="kt-option" data-word={word} aria-pressed={chosen} data-mark={mark} disabled={!active}
              onClick={() => onChoose?.(category, word)}>{text}</button>;
        })}
      </div>
    </section>)}
  </div>;
}
