import { AuthProvider, useAuth } from "./context/AuthContext";
import { GameProvider, useGame } from "./context/GameContext";
import ErrorToast from "./components/ErrorToast";
import GameTable from "./components/GameTable";
import HomeScreen from "./components/HomeScreen";
import LobbyScreen from "./components/LobbyScreen";
import LoginScreen from "./components/LoginScreen";

function Screens() {
  const { state } = useGame();
  if (!state) return <HomeScreen />;
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
    <AuthProvider>
      <Authenticated />
    </AuthProvider>
  );
}
