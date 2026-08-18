import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  cliStatus,
  isTauri,
  onAgentStatus,
  onModelsUpdate,
  onPermissionAsk,
  onSessionUpdate,
  onTurnEnd,
  startAgent,
} from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import { useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

export function useAgentConnection() {
  const setScreen = useAppStore((state) => state.setScreen);
  const setCli = useAppStore((state) => state.setCli);
  const setAgentState = useAppStore((state) => state.setAgentState);
  const setPermission = useAppStore((state) => state.setPermission);

  useEffect(() => {
    if (!isTauri()) {
      setScreen("onboarding");
      return;
    }

    const unlisten: Array<Promise<() => void>> = [
      onSessionUpdate((payload) => {
        const sessionId = String(payload.sessionId ?? "");
        if (!sessionId) return;
        useSessionStore.getState().applyUpdate(sessionId, payload);
      }),
      onTurnEnd((payload) => {
        const sessionId = String(payload.sessionId ?? "");
        if (sessionId) {
          useSessionStore.getState().setBusy(sessionId, false);
        }
        if (payload.ok === false && payload.error) {
          useSessionStore.getState().setError(payload.error);
        }
      }),
      onPermissionAsk((payload) => setPermission(payload)),
      onAgentStatus((payload) => {
        if (payload.state === "disconnected") {
          if (useAppStore.getState().agentState === "connecting") return;
          setAgentState("disconnected", payload.message ?? null);
        } else if (payload.state === "ready") {
          setAgentState("ready");
        }
      }),
      onModelsUpdate((payload) => {
        const models = payload.availableModels as Array<{ modelId?: string }> | undefined;
        const ids = (models ?? [])
          .map((item) => item.modelId)
          .filter((id): id is string => Boolean(id));
        if (ids.length) useSettingsStore.getState().setModels(ids);
        const current = payload.currentModelId;
        if (typeof current === "string" && current) {
          useSettingsStore.getState().setModel(current);
        }
      }),
    ];

    void boot();

    return () => {
      for (const item of unlisten) void item.then((fn) => fn());
    };
  }, [setAgentState, setCli, setPermission, setScreen]);

  async function boot() {
    await connect(false);
  }
}

let inflight: Promise<void> | null = null;

export async function connect(forceOnboarding: boolean) {
  if (inflight) return inflight;
  inflight = connectOnce(forceOnboarding).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function connectOnce(forceOnboarding: boolean) {
  const { setScreen, setCli, setAgentState, screen, agentState } = useAppStore.getState();
  if (!forceOnboarding && screen === "main" && agentState === "ready") {
    return;
  }
  const settings = useSettingsStore.getState();
  try {
    const status = await cliStatus(settings.cliPath || null);
    setCli(status);
    if (status.standaloneDir) settings.setStandaloneDir(status.standaloneDir);
    if (!status.installed || !status.loggedIn || forceOnboarding) {
      setScreen("onboarding");
      return;
    }
    setScreen("main");
    setAgentState("connecting");
    const indexed = useSessionStore.getState().indexFromDisk();
    await startAgent(settings.cliPath || null, settings.model, false);
    setAgentState("ready");
    await indexed;
    const currentId = useSessionStore.getState().activeSessionId;
    if (currentId) {
      void useSessionStore.getState().openSession(currentId);
    } else {
      const cwd = settings.lastCwd ?? status.defaultCwd;
      if (cwd) await useSessionStore.getState().createSession(cwd);
    }
  } catch (error) {
    setAgentState(
      "disconnected",
      error instanceof Error ? error.message : String(error),
    );
    setScreen("onboarding");
  }
}

export async function reconnect() {
  const { setScreen, setCli, setAgentState } = useAppStore.getState();
  const settings = useSettingsStore.getState();
  setAgentState("connecting");
  try {
    const status = await cliStatus(settings.cliPath || null);
    setCli(status);
    if (status.standaloneDir) settings.setStandaloneDir(status.standaloneDir);
    if (!status.installed || !status.loggedIn) {
      setScreen("onboarding");
      return;
    }
    setScreen("main");
    await startAgent(settings.cliPath || null, settings.model, true);
    setAgentState("ready");
    useSessionStore.setState({ loadedOnAgent: {} });
    await useSessionStore.getState().hydrateFromDisk();
    if (!useSessionStore.getState().activeSessionId) {
      const cwd = settings.lastCwd ?? status.defaultCwd;
      if (cwd) await useSessionStore.getState().createSession(cwd);
    }
  } catch (error) {
    setAgentState(
      "disconnected",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function pickProjectFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === "string" && selected) return selected;
  return null;
}
