const labels = ['Rest', 'Tongue_Left', 'Tongue_Right'];

// Calibration examples stay in this classifier; the game only learns how many were taken and the predicted direction.
export function CreateTongueDetector({ landmarker, lipIndices, extractFeature, classifier }) {
  const samples = { Rest: 0, Tongue_Left: 0, Tongue_Right: 0 };
  let capturing = null;
  return {
    Capture(label, active) {
      if (!labels.includes(label)) return;
      if (!active) { if (capturing === label) capturing = null; return; }
      if ((classifier.getClassExampleCount()[label] ?? 0) > 0) classifier.clearClass(label);
      samples[label] = 0;
      capturing = label;
    },
    async Detect(video, timestamp) {
      const frame = { timestamp, videoWidth: video.videoWidth, videoHeight: video.videoHeight };
      const landmarks = landmarker.detectForVideo(video, timestamp).faceLandmarks[0];
      if (!landmarks) return { ...frame, face: false, mouth: null, label: null, confidence: 0, samples: { ...samples } };
      const lips = lipIndices.map(index => landmarks[index]).filter(Boolean);
      const mouth = lips.length === 0 ? { x: 0.5, y: 0.64 } : {
        x: lips.reduce((total, point) => total + point.x, 0) / lips.length,
        y: lips.reduce((total, point) => total + point.y, 0) / lips.length,
      };
      if (![mouth.x, mouth.y].every(value => Number.isFinite(value) && Math.abs(value) <= 10)) throw new Error('Invalid face landmarks');
      const feature = extractFeature(video, landmarks);
      try {
        let label = null;
        let confidence = 0;
        if (capturing) {
          classifier.addExample(feature, capturing);
          samples[capturing] += 1;
        } else if (labels.every(name => samples[name] > 0)) {
          const prediction = await classifier.predictClass(feature, 3);
          label = labels.includes(prediction.label) ? prediction.label : 'Rest';
          confidence = prediction.confidences[prediction.label] ?? 0;
        }
        return { ...frame, face: true, mouth, label, confidence, samples: { ...samples } };
      } finally { feature.dispose(); }
    },
    Close() { landmarker.close(); classifier.dispose(); },
  };
}
