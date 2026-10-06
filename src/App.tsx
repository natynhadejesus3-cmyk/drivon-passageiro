import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { InviteAutoPair } from "./components/InviteAutoPair";
import { RideAcceptedCelebration } from "./components/RideAcceptedCelebration";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { getBootInvite } from "@/lib/invite";
import { listenForInviteLinks } from "@/lib/native-invite";
import { usePresence } from "@/lib/use-presence";
import { startVersionWatcher } from "@/lib/build-version";
import { initNativePush } from "@/lib/notifications/native-push";
import { Agenda } from "./pages/Agenda";
import { Auth } from "./pages/Auth";
import { Chat } from "./pages/Chat";
import { Home } from "./pages/Home";
import { Invite } from "./pages/Invite";
import { Pair } from "./pages/Pair";
import { Profile } from "./pages/Profile";

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const hideNav = location.pathname.startsWith("/chat/") || location.pathname === "/pair";

  // Convite que chegou pelo link do QR (câmera do celular). No navegador mostra primeiro a
  // página de convite (baixar / abrir no app / continuar); dentro do app instalado vai
  // direto pro pareamento automático.
  const [landing, setLanding] = useState(() => {
    const boot = getBootInvite();
    return boot && !Capacitor.isNativePlatform() ? boot : null;
  });
  // Muda quando chega um convite novo com o app já aberto.
  const [inviteTick, setInviteTick] = useState(0);
  useEffect(() => listenForInviteLinks(() => setInviteTick((t) => t + 1)), []);

  usePresence();
  useEffect(() => startVersionWatcher(), []);

  useEffect(() => {
    if (!session?.user.id) return;
    void initNativePush(session.user.id, navigate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  // Não depende de conta: aparece já, sem esperar a sessão carregar.
  if (landing) {
    return (
      <AppShell hideNav>
        <Invite code={landing.code} noApp={landing.noApp} onContinue={() => setLanding(null)} />
      </AppShell>
    );
  }

  if (loading) return null;

  if (!session) {
    return (
      <AppShell hideNav>
        <Auth inviteTick={inviteTick} />
      </AppShell>
    );
  }

  return (
    <>
      <InviteAutoPair tick={inviteTick} />
      <AppShell hideNav={hideNav}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/pair" element={<Pair />} />
          <Route path="/chat/:linkId" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </AppShell>
      {/* Fora do AppShell de propósito: o <main> dele tem animação com
          transform, que faria o "fixed" do aviso prender nele em vez da tela. */}
      <RideAcceptedCelebration />
    </>
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
