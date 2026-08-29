import {
  CreateTrainingEnvelope,
  CreateTrainingHostConnect,
  IsTrainingHostEvent,
  IsTrainingHostReady,
  type TrainingHostCommand,
  type TrainingHostEvent,
  type TrainingLifecycleEnvelope,
  type TrainingModuleManifest,
} from '@rehab-trainer/training-contracts';
import { CreateOfficialHostIframePolicy } from './officialTrainingHostPolicy';

const defaultCommandTimeoutMs = 15_000;

export interface OfficialTrainingHostReadyMessage {
  schema: 'trainerhub.training/host/v1';
  type: 'iframe-ready';
  moduleId: string;
  protocolVersion: 1;
  hostVersion: string;
}

export interface OfficialTrainingHostSessionOptions {
  iframe: HTMLIFrameElement;
  manifest: Pick<TrainingModuleManifest, 'id' | 'capabilities'>;
  origin?: string;
  sessionNonce?: string;
  runId?: string;
  commandTimeoutMs?: number;
  onEvent?: (event: TrainingHostEvent, envelope: TrainingLifecycleEnvelope<TrainingHostEvent>) => void;
  onError?: (error: Error) => void;
}

export interface TrainingHostCommandInput {
  type: TrainingHostCommand['type'];
  config?: unknown;
  reason?: 'back' | 'exit' | 'unmount';
}

interface PendingCommand {
  commandId: string;
  resolve: (event: TrainingHostEvent) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

/**
 * Parent-side controller for the official-training-host iframe.
 *
 * The controller owns only the MessageChannel and command correlation. It
 * never imports jsPsych, reads renderer state, or forwards raw trial data.
 */
export class OfficialTrainingHostSession {
  readonly sessionNonce: string;
  readonly runId: string;

  private readonly iframe: HTMLIFrameElement;
  private readonly manifest: Pick<TrainingModuleManifest, 'id' | 'capabilities'>;
  private readonly origin: string;
  private readonly commandTimeoutMs: number;
  private readonly onEvent?: OfficialTrainingHostSessionOptions['onEvent'];
  private readonly onError?: OfficialTrainingHostSessionOptions['onError'];
  private port: MessagePort | null = null;
  private outboundSequence = 0;
  private inboundSequence = 0;
  private commandSequence = 0;
  private pending = new Map<string, PendingCommand>();
  private disposed = false;

  constructor(options: OfficialTrainingHostSessionOptions) {
    this.iframe = options.iframe;
    this.manifest = options.manifest;
    this.origin = NormalizeOrigin(options.origin ?? window.location.origin);
    this.sessionNonce = options.sessionNonce ?? CreateOpaqueId();
    this.runId = options.runId ?? CreateOpaqueId();
    this.commandTimeoutMs = options.commandTimeoutMs ?? defaultCommandTimeoutMs;
    this.onEvent = options.onEvent;
    this.onError = options.onError;
  }

  /** Complete the one-time ready -> private MessagePort handshake. */
  connect(readyEvent: MessageEvent<unknown>): boolean {
    if (this.disposed || this.port) return false;
    if (!IsTrustedReadyEvent(readyEvent, this.origin, this.iframe, this.manifest.id)) return false;
    const targetWindow = this.iframe.contentWindow;
    if (!targetWindow) return false;
    const channel = new MessageChannel();
    const port = channel.port1;
    port.addEventListener('message', this.handlePortMessage);
    port.start();
    this.port = port;

    const connectMessage = CreateTrainingHostConnect({
      runId: this.runId,
      sessionNonce: this.sessionNonce,
      moduleId: this.manifest.id,
    });
    try {
      targetWindow.postMessage(connectMessage, this.origin, [channel.port2]);
    } catch (error) {
      port.removeEventListener('message', this.handlePortMessage);
      port.close();
      this.port = null;
      this.onError?.(error instanceof Error ? error : new Error('Unable to connect to training host.'));
      return false;
    }
    return true;
  }

  send(command: TrainingHostCommandInput): Promise<TrainingHostEvent> {
    if (this.disposed || !this.port) {
      return Promise.reject(new Error('Training host is not connected.'));
    }
    const commandId = `${this.runId}:${++this.commandSequence}`;
    const payload = {
      ...command,
      runId: this.runId,
      commandId,
    } as TrainingHostCommand;
    if (payload.type === 'abort' && !payload.reason) {
      return Promise.reject(new Error('Abort commands require a reason.'));
    }
    if (payload.type === 'prepare' && !Object.hasOwn(payload, 'config')) {
      return Promise.reject(new Error('Prepare commands require a config value.'));
    }

    const envelope = CreateTrainingEnvelope({
      sessionNonce: this.sessionNonce,
      moduleId: this.manifest.id,
      sequence: ++this.outboundSequence,
      payload,
    });
    return new Promise<TrainingHostEvent>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(commandId);
        const error = new Error(`Training host command timed out: ${payload.type}.`);
        this.onError?.(error);
        reject(error);
      }, this.commandTimeoutMs);
      this.pending.set(commandId, { commandId, resolve, reject, timeoutId });
      try {
        this.port?.postMessage(envelope);
      } catch (error) {
        window.clearTimeout(timeoutId);
        this.pending.delete(commandId);
        const commandError = error instanceof Error ? error : new Error('Training host command failed.');
        this.onError?.(commandError);
        reject(commandError);
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error('Training host session disposed.'));
    }
    this.pending.clear();
    this.port?.removeEventListener('message', this.handlePortMessage);
    this.port?.close();
    this.port = null;
  }

  private readonly handlePortMessage = (event: MessageEvent<unknown>) => {
    const envelope = event.data;
    if (!IsTrainingHostEvent(envelope, {
      sessionNonce: this.sessionNonce,
      moduleId: this.manifest.id,
      runId: this.runId,
    })) {
      return;
    }
    if (envelope.sequence <= this.inboundSequence) return;
    this.inboundSequence = envelope.sequence;
    const hostEvent = envelope.payload;
    this.onEvent?.(hostEvent, envelope);

    const commandId = 'commandId' in hostEvent ? hostEvent.commandId : undefined;
    if (!commandId) return;
    const pending = this.pending.get(commandId);
    if (!pending) return;
    if (hostEvent.type === 'preload-progress') return;
    this.pending.delete(commandId);
    window.clearTimeout(pending.timeoutId);
    if (hostEvent.type === 'command-rejected') {
      pending.reject(new Error(`Training host rejected command: ${hostEvent.errorCode}.`));
      return;
    }
    pending.resolve(hostEvent);
  };
}

export function CreateOfficialHostAllowAttribute(
  manifest: Pick<TrainingModuleManifest, 'id' | 'capabilities'>,
  options: { origin?: string; routePrefix?: string } = {},
): string {
  const policy = CreateOfficialHostIframePolicy(manifest, options);
  return Object.entries(policy.featureAllowlist)
    .map(([feature, value]) => `${feature} ${value}`)
    .join('; ');
}

export function IsTrustedReadyEvent(
  event: Pick<MessageEvent<unknown>, 'origin' | 'source' | 'data'>,
  expectedOrigin: string,
  iframe: HTMLIFrameElement,
  expectedModuleId: string,
): event is MessageEvent<OfficialTrainingHostReadyMessage> {
  return event.origin === expectedOrigin
    && event.source === iframe.contentWindow
    && IsTrainingHostReady(event.data)
    && event.data.moduleId === expectedModuleId;
}

function NormalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('Official host origin must use HTTP(S).');
  }
  return url.origin;
}

function CreateOpaqueId(): string {
  const cryptoApi = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : null;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (!cryptoApi) throw new Error('Secure randomness is required for a training host session.');
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
