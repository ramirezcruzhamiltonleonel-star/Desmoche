import { AuthProvider, useAuth } from "./context/AuthContext";
import { GameProvider, useGame } from "./context/GameContext";
import ErrorToast from "./components/ErrorToast";
import GameTable from "./components/GameTable";
import GuestDemoLoader from "./components/GuestDemoLoader";
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
    // A saved table code means we're rejoining a hand in progress — say so,
    // rather than flashing the home screen while table:state is in flight.
    if (loadTableCode()) return <LoadingScreen message="Reconectando a tu mesa..." />;
    // A guest never sees the create/join/spectate menu at all — "Jugar
    // ahora" means exactly that, no extra screen in between.
    if (isGuest) return <GuestDemoLoader />;
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
