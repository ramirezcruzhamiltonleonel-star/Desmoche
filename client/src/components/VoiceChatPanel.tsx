import type { VoiceChatApi } from "../hooks/useVoiceChat";

interface VoiceChatPanelProps {
  voice: VoiceChatApi;
  isSelfSpeaking: boolean;
  nameByPlayerId: Record<string, string>;
}

export default function VoiceChatPanel({ voice, isSelfSpeaking, nameByPlayerId }: VoiceChatPanelProps) {
  const failedPeers = Object.entries(voice.peerStatus).filter(([, status]) => status === "failed");

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {voice.active && (
          <button
            onClick={voice.toggleSelfMute}
            aria-label={voice.selfMuted ? "Activar tu micrófono" : "Mutear tu micrófono"}
            className={`rounded-full border px-2 py-1 text-xs transition ${
              voice.selfMuted
                ? "border-red-500 text-red-400"
                : isSelfSpeaking
                  ? "border-green-400 text-green-400"
                  : "border-stone-500 text-stone-300"
            }`}
          >
            {voice.selfMuted ? "🔇" : "🎙️"}
          </button>
        )}
        <button
          onClick={() => void voice.toggleActive()}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            voice.active
              ? "border-gold bg-gold/10 text-gold"
              : "border-stone-500 text-stone-300 hover:border-gold"
          }`}
        >
          {voice.active ? "Voz activada" : "Activar micrófono"}
        </button>
      </div>

      {voice.error && <p className="max-w-[12rem] text-right text-[10px] text-red-400">{voice.error}</p>}

      {failedPeers.map(([playerId]) => (
        <p key={playerId} className="max-w-[12rem] text-right text-[10px] text-red-400">
          No se pudo conectar audio con {nameByPlayerId[playerId] ?? "ese jugador"}.
        </p>
      ))}
    </div>
  );
}
