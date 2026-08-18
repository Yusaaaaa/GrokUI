import { AppShell } from "@/components/layout/AppShell";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { connect, useAgentConnection } from "@/features/chat/useAgentConnection";
import { useAppStore } from "@/stores/app-store";
import { Providers } from "./providers";

export function App() {
  return (
    <Providers>
      <Root />
    </Providers>
  );
}

function Root() {
  useAgentConnection();
  const screen = useAppStore((state) => state.screen);
  const cli = useAppStore((state) => state.cli);

  if (screen === "onboarding") {
    return (
      <OnboardingScreen
        status={cli}
        onRefresh={() => connect(false)}
      />
    );
  }

  return <AppShell />;
}
