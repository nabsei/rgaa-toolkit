const api = globalThis.browser ?? globalThis.chrome;

const DEFAULTS = {
  enabled: false,
  intensity: 90,
  mode: "auto",
  excludedSites: [],
  textSpacing: false,
  stopAnimations: false,
  textZoom: 100,
  enhancedFocus: false,
  enhancedContrast: false,
  imagesAsText: false,
  underlineLinks: false,
  skipLink: false,
  flagNewWindow: false,
  blockAutoRefresh: false,
  muteAutoplay: false,
  forceMediaControls: false,
  improveReflow: false,
  forceSubtitles: false,
  simplifiedView: false,
};

async function loadSettings() {
  try {
    return await api.storage.sync.get(DEFAULTS);
  } catch (err) {
    console.warn("Dark Mode RGAA: unable to read storage", err);
    return { ...DEFAULTS };
  }
}

let saveTimer;
function saveSettingsDebounced(partial, delay = 300) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    api.storage.sync.set(partial).catch((err) => {
      console.warn("Dark Mode RGAA: unable to write to storage", err);
    });
  }, delay);
}

async function saveSettings(partial) {
  try {
    return await api.storage.sync.set(partial);
  } catch (err) {
    console.warn("Dark Mode RGAA: unable to write to storage", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggle-dark");
  const toggleState = toggleBtn.querySelector(".toggle-state");
  const intensityRange = document.getElementById("intensity-range");
  const intensityOutput = document.getElementById("intensity-output");
  const modeSelect = document.getElementById("apply-mode-select");
  const statusMessage = document.getElementById("status-message");
  const excludeBtn = document.getElementById("exclude-site");
  const excludedList = document.getElementById("excluded-list");
  const featureToggles = document.querySelectorAll(
    ".toggle-switch[data-setting]",
  );
  const textZoomSelect = document.getElementById("text-zoom-select");

  const featureLabels = {
    textSpacing: "Espacement du texte",
    stopAnimations: "Arrêt des animations",
    enhancedFocus: "Focus amélioré",
    enhancedContrast: "Contraste amélioré",
    imagesAsText: "Texte alt",
    underlineLinks: "Soulignement des liens",
    skipLink: "Lien d'évitement",
    flagNewWindow: "Signalement nouvelle fenêtre",
    blockAutoRefresh: "Blocage auto-actualisation",
    muteAutoplay: "Coupure lecture auto",
    forceMediaControls: "Contrôles média",
    improveReflow: "Amélioration du reflow",
    forceSubtitles: "Sous-titres auto",
    simplifiedView: "Vue simplifiée",
  };

  toggleBtn.addEventListener("click", async () => {
    const isEnabled = toggleBtn.getAttribute("aria-checked") === "true";
    const newState = !isEnabled;

    toggleBtn.setAttribute("aria-checked", String(newState));
    toggleState.textContent = newState ? "Activé" : "Désactivé";

    await saveSettings({ enabled: newState });
    showStatus(newState ? "Mode sombre activé" : "Mode sombre désactivé");
  });

  toggleBtn.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleBtn.click();
    }
  });

  intensityRange.addEventListener("input", () => {
    const val = intensityRange.value;
    intensityRange.setAttribute("aria-valuenow", val);
    intensityRange.setAttribute("aria-valuetext", `${val} %`);
    intensityOutput.textContent = `${val} %`;
    saveSettingsDebounced({ intensity: Number(val) });
  });

  modeSelect.addEventListener("change", async () => {
    const mode = modeSelect.value;
    await saveSettings({ mode });

    const labels = {
      auto: "Mode automatique",
      always: "Toujours actif",
      manual: "Mode manuel",
    };
    showStatus(labels[mode] || "Mode mis à jour");
  });

  featureToggles.forEach((btn) => {
    const settingKey = btn.dataset.setting;

    btn.addEventListener("click", async () => {
      const isOn = btn.getAttribute("aria-checked") === "true";
      const newState = !isOn;
      btn.setAttribute("aria-checked", String(newState));
      btn.querySelector(".toggle-state").textContent = newState
        ? "Activé"
        : "Désactivé";

      await saveSettings({ [settingKey]: newState });
      const label = featureLabels[settingKey] || settingKey;
      showStatus(newState ? `${label} activé` : `${label} désactivé`);
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        btn.click();
      }
    });
  });

  textZoomSelect.addEventListener("change", async () => {
    const zoom = Number(textZoomSelect.value);
    await saveSettings({ textZoom: zoom });
    showStatus(zoom > 100 ? `Zoom texte ${zoom} %` : "Zoom texte désactivé");
  });

  excludeBtn.addEventListener("click", async () => {
    let tab;
    try {
      const tabs = await api.tabs.query({
        active: true,
        currentWindow: true,
      });
      tab = tabs[0];
    } catch (err) {
      showStatus("Impossible de détecter l'onglet actif");
      return;
    }

    if (!tab || !tab.url) {
      showStatus("Impossible de détecter le site");
      return;
    }

    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      showStatus("URL invalide");
      return;
    }

    if (!hostname) {
      showStatus("Aucun site à exclure");
      return;
    }

    const current = await loadSettings();
    const excluded = current.excludedSites || [];

    if (excluded.includes(hostname)) {
      const updated = excluded.filter((s) => s !== hostname);
      await saveSettings({ excludedSites: updated });
      showStatus(`${hostname} réactivé`);
    } else {
      excluded.push(hostname);
      await saveSettings({ excludedSites: excluded });
      showStatus(`${hostname} exclu`);
    }

    const refreshed = await loadSettings();
    renderExcludedList(refreshed.excludedSites || []);
    updateExcludeButton(hostname, refreshed.excludedSites || []);
  });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.activeElement?.classList.contains("info-btn")
    ) {
      document.activeElement.blur();
    }
  });

  loadSettings().then((settings) => {
    applySettingsToUI(settings);
  });

  function applySettingsToUI(s) {
    toggleBtn.setAttribute("aria-checked", String(!!s.enabled));
    toggleState.textContent = s.enabled ? "Activé" : "Désactivé";

    intensityRange.value = s.intensity;
    intensityRange.setAttribute("aria-valuenow", s.intensity);
    intensityRange.setAttribute("aria-valuetext", `${s.intensity} %`);
    intensityOutput.textContent = `${s.intensity} %`;

    modeSelect.value = s.mode || "auto";

    renderExcludedList(s.excludedSites || []);

    featureToggles.forEach((btn) => {
      const key = btn.dataset.setting;
      const val = !!s[key];
      btn.setAttribute("aria-checked", String(val));
      btn.querySelector(".toggle-state").textContent = val
        ? "Activé"
        : "Désactivé";
    });

    textZoomSelect.value = String(s.textZoom || 100);

    api.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs && tabs[0];
        if (tab && tab.url) {
          try {
            const hostname = new URL(tab.url).hostname;
            updateExcludeButton(hostname, s.excludedSites || []);
          } catch {}
        }
      })
      .catch(() => {});
  }

  function updateExcludeButton(hostname, excludedSites) {
    if (!hostname) return;
    const isExcluded = excludedSites.includes(hostname);
    excludeBtn.textContent = isExcluded
      ? `Réactiver sur ${hostname}`
      : `Désactiver sur ${hostname}`;
    excludeBtn.setAttribute(
      "aria-label",
      isExcluded
        ? `Réactiver le mode sombre sur ${hostname}`
        : `Désactiver le mode sombre sur ${hostname}`,
    );
  }

  function renderExcludedList(sites) {
    excludedList.textContent = "";

    if (sites.length === 0) {
      excludedList.setAttribute("aria-hidden", "true");
      return;
    }

    excludedList.removeAttribute("aria-hidden");

    sites.forEach((site) => {
      const li = document.createElement("li");

      const span = document.createElement("span");
      span.textContent = site;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Retirer";
      removeBtn.className = "remove-site";
      removeBtn.setAttribute(
        "aria-label",
        `Retirer ${site} de la liste d'exclusion`,
      );
      removeBtn.addEventListener("click", async () => {
        const current = await loadSettings();
        const updated = (current.excludedSites || []).filter((s) => s !== site);
        await saveSettings({ excludedSites: updated });
        renderExcludedList(updated);
        showStatus(`${site} retiré`);

        api.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            const tab = tabs && tabs[0];
            if (tab && tab.url) {
              try {
                const hostname = new URL(tab.url).hostname;
                updateExcludeButton(hostname, updated);
              } catch {}
            }
          })
          .catch(() => {});
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      excludedList.appendChild(li);
    });
  }

  let statusTimer;
  function showStatus(msg) {
    statusMessage.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusMessage.textContent = "";
    }, 3000);
  }
});
