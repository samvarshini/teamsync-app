import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PanToolIcon from '@mui/icons-material/PanTool';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import ReplayIcon from '@mui/icons-material/Replay';
import { getMyTeams, getTeamMembers } from '../services/teamService';
import API from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

const WS_URL = 'https://teamsync-app-6guk.onrender.com/ws';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CALL_TIMEOUT_MS = 30000;
const MESSAGE_ACK_TIMEOUT_MS = 12000;
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

const formatMessageTime = (sentAt) => {
  if (!sentAt) return '';

  const timestamp = typeof sentAt === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/.test(sentAt)
    ? `${sentAt}Z`
    : sentAt;
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatCallDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = String(safeSeconds % 60).padStart(2, '0');

  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m ${secs}s`;
};

const createLoopTone = (frequency) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gain.gain.value = 0.045;
  oscillator.connect(gain);
  gain.connect(context.destination);

  return {
    start: () => {
      context.resume?.();
      oscillator.start();
    },
    stop: () => {
      gain.gain.value = 0;
      oscillator.stop();
      context.close?.();
    },
  };
};

const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const allowedAttachmentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const attachmentAccept = Array.from(allowedAttachmentTypes).join(',');

const createClientMessageId = (userId) => `msg-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatFileSize = (bytes = 0) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'SENDING':
      return 'Sending';
    case 'DELIVERED':
      return '✓✓ Delivered';
    case 'SEEN':
      return '✓✓ Seen';
    case 'FAILED':
      return 'Failed';
    case 'SENT':
    default:
      return '✓ Sent';
  }
};

function VoiceMessage({ msg, isMe }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div style={styles.voiceMessage}>
      <audio
        ref={audioRef}
        src={msg.audioDataUrl}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
      <button
        type="button"
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        style={{ ...styles.iconButton, ...(isMe ? styles.lightIconButton : {}) }}
        onClick={togglePlayback}
      >
        {playing ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
      </button>
      <div style={styles.voiceTrack}>
        <div style={{ ...styles.voiceProgress, width: `${progress}%` }} />
      </div>
      <span style={styles.duration}>{formatDuration(msg.audioDurationSeconds)}</span>
    </div>
  );
}

function AttachmentMessage({ msg, isMe }) {
  const isImage = msg.mediaMimeType?.startsWith('image/');

  if (isImage) {
    return (
      <a href={msg.attachmentDataUrl} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
        <img src={msg.attachmentDataUrl} alt={msg.attachmentFileName || 'Attachment'} style={styles.attachmentImage} />
        {msg.attachmentFileName && (
          <span style={{ ...styles.attachmentName, color: isMe ? 'white' : 'var(--text-secondary)' }}>
            {msg.attachmentFileName}
          </span>
        )}
      </a>
    );
  }

  return (
    <a href={msg.attachmentDataUrl} download={msg.attachmentFileName} target="_blank" rel="noreferrer" style={{ ...styles.fileAttachment, color: isMe ? 'white' : 'var(--text-primary)' }}>
      <InsertDriveFileIcon fontSize="small" />
      <span style={styles.fileName}>{msg.attachmentFileName || 'Attachment'}</span>
      <span style={styles.fileSize}>{formatFileSize(msg.attachmentFileSize)}</span>
    </a>
  );
}

function VideoTile({ stream, name, muted, isScreen, active }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div style={{ ...styles.videoTile, ...(active ? styles.activeVideoTile : {}) }}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={styles.video}
        />
      ) : (
        <div style={styles.videoPlaceholder}>{name?.charAt(0)?.toUpperCase() || '?'}</div>
      )}
      <div style={styles.videoBadge}>{isScreen ? 'Screen' : name}</div>
    </div>
  );
}

function CallBadge({ msg, isMe }) {
  const mediaType = msg.callMediaType || 'video';
  const icon = mediaType === 'voice' ? '📞' : '📹';

  let title = 'Call event';
  if (msg.callStatus === 'ANSWERED') {
    title = `${isMe ? 'Outgoing' : 'Incoming'} ${mediaType} call`;
  } else if (msg.callStatus === 'MISSED') {
    title = `Missed ${mediaType} call`;
  } else if (msg.callStatus === 'DECLINED') {
    title = 'Call declined';
  } else if (msg.callStatus === 'CANCELLED') {
    title = 'Call cancelled';
  }

  return (
    <div style={styles.callBadgeContent}>
      <p style={styles.msgContent}>{icon} {title}</p>
      {msg.callStatus === 'ANSWERED' && (
        <p style={styles.callDuration}>Duration: {formatCallDuration(msg.callDurationSeconds)}</p>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [memberNames, setMemberNames] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [attachmentDraft, setAttachmentDraft] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callId, setCallId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [participants, setParticipants] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [controlRequest, setControlRequest] = useState(null);
  const [controlStatus, setControlStatus] = useState('idle');

  const clientRef = useRef(null);
  const bottomRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingSecondsRef = useRef(0);
  const fileInputRef = useRef(null);
  const pendingMessageTimersRef = useRef({});
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const handleSignalRef = useRef(null);
  const processedSignalsRef = useRef(new Set());
  const callStartedAtRef = useRef(null);
  const callInitiatorIdRef = useRef(null);
  const callInitiatorNameRef = useRef('');
  const callTimeoutRef = useRef(null);
  const callFinalizedRef = useRef(false);
  const incomingToneRef = useRef(null);
  const outgoingToneRef = useRef(null);
  const navigate = useNavigate();
  const user = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

  const getDisplayName = useCallback((userId, fallback = '') => {
    if (userId === user?.id) return user.name;
    return memberNames[userId] || fallback || '';
  }, [memberNames, user]);

  const normalizeMessage = useCallback((msg) => ({
    id: msg.id,
    teamId: msg.teamId,
    senderId: msg.senderId,
    senderName: msg.senderName || getDisplayName(msg.senderId),
    content: msg.content,
    clientMessageId: msg.clientMessageId,
    messageType: msg.messageType || 'TEXT',
    audioDataUrl: msg.audioDataUrl,
    audioDurationSeconds: msg.audioDurationSeconds,
    mediaMimeType: msg.mediaMimeType,
    attachmentDataUrl: msg.attachmentDataUrl,
    attachmentFileName: msg.attachmentFileName,
    attachmentFileSize: msg.attachmentFileSize,
    deliveryStatus: msg.deliveryStatus || 'SENT',
    callId: msg.callId,
    callStatus: msg.callStatus,
    callMediaType: msg.callMediaType,
    callInitiatorId: msg.callInitiatorId,
    callDurationSeconds: msg.callDurationSeconds,
    sentAt: msg.sentAt,
  }), [getDisplayName]);

  const clearPendingMessageTimer = useCallback((clientMessageId) => {
    if (!clientMessageId || !pendingMessageTimersRef.current[clientMessageId]) return;

    clearTimeout(pendingMessageTimersRef.current[clientMessageId]);
    delete pendingMessageTimersRef.current[clientMessageId];
  }, []);

  const markMessageFailed = useCallback((clientMessageId) => {
    clearPendingMessageTimer(clientMessageId);
    setMessages((prev) => prev.map((msg) => (
      msg.clientMessageId === clientMessageId && msg.deliveryStatus === 'SENDING'
        ? { ...msg, deliveryStatus: 'FAILED' }
        : msg
    )));
  }, [clearPendingMessageTimer]);

  const trackPendingMessage = useCallback((clientMessageId) => {
    clearPendingMessageTimer(clientMessageId);
    pendingMessageTimersRef.current[clientMessageId] = setTimeout(() => {
      markMessageFailed(clientMessageId);
    }, MESSAGE_ACK_TIMEOUT_MS);
  }, [clearPendingMessageTimer, markMessageFailed]);

  const upsertMessage = useCallback((incoming) => {
    clearPendingMessageTimer(incoming.clientMessageId);
    setMessages((prev) => {
      const existingIndex = prev.findIndex((msg) => (
        (incoming.id && msg.id === incoming.id)
        || (incoming.clientMessageId && msg.clientMessageId === incoming.clientMessageId)
      ));

      if (existingIndex === -1) return [...prev, incoming];

      const next = [...prev];
      next[existingIndex] = {
        ...next[existingIndex],
        ...incoming,
        deliveryStatus: incoming.deliveryStatus || next[existingIndex].deliveryStatus,
      };
      return next;
    });
  }, [clearPendingMessageTimer]);

  const publishChatMessage = useCallback((message) => {
    if (!clientRef.current?.connected || !selectedTeam) return false;

    trackPendingMessage(message.clientMessageId);
    clientRef.current.publish({
      destination: `/app/chat/${selectedTeam.id}`,
      body: JSON.stringify({ ...message, deliveryStatus: undefined }),
    });

    return true;
  }, [selectedTeam, trackPendingMessage]);

  const publishMessageStatus = useCallback((message, deliveryStatus) => {
    if (!message?.id || !clientRef.current?.connected || !selectedTeam || !user || message.senderId === user.id) {
      return;
    }

    clientRef.current.publish({
      destination: `/app/chat-status/${selectedTeam.id}`,
      body: JSON.stringify({
        id: message.id,
        teamId: selectedTeam.id,
        senderId: user.id,
        deliveryStatus,
      }),
    });
  }, [selectedTeam, user]);

  const publishSignal = useCallback((signal) => {
    if (!clientRef.current?.connected || !selectedTeam || !user) return;

    clientRef.current.publish({
      destination: `/app/call/${selectedTeam.id}`,
      body: JSON.stringify({
        callId,
        teamId: selectedTeam.id,
        senderId: user.id,
        senderName: user.name,
        ...signal,
      }),
    });
  }, [callId, selectedTeam, user]);

  const stopMediaStream = useCallback((stream) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopIncomingTone = useCallback(() => {
    incomingToneRef.current?.stop();
    incomingToneRef.current = null;
  }, []);

  const stopOutgoingTone = useCallback(() => {
    outgoingToneRef.current?.stop();
    outgoingToneRef.current = null;
  }, []);

  const startIncomingTone = useCallback(() => {
    if (incomingToneRef.current) return;
    const tone = createLoopTone(660);
    if (!tone) return;
    incomingToneRef.current = tone;
    tone.start();
  }, []);

  const startOutgoingTone = useCallback(() => {
    if (outgoingToneRef.current) return;
    const tone = createLoopTone(440);
    if (!tone) return;
    outgoingToneRef.current = tone;
    tone.start();
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const stopCallSounds = useCallback(() => {
    stopIncomingTone();
    stopOutgoingTone();
  }, [stopIncomingTone, stopOutgoingTone]);

  const resetCallRefs = useCallback(() => {
    clearCallTimeout();
    stopCallSounds();
    callStartedAtRef.current = null;
    callInitiatorIdRef.current = null;
    callInitiatorNameRef.current = '';
    callFinalizedRef.current = false;
  }, [clearCallTimeout, stopCallSounds]);

  const getCallDurationSeconds = useCallback(() => {
    if (!callStartedAtRef.current) return 0;
    return Math.max(0, Math.round((Date.now() - callStartedAtRef.current) / 1000));
  }, []);

  const publishFinalCallStatus = useCallback((type, overrides = {}) => {
    const finalCallId = overrides.callId || callId;
    if (callFinalizedRef.current || !finalCallId) return;
    callFinalizedRef.current = true;

    const statusIncludesDuration = type === 'CALL_ENDED';
    publishSignal({
      type,
      callId: finalCallId,
      callMediaType: 'video',
      callInitiatorId: callInitiatorIdRef.current || user.id,
      senderName: callInitiatorNameRef.current || user.name,
      callDurationSeconds: statusIncludesDuration ? getCallDurationSeconds() : null,
      ...overrides,
    });
  }, [callId, getCallDurationSeconds, publishSignal, user]);

  const cleanupCall = useCallback((notify = true) => {
    if (notify && callState !== 'idle') {
      publishSignal({ type: 'LEAVE_CALL' });
    }

    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
    stopMediaStream(localStreamRef.current);
    stopMediaStream(screenStreamRef.current);
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setParticipants({});
    setIncomingCall(null);
    setCallState('idle');
    setCallId(null);
    setMicMuted(false);
    setCameraOff(false);
    setControlRequest(null);
    setControlStatus('idle');
    resetCallRefs();
  }, [callState, publishSignal, resetCallRefs, stopMediaStream]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeer = useCallback(async (participantId, initiator) => {
    const local = await ensureLocalStream();
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[participantId] = peer;

    local.getTracks().forEach((track) => peer.addTrack(track, local));
    screenStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, screenStreamRef.current));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal({
          type: 'ICE_CANDIDATE',
          targetUserId: participantId,
          payload: JSON.stringify(event.candidate),
        });
      }
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      setParticipants((prev) => ({
        ...prev,
        [participantId]: {
          ...prev[participantId],
          ...(prev[participantId]?.screenSharing && stream.getAudioTracks().length === 0
            ? { screenStream: stream }
            : { stream }),
          active: true,
        },
      }));
    };

    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(peer.connectionState) && callState !== 'idle') {
        publishSignal({ type: 'RECONNECT_REQUEST', targetUserId: participantId });
      }
    };

    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      publishSignal({
        type: 'WEBRTC_OFFER',
        targetUserId: participantId,
        payload: JSON.stringify(offer),
      });
    }

    return peer;
  }, [callState, ensureLocalStream, publishSignal]);

  const renegotiatePeer = useCallback(async (participantId, peer) => {
    if (!peer || peer.signalingState !== 'stable') return;

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    publishSignal({
      type: 'WEBRTC_OFFER',
      targetUserId: Number(participantId),
      payload: JSON.stringify(offer),
    });
  }, [publishSignal]);

  const handleSignal = useCallback(async (signal) => {
    if (!user || signal.senderId === user.id || signal.teamId !== selectedTeam?.id) return;

    const signalKey = [
      signal.callId,
      signal.senderId,
      signal.targetUserId,
      signal.type,
      signal.payload?.slice?.(0, 40),
    ].join('|');
    if (processedSignalsRef.current.has(signalKey)) return;
    processedSignalsRef.current.add(signalKey);

    if (signal.targetUserId && signal.targetUserId !== user.id) return;

    switch (signal.type) {
      case 'CALL_INVITE':
        if (callState === 'idle') {
          setIncomingCall(signal);
          setCallId(signal.callId);
          callInitiatorIdRef.current = signal.callInitiatorId || signal.senderId;
          callInitiatorNameRef.current = signal.senderName || getDisplayName(signal.senderId);
          callFinalizedRef.current = false;
          setCallState('ringing');
          startIncomingTone();
          clearCallTimeout();
          callTimeoutRef.current = setTimeout(() => {
            publishFinalCallStatus('CALL_MISSED', {
              callId: signal.callId,
              callInitiatorId: signal.callInitiatorId || signal.senderId,
              senderName: signal.senderName || getDisplayName(signal.senderId),
              targetUserId: user.id,
            });
            cleanupCall(false);
          }, CALL_TIMEOUT_MS);
        }
        break;
      case 'CALL_ACCEPTED':
      case 'JOIN_CALL':
        if (callState !== 'idle') {
          clearCallTimeout();
          stopCallSounds();
          callStartedAtRef.current = Date.now();
          setCallState('active');
          setParticipants((prev) => ({
            ...prev,
            [signal.senderId]: {
              name: getDisplayName(signal.senderId, signal.senderName || signal.participantName),
              active: true,
            },
          }));
          await createPeer(signal.senderId, true);
        }
        break;
      case 'CALL_REJECTED':
        if (signal.targetUserId === user.id || !signal.targetUserId) {
          setIncomingCall(null);
          cleanupCall(false);
        }
        break;
      case 'CALL_CANCELLED':
      case 'CALL_MISSED':
        cleanupCall(false);
        break;
      case 'WEBRTC_OFFER': {
        const peer = peersRef.current[signal.senderId] || await createPeer(signal.senderId, false);
        await peer.setRemoteDescription(JSON.parse(signal.payload));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        publishSignal({
          type: 'WEBRTC_ANSWER',
          targetUserId: signal.senderId,
          payload: JSON.stringify(answer),
        });
        setParticipants((prev) => ({
          ...prev,
          [signal.senderId]: {
            ...prev[signal.senderId],
            name: getDisplayName(signal.senderId, signal.senderName || prev[signal.senderId]?.name),
            active: true,
          },
        }));
        break;
      }
      case 'WEBRTC_ANSWER': {
        const peer = peersRef.current[signal.senderId];
        if (peer) await peer.setRemoteDescription(JSON.parse(signal.payload));
        break;
      }
      case 'ICE_CANDIDATE': {
        const peer = peersRef.current[signal.senderId];
        if (peer && signal.payload) await peer.addIceCandidate(JSON.parse(signal.payload));
        break;
      }
      case 'SCREEN_SHARE_INVITE':
        setParticipants((prev) => ({
          ...prev,
          [signal.senderId]: {
            ...prev[signal.senderId],
            name: getDisplayName(signal.senderId, signal.senderName),
            screenSharing: true,
            active: true,
          },
        }));
        break;
      case 'SCREEN_SHARE_STOPPED':
        setParticipants((prev) => ({
          ...prev,
          [signal.senderId]: {
            ...prev[signal.senderId],
            screenSharing: false,
            screenStream: null,
          },
        }));
        break;
      case 'SCREEN_CONTROL_REQUEST':
        if (screenStreamRef.current) setControlRequest(signal);
        break;
      case 'SCREEN_CONTROL_GRANTED':
        setControlStatus('granted');
        break;
      case 'SCREEN_CONTROL_DENIED':
      case 'SCREEN_CONTROL_REVOKED':
        setControlStatus(signal.type === 'SCREEN_CONTROL_DENIED' ? 'denied' : 'revoked');
        break;
      case 'LEAVE_CALL':
        peersRef.current[signal.senderId]?.close();
        delete peersRef.current[signal.senderId];
        setParticipants((prev) => {
          const next = { ...prev };
          delete next[signal.senderId];
          return next;
        });
        break;
      case 'END_CALL':
        cleanupCall(false);
        break;
      case 'RECONNECT_REQUEST':
        if (callState !== 'idle') await createPeer(signal.senderId, true);
        break;
      default:
        break;
    }
  }, [callState, cleanupCall, clearCallTimeout, createPeer, getDisplayName, publishFinalCallStatus, publishSignal, selectedTeam?.id, startIncomingTone, stopCallSounds, user]);

  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
      loadMessages(selectedTeam.id);
      connectWebSocket(selectedTeam.id);
    }

    return () => {
      if (clientRef.current) clientRef.current.deactivate();
      setConnected(false);
    };
    // Chat sockets should reconnect only when the selected team changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!connected) return;

    messages
      .filter((message) => message.senderId !== user.id && message.messageType !== 'CALL')
      .forEach((message) => publishMessageStatus(message, 'SEEN'));
  }, [connected, messages, publishMessageStatus, user.id]);

  useEffect(() => () => {
    Object.values(peersRef.current).forEach((peer) => peer.close());
    stopMediaStream(localStreamRef.current);
    stopMediaStream(screenStreamRef.current);
    clearInterval(recordingTimerRef.current);
    Object.values(pendingMessageTimersRef.current).forEach((timer) => clearTimeout(timer));
    pendingMessageTimersRef.current = {};
  }, [stopMediaStream]);

  const loadTeams = async () => {
    try {
      const res = await getMyTeams();
      setTeams(res.data);
      if (res.data.length > 0) setSelectedTeam(res.data[0]);
    } catch (err) {
      console.error('Failed to load teams');
    }
  };

  const loadMessages = async (teamId) => {
    try {
      const res = await API.get(`/messages/${teamId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const loadedMessages = res.data.map(normalizeMessage);
      setMessages(loadedMessages);
      loadedMessages
        .filter((message) => message.senderId !== user.id && message.messageType !== 'CALL')
        .forEach((message) => publishMessageStatus(message, 'SEEN'));
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const loadTeamMembers = async (teamId) => {
    try {
      const res = await getTeamMembers(teamId);
      const names = {};
      res.data.forEach((member) => {
        if (member.userId && member.name) names[member.userId] = member.name;
      });
      setMemberNames(names);
    } catch (err) {
      console.error('Failed to load team members');
    }
  };

  const connectWebSocket = (teamId) => {
    if (clientRef.current) clientRef.current.deactivate();

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/team/${teamId}`, (message) => {
          const msg = normalizeMessage(JSON.parse(message.body));
          upsertMessage(msg);
          if (msg.senderId !== user.id && msg.messageType !== 'CALL') {
            publishMessageStatus(msg, 'DELIVERED');
            publishMessageStatus(msg, 'SEEN');
          }
        });
        client.subscribe(`/topic/team/${teamId}/status`, (message) => {
          const statusMessage = JSON.parse(message.body);
          if (statusMessage.clientMessageId) clearPendingMessageTimer(statusMessage.clientMessageId);
          setMessages((prev) => prev.map((msg) => (
            (statusMessage.id && msg.id === statusMessage.id)
            || (statusMessage.clientMessageId && msg.clientMessageId === statusMessage.clientMessageId)
              ? { ...msg, deliveryStatus: statusMessage.deliveryStatus || msg.deliveryStatus }
              : msg
          )));
        });
        client.subscribe(`/topic/calls/${teamId}`, (message) => {
          handleSignalRef.current?.(JSON.parse(message.body));
        });
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: () => {
        setConnected(false);
      }
    });

    client.activate();
    clientRef.current = client;
  };

  const sendMessage = () => {
    if (!input.trim() || !clientRef.current?.connected) return;

    const clientMessageId = createClientMessageId(user.id);
    const msg = {
      teamId: selectedTeam.id,
      senderId: user.id,
      senderName: user.name,
      content: input,
      clientMessageId,
      messageType: 'TEXT',
      deliveryStatus: 'SENDING',
      sentAt: new Date().toISOString(),
    };

    upsertMessage(msg);
    publishChatMessage(msg);

    setInput('');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || isRecording) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recordingChunksRef.current = [];
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setVoiceDraft({
        blob,
        url,
        duration: recordingSecondsRef.current,
        mimeType: blob.type,
        tooLarge: blob.size > MAX_MEDIA_BYTES,
      });
      stream.getTracks().forEach((track) => track.stop());
    };

    recordingSecondsRef.current = 0;
    setRecordingSeconds(0);
    setIsRecording(true);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((value) => {
        const nextValue = value + 1;
        recordingSecondsRef.current = nextValue;
        return nextValue;
      });
    }, 1000);
    recorder.start();
  };

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    clearInterval(recordingTimerRef.current);
    recorderRef.current.stop();
    setIsRecording(false);
  };

  const cancelVoiceDraft = () => {
    if (isRecording) {
      clearInterval(recordingTimerRef.current);
      recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
      recorderRef.current?.stop();
      setIsRecording(false);
    }
    if (voiceDraft?.url) URL.revokeObjectURL(voiceDraft.url);
    setVoiceDraft(null);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
  };

  const sendVoiceDraft = async () => {
    if (!voiceDraft || !clientRef.current?.connected) return;
    if (voiceDraft.blob.size > MAX_MEDIA_BYTES) {
      setVoiceDraft((draft) => draft ? { ...draft, tooLarge: true } : draft);
      return;
    }

    const audioDataUrl = await readBlobAsDataUrl(voiceDraft.blob);
    const clientMessageId = createClientMessageId(user.id);
    const msg = {
      teamId: selectedTeam.id,
      senderId: user.id,
      senderName: user.name,
      content: 'Voice message',
      clientMessageId,
      messageType: 'VOICE',
      audioDataUrl,
      audioDurationSeconds: voiceDraft.duration,
      mediaMimeType: voiceDraft.mimeType,
      deliveryStatus: 'SENDING',
      sentAt: new Date().toISOString(),
    };

    upsertMessage(msg);
    publishChatMessage(msg);

    cancelVoiceDraft();
  };

  const handleAttachmentSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !allowedAttachmentTypes.has(file.type)) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setAttachmentDraft({
        tooLarge: true,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      return;
    }

    const dataUrl = await readBlobAsDataUrl(file);
    setAttachmentDraft({
      dataUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  };

  const cancelAttachmentDraft = () => {
    setAttachmentDraft(null);
  };

  const sendAttachmentDraft = () => {
    if (!attachmentDraft || !clientRef.current?.connected) return;

    const clientMessageId = createClientMessageId(user.id);
    const msg = {
      teamId: selectedTeam.id,
      senderId: user.id,
      senderName: user.name,
      content: attachmentDraft.fileName,
      clientMessageId,
      messageType: 'ATTACHMENT',
      mediaMimeType: attachmentDraft.mimeType,
      attachmentDataUrl: attachmentDraft.dataUrl,
      attachmentFileName: attachmentDraft.fileName,
      attachmentFileSize: attachmentDraft.fileSize,
      deliveryStatus: 'SENDING',
      sentAt: new Date().toISOString(),
    };

    upsertMessage(msg);
    publishChatMessage(msg);
    setAttachmentDraft(null);
  };

  const retryMessage = (message) => {
    if (!clientRef.current?.connected) return;

    const retry = {
      ...message,
      deliveryStatus: 'SENDING',
      sentAt: new Date().toISOString(),
    };
    upsertMessage(retry);
    publishChatMessage(retry);
  };

  const startCall = async () => {
    await ensureLocalStream();
    const nextCallId = `call-${selectedTeam.id}-${Date.now()}`;
    setCallId(nextCallId);
    callInitiatorIdRef.current = user.id;
    callInitiatorNameRef.current = user.name;
    callFinalizedRef.current = false;
    setCallState('outgoing');
    startOutgoingTone();
    publishSignal({
      type: 'CALL_INVITE',
      callId: nextCallId,
      callMediaType: 'video',
      callInitiatorId: user.id,
    });
    clearCallTimeout();
    callTimeoutRef.current = setTimeout(() => {
      publishFinalCallStatus('CALL_MISSED', {
        callId: nextCallId,
        callInitiatorId: user.id,
        senderName: user.name,
      });
      cleanupCall(false);
    }, CALL_TIMEOUT_MS);
  };

  const acceptCall = async () => {
    await ensureLocalStream();
    clearCallTimeout();
    stopCallSounds();
    callStartedAtRef.current = Date.now();
    callInitiatorIdRef.current = incomingCall.callInitiatorId || incomingCall.senderId;
    callInitiatorNameRef.current = incomingCall.senderName || getDisplayName(incomingCall.senderId);
    setCallState('active');
    publishSignal({
      type: 'CALL_ACCEPTED',
      callId: incomingCall.callId,
      targetUserId: incomingCall.senderId,
      callMediaType: incomingCall.callMediaType || 'video',
      callInitiatorId: incomingCall.callInitiatorId || incomingCall.senderId,
    });
    setIncomingCall(null);
  };

  const rejectCall = () => {
    publishFinalCallStatus('CALL_REJECTED', {
      callId: incomingCall?.callId,
      callInitiatorId: incomingCall?.callInitiatorId || incomingCall?.senderId,
      senderName: incomingCall?.senderName,
      targetUserId: incomingCall?.senderId,
    });
    cleanupCall(false);
  };

  const endCall = () => {
    if (callState === 'active') {
      publishFinalCallStatus('CALL_ENDED');
      publishSignal({ type: 'END_CALL' });
    } else if (callState === 'outgoing') {
      publishFinalCallStatus('CALL_CANCELLED');
    } else {
      publishSignal({ type: 'END_CALL' });
    }
    cleanupCall(false);
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micMuted;
    });
    setMicMuted((value) => !value);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraOff;
    });
    setCameraOff((value) => !value);
  };

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return;

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    screenStreamRef.current = stream;
    setScreenStream(stream);
    stream.getVideoTracks()[0].onended = () => stopScreenShare();

    await Promise.all(Object.entries(peersRef.current).map(async ([participantId, peer]) => {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await renegotiatePeer(participantId, peer);
    }));

    publishSignal({
      type: 'SCREEN_SHARE_INVITE',
      screenSharing: true,
    });
  };

  const stopScreenShare = async () => {
    const currentScreenStream = screenStreamRef.current;
    if (!currentScreenStream) return;

    Object.entries(peersRef.current).forEach(([participantId, peer]) => {
      peer.getSenders()
        .filter((sender) => sender.track && currentScreenStream.getTracks().includes(sender.track))
        .forEach((sender) => peer.removeTrack(sender));
      renegotiatePeer(participantId, peer);
    });

    stopMediaStream(currentScreenStream);
    screenStreamRef.current = null;
    setScreenStream(null);
    publishSignal({ type: 'SCREEN_SHARE_STOPPED', screenSharing: false });
    setControlRequest(null);
  };

  const requestControl = (participantId) => {
    setControlStatus('requested');
    publishSignal({
      type: 'SCREEN_CONTROL_REQUEST',
      targetUserId: participantId,
      controlRequested: true,
    });
  };

  const respondToControl = (granted) => {
    publishSignal({
      type: granted ? 'SCREEN_CONTROL_GRANTED' : 'SCREEN_CONTROL_DENIED',
      targetUserId: controlRequest.senderId,
      controlGranted: granted,
    });
    setControlRequest(null);
  };

  const revokeControl = () => {
    publishSignal({ type: 'SCREEN_CONTROL_REVOKED' });
    setControlStatus('revoked');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  const remoteParticipants = Object.entries(participants);
  const screenOwner = remoteParticipants.find(([, participant]) => participant.screenSharing);

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>Chats</h3>
          <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>Back</button>
        </div>
        {teams.map(team => (
          <div
            key={team.id}
            style={{ ...styles.teamItem, background: selectedTeam?.id === team.id ? 'linear-gradient(135deg, rgba(var(--primary-accent-rgb),0.24), rgba(var(--secondary-accent-rgb),0.26))' : 'transparent' }}
            onClick={() => setSelectedTeam(team)}>
            <span style={{ color: selectedTeam?.id === team.id ? 'white' : 'var(--text-secondary)' }}>
              {team.name}
            </span>
          </div>
        ))}
      </div>

      <div style={styles.chatArea}>
        <div style={styles.chatHeader}>
          <h3 style={styles.chatTitle}>
            {selectedTeam ? `# ${selectedTeam.name}` : 'Select a team'}
          </h3>
          <div style={styles.headerActions}>
            <span style={{ ...styles.status, color: connected ? 'var(--success)' : 'var(--error)' }}>
              {connected ? 'Connected' : 'Connecting...'}
            </span>
            <button
              type="button"
              title="Start group video call"
              style={styles.headerIconButton}
              onClick={startCall}
              disabled={!connected || callState !== 'idle'}
            >
              <VideocamIcon fontSize="small" />
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.empty}>No messages yet. Say hello!</p>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={msg.id || msg.clientMessageId || `${msg.sentAt || i}-${i}`} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.msgBubble, background: isMe ? 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))' : 'var(--glass-bg)', color: isMe ? 'white' : 'var(--text-primary)' }}>
                  {!isMe && msg.messageType !== 'CALL' && <p style={styles.senderName}>{msg.senderName}</p>}
                  {msg.messageType === 'VOICE' ? (
                    <VoiceMessage msg={msg} isMe={isMe} />
                  ) : msg.messageType === 'ATTACHMENT' ? (
                    <AttachmentMessage msg={msg} isMe={isMe} />
                  ) : msg.messageType === 'CALL' ? (
                    <CallBadge msg={msg} isMe={msg.callInitiatorId === user.id || isMe} />
                  ) : (
                    <p style={styles.msgContent}>{msg.content}</p>
                  )}
                  <p style={{ ...styles.msgTime, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                    {formatMessageTime(msg.sentAt)} {isMe && msg.messageType !== 'CALL' ? getStatusLabel(msg.deliveryStatus) : ''}
                  </p>
                  {isMe && msg.deliveryStatus === 'FAILED' && (
                    <button
                      type="button"
                      title="Retry message"
                      style={styles.retryBtn}
                      onClick={() => retryMessage(msg)}
                      disabled={!connected}
                    >
                      <ReplayIcon fontSize="inherit" />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {voiceDraft && (
          <div style={styles.voicePreview}>
            <audio src={voiceDraft.url} controls style={styles.previewAudio} />
            <span style={styles.previewMeta}>{formatDuration(voiceDraft.duration)}</span>
            {voiceDraft.tooLarge && (
              <span style={styles.previewError}>Max {formatFileSize(MAX_MEDIA_BYTES)}</span>
            )}
            <button type="button" title="Cancel voice message" style={styles.iconButton} onClick={cancelVoiceDraft}>
              <CloseIcon fontSize="small" />
            </button>
            {!voiceDraft.tooLarge && (
              <button type="button" title="Send voice message" style={styles.sendIconButton} onClick={sendVoiceDraft}>
                <SendIcon fontSize="small" />
              </button>
            )}
          </div>
        )}

        {attachmentDraft && (
          <div style={styles.voicePreview}>
            {attachmentDraft.dataUrl && attachmentDraft.mimeType.startsWith('image/') ? (
              <img src={attachmentDraft.dataUrl} alt={attachmentDraft.fileName} style={styles.attachmentPreviewImage} />
            ) : (
              <InsertDriveFileIcon fontSize="small" />
            )}
            <span style={styles.previewMeta}>{attachmentDraft.fileName}</span>
            <span style={styles.previewMeta}>{formatFileSize(attachmentDraft.fileSize)}</span>
            {attachmentDraft.tooLarge && (
              <span style={styles.previewError}>Max {formatFileSize(MAX_MEDIA_BYTES)}</span>
            )}
            <button type="button" title="Cancel attachment" style={styles.iconButton} onClick={cancelAttachmentDraft}>
              <CloseIcon fontSize="small" />
            </button>
            {!attachmentDraft.tooLarge && (
              <button type="button" title="Send attachment" style={styles.sendIconButton} onClick={sendAttachmentDraft}>
                <SendIcon fontSize="small" />
              </button>
            )}
          </div>
        )}

        <div style={styles.inputArea}>
          <input
            ref={fileInputRef}
            type="file"
            accept={attachmentAccept}
            style={styles.hiddenInput}
            onChange={handleAttachmentSelect}
          />
          <button
            type="button"
            title="Attach file"
            style={styles.recordBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected}
          >
            <AttachFileIcon fontSize="small" />
          </button>
          <button
            type="button"
            title={isRecording ? 'Stop recording' : 'Record voice message'}
            style={{ ...styles.recordBtn, ...(isRecording ? styles.recordingBtn : {}) }}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!connected}
          >
            {isRecording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
          </button>
          {isRecording && <span style={styles.recordingTimer}>{formatDuration(recordingSeconds)}</span>}
          <input
            style={styles.input}
            placeholder={connected ? 'Type a message... (Enter to send)' : 'Connecting to chat...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!connected}
          />
          <button
            style={{ ...styles.sendBtn, opacity: connected ? 1 : 0.5 }}
            onClick={sendMessage}
            disabled={!connected}>
            Send
          </button>
        </div>
      </div>

      {incomingCall && callState === 'ringing' && (
        <div style={styles.callToast}>
          <div style={styles.avatar}>{incomingCall.senderName?.charAt(0)?.toUpperCase() || '?'}</div>
          <div>
            <p style={styles.callTitle}>{incomingCall.senderName}</p>
            <p style={styles.callSubtitle}>Incoming video call</p>
          </div>
          <button type="button" style={styles.acceptBtn} onClick={acceptCall}><CheckIcon fontSize="small" /></button>
          <button type="button" style={styles.rejectBtn} onClick={rejectCall}><CloseIcon fontSize="small" /></button>
        </div>
      )}

      {(callState === 'active' || callState === 'outgoing') && (
        <div style={styles.callPanel}>
          <div style={styles.videoGrid}>
            <VideoTile stream={localStream} name={`${user.name} (you)`} muted active />
            {screenStream && <VideoTile stream={screenStream} name="Your screen" muted isScreen />}
            {remoteParticipants.map(([id, participant]) => (
              <div key={id} style={styles.participantVideos}>
                <VideoTile
                  stream={participant.stream}
                  name={participant.name}
                  active={participant.active}
                />
                {participant.screenStream && (
                  <VideoTile
                    stream={participant.screenStream}
                    name={`${participant.name}'s screen`}
                    isScreen
                    active={participant.active}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={styles.callControls}>
            <button type="button" title={micMuted ? 'Unmute mic' : 'Mute mic'} style={styles.callControlBtn} onClick={toggleMic}>
              {micMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </button>
            <button type="button" title={cameraOff ? 'Turn camera on' : 'Turn camera off'} style={styles.callControlBtn} onClick={toggleCamera}>
              {cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
            </button>
            <button type="button" title={screenStream ? 'Stop screen sharing' : 'Share screen'} style={styles.callControlBtn} onClick={screenStream ? stopScreenShare : startScreenShare}>
              {screenStream ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </button>
            {screenOwner && (
              <button type="button" title="Request screen control" style={styles.callControlBtn} onClick={() => requestControl(Number(screenOwner[0]))}>
                <PanToolIcon />
              </button>
            )}
            {screenStream && (
              <button type="button" title="Revoke screen control" style={styles.callControlBtn} onClick={revokeControl}>
                <BlockIcon />
              </button>
            )}
            <button type="button" title="End call" style={styles.endCallBtn} onClick={endCall}>
              <CallEndIcon />
            </button>
            <span style={styles.controlStatus}>{controlStatus !== 'idle' ? `Control ${controlStatus}` : ''}</span>
          </div>
          {controlRequest && (
            <div style={styles.controlPrompt}>
              <span>{controlRequest.senderName} requested screen control</span>
              <button type="button" style={styles.acceptSmall} onClick={() => respondToControl(true)}>Grant</button>
              <button type="button" style={styles.rejectSmall} onClick={() => respondToControl(false)}>Deny</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', background: 'transparent', padding: '20px', gap: '20px', position: 'relative' },
  sidebar: { width: '280px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sidebarTitle: { margin: 0, color: 'var(--text-primary)' },
  backBtn: { padding: '8px 12px', background: 'var(--glass-bg-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
  teamItem: { padding: '13px 16px', cursor: 'pointer', borderRadius: '16px', margin: '6px 10px', border: '1px solid var(--border-color)', transition: 'background 220ms ease, transform 220ms ease' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  chatHeader: { padding: '18px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '22px 22px 0 0', boxShadow: 'var(--shadow-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { margin: 0, color: 'var(--text-primary)' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  status: { fontSize: '14px' },
  headerIconButton: { width: '38px', height: '38px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--glass-bg-soft)', color: 'var(--text-primary)', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  messages: { flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--glass-bg-soft)', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', marginTop: '48px' },
  msgRow: { display: 'flex' },
  msgBubble: { maxWidth: '62%', padding: '13px 16px', borderRadius: '18px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' },
  senderName: { margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-accent)' },
  msgContent: { margin: 0, fontSize: '14px', overflowWrap: 'anywhere' },
  callBadgeContent: { display: 'flex', flexDirection: 'column', gap: '4px' },
  callDuration: { margin: 0, fontSize: '12px', opacity: 0.8 },
  msgTime: { margin: '4px 0 0 0', fontSize: '10px', textAlign: 'right' },
  retryBtn: { marginTop: '8px', marginLeft: 'auto', padding: '6px 9px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.24)', background: 'rgba(255,255,255,0.16)', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 800 },
  attachmentLink: { display: 'flex', flexDirection: 'column', gap: '6px', color: 'inherit', textDecoration: 'none' },
  attachmentImage: { maxWidth: '260px', maxHeight: '220px', borderRadius: '12px', objectFit: 'cover', display: 'block' },
  attachmentName: { fontSize: '12px', fontWeight: 700, overflowWrap: 'anywhere' },
  fileAttachment: { display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', minWidth: '220px' },
  fileName: { fontSize: '14px', fontWeight: 800, overflowWrap: 'anywhere' },
  fileSize: { fontSize: '11px', opacity: 0.75, marginLeft: 'auto' },
  voiceMessage: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '230px' },
  iconButton: { width: '34px', height: '34px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--glass-bg-soft)', color: 'var(--text-primary)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: '0 0 auto' },
  lightIconButton: { background: 'rgba(255,255,255,0.18)', color: 'white' },
  voiceTrack: { height: '8px', flex: 1, minWidth: '120px', borderRadius: '999px', background: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  voiceProgress: { height: '100%', borderRadius: '999px', background: 'var(--primary-accent)' },
  duration: { fontSize: '12px', fontWeight: 700 },
  voicePreview: { padding: '12px 24px', background: 'var(--glass-bg)', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' },
  previewAudio: { height: '36px', flex: 1, minWidth: '160px' },
  attachmentPreviewImage: { width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' },
  previewMeta: { color: 'var(--text-secondary)', fontWeight: 700 },
  previewError: { color: 'var(--error)', fontWeight: 800, fontSize: '12px' },
  sendIconButton: { width: '34px', height: '34px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: '0 0 auto' },
  inputArea: { padding: '16px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '0 0 22px 22px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--shadow-soft)' },
  hiddenInput: { display: 'none' },
  input: { flex: 1, minWidth: 0, padding: '13px 15px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '14px' },
  sendBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 },
  recordBtn: { width: '42px', height: '42px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--glass-bg-soft)', color: 'var(--text-primary)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: '0 0 auto' },
  recordingBtn: { background: 'var(--error)', color: 'white' },
  recordingTimer: { color: 'var(--error)', fontWeight: 800, minWidth: '42px' },
  callToast: { position: 'absolute', top: '24px', right: '24px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '18px', boxShadow: 'var(--shadow-soft)' },
  avatar: { width: '42px', height: '42px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', fontWeight: 900 },
  callTitle: { margin: 0, color: 'var(--text-primary)', fontWeight: 800 },
  callSubtitle: { margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' },
  acceptBtn: { width: '36px', height: '36px', borderRadius: '12px', border: 0, background: 'var(--success)', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  rejectBtn: { width: '36px', height: '36px', borderRadius: '12px', border: 0, background: 'var(--error)', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  callPanel: { position: 'absolute', inset: '72px 32px 32px 332px', zIndex: 15, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'rgba(15, 23, 42, 0.88)', border: '1px solid var(--border-color)', borderRadius: '22px', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(20px)' },
  videoGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', minHeight: 0 },
  participantVideos: { display: 'contents' },
  videoTile: { position: 'relative', overflow: 'hidden', borderRadius: '18px', background: '#101827', border: '1px solid rgba(255,255,255,0.12)', minHeight: '180px' },
  activeVideoTile: { boxShadow: '0 0 0 2px var(--primary-accent)' },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoPlaceholder: { width: '100%', height: '100%', minHeight: '180px', display: 'grid', placeItems: 'center', color: 'white', fontSize: '46px', fontWeight: 900 },
  videoBadge: { position: 'absolute', left: '10px', bottom: '10px', padding: '6px 10px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '12px', fontWeight: 800 },
  callControls: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' },
  callControlBtn: { width: '44px', height: '44px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.12)', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  endCallBtn: { width: '50px', height: '44px', borderRadius: '14px', border: 0, background: 'var(--error)', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  controlStatus: { color: 'white', minWidth: '120px', fontSize: '12px', fontWeight: 800 },
  controlPrompt: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'white', fontWeight: 800 },
  acceptSmall: { padding: '8px 12px', borderRadius: '10px', border: 0, background: 'var(--success)', color: 'white', cursor: 'pointer', fontWeight: 800 },
  rejectSmall: { padding: '8px 12px', borderRadius: '10px', border: 0, background: 'var(--error)', color: 'white', cursor: 'pointer', fontWeight: 800 },
};
