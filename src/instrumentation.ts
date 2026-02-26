export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupVectorColumn } = await import("@/lib/rag/setup-vectors");
    await setupVectorColumn();

    const { startWatcher } = await import("@/lib/rag/watcher");
    startWatcher();
  }
}
