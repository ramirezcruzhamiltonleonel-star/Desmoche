import { AuthProvider, useAuth } from "./context/AuthContext";
import { GameProvider, useGame } from "./context/GameContext";
import ErrorToast from "./components/ErrorToast";
import GameTable from "./components/GameTable";
import HomeScreen from "./components/HomeScreen";
import LoadingScreen from "./components/LoadingScreen";
import LobbyScreen from "./components/LobbyScreen";
import LoginScreen from "./components/LoginScreen";
import { ThemeProvider } from "./context/ThemeContext";
import { loadTableCode } from "./lib/tableStorage";

function Screens() {
  const { connected, state } = useGame();
  const { isGuest } = useAuth();
  if (!connected) return <LoadingScreen message="Conectando..." />;
  if (!state) {
    // A saved table code means we're rejoining a table (lobby or a hand
    // already in progress) — say so, rather than flashing the home screen
    // while table:state is in flight.
    if (loadTableCode(isGuest)) return <LoadingScreen message="Reconectando a tu mesa..." />;
    // A guest sees the exact same create/join/spectate menu as a real
    // account — real multiplayer with anyone, not just a solo bots demo.
    // HomeScreen offers the instant bots demo as one quick option among
    // others, not a forced detour.
    return <HomeScreen />;
  }
  if (state.phase === "lobby") return <LobbyScreen />;
  return <GameTable />;
}

function Authenticated() {
  const { token } = useAuth();
  if (!token) return <LoginScreen />;
  return (
    <GameProvider>
      <Screens />
      <ErrorToast />
    </GameProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Authenticated />
      </AuthProvider>
    </ThemeProvider>
  );
}
