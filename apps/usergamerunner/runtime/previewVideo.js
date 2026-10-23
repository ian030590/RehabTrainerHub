// The container shows the camera image behind the transparent game frame, flipped so it reads like a mirror.
export function CreatePreviewVideo(host) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  Object.assign(video.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%',
    objectFit: 'cover', transform: 'scaleX(-1)' });
  if (host) host.append(video);
  else { video.hidden = true; document.body.append(video); }
  return video;
}
