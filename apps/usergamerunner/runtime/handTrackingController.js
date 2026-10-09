export function CreateHandTrackingController(environment) {
  let generation = 0;
  let stream = null;
  let video = null;
  let landmarker = null;
  let frame = null;
  const Stop = () => {
    generation++;
    if (frame !== null) environment.cancelFrame(frame);
    frame = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (video) { video.pause(); video.srcObject = null; video.remove?.(); }
    video = null;
    landmarker?.close();
    landmarker = null;
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
      const detector = await environment.createLandmarker();
      if (generation !== selected) { detector.close(); return false; }
      landmarker = detector;
      let previousTime = -1;
      let previousDetection = -Infinity;
      const process = timestamp => {
        if (generation !== selected) return;
        frame = environment.requestFrame(process);
        if (video.readyState < 2 || video.currentTime === previousTime || timestamp - previousDetection < 66) return;
        previousTime = video.currentTime;
        previousDetection = timestamp;
        try {
          const points = landmarker.detectForVideo(video, timestamp).landmarks[0] ?? [];
          if (points.length !== 0 && (points.length !== 21 || points.some(point =>
            ![point.x, point.y, point.z].every(value => Number.isFinite(value) && Math.abs(value) <= 10)))) {
            throw new Error('Invalid hand landmarks');
          }
          onFrame({ timestamp, landmarks: points.map(({ x, y, z }) => ({ x, y, z })) });
        } catch { fail('initialization'); }
      };
      frame = environment.requestFrame(process);
      return true;
    } catch (error) {
      fail(['NotAllowedError', 'SecurityError'].includes(error?.name) ? 'permission' : 'initialization');
      return false;
    }
  };
  return { Start, Stop };
}
