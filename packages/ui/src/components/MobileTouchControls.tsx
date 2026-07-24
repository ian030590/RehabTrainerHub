import { useRef } from 'react';

export type MobileDirection = 'up' | 'down' | 'left' | 'right';

export interface MobileDirectionPadProps {
  label?: string;
  className?: string;
  onDirectionStart: (direction: MobileDirection) => void;
  onDirectionEnd: (direction: MobileDirection) => void;
}

export interface MobileActionControl {
  id: string;
  label: string;
  className?: string;
  onPress: () => void;
}

export interface MobileActionControlsProps {
  actions: readonly MobileActionControl[];
  label?: string;
  className?: string;
}

const directionLabels: Record<MobileDirection, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
};

const directionSymbols: Record<MobileDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export function MobileDirectionPad({
  label = 'Touch movement controls',
  className,
  onDirectionStart,
  onDirectionEnd,
}: MobileDirectionPadProps) {
  const activeDirections = useRef(new Set<MobileDirection>());

  const startDirection = (direction: MobileDirection) => {
    if (activeDirections.current.has(direction)) return;
    activeDirections.current.add(direction);
    onDirectionStart(direction);
  };

  const endDirection = (direction: MobileDirection) => {
    if (!activeDirections.current.delete(direction)) return;
    onDirectionEnd(direction);
  };

  return (
    <div className={['mobile-touch-pad', className].filter(Boolean).join(' ')} aria-label={label}>
      {(['up', 'left', 'right', 'down'] as const).map((direction) => (
        <button
          aria-label={directionLabels[direction]}
          className={`mobile-touch-button mobile-touch-${direction}`}
          key={direction}
          onContextMenu={(event) => event.preventDefault()}
          onPointerCancel={(event) => {
            event.preventDefault();
            endDirection(direction);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            startDirection(direction);
          }}
          onPointerLeave={(event) => {
            event.preventDefault();
            endDirection(direction);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            endDirection(direction);
          }}
          type="button"
        >
          {directionSymbols[direction]}
        </button>
      ))}
    </div>
  );
}

export function MobileActionControls({
  actions,
  label = 'Touch action controls',
  className,
}: MobileActionControlsProps) {
  const pointerHandled = useRef(false);

  return (
    <div className={['mobile-action-controls', className].filter(Boolean).join(' ')} aria-label={label}>
      {actions.map((action) => (
        <button
          className={['mobile-action-button', action.className].filter(Boolean).join(' ')}
          key={action.id}
          onClick={() => {
            if (pointerHandled.current) {
              pointerHandled.current = false;
              return;
            }
            action.onPress();
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            event.preventDefault();
            pointerHandled.current = true;
            action.onPress();
          }}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
