import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { usePresence } from "@/lib/use-presence";
import { Agenda } from "./pages/Agenda";
import { Auth } from "./pages/Auth";
import { Chat } from "./pages/Chat";
import { Home } from "./pages/Home";
import { Pair } from "./pages/Pair";
import { Profile } from "./pages/Profile";

function AppRoutes() {
  const location = useLocation();
  const { session, loading } = useAuth();
  const hideNav =
    location.pathname.startsWith("/chat/") || location.pathname === "/pair" || location.pathname === "/profile";

  usePresence();

  if (loading) return null;

  if (!session) {
    return (
      <AppShell hideNav>
        <Auth />
      </AppShell>
    );
  }

  return (
    <AppShell hideNav={hideNav}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/pair" element={<Pair />} />
        <Route path="/chat/:linkId" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
