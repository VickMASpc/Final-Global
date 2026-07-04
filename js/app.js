import { bindEvents } from "./events.js";
import { renderApp } from "./render.js";
import {
  ensureCurrentMonth,
  getAvailableMonths,
  getBudgetsSnapshot,
  getCurrentMonth,
  initializeState,
  setBudgets,
  setImportMonth,
  setSaveState,
  uiState
} from "./state.js";
import { initStorage, loadBudgets, saveBudgets } from "./storage.js";

const AUTOSAVE_DELAY_MS = 1000;
const SAVE_LABEL_MAP = {
  idle: "Ready",
  dirty: "Changes pending",
  saving: "Saving...",
  saved: "Saved",
  error: "Save failed"
};
const DEFERRED_EDIT_ACTIONS = new Set(["edit-field", "edit-card-field", "edit-purchase-field"]);

let autosaveTimeoutId = null;
let saveFlashTimeoutId = null;
let editableInputEventInProgress = false;
let pendingEditableCommit = false;

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function isDeferredEditableTarget(target) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }

  return DEFERRED_EDIT_ACTIONS.has(target.dataset.action) && target.type !== "checkbox";
}

function markPendingEditableChange() {
  pendingEditableCommit = true;
  setSaveState("dirty");
  updateSaveIndicator();
}

function updateSaveIndicator() {
  const statusElement = document.querySelector(".toolbar-grid .save-indicator");

  if (!statusElement) {
    return;
  }

  statusElement.classList.toggle("is-dirty", uiState.saveState === "dirty" || uiState.saveState === "saving");
  statusElement.textContent = SAVE_LABEL_MAP[uiState.saveState] || "Ready";
}

function toggleLoading(isVisible) {
  const overlay = document.getElementById("loadingOverlay");
  overlay.classList.toggle("is-hidden", !isVisible);
  overlay.setAttribute("aria-hidden", String(!isVisible));
}

function setLoading(isVisible, message = "Preparing budget workspace...") {
  const overlay = document.getElementById("loadingOverlay");
  const messageElement = overlay.querySelector("p");
  messageElement.textContent = message;
  toggleLoading(isVisible);
}

function showToast(message) {
  const toastRegion = document.getElementById("toastRegion");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}

function syncImportMonth() {
  const availableMonths = getAvailableMonths();
  const firstDifferentMonth = availableMonths.find((month) => month !== getCurrentMonth());
  setImportMonth(firstDifferentMonth || getCurrentMonth());
}

function createRenderer(rootElement) {
  return () => renderApp(rootElement);
}

function createInteractionAwareRenderer() {
  return (rootElement) => {
    if (editableInputEventInProgress) {
      return;
    }

    renderApp(rootElement);
  };
}

async function persistBudgets(showToastMessage) {
  setSaveState("saving");
  updateSaveIndicator();

  try {
    await saveBudgets(getBudgetsSnapshot());
    setSaveState("saved");
    updateSaveIndicator();

    if (saveFlashTimeoutId) {
      clearTimeout(saveFlashTimeoutId);
    }

    saveFlashTimeoutId = window.setTimeout(() => {
      setSaveState("idle");
      updateSaveIndicator();
    }, 1600);
  } catch (error) {
    console.error("Failed to save shared budgets.", error);
    setSaveState("error");
    updateSaveIndicator();
    showToastMessage("Save failed. Changes remain in the current browser session.");
  }
}

function scheduleAutosave(showToastMessage) {
  setSaveState("dirty");
  updateSaveIndicator();

  if (autosaveTimeoutId) {
    clearTimeout(autosaveTimeoutId);
  }

  autosaveTimeoutId = window.setTimeout(() => {
    persistBudgets(showToastMessage);
  }, AUTOSAVE_DELAY_MS);
}

function bindEditableCommitGuards(rootElement) {
  rootElement.addEventListener(
    "input",
    (event) => {
      if (!isDeferredEditableTarget(event.target)) {
        return;
      }

      editableInputEventInProgress = true;
      markPendingEditableChange();

      queueMicrotask(() => {
        editableInputEventInProgress = false;
      });
    },
    true
  );

  rootElement.addEventListener(
    "change",
    (event) => {
      if (!pendingEditableCommit || !isDeferredEditableTarget(event.target)) {
        return;
      }

      pendingEditableCommit = false;
      scheduleAutosave(showToast);
    },
    true
  );
}

async function startApp() {
  const rootElement = document.getElementById("app");
  initializeState(getCurrentMonthValue());
  const renderCurrentView = createRenderer(rootElement);
  let currentMonthCreated = false;
  let storageReady = false;

  try {
    await initStorage();
    const sharedBudgets = await loadBudgets();
    setBudgets(sharedBudgets);
    storageReady = true;
  } catch (error) {
    console.error("Failed to load shared budgets.", error);
    setBudgets({});
    showToast("Shared data could not be loaded. Continuing with empty local data.");
  }

  currentMonthCreated = ensureCurrentMonth().created;
  syncImportMonth();
  renderCurrentView();
  bindEditableCommitGuards(rootElement);
  bindEvents(
    rootElement,
    createInteractionAwareRenderer(),
    { showToast, setLoading },
    () => {
      if (editableInputEventInProgress) {
        markPendingEditableChange();
        return;
      }

      scheduleAutosave(showToast);
    }
  );

  if (currentMonthCreated && storageReady) {
    scheduleAutosave(showToast);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  setLoading(true);
  await startApp();
  setLoading(false);
});
