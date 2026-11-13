export function CreateLaserAudio(createAudio: (url: string) => HTMLAudioElement = url => new Audio(url)) {
  const laser = createAudio('./assets/laser-hero/laser.ogg');
  const hit = createAudio('./assets/laser-hero/hit.ogg');
  const complete = createAudio('./assets/laser-hero/complete.ogg');
  const samples = [laser, hit, complete];
  laser.loop = true;
  laser.volume = .12;
  hit.volume = .2;
  complete.volume = .16;
  let firing = false;
  let disposed = false;
  let generation = 0;
  const play = (sample: HTMLAudioElement) => {
    if (disposed) return;
    const started = generation;
    void sample.play().then(() => {
      if (disposed || started !== generation || (sample === laser && !firing)) sample.pause();
    }).catch(() => undefined);
  };
  const stop = () => {
    generation++;
    firing = false;
    for (const sample of samples) { sample.pause(); sample.currentTime = 0; }
  };
  return {
    setFiring(value: boolean) {
      if (disposed || value === firing) return;
      firing = value;
      if (value) play(laser);
      else { laser.pause(); laser.currentTime = 0; }
    },
    playHit() { if (!disposed) { hit.currentTime = 0; play(hit); } },
    playComplete() { if (!disposed) play(complete); },
    stop,
    dispose() {
      stop(); disposed = true;
      for (const sample of samples) { sample.removeAttribute('src'); sample.load(); }
    },
  };
}
