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
  setSaveState
} from "./state.js";
import { initStorage, loadBudgets, saveBudgets } from "./storage.js";

const AUTOSAVE_DELAY_MS = 1000;
let autosaveTimeoutId = null;
let saveFlashTimeoutId = null;

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

async function persistBudgets(renderCurrentView, showToastMessage) {
  setSaveState("saving");
  renderCurrentView();

  try {
    await saveBudgets(getBudgetsSnapshot());
    setSaveState("saved");
    renderCurrentView();

    if (saveFlashTimeoutId) {
      clearTimeout(saveFlashTimeoutId);
    }

    saveFlashTimeoutId = window.setTimeout(() => {
      setSaveState("idle");
      renderCurrentView();
    }, 1600);
  } catch (error) {
    console.error("Failed to save shared budgets.", error);
    setSaveState("error");
    renderCurrentView();
    showToastMessage("Save failed. Changes remain in the current browser session.");
  }
}

function scheduleAutosave(renderCurrentView, showToastMessage) {
  setSaveState("dirty");
  renderCurrentView();

  if (autosaveTimeoutId) {
    clearTimeout(autosaveTimeoutId);
  }

  autosaveTimeoutId = window.setTimeout(() => {
    persistBudgets(renderCurrentView, showToastMessage);
  }, AUTOSAVE_DELAY_MS);
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
  bindEvents(
    rootElement,
    (root) => renderApp(root),
    { showToast, setLoading },
    () => scheduleAutosave(renderCurrentView, showToast)
  );

  if (currentMonthCreated && storageReady) {
    scheduleAutosave(renderCurrentView, showToast);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  setLoading(true);
  await startApp();
  setLoading(false);
});
