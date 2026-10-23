// Hub side of the sensor proxies. Messages reach Handle only after AcceptGameMessage, so payloads are already checked.
// The container shows the camera image in `preview`, behind the transparent game frame, and enters fullscreen
// on `shell` (the element holding both) so the image stays visible.
export function CreateSensorInputHost({ inputs, createBroker, post, preview, shell, page }) {
  let sequence = 0;
  const send = message => post({ schema: 'trainerhub.input/v1', sequence: sequence++, ...message });
  const brokers = Object.fromEntries(inputs.map(input => [input, createBroker(input, send)]));
  const Stop = () => Object.values(brokers).forEach(broker => broker.Stop());
  const Handle = message => {
    const payload = message.payload;
    if (message.type === 'input-start') {
      const broker = brokers[payload.input];
      if (!broker) return false;
      Object.entries(brokers).forEach(([input, other]) => { if (input !== payload.input) other.Stop(); });
      void broker.Start(payload.input);
    } else if (message.type === 'input-stop') Stop();
    else if (message.type === 'input-capture') brokers.tongue?.Capture(payload.label, payload.active);
    else if (message.type === 'input-preview') {
      if (!preview) return false;
      preview.hidden = !payload.visible;
      for (const [key, name] of [['x', 'left'], ['y', 'top'], ['width', 'width'], ['height', 'height']]) {
        preview.style[name] = `${Math.round(payload[key] * 10000) / 100}%`;
      }
    } else if (message.type === 'fullscreen-request') {
      if (shell && page.fullscreenElement !== shell) void Promise.resolve(shell.requestFullscreen?.()).catch(() => undefined);
    } else if (message.type === 'fullscreen-exit') {
      if (shell && page.fullscreenElement === shell) void Promise.resolve(page.exitFullscreen()).catch(() => undefined);
    } else return false;
    return true;
  };
  const FullscreenChanged = () => post({ schema: 'trainerhub.game/v1', type: 'fullscreen', active: Boolean(shell) && page.fullscreenElement === shell });
  return { Handle, Stop, FullscreenChanged };
}
