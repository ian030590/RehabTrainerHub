// Web Audio level proxy: the game receives the loudness and the high/low spectrum balance of each animation frame,
// never the sound itself. Browser voice processing is off so short clap and thigh sounds keep their shape.
export function CreateMicrophoneController(environment) {
  let generation = 0;
  let stream = null;
  let context = null;
  let source = null;
  let analyser = null;
  let frame = null;
  const Stop = () => {
    generation++;
    if (frame !== null) environment.cancelFrame(frame);
    frame = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    source?.disconnect();
    analyser?.disconnect();
    source = null;
    analyser = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    context = null;
  };
  const Start = async (onFrame, onError) => {
    Stop();
    const selected = generation;
    const fail = reason => {
      if (generation !== selected) return;
      Stop();
      onError(reason);
    };
    try {
      if (!environment.getUserMedia) { fail('unsupported'); return false; }
      const created = environment.createAudioContext();
      if (!created) { fail('unsupported'); return false; }
      context = created;
      const acquired = await environment.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (generation !== selected) { acquired.getTracks().forEach(track => track.stop()); return false; }
      stream = acquired;
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('Microphone track unavailable');
      track.addEventListener('ended', () => fail('disconnected'), { once: true });
      await context.resume();
      if (generation !== selected) return false;
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.45;
      source.connect(analyser);
      const timeSamples = new Float32Array(analyser.fftSize);
      const frequencySamples = new Uint8Array(analyser.frequencyBinCount);
      const split = Math.floor(frequencySamples.length * 0.38);
      const tick = timestamp => {
        if (generation !== selected) return;
        frame = environment.requestFrame(tick);
        analyser.getFloatTimeDomainData(timeSamples);
        let total = 0;
        for (const sample of timeSamples) total += sample * sample;
        analyser.getByteFrequencyData(frequencySamples);
        let low = 0;
        let high = 0;
        for (let index = 0; index < frequencySamples.length; index += 1) {
          if (index < split) low += frequencySamples[index];
          else high += frequencySamples[index];
        }
        onFrame({ timestamp, rms: Math.sqrt(total / timeSamples.length), highRatio: high / Math.max(1, high + low) });
      };
      frame = environment.requestFrame(tick);
      return true;
    } catch (error) {
      fail(['NotAllowedError', 'SecurityError'].includes(error?.name) ? 'permission' : 'initialization');
      return false;
    }
  };
  return { Start, Stop };
}
