'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GetGameSettingsDefaults,
  NormalizeGameSettingsValues,
  ResolveGameSettingsText,
  type GameSettingField,
  type GameSettingsDefinition,
  type GameSettingsSection,
  type GameSettingsValues,
} from '@rehab-trainer/game-settings';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';

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
      className="game-settings-form mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] text-[var(--text)] shadow-[var(--shadow-md)]"
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto grid w-full gap-5">
          {definition.sections.map((section) => {
            const isCompass = IsDirectionsCompassSection(section);
            const activeCompassCount = isCompass
              ? [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => Boolean(values[`axis${i}Enabled`])).length
              : 0;

            return (
              <section
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
                key={section.id}
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="m-0 text-lg font-black tracking-[-0.015em] text-[var(--heading)]">
                      {ResolveGameSettingsText(section.title, locale)}
                    </h3>
                    {section.description && (
                      <p className="mt-1 mb-0 text-sm leading-6 text-[var(--text-muted)]">
                        {ResolveGameSettingsText(section.description, locale)}
                      </p>
                    )}
                  </div>
                  {isCompass && (
                    <output className="min-w-20 shrink-0 rounded-[6px] bg-[var(--primary-soft)] px-2.5 py-1 text-center font-mono text-xs font-black tabular-nums text-[var(--primary)]">
                      {locale === 'en'
                        ? `${activeCompassCount}/8 directions active`
                        : `${activeCompassCount}/8 方向啟用`}
                    </output>
                  )}
                </div>
                {isCompass ? (
                  <DirectionsCompassSection
                    locale={locale}
                    onToggleAll={() => {
                      if (activeCompassCount === 8) {
                        setValues((current) => ({
                          ...current,
                          axis0Enabled: true,
                          axis1Enabled: false,
                          axis2Enabled: true,
                          axis3Enabled: false,
                          axis4Enabled: true,
                          axis5Enabled: false,
                          axis6Enabled: true,
                          axis7Enabled: false,
                        }));
                      } else {
                        setValues((current) => ({
                          ...current,
                          axis0Enabled: true,
                          axis1Enabled: true,
                          axis2Enabled: true,
                          axis3Enabled: true,
                          axis4Enabled: true,
                          axis5Enabled: true,
                          axis6Enabled: true,
                          axis7Enabled: true,
                        }));
                      }
                    }}
                    onToggleAxis={(axis) => {
                      const key = `axis${axis}Enabled`;
                      const isCurrentlyActive = Boolean(values[key]);
                      if (isCurrentlyActive) {
                        if (activeCompassCount > 1) {
                          updateValue(key, false);
                        }
                      } else {
                        updateValue(key, true);
                      }
                    }}
                    values={values}
                  />
                ) : (
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
                )}
              </section>
            );
          })}
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

  if (field.type === 'color') {
    const colorValue = typeof value === 'string' ? value : field.default;
    return (
      <label className="grid cursor-pointer gap-2" htmlFor={`game-setting-${field.key}`}>
        <span className="grid gap-0.5">
          <span className="font-extrabold text-[var(--heading)]">{label}</span>
          {description && <span className="text-sm leading-5 text-[var(--text-muted)]">{description}</span>}
        </span>
        <span className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <input
            aria-label={label}
            className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
            id={`game-setting-${field.key}`}
            onChange={(event) => onChange(event.target.value)}
            type="color"
            value={colorValue}
          />
          <output className="font-mono text-sm font-black uppercase text-[var(--heading)]">
            {colorValue}
          </output>
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

interface CompassSlot {
  axis?: number;
  isCenter?: boolean;
  arrow: string;
  labelZh: string;
  labelEn: string;
}

const nineGridCompassSlots: CompassSlot[] = [
  { axis: 7, arrow: '↖', labelZh: '左上', labelEn: 'Up-Left' },
  { axis: 0, arrow: '↑', labelZh: '上', labelEn: 'Up' },
  { axis: 1, arrow: '↗', labelZh: '右上', labelEn: 'Up-Right' },
  { axis: 6, arrow: '←', labelZh: '左', labelEn: 'Left' },
  { isCenter: true, arrow: 'ALL', labelZh: '全選', labelEn: 'All' },
  { axis: 2, arrow: '→', labelZh: '右', labelEn: 'Right' },
  { axis: 5, arrow: '↙', labelZh: '左下', labelEn: 'Down-Left' },
  { axis: 4, arrow: '↓', labelZh: '下', labelEn: 'Down' },
  { axis: 3, arrow: '↘', labelZh: '右下', labelEn: 'Down-Right' },
];

function IsDirectionsCompassSection(section: GameSettingsSection): boolean {
  return section.id === 'directions'
    && [0, 1, 2, 3, 4, 5, 6, 7].every((axis) => (
      section.fields.some((field) => field.key === `axis${axis}Enabled` && field.type === 'checkbox')
    ));
}

function DirectionsCompassSection({
  locale,
  onToggleAll,
  onToggleAxis,
  values,
}: {
  locale: 'en' | 'zh-TW';
  onToggleAll: () => void;
  onToggleAxis: (axis: number) => void;
  values: GameSettingsValues;
}) {
  const activeCount = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => Boolean(values[`axis${i}Enabled`])).length;
  const isAllActive = activeCount === 8;

  return (
    <div className="mx-auto grid w-full max-w-[440px] grid-cols-3 gap-2.5">
      {nineGridCompassSlots.map((slot) => {
        if (slot.isCenter) {
          return (
            <button
              aria-pressed={isAllActive}
              className={`flex min-h-[66px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border p-2 select-none transition-all ${
                isAllActive
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--surface)]'
              }`}
              key="center-all"
              onClick={onToggleAll}
              type="button"
            >
              <span className="text-[15px] font-black tracking-wider leading-none">ALL</span>
              <span className={`text-xs font-bold ${isAllActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                {locale === 'en' ? slot.labelEn : slot.labelZh}
              </span>
            </button>
          );
        }

        const axis = slot.axis!;
        const isActive = Boolean(values[`axis${axis}Enabled`]);

        return (
          <button
            aria-pressed={isActive}
            className={`flex min-h-[66px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border p-2 select-none transition-all ${
              isActive
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--primary)]'
                : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--surface)]'
            }`}
            key={`axis-${axis}`}
            onClick={() => onToggleAxis(axis)}
            type="button"
          >
            <span className="text-2xl font-black leading-none">{slot.arrow}</span>
            <span className={`text-xs font-bold ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              {locale === 'en' ? slot.labelEn : slot.labelZh}
            </span>
          </button>
        );
      })}
    </div>
  );
}

