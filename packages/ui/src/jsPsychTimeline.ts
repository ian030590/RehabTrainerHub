export type JsPsychTimelineTrial = Record<string, unknown>;

export interface JsPsychFullscreenOptions {
  message?: string;
  buttonLabel?: string;
  exitFullscreen?: boolean;
}

export function withJsPsychFullscreen<T extends JsPsychTimelineTrial>(
  timeline: T[],
  fullscreenPlugin: unknown,
  options: JsPsychFullscreenOptions = {},
): JsPsychTimelineTrial[] {
  const wrapped: JsPsychTimelineTrial[] = [
    {
      type: fullscreenPlugin,
      fullscreen_mode: true,
      message: options.message ?? '',
      button_label: options.buttonLabel ?? 'Continue',
    },
    ...timeline,
  ];

  if (options.exitFullscreen ?? true) {
    wrapped.push({
      type: fullscreenPlugin,
      fullscreen_mode: false,
      delay_after: 0,
    });
  }

  return wrapped;
}
