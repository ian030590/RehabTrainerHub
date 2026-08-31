/**
 * Stop every track owned by a training run.
 *
 * Permission preflights and module-owned runtimes both use this helper so a
 * stream cannot survive a jsPsych abort, React unmount, or late async setup.
 */
export function StopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
