const api = globalThis.browser ?? globalThis.chrome;

api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    api.tabs.sendMessage(tabId, { action: "applySettings" }).catch(() => {});
  }
});

api.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-dark-mode") {
    const { enabled } = await api.storage.sync.get({ enabled: false });
    await api.storage.sync.set({ enabled: !enabled });
  }
});
