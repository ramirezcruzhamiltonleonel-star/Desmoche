import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceIceCandidate, VoiceSignalData } from "@desmoche/shared";
import { useGame } from "../context/GameContext";
import { ICE_SERVERS } from "../lib/webrtc";

export type PeerVoiceStatus = "connecting" | "connected" | "failed";

export interface VoiceChatApi {
  /** Whether the local mic is on and we're in the voice mesh at all. */
  active: boolean;
  selfMuted: boolean;
  error: string | null;
  speakingPlayerIds: Set<string>;
  peerStatus: Record<string, PeerVoiceStatus>;
  toggleActive: () => Promise<void>;
  toggleSelfMute: () => void;
}

const SPEAKING_THRESHOLD = 18; // 0-255 average volume
const SPEAKING_POLL_MS = 150;

/**
 * P2P WebRTC voice mesh for one table (up to 4 players). The server only
 * relays signaling (offers/answers/ICE candidates) — audio never touches it.
 * Protocol: whoever is ALREADY in voice always initiates the offer to a
 * newcomer; a newcomer only ever answers. That fixed rule means two sides
 * never race to send simultaneous offers ("glare") without needing any
 * tie-breaking logic.
 */
export function useVoiceChat(): VoiceChatApi {
  const { socket, state } = useGame();
  const yourPlayerId = state?.seats.find((s) => s.seatIndex === state.yourSeatIndex)?.playerId ?? null;

  const [active, setActive] = useState(false);
  const [selfMuted, setSelfMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingPlayerIds, setSpeakingPlayerIds] = useState<Set<string>>(new Set());
  const [peerStatus, setPeerStatus] = useState<Record<string, PeerVoiceStatus>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, VoiceIceCandidate[]>>(new Map());
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(
    new Map(),
  );
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const setStatus = useCallback((playerId: string, status: PeerVoiceStatus) => {
    setPeerStatus((prev) => ({ ...prev, [playerId]: status }));
  }, []);

  const registerAnalyser = useCallback((playerId: string, stream: MediaStream) => {
    try {
      audioCtxRef.current ??= new AudioContext();
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      analysersRef.current.set(playerId, { analyser, data });
    } catch {
      // Speaking indicator is a nice-to-have — never let it break the call itself.
    }
  }, []);

  const cleanupPeer = useCallback((playerId: string) => {
    peerConnectionsRef.current.get(playerId)?.close();
    peerConnectionsRef.current.delete(playerId);
    const audioEl = audioElsRef.current.get(playerId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioElsRef.current.delete(playerId);
    }
    analysersRef.current.delete(playerId);
    pendingCandidatesRef.current.delete(playerId);
    setPeerStatus((prev) => {
      if (!(playerId in prev)) return prev;
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }, []);

  const ensurePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = peerConnectionsRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const localStream = localStreamRef.current;
      if (localStream) {
        for (const track of localStream.getAudioTracks()) pc.addTrack(track, localStream);
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket?.emit("voice:signal", {
          toPlayerId: peerId,
          data: {
            kind: "ice-candidate",
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          },
        });
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {
          /* autoplay can be blocked until further user interaction — non-fatal */
        });
        audioElsRef.current.set(peerId, audioEl);
        registerAnalyser(peerId, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus(peerId, "connected");
        else if (pc.connectionState === "failed") setStatus(peerId, "failed");
      };

      peerConnectionsRef.current.set(peerId, pc);
      setStatus(peerId, "connecting");
      return pc;
    },
    [socket, registerAnalyser, setStatus],
  );

  const initiateOfferTo = useCallback(
    async (peerId: string) => {
      const pc = ensurePeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit("voice:signal", {
        toPlayerId: peerId,
        data: { kind: "sdp", sdp: { type: "offer", sdp: offer.sdp ?? "" } },
      });
    },
    [ensurePeerConnection, socket],
  );

  const flushPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current.get(peerId);
    if (!queued) return;
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  }, []);

  const handleSignal = useCallback(
    async (fromPlayerId: string, data: VoiceSignalData) => {
      if (data.kind === "sdp" && data.sdp.type === "offer") {
        const pc = ensurePeerConnection(fromPlayerId);
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp.sdp });
        await flushPendingCandidates(fromPlayerId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("voice:signal", {
          toPlayerId: fromPlayerId,
          data: { kind: "sdp", sdp: { type: "answer", sdp: answer.sdp ?? "" } },
        });
        return;
      }
      if (data.kind === "sdp" && data.sdp.type === "answer") {
        const pc = peerConnectionsRef.current.get(fromPlayerId);
        if (!pc) return;
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp.sdp });
        await flushPendingCandidates(fromPlayerId, pc);
        return;
      }
      if (data.kind === "ice-candidate") {
        const pc = peerConnectionsRef.current.get(fromPlayerId);
        if (!pc || !pc.remoteDescription) {
          const queue = pendingCandidatesRef.current.get(fromPlayerId) ?? [];
          queue.push(data.candidate);
          pendingCandidatesRef.current.set(fromPlayerId, queue);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      }
    },
    [ensurePeerConnection, flushPendingCandidates, socket],
  );

  // Wire socket listeners once we have a socket, regardless of whether voice is active —
  // "peer-joined" only matters if we ourselves are active, checked inside the handler.
  useEffect(() => {
    if (!socket) return;

    const onPeerJoined = ({ playerId }: { playerId: string }) => {
      if (!localStreamRef.current) return; // we're not in voice ourselves — ignore
      void initiateOfferTo(playerId);
    };
    const onPeerLeft = ({ playerId }: { playerId: string }) => cleanupPeer(playerId);
    const onSignal = ({ fromPlayerId, data }: { fromPlayerId: string; data: VoiceSignalData }) =>
      void handleSignal(fromPlayerId, data);

    socket.on("voice:peer-joined", onPeerJoined);
    socket.on("voice:peer-left", onPeerLeft);
    socket.on("voice:signal", onSignal);
    return () => {
      socket.off("voice:peer-joined", onPeerJoined);
      socket.off("voice:peer-left", onPeerLeft);
      socket.off("voice:signal", onSignal);
    };
  }, [socket, initiateOfferTo, handleSignal, cleanupPeer]);

  // Speaking-indicator poll loop: local mic (when active+unmuted) plus every connected peer.
  useEffect(() => {
    if (!active) {
      setSpeakingPlayerIds(new Set());
      return;
    }
    let lastRun = 0;
    const tick = (now: number) => {
      if (now - lastRun >= SPEAKING_POLL_MS) {
        lastRun = now;
        const speaking = new Set<string>();
        for (const [playerId, { analyser, data }] of analysersRef.current) {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
          if (avg > SPEAKING_THRESHOLD) speaking.add(playerId);
        }
        setSpeakingPlayerIds(speaking);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  const stopEverything = useCallback(() => {
    for (const playerId of [...peerConnectionsRef.current.keys()]) cleanupPeer(playerId);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setPeerStatus({});
    setSpeakingPlayerIds(new Set());
  }, [cleanupPeer]);

  const toggleActive = useCallback(async () => {
    if (active) {
      socket?.emit("voice:leave");
      stopEverything();
      setActive(false);
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      if (yourPlayerId) registerAnalyser(yourPlayerId, stream);
      setActive(true);
      setSelfMuted(false);

      socket?.emit("voice:join", (result) => {
        // We only ever WAIT for offers from the existing roster — we never
        // initiate to them ourselves (see the module doc comment on why).
        for (const peerId of result.peerIds) {
          ensurePeerConnection(peerId);
        }
      });
    } catch {
      setError("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
      localStreamRef.current = null;
    }
  }, [active, socket, yourPlayerId, ensurePeerConnection, registerAnalyser, stopEverything]);

  const toggleSelfMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !selfMuted;
    for (const track of stream.getAudioTracks()) track.enabled = !nextMuted;
    setSelfMuted(nextMuted);
  }, [selfMuted]);

  // Leave voice cleanly if the component unmounts (e.g. navigating away from the table).
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        socket?.emit("voice:leave");
        stopEverything();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cheap diagnostic surface — nothing sensitive, just connection state, so a
  // player who reports "no me anda el audio" can open devtools and read
  // window.__desmocheVoice instead of it being a total black box.
  useEffect(() => {
    (window as unknown as { __desmocheVoice?: unknown }).__desmocheVoice = {
      active,
      selfMuted,
      peerStatus,
      speakingPlayerIds: [...speakingPlayerIds],
    };
  }, [active, selfMuted, peerStatus, speakingPlayerIds]);

  return { active, selfMuted, error, speakingPlayerIds, peerStatus, toggleActive, toggleSelfMute };
}
