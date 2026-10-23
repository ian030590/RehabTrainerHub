// Camera loop shared by the pose and tongue proxies. The detector turns a video frame into the numeric
// payload the game may see; the video element only ever lives in the container.
export function CreateCameraInputController(environment, { intervalMs, createDetector }) {
  let generation = 0;
  let stream = null;
  let video = null;
  let detector = null;
  let frame = null;
  const Stop = () => {
    generation++;
    if (frame !== null) environment.cancelFrame(frame);
    frame = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (video) { video.pause(); video.srcObject = null; video.remove?.(); }
    video = null;
    detector?.Close();
    detector = null;
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
      const acquired = await environment.getUserMedia({ audio: false,
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } } });
      if (generation !== selected) { acquired.getTracks().forEach(track => track.stop()); return false; }
      stream = acquired;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Camera track unavailable');
      track.addEventListener('ended', () => fail('disconnected'), { once: true });
      video = environment.createVideo();
      video.srcObject = stream;
      await video.play();
      if (generation !== selected) return false;
      const created = await createDetector();
      if (generation !== selected) { created.Close(); return false; }
      detector = created;
      let previousTime = -1;
      let previousDetection = -Infinity;
      let pending = false;
      const process = timestamp => {
        if (generation !== selected) return;
        frame = environment.requestFrame(process);
        if (pending || video.readyState < 2 || video.currentTime === previousTime || timestamp - previousDetection < intervalMs) return;
        previousTime = video.currentTime;
        previousDetection = timestamp;
        try {
          const result = detector.Detect(video, timestamp);
          if (typeof result?.then !== 'function') { if (result) onFrame(result); return; }
          // An earlier classification is still running: wait for it instead of queueing more work.
          pending = true;
          result.then(payload => {
            pending = false;
            if (generation === selected && payload) onFrame(payload);
          }, () => fail('initialization'));
        } catch { fail('initialization'); }
      };
      frame = environment.requestFrame(process);
      return true;
    } catch (error) {
      fail(['NotAllowedError', 'SecurityError'].includes(error?.name) ? 'permission' : 'initialization');
      return false;
    }
  };
  return { Start, Stop, Capture: (label, capturing) => detector?.Capture?.(label, capturing) };
}
