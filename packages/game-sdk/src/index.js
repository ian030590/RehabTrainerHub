const messageSchema = 'trainerhub.game-platform/v1';
const lifecycleMessageType = 'trainerhub.game:lifecycle';
const resultMessageType = 'trainerhub.game:result';
const hostInitMessageType = 'trainerhub.host:init';
const hostCommandMessageType = 'trainerhub.host:command';
const maximumResultDurationMs = 24 * 60 * 60 * 1000;
const maximumResultPayloadBytes = 16_000;
const maximumResultTrialCount = 100_000;
const validCommands = new Set(['pause', 'resume', 'exit']);
const sensitiveMetricKeyPattern = /(auth|authorization|birthday|cookie|credential|dob|email|jwt|name|participant|password|phone|secret|session|token|user)/i;

/**
 * Run one uploaded game through a jsPsych 8 instance and the TrainerHub
 * sandbox lifecycle. The caller owns its timeline and rendering; this helper
 * only coordinates lifecycle, pause/resume/exit, and aggregate results.
 */
export async function RunTrainerHubJsPsychGame({
  initJsPsych,
  timeline,
  jsPsychOptions = {},
  summarize,
}) {
  if (typeof initJsPsych !== 'function' || !Array.isArray(timeline) || timeline.length === 0) {
    throw new TypeError('initJsPsych and a non-empty timeline are required.');
  }
  if (typeof summarize !== 'function') {
    throw new TypeError('summarize(jsPsych) must return an aggregate result.');
  }

  const bridge = CreateTrainerHubGameBridge();
  const {
    on_finish: onFinish,
    on_trial_finish: onTrialFinish,
    on_trial_start: onTrialStart,
    ...remainingOptions
  } = jsPsychOptions;
  let started = false;
  let wasAborted = false;
  const jsPsych = initJsPsych({
    ...remainingOptions,
    on_trial_start(trial) {
      if (!started) {
        started = true;
        bridge.ReportLifecycle('started', 0);
      }
      onTrialStart?.(trial);
    },
    on_trial_finish(data) {
      onTrialFinish?.(data);
      const progress = ReadJsPsychProgress(jsPsych);
      if (progress !== null) bridge.ReportLifecycle('started', progress);
    },
    on_finish(data) {
      onFinish?.(data);
    },
  });

  const handleCommand = ({ command }) => {
    if (command === 'pause') {
      jsPsych.pauseExperiment?.();
      bridge.ReportLifecycle('paused');
    } else if (command === 'resume') {
      jsPsych.resumeExperiment?.();
      bridge.ReportLifecycle('resumed');
    } else if (command === 'exit') {
      wasAborted = true;
      jsPsych.abortExperiment?.('The platform ended this game session.');
    }
  };
  bridge.AddCommandListener(handleCommand);

  try {
    await bridge.Ready;
    bridge.ReportLifecycle('ready', 0);
    await jsPsych.run(timeline);
    const result = wasAborted
      ? { status: 'aborted' }
      : NormalizeAggregateResult(await summarize(jsPsych), 'completed');
    bridge.ReportResult(result);
    bridge.ReportLifecycle(result.status === 'completed' ? 'completed' : 'aborted', result.status === 'completed' ? 1 : undefined);
    return { jsPsych, result };
  } catch (error) {
    if (bridge.IsConnected) {
      bridge.ReportResult({ status: 'aborted' });
      bridge.ReportLifecycle('aborted');
    }
    throw error;
  } finally {
    bridge.RemoveCommandListener(handleCommand);
    bridge.Dispose();
  }
}

export function CreateTrainerHubGameBridge() {
  let session = null;
  let hostPort = null;
  let sequence = 0;
  let disposed = false;
  const commandListeners = new Set();
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const handleHostCommand = (message) => {
    if (disposed
      || !session
      || !IsExactObject(message, ['schema', 'type', 'sessionId', 'sessionNonce', 'command'])
      || message.schema !== messageSchema
      || message.type !== hostCommandMessageType
      || message.sessionId !== session.sessionId
      || message.sessionNonce !== session.sessionNonce
      || !validCommands.has(message.command)) return;
    commandListeners.forEach((listener) => listener({ command: message.command }));
  };

  const handleMessage = (event) => {
    if (disposed || event.source !== window.parent || !IsPlainObject(event.data)) return;
    const message = event.data;
    if (message.schema !== messageSchema
      || message.type !== hostInitMessageType
      || !IsHostInitMessage(message)
      || !event.ports
      || event.ports.length !== 1
      || !event.ports[0]
      || session) return;
    hostPort = event.ports[0];
    hostPort.addEventListener('message', (portEvent) => handleHostCommand(portEvent.data));
    hostPort.start();
    session = Object.freeze({
      gameId: message.gameId,
      gameVersion: message.gameVersion,
      sessionId: message.sessionId,
      sessionNonce: message.sessionNonce,
    });
    resolveReady(session);
  };
  window.addEventListener('message', handleMessage);

  const send = (type, payload) => {
    if (disposed || !session || !hostPort) throw new Error('The TrainerHub host session is not ready.');
    hostPort.postMessage({
      schema: messageSchema,
      type,
      sessionNonce: session.sessionNonce,
      sequence,
      payload,
    });
    sequence += 1;
  };

  return {
    Ready: ready,
    get IsConnected() {
      return session !== null && !disposed;
    },
    AddCommandListener(listener) {
      if (typeof listener === 'function') commandListeners.add(listener);
    },
    RemoveCommandListener(listener) {
      commandListeners.delete(listener);
    },
    ReportLifecycle(phase, progress) {
      if (!['ready', 'started', 'paused', 'resumed', 'completed', 'aborted'].includes(phase)) {
        throw new TypeError('Invalid lifecycle phase.');
      }
      const payload = { phase };
      if (progress !== undefined) {
        if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
          throw new TypeError('Lifecycle progress must be between zero and one.');
        }
        payload.progress = progress;
      }
      send(lifecycleMessageType, payload);
    },
    ReportResult(result) {
      send(resultMessageType, NormalizeAggregateResult(result));
    },
    Dispose() {
      if (disposed) return;
      disposed = true;
      commandListeners.clear();
      hostPort?.close();
      hostPort = null;
      window.removeEventListener('message', handleMessage);
    },
  };
}

export function NormalizeAggregateResult(value, fallbackStatus) {
  if (!IsPlainObject(value)) throw new TypeError('The game result must be a plain object.');
  const allowedKeys = new Set(['status', 'score', 'durationMs', 'trialCount', 'metrics']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new TypeError('The game result contains an unsupported field.');
  }
  const status = value.status ?? fallbackStatus;
  if (!['completed', 'aborted'].includes(status)) throw new TypeError('Invalid result status.');
  const result = { status };
  if ('score' in value) {
    if (!Number.isFinite(value.score)) throw new TypeError('score must be finite.');
    result.score = value.score;
  }
  if ('durationMs' in value) {
    if (!Number.isSafeInteger(value.durationMs)
      || value.durationMs < 0
      || value.durationMs > maximumResultDurationMs) {
      throw new TypeError(`durationMs must be a safe integer between 0 and ${maximumResultDurationMs}.`);
    }
    result.durationMs = value.durationMs;
  }
  if ('trialCount' in value) {
    if (!Number.isSafeInteger(value.trialCount)
      || value.trialCount < 0
      || value.trialCount > maximumResultTrialCount) {
      throw new TypeError(`trialCount must be a safe integer between 0 and ${maximumResultTrialCount}.`);
    }
    result.trialCount = value.trialCount;
  }
  if ('metrics' in value) result.metrics = NormalizeMetrics(value.metrics);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > maximumResultPayloadBytes) {
    throw new TypeError(`The aggregate result exceeds ${maximumResultPayloadBytes} UTF-8 bytes.`);
  }
  return result;
}

function NormalizeMetrics(value) {
  if (!IsPlainObject(value) || Object.keys(value).length > 512) {
    throw new TypeError('metrics must be a bounded plain object.');
  }
  return Object.fromEntries(Object.entries(value).map(([key, metric]) => {
    if (!/^[a-z][A-Za-z0-9_.-]{0,63}$/.test(key)
      || sensitiveMetricKeyPattern.test(key)
      || !(metric === null || typeof metric === 'boolean' || Number.isFinite(metric))) {
      throw new TypeError(`Invalid aggregate metric: ${key}`);
    }
    return [key, metric];
  }));
}

function IsHostInitMessage(value) {
  return IsExactObject(
    value,
    ['schema', 'type', 'gameId', 'gameVersion', 'sessionId', 'sessionNonce'],
  )
    && IsIdentifier(value.gameId, 1, 64)
    && IsIdentifier(value.gameVersion, 5, 64)
    && IsIdentifier(value.sessionId, 32, 128)
    && IsIdentifier(value.sessionNonce, 32, 128);
}

function IsIdentifier(value, minimumLength, maximumLength) {
  return typeof value === 'string'
    && value.length >= minimumLength
    && value.length <= maximumLength
    && /^[A-Za-z0-9._-]+$/.test(value);
}

function ReadJsPsychProgress(jsPsych) {
  try {
    const progress = jsPsych.getProgress?.();
    if (!Number.isFinite(progress?.percent_complete)) return null;
    const reported = progress.percent_complete;
    return Math.max(0, Math.min(1, reported <= 1 ? reported : reported / 100));
  } catch {
    return null;
  }
}

function IsExactObject(value, requiredKeys) {
  return IsPlainObject(value)
    && Object.keys(value).length === requiredKeys.length
    && requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function IsPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
