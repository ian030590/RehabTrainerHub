// Trusted containers own camera permission; packages receive only private xyz input.
export function CreateHandTrackingBroker({ createController, send, requestConsent, cancelConsent }) {
  let generation = 0;
  let active = false;
  let controller = null;
  let sequence = 0;
  const reply = (type, payload) => send({ schema: 'trainerhub.input/v1', sequence: sequence++, type, payload });
  const Stop = () => {
    generation++;
    active = false;
    cancelConsent?.();
    controller?.Stop();
    controller = null;
  };
  const Start = async () => {
    if (active) return;
    active = true;
    const selected = generation;
    try {
      const consent = await requestConsent();
      if (selected !== generation) return;
      if (!consent) { Stop(); reply('error', { reason: 'permission' }); return; }
      const input = await createController();
      if (selected !== generation) { input.Stop(); return; }
      controller = input;
      const started = await input.Start(
        payload => { if (selected === generation) reply('frame', payload); },
        reason => { if (selected === generation) { Stop(); reply('error', { reason }); } },
      );
      if (selected === generation && started) reply('ready', {});
    } catch {
      if (selected === generation) { Stop(); reply('error', { reason: 'initialization' }); }
    }
  };
  return { Start, Stop };
}
