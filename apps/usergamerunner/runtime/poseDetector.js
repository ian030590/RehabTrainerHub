const posePoints = [23, 24, 25, 26];

function Xyz(point) {
  if (![point?.x, point?.y, point?.z].every(value => Number.isFinite(value) && Math.abs(value) <= 10)) throw new Error('Invalid landmark');
  return { x: point.x, y: point.y, z: point.z };
}

// Up to two hands of 21 points, plus the hip and knee points 23–26 when a body is in view.
export function CreatePoseDetector({ handLandmarker, poseLandmarker }) {
  return {
    Detect(video, timestamp) {
      const hands = handLandmarker.detectForVideo(video, timestamp).landmarks.slice(0, 2);
      const body = poseLandmarker.detectForVideo(video, timestamp).landmarks[0];
      if (hands.some(points => points.length !== 21)) throw new Error('Invalid hand landmarks');
      return {
        timestamp, videoWidth: video.videoWidth, videoHeight: video.videoHeight,
        hands: hands.map(points => points.map(Xyz)),
        pose: body && posePoints.every(index => body[index]) ? posePoints.map(index => Xyz(body[index])) : [],
      };
    },
    Close() { handLandmarker.close(); poseLandmarker.close(); },
  };
}
