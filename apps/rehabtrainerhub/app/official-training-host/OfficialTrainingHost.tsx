'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CreateTrainingEnvelope,
  IsTrainingHostCommand,
  IsTrainingHostConnect,
  ValidateTrainingEnvelope,
  trainingHostMessageSchema,
  trainingHostProtocolVersion,
  type TrainingHostCommand,
  type TrainingHostEvent,
  type TrainingModuleManifest,
} from '@rehab-trainer/training-contracts';
import {
  CreateOfficialHostAllowAttribute,
} from '@rehab-trainer/ui/officialTrainingHostProtocol';
import { CreateOfficialHostIframePolicy } from '@rehab-trainer/ui/officialTrainingHostPolicy';
import {
  IsHubTrainingActiveMessage,
  IsHubTrainingCompleteMessage,
  IsHubTrainingExitMessage,
  IsHubTrainingReadyMessage,
} from '@rehab-trainer/ui/embeddedTraining';
import { GetHubUiCopy } from '../i18n';
import './OfficialTrainingHost.css';

const hostVersion = '1.0.0';

interface OfficialTrainingHostProps {
  legacySource: string;
  manifest: TrainingModuleManifest;
}

interface HostSession {
  runId: string;
  sessionNonce: string;
  port: MessagePort;
  inboundSequence: number;
  outboundSequence: number;
}

export function OfficialTrainingHost({ legacySource, manifest }: OfficialTrainingHostProps) {
  const legacyFrameRef = useRef<HTMLIFrameElement>(null);
  const sessionRef = useRef<HostSession | null>(null);
  const pendingPrepareRef = useRef<string | null>(null);
  const pendingStartRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLegacyMounted, setIsLegacyMounted] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const copy = GetHubUiCopy(language).embeddedTraining;
  const policy = useMemo(() => CreateOfficialHostIframePolicy(manifest), [manifest]);
  const allowAttribute = useMemo(() => CreateOfficialHostAllowAttribute(manifest), [manifest]);

  const buildLegacySource = useCallback(() => {
    const url = new URL(legacySource, window.location.href);
    // Keep compatibility mode same-origin in local previews without allowing
    // a manifest or query parameter to choose an arbitrary runtime origin.
    url.protocol = window.location.protocol;
    url.host = window.location.host;
    url.searchParams.set('embed', 'hub');
    const language = new URLSearchParams(window.location.search).get('lang');
    if (language === 'en' || language === 'zh') url.searchParams.set('lang', language);
    return url.toString();
  }, [legacySource]);

  const sendEvent = useCallback((payload: TrainingHostEvent) => {
    const session = sessionRef.current;
    if (!session) return;
    const envelope = CreateTrainingEnvelope({
      sessionNonce: session.sessionNonce,
      moduleId: manifest.id,
      sequence: ++session.outboundSequence,
      payload,
    });
    try {
      session.port.postMessage(envelope);
    } catch {
      setErrorCode('port-write-failed');
    }
  }, [manifest.id]);

  const createRunResult = useCallback((status: 'completed' | 'aborted') => {
    const startedAt = startedAtRef.current ?? Date.now();
    return {
      schemaVersion: 1 as const,
      moduleId: manifest.id,
      moduleVersion: manifest.implementationVersion,
      status,
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt),
      trialCount: 0,
      metrics: {},
    };
  }, [manifest.id, manifest.implementationVersion]);

  const removeLegacyFrame = useCallback(() => {
    setIsLegacyMounted(false);
    pendingPrepareRef.current = null;
    pendingStartRef.current = null;
    startedAtRef.current = null;
  }, []);

  const handleCommand = useCallback((event: MessageEvent<unknown>) => {
    const session = sessionRef.current;
    if (!session) return;
    const validation = ValidateTrainingEnvelope(event.data);
    if (!validation.ok) return;
    const envelope = validation.value;
    if (envelope.sessionNonce !== session.sessionNonce
      || envelope.moduleId !== manifest.id
      || envelope.sequence <= session.inboundSequence
      || !IsTrainingHostCommand(envelope.payload)) {
      return;
    }
    session.inboundSequence = envelope.sequence;
    const command = envelope.payload as TrainingHostCommand;

    if (command.type === 'prepare') {
      pendingPrepareRef.current = command.commandId;
      setErrorCode(null);
      setIsLegacyMounted(true);
      return;
    }
    if (command.type === 'start') {
      pendingStartRef.current = command.commandId;
      return;
    }
    if (command.type === 'pause' || command.type === 'resume') {
      sendEvent({
        type: 'command-rejected',
        runId: session.runId,
        commandId: command.commandId,
        errorCode: 'legacy-runtime-command-unsupported',
        recoverable: true,
      });
      return;
    }
    if (command.type === 'abort') {
      removeLegacyFrame();
      sendEvent({
        type: 'aborted',
        runId: session.runId,
        commandId: command.commandId,
        result: createRunResult('aborted'),
      });
      return;
    }
    removeLegacyFrame();
    sendEvent({ type: 'disposed', runId: session.runId, commandId: command.commandId });
    session.port.close();
    sessionRef.current = null;
    setIsConnected(false);
  }, [createRunResult, manifest.id, removeLegacyFrame, sendEvent]);

  useEffect(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
    if (requestedLanguage === 'en' || requestedLanguage === 'zh') setLanguage(requestedLanguage);
  }, []);

  useEffect(() => {
    const parentOrigin = window.location.origin;
    const announceReady = () => {
      if (window.parent === window) return;
      window.parent.postMessage({
        schema: trainingHostMessageSchema,
        type: 'iframe-ready',
        moduleId: manifest.id,
        protocolVersion: trainingHostProtocolVersion,
        hostVersion,
      }, parentOrigin);
    };

    const handleConnect = (event: MessageEvent<unknown>) => {
      if (event.origin !== parentOrigin
        || event.source !== window.parent
        || !IsTrainingHostConnect(event.data)
        || event.data.moduleId !== manifest.id
        || event.ports.length !== 1
        || sessionRef.current) {
        return;
      }
      const port = event.ports[0];
      const session: HostSession = {
        runId: event.data.runId,
        sessionNonce: event.data.sessionNonce,
        port,
        inboundSequence: 0,
        outboundSequence: 0,
      };
      sessionRef.current = session;
      port.addEventListener('message', handleCommand);
      port.start();
      setIsConnected(true);
      setErrorCode(null);
    };

    window.addEventListener('message', handleConnect);
    announceReady();
    return () => {
      window.removeEventListener('message', handleConnect);
      const session = sessionRef.current;
      session?.port.removeEventListener('message', handleCommand);
      session?.port.close();
      sessionRef.current = null;
      setIsConnected(false);
    };
  }, [handleCommand, manifest.id]);

  useEffect(() => {
    const handleLegacyMessage = (event: MessageEvent<unknown>) => {
      const frame = legacyFrameRef.current;
      const session = sessionRef.current;
      if (!frame || !session
        || event.origin !== window.location.origin
        || event.source !== frame.contentWindow) return;

      if (IsHubTrainingReadyMessage(event.data)) {
        const commandId = pendingPrepareRef.current;
        if (!commandId) return;
        pendingPrepareRef.current = null;
        sendEvent({ type: 'prepared', runId: session.runId, commandId });
        return;
      }
      if (IsHubTrainingActiveMessage(event.data)) {
        if (!event.data.active) return;
        startedAtRef.current ??= Date.now();
        const commandId = pendingStartRef.current ?? `${session.runId}:legacy-start`;
        pendingStartRef.current = null;
        sendEvent({
          type: 'started',
          runId: session.runId,
          commandId,
        });
        return;
      }
      if (IsHubTrainingCompleteMessage(event.data)) {
        pendingStartRef.current = null;
        sendEvent({ type: 'completed', runId: session.runId, result: createRunResult('completed') });
        return;
      }
      if (IsHubTrainingExitMessage(event.data)) {
        pendingPrepareRef.current = null;
        pendingStartRef.current = null;
        sendEvent({
          type: 'aborted',
          runId: session.runId,
          commandId: `${session.runId}:legacy-abort`,
          result: createRunResult('aborted'),
        });
      }
    };
    window.addEventListener('message', handleLegacyMessage);
    return () => window.removeEventListener('message', handleLegacyMessage);
  }, [createRunResult, sendEvent]);

  const legacyUrl = isLegacyMounted ? buildLegacySource() : undefined;

  return (
    <main className="official-training-host" data-connected={isConnected || undefined}>
      {!isLegacyMounted && (
        <p className="official-training-host-status" role="status">
          {errorCode ? copy.loadingPage : copy.loading}
        </p>
      )}
      {legacyUrl && (
        <iframe
          allow={allowAttribute}
          allowFullScreen={policy.allowFullscreen}
          className="official-training-host-frame"
          ref={legacyFrameRef}
          referrerPolicy="same-origin"
          sandbox={policy.sandboxTokens.join(' ')}
          src={legacyUrl}
          title={copy.loadingPage}
        />
      )}
    </main>
  );
}
