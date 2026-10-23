// Head angles from MediaPipe's facial transformation matrix (column-major 4x4), using the conversion from
// FlyingMoo (MIT): yaw > 0 when the user turns to their own right, pitch > 0 when they look up.
function Angle(radians) { return Math.round(radians * 18000 / Math.PI) / 100 || 0; }

export function MatrixToHeadAngles(data) {
  if (!Array.isArray(data) && !ArrayBuffer.isView(data)) return null;
  if (data.length !== 16 || !Array.from(data).every(Number.isFinite)) return null;
  // Columns 0-2 carry the face's scale; normalize them so only the rotation is left.
  const columns = [0, 1, 2].map(column => {
    const values = [0, 1, 2].map(row => data[column * 4 + row]);
    const length = Math.hypot(...values);
    return length > 1e-9 ? values.map(value => value / length) : null;
  });
  if (columns.includes(null)) return null;
  const at = (row, column) => columns[column][row];
  const angles = {
    yaw: -Angle(Math.atan2(at(0, 2), at(2, 2))),
    pitch: -Angle(Math.asin(Math.min(Math.max(-at(1, 2), -1), 1))),
    roll: Angle(Math.atan2(at(1, 0), at(1, 1))),
  };
  return { yaw: angles.yaw || 0, pitch: angles.pitch || 0, roll: angles.roll || 0 };
}

// The game receives three angles and whether a face was found; landmarks and video stay in the proxy.
export function CreateHeadPoseDetector({ landmarker }) {
  return {
    Detect(video, timestamp) {
      const frame = { timestamp, videoWidth: video.videoWidth, videoHeight: video.videoHeight };
      const result = landmarker.detectForVideo(video, timestamp);
      const angles = result.faceLandmarks?.[0] ? MatrixToHeadAngles(result.facialTransformationMatrixes?.[0]?.data) : null;
      return angles ? { ...frame, face: true, ...angles } : { ...frame, face: false, yaw: null, pitch: null, roll: null };
    },
    Close() { landmarker.close(); },
  };
}
