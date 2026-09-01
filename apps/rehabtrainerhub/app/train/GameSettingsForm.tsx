'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GetGameSettingsDefaults,
  NormalizeGameSettingsValues,
  ResolveGameSettingsText,
  type GameSettingField,
  type GameSettingsDefinition,
  type GameSettingsValues,
} from '@rehab-trainer/game-settings';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';

interface GameSettingsFormProps {
  definition: GameSettingsDefinition;
  language: 'en' | 'zh';
  title: string;
  onCancel: () => void;
  onSubmit: (values: GameSettingsValues) => void;
}

export function GameSettingsForm({
  definition,
  language,
  onCancel,
  onSubmit,
  title,
}: GameSettingsFormProps) {
  const defaults = useMemo(() => GetGameSettingsDefaults(definition), [definition]);
  const [values, setValues] = useState<GameSettingsValues>(defaults);
  const formRef = useRef<HTMLFormElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const locale = language === 'en' ? 'en' : 'zh-TW';
  const copy = language === 'en'
    ? {
        cancel: 'Back to lobby',
        heading: 'Training settings',
        intro: 'Choose the settings for this session. The platform sends only these values to the game.',
        start: 'Start training',
      }
    : {
        cancel: '返回大廳',
        heading: '訓練設定',
        intro: '請調整這次活動的參數；平台只會將下列設定值傳送給遊戲。',
        start: '開始訓練',
      };

  const updateValue = (key: string, value: string | number | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    setPortalContainer(formRef.current?.closest('dialog') ?? formRef.current);
  }, []);

  return (
    <form
      className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[var(--background)] text-[var(--text)]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(NormalizeGameSettingsValues(definition, values));
      }}
      ref={formRef}
    >
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-5 sm:px-8 sm:py-7">
        <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-[var(--primary)] uppercase">{copy.heading}</p>
        <h2 className="m-0 text-balance text-2xl font-black tracking-[-0.025em] text-[var(--heading)] sm:text-3xl">{title}</h2>
        <p className="mt-2 mb-0 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{copy.intro}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
        <div className="grid gap-5 lg:grid-cols-2">
          {definition.sections.map((section) => (
            <section
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
              key={section.id}
            >
              <div className="mb-5">
                <h3 className="m-0 text-lg font-black tracking-[-0.015em] text-[var(--heading)]">
                  {ResolveGameSettingsText(section.title, locale)}
                </h3>
                {section.description && (
                  <p className="mt-1 mb-0 text-sm leading-6 text-[var(--text-muted)]">
                    {ResolveGameSettingsText(section.description, locale)}
                  </p>
                )}
              </div>
              <div className="grid gap-5">
                {section.fields.map((field) => (
                  <GameSettingControl
                    field={field}
                    key={field.key}
                    locale={locale}
                    onChange={(value) => updateValue(field.key, value)}
                    portalContainer={portalContainer}
                    value={values[field.key]}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="flex flex-col-reverse gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
        <Button onClick={onCancel} type="button" variant="outline">{copy.cancel}</Button>
        <Button size="lg" type="submit">
          {copy.start}
          <span aria-hidden="true" className="material-symbols-outlined text-xl">play_arrow</span>
        </Button>
      </footer>
    </form>
  );
}

function GameSettingControl({
  field,
  locale,
  onChange,
  portalContainer,
  value,
}: {
  field: GameSettingField;
  locale: 'en' | 'zh-TW';
  onChange: (value: string | number | boolean) => void;
  portalContainer: HTMLElement | null;
  value: string | number | boolean;
}) {
  const label = ResolveGameSettingsText(field.label, locale);
  const description = field.description
    ? ResolveGameSettingsText(field.description, locale)
    : null;

  if (field.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] bg-[var(--surface-muted)] p-4">
        <Checkbox
          aria-label={label}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span className="grid gap-0.5">
          <span className="font-extrabold text-[var(--heading)]">{label}</span>
          {description && <span className="text-sm leading-5 text-[var(--text-muted)]">{description}</span>}
        </span>
      </label>
    );
  }

  if (field.type === 'slider') {
    const numericValue = typeof value === 'number' ? value : field.default;
    const unit = field.unit ? ResolveGameSettingsText(field.unit, locale) : '';
    return (
      <div className="grid gap-2.5">
        <div className="flex items-start justify-between gap-4">
          <label className="grid gap-0.5" htmlFor={`game-setting-${field.key}`}>
            <span className="font-extrabold text-[var(--heading)]">{label}</span>
            {description && <span className="text-sm leading-5 text-[var(--text-muted)]">{description}</span>}
          </label>
          <output className="min-w-20 rounded-[6px] bg-[var(--primary-soft)] px-2.5 py-1 text-center font-mono text-sm font-black tabular-nums text-[var(--primary)]">
            {numericValue}{unit ? ` ${unit}` : ''}
          </output>
        </div>
        <Slider
          aria-label={label}
          id={`game-setting-${field.key}`}
          max={field.max}
          min={field.min}
          onValueChange={([nextValue]) => onChange(nextValue)}
          step={field.step}
          value={[numericValue]}
        />
        <div aria-hidden="true" className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
          <span>{field.min}{unit ? ` ${unit}` : ''}</span>
          <span>{field.max}{unit ? ` ${unit}` : ''}</span>
        </div>
      </div>
    );
  }

  const selectedOption = field.options.find((option) => Object.is(option.value, value))
    ?? field.options[0];
  return (
    <div className="grid gap-2">
      <label className="grid gap-0.5" htmlFor={`game-setting-${field.key}`}>
        <span className="font-extrabold text-[var(--heading)]">{label}</span>
        {description && <span className="text-sm leading-5 text-[var(--text-muted)]">{description}</span>}
      </label>
      <Select
        onValueChange={(encodedValue) => {
          const optionIndex = Number(encodedValue);
          const option = field.options[optionIndex];
          if (option) onChange(option.value);
        }}
        value={String(field.options.indexOf(selectedOption))}
      >
        <SelectTrigger aria-label={label} id={`game-setting-${field.key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent portalContainer={portalContainer}>
          {field.options.map((option, index) => (
            <SelectItem key={`${typeof option.value}:${String(option.value)}`} value={String(index)}>
              {ResolveGameSettingsText(option.label, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
