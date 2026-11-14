export function CreateLaserAudio(createAudio: (url: string) => HTMLAudioElement = url => new Audio(url)) {
  const laser = createAudio('./assets/laser-hero/laser.ogg');
  const hit = createAudio('./assets/laser-hero/hit.ogg');
  const complete = createAudio('./assets/laser-hero/complete.ogg');
  const charge = createAudio('./assets/laser-hero/charge.ogg');
  const samples = [laser, hit, complete, charge];
  laser.loop = true;
  charge.loop = true;
  laser.volume = .12;
  charge.volume = .12;
  charge.preservesPitch = false;
  hit.volume = .2;
  complete.volume = .16;
  let activeLoop: HTMLAudioElement | null = null;
  let disposed = false;
  let generation = 0;
  const play = (sample: HTMLAudioElement) => {
    if (disposed) return;
    const started = generation;
    void sample.play().then(() => {
      if (disposed || started !== generation || ([laser, charge].includes(sample) && sample !== activeLoop)) sample.pause();
    }).catch(() => undefined);
  };
  const stop = () => {
    generation++;
    activeLoop = null;
    for (const sample of samples) { sample.pause(); sample.currentTime = 0; }
    charge.playbackRate = 1;
  };
  return {
    setFiring(value: boolean, onEnemy = false, progress = 0) {
      if (disposed) return;
      const nextLoop = value ? (onEnemy ? charge : laser) : null;
      charge.playbackRate = nextLoop === charge ? 1 + .6 * Math.max(0, Math.min(1, progress)) : 1;
      if (nextLoop === activeLoop) return;
      if (activeLoop) { activeLoop.pause(); activeLoop.currentTime = 0; }
      activeLoop = nextLoop;
      if (activeLoop) play(activeLoop);
    },
    playHit() { if (!disposed) { stop(); play(hit); } },
    playComplete() { if (!disposed) { stop(); play(complete); } },
    stop,
    dispose() {
      stop(); disposed = true;
      for (const sample of samples) { sample.removeAttribute('src'); sample.load(); }
    },
  };
}
