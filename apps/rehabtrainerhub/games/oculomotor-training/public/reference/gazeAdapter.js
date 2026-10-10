// The game owns calibration and validation. The trusted container owns WebGazer and the camera.
(() => {
  let enabled = true;
  const prediction = () => enabled ? window.OculomotorInput.Prediction() : null;
  window.webgazer = { getCurrentPrediction: async () => prediction(), resume: () => { enabled = true; }, pause: () => { enabled = false; }, end: () => window.OculomotorInput.Stop() };
  class GazeExtension {
    constructor() { this.gazeUpdateCallbacks = []; this.timer = null; }
    initialize() { return Promise.resolve(); }
    on_start() { this.resume(); }
    on_load() {}
    on_finish() { this.pause(); return {}; }
    isInitialized() { return true; }
    start() { return Promise.resolve(); }
    faceDetected() { return window.OculomotorInput.FaceDetected(); }
    showVideo() {}
    hideVideo() {}
    hidePredictions() {}
    resetCalibration() { window.OculomotorInput.Reset(); }
    calibratePoint(x, y) { window.OculomotorInput.Calibrate(x, y); }
    pause() { clearInterval(this.timer); this.timer = null; enabled = false; }
    resume() {
      if (this.timer !== null) return;
      enabled = true;
      this.timer = setInterval(() => this.handleGazeDataUpdate(prediction(), performance.now()), 34);
    }
    handleGazeDataUpdate(value) { if (value) this.gazeUpdateCallbacks.forEach(callback => callback(value)); }
    onGazeUpdate(callback) { this.gazeUpdateCallbacks.push(callback); return () => { this.gazeUpdateCallbacks = this.gazeUpdateCallbacks.filter(value => value !== callback); }; }
  }
  GazeExtension.info = { name: 'webgazer' };
  class GazeCalibration {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    trial(display, trial) {
      const points = trial.calibration_points.flatMap(point => Array.from({ length: trial.repetitions_per_point }, () => point));
      if (trial.randomize_calibration_order) for (let index = points.length - 1; index > 0; index--) {
        const next = Math.floor(Math.random() * (index + 1)); [points[index], points[next]] = [points[next], points[index]];
      }
      let index = 0;
      const render = () => {
        const en = window.oculomotorLanguage === 'en';
        display.innerHTML = `<section class="gaze-calibration"><p>${en ? 'Look at each point, then click or tap it.' : '看著每個校正點，再點擊或觸控。'} ${index + 1} / ${points.length}</p><button type="button" class="gaze-calibration-point" aria-label="${en ? 'Calibration point' : '校正點'}"></button></section>`;
        const button = display.querySelector('button');
        Object.assign(button.style, { left: points[index][0] + '%', top: points[index][1] + '%', width: trial.point_size + 'px', height: trial.point_size + 'px' });
        button.onclick = () => {
          const rect = button.getBoundingClientRect();
          window.OculomotorInput.Calibrate(rect.left + rect.width / 2, rect.top + rect.height / 2);
          if (++index === points.length) this.jsPsych.finishTrial({ calibration_points: points }); else render();
        };
        button.focus();
      };
      render();
    }
  }
  const type = jsPsychModule.ParameterType;
  GazeCalibration.info = { name: 'webgazer-calibrate', parameters: {
    calibration_points: { type: type.COMPLEX, default: [] }, repetitions_per_point: { type: type.INT, default: 2 },
    randomize_calibration_order: { type: type.BOOL, default: true }, calibration_mode: { type: type.STRING, default: 'click' }, point_size: { type: type.INT, default: 24 },
  } };
  window.jsPsychExtensionWebgazer = GazeExtension;
  window.jsPsychWebgazerCalibrate = GazeCalibration;
  window.jsPsychWebgazerInitCamera = true;
})();
