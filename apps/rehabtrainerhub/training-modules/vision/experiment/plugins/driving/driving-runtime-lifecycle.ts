let activeDrivingRuntimeDisposer: (() => void) | null = null;

export function RegisterDrivingRuntimeDisposer(disposer: () => void) {
  activeDrivingRuntimeDisposer?.();
  activeDrivingRuntimeDisposer = disposer;
  return () => {
    if (activeDrivingRuntimeDisposer === disposer) activeDrivingRuntimeDisposer = null;
  };
}

export function DisposeDrivingRehabRuntime() {
  const disposer = activeDrivingRuntimeDisposer;
  activeDrivingRuntimeDisposer = null;
  disposer?.();
}
