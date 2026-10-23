// Trusted containers own camera and microphone permission; games receive only the proxy's numeric frames.
// Replies carry only type and payload: one game can use two proxies, so the container numbers them on one sequence.
export function CreateSensorInputBroker({ createController, send, requestConsent, cancelConsent }) {
  let generation = 0;
  let active = null;
  let controller = null;
  const Stop = () => {
    generation++;
    active = null;
    cancelConsent?.();
    controller?.Stop();
    controller = null;
  };
  const Start = async input => {
    if (active === input) return;
    if (active !== null) Stop();
    active = input;
    const selected = generation;
    try {
      const consent = await requestConsent(input);
      if (selected !== generation) return;
      if (!consent) { Stop(); send({ type: 'error', payload: { reason: 'permission' } }); return; }
      const created = await createController(input);
      if (selected !== generation) { created.Stop(); return; }
      controller = created;
      const started = await created.Start(
        payload => { if (selected === generation) send({ type: 'frame', payload }); },
        reason => { if (selected === generation) { Stop(); send({ type: 'error', payload: { reason } }); } },
      );
      if (selected === generation && started) send({ type: 'ready', payload: {} });
    } catch {
      if (selected === generation) { Stop(); send({ type: 'error', payload: { reason: 'initialization' } }); }
    }
  };
  return { Start, Stop, Capture: (label, capturing) => controller?.Capture?.(label, capturing) };
}
