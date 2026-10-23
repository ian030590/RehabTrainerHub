import type { ResponseAction } from './everyBallResponse';

export interface Point { x: number; y: number; z: number }
export interface PoseFrame { timestamp: number; videoWidth: number; videoHeight: number; hands: Point[][]; pose: Point[] }
export interface MicrophoneFrame { timestamp: number; rms: number; highRatio: number }

// Values from the original game. Pose points arrive as hips 23 and 24, then knees 25 and 26.
// The last two are new: a hand must be off the thigh for thighRearmMs before the next tap counts, and a body the
// model loses keeps its last hip and knee zone for poseHoldMs.
export const cameraDetection = { closeDistance: 0.12, openDistance: 0.2, cooldownMs: 480, thighFallbackY: 0.62, thighRearmMs: 250, poseHoldMs: 1000 } as const;
// decisionMs and loudRatio are new: the first frame of a sound holds only its start, which reads as bright whatever
// the sound is, and the proxy smooths the spectrum from frame to frame but not the level, so the brightness trails it.
export const microphoneDetection = { cooldownMs: 320, rearmRatio: 0.62, clapHighRatio: 0.34, decisionMs: 50, loudRatio: 0.7 } as const;

function Clamp(value: number, minimum: number, maximum: number) { return Math.min(Math.max(value, minimum), maximum); }

export function GetPalmCenter(hand: Point[]): Point {
  const indexes = [0, 5, 9, 13, 17];
  const total = indexes.reduce((sum, index) => ({ x: sum.x + hand[index].x, y: sum.y + hand[index].y, z: sum.z + hand[index].z }), { x: 0, y: 0, z: 0 });
  return { x: total.x / indexes.length, y: total.y / indexes.length, z: total.z / indexes.length };
}

export function IsThighContact(centers: Point[], pose: Point[]) {
  if (pose.length !== 4) return centers.some(hand => hand.y > cameraDetection.thighFallbackY);
  return centers.some(hand => [[pose[0], pose[2]], [pose[1], pose[3]]].some(([hip, knee]) =>
    hand.x >= Math.min(hip.x, knee.x) - 0.18 && hand.x <= Math.max(hip.x, knee.x) + 0.18
    && hand.y >= Math.min(hip.y, knee.y) - 0.08 && hand.y <= Math.max(hip.y, knee.y) + 0.1));
}

// A clap is two palms closing after they were apart; a tap is a palm entering the hip-to-knee zone.
// Tracking often loses a hand for a frame or two, most of all a hand resting on the thigh, and the body model loses
// the hips and knees even more often. A frame without hands keeps the last state, a lost body keeps its last zone,
// and a short gap in contact does not re-arm the tap, so a hand that has not moved never responds again.
export function CreateCameraGestureDetector() {
  let lastClapDistance = Number.POSITIVE_INFINITY;
  let lastThighContact = false;
  let lastContactAt = Number.NEGATIVE_INFINITY;
  let lastPose: Point[] = [];
  let lastPoseAt = Number.NEGATIVE_INFINITY;
  let lastGestureAt = Number.NEGATIVE_INFINITY;
  const Update = (frame: PoseFrame): { action: ResponseAction | null; tracking: boolean } => {
    if (frame.pose.length === 4) { lastPose = frame.pose; lastPoseAt = frame.timestamp; }
    const centers = frame.hands.map(GetPalmCenter);
    if (centers.length === 0) return { action: null, tracking: false };
    let action: ResponseAction | null = null;
    if (centers.length >= 2) {
      const distance = Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y);
      if (distance <= cameraDetection.closeDistance && lastClapDistance >= cameraDetection.openDistance
        && frame.timestamp - lastGestureAt >= cameraDetection.cooldownMs) {
        action = 'clap';
        lastGestureAt = frame.timestamp;
      }
      lastClapDistance = distance;
    }
    const pose = frame.timestamp - lastPoseAt <= cameraDetection.poseHoldMs ? lastPose : [];
    const thighContact = IsThighContact(centers, pose);
    if (!action && thighContact && !lastThighContact && frame.timestamp - lastContactAt >= cameraDetection.thighRearmMs
      && frame.timestamp - lastGestureAt >= cameraDetection.cooldownMs) {
      action = 'thigh';
      lastGestureAt = frame.timestamp;
    }
    lastThighContact = thighContact;
    if (thighContact) lastContactAt = frame.timestamp;
    return { action, tracking: true };
  };
  return { Update };
}

export function MicrophoneThreshold(sensitivityPercent: number) {
  return 0.085 - Clamp(sensitivityPercent / 100, 0.35, 0.9) * 0.06;
}

export function ToMeterLevel(rms: number) { return Clamp(rms * 8.5, 0, 1); }

export type MicrophoneResult = { onset: true } | { action: ResponseAction; delayMs: number } | null;

// One sound counts once: it must fall below 62% of the threshold before the next one, and the cooldown must pass.
// The frames of the first decisionMs that are at least loudRatio of the peak level sort it. A clap (more energy above
// 38% of the spectrum) stays bright in all of them; one duller frame makes it a thigh tap. The result says how long ago
// the sound started, so the response time stays exact.
export function CreateMicrophoneTapDetector(sensitivityPercent: number) {
  const threshold = MicrophoneThreshold(sensitivityPercent);
  let lastTriggerAt = Number.NEGATIVE_INFINITY;
  let belowThreshold = true;
  let sound: { startedAt: number; frames: MicrophoneFrame[] } | null = null;
  const Update = (frame: MicrophoneFrame): MicrophoneResult => {
    if (frame.rms < threshold * microphoneDetection.rearmRatio) belowThreshold = true;
    if (sound) {
      sound.frames.push(frame);
      const delayMs = frame.timestamp - sound.startedAt;
      if (!belowThreshold && delayMs < microphoneDetection.decisionMs) return null;
      const peak = Math.max(...sound.frames.map(item => item.rms));
      const dullest = Math.min(...sound.frames.filter(item => item.rms >= peak * microphoneDetection.loudRatio).map(item => item.highRatio));
      const action = dullest >= microphoneDetection.clapHighRatio ? 'clap' : 'thigh';
      sound = null;
      return { action, delayMs };
    }
    if (!belowThreshold || frame.rms < threshold || frame.timestamp - lastTriggerAt < microphoneDetection.cooldownMs) return null;
    belowThreshold = false;
    lastTriggerAt = frame.timestamp;
    sound = { startedAt: frame.timestamp, frames: [frame] };
    return { onset: true };
  };
  return { Update };
}
