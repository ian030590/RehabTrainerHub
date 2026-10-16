export function CreateEyeTrackingController(environment) {
  let generation = 0;
  let stream = null;
  let engine = null;
  let frame = null;
  const Stop = () => {
    generation++;
    if (frame !== null) environment.cancelFrame(frame);
    frame = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    engine?.Dispose();
    engine = null;
  };
  const Start = async (onFrame, onError) => {
    Stop();
    const selected = generation;
    const fail = reason => { if (selected === generation) { Stop(); onError(reason); } };
    try {
      const acquired = await environment.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      if (selected !== generation) { acquired.getTracks().forEach(track => track.stop()); return false; }
      stream = acquired;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Camera track unavailable');
      track.addEventListener('ended', () => fail('disconnected'), { once: true });
      const created = await environment.createEngine(stream);
      if (selected !== generation) { created.Dispose(); return false; }
      engine = created;
      let last = -Infinity;
      const process = async timestamp => {
        if (selected !== generation) return;
        if (timestamp - last >= 34) {
          last = timestamp;
          try {
            const current = engine;
            const inferenceStart = environment.now?.() ?? timestamp;
            const prediction = await current.Predict();
            if (selected !== generation) return;
            const valid = prediction && [prediction.x, prediction.y].every(value => Number.isFinite(value) && Math.abs(value) <= 10000);
            onFrame({ timestamp: (environment.timeOrigin || 0) + inferenceStart, x: valid ? prediction.x / 1000 : null, y: valid ? prediction.y / 1000 : null, faceDetected: Boolean(current.FaceDetected()) });
          } catch { fail('initialization'); return; }
        }
        if (selected === generation) frame = environment.requestFrame(process);
      };
      frame = environment.requestFrame(process);
      return true;
    } catch (error) { fail(['NotAllowedError', 'SecurityError'].includes(error?.name) ? 'permission' : 'initialization'); return false; }
  };
  return { Start, Stop, Calibrate: (x, y) => engine?.Calibrate(x * 1000, y * 1000), Reset: () => engine?.Reset() };
}
