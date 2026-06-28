import {
  addCreditCard,
  addCreditCardPurchase,
  addRow,
  applyLoanIncrease,
  cloneMonthCollection,
  deleteCreditCard,
  deleteCreditCardPurchase,
  deleteRow,
  getAvailableMonths,
  getCurrentMonth,
  getImportMonth,
  setActivePlanSubtab,
  setActiveTab,
  setCardBillPaid,
  setCurrentMonth,
  setImportMonth,
  setLoanIncreaseDraft,
  updateCreditCard,
  updateCreditCardPurchase,
  updateRow
} from "./state.js";

function toDataAttribute(key) {
  return key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function escapeAttribute(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return String(value).replaceAll('"', '\\"');
}

function captureFocus(target) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return null;
  }

  return {
    tagName: target.tagName.toLowerCase(),
    dataset: { ...target.dataset },
    selectionStart: typeof target.selectionStart === "number" ? target.selectionStart : null,
    selectionEnd: typeof target.selectionEnd === "number" ? target.selectionEnd : null
  };
}

function restoreFocus(rootElement, focusMeta) {
  if (!focusMeta) {
    return;
  }

  const selector = Object.entries(focusMeta.dataset)
    .map(([key, value]) => `[data-${toDataAttribute(key)}="${escapeAttribute(value)}"]`)
    .join("");
  const target = rootElement.querySelector(`${focusMeta.tagName}${selector}`);

  if (!target) {
    return;
  }

  target.focus();

  if (typeof target.setSelectionRange === "function" && focusMeta.selectionStart !== null && focusMeta.selectionEnd !== null) {
    target.setSelectionRange(focusMeta.selectionStart, focusMeta.selectionEnd);
  }
}

function rerender(renderApp, rootElement, focusMeta = null) {
  renderApp(rootElement);
  restoreFocus(rootElement, focusMeta);
}

function commitStateChange({ mutate, renderApp, rootElement, onDataChange, focusMeta = null }) {
  mutate();
  rerender(renderApp, rootElement, focusMeta);
  onDataChange();
}

function confirmDeletion(message, showToast) {
  const confirmed = window.confirm(message);

  if (!confirmed) {
    showToast("Delete canceled.");
  }

  return confirmed;
}

function handleMonthChange(target, renderApp, rootElement, onDataChange) {
  const { created } = setCurrentMonth(target.value);

  if (getImportMonth() === target.value) {
    const nextImportMonth = getAvailableMonths().find((month) => month !== target.value) || target.value;
    setImportMonth(nextImportMonth);
  }

  rerender(renderApp, rootElement);

  if (created) {
    onDataChange();
  }
}

export function bindEvents(rootElement, renderApp, uiActions, onDataChange) {
  const { showToast, setLoading } = uiActions;

  rootElement.addEventListener("click", (event) => {
    const actionElement = event.target.closest("[data-action]");

    if (!actionElement) {
      return;
    }

    const { action } = actionElement.dataset;

    if (action === "switch-tab") {
      setActiveTab(actionElement.dataset.tab);
      rerender(renderApp, rootElement);
      return;
    }

    if (action === "switch-plan-subtab") {
      setActivePlanSubtab(actionElement.dataset.subtab);
      rerender(renderApp, rootElement);
      return;
    }

    if (action === "add-row") {
      commitStateChange({
        mutate: () => addRow(actionElement.dataset.collection),
        renderApp,
        rootElement,
        onDataChange
      });
      return;
    }

    if (action === "delete-row") {
      if (!confirmDeletion("Delete this row?", showToast)) {
        return;
      }

      commitStateChange({
        mutate: () => deleteRow(actionElement.dataset.collection, actionElement.dataset.rowId),
        renderApp,
        rootElement,
        onDataChange
      });
      showToast("Row deleted.");
      return;
    }

    if (action === "add-credit-card") {
      commitStateChange({
        mutate: () => addCreditCard(),
        renderApp,
        rootElement,
        onDataChange
      });
      return;
    }

    if (action === "delete-credit-card") {
      if (!confirmDeletion("Delete this credit card and its generated bill for the month?", showToast)) {
        return;
      }

      commitStateChange({
        mutate: () => deleteCreditCard(actionElement.dataset.cardId),
        renderApp,
        rootElement,
        onDataChange
      });
      showToast("Credit card deleted.");
      return;
    }

    if (action === "add-purchase") {
      commitStateChange({
        mutate: () => addCreditCardPurchase(actionElement.dataset.cardId),
        renderApp,
        rootElement,
        onDataChange
      });
      return;
    }

    if (action === "delete-purchase") {
      if (!confirmDeletion("Delete this purchase installment row?", showToast)) {
        return;
      }

      commitStateChange({
        mutate: () => deleteCreditCardPurchase(actionElement.dataset.cardId, actionElement.dataset.rowId),
        renderApp,
        rootElement,
        onDataChange
      });
      showToast("Purchase deleted.");
      return;
    }

    if (action === "apply-loan-increase") {
      const applied = applyLoanIncrease(actionElement.dataset.loanId);

      if (!applied) {
        showToast("Enter a non-zero increase amount first.");
        return;
      }

      rerender(renderApp, rootElement);
      onDataChange();
      return;
    }

    if (action === "import-month-data") {
      const sourceMonth = getImportMonth();

      if (!sourceMonth || sourceMonth === getCurrentMonth()) {
        showToast("Select a different saved month to import from.");
        return;
      }

      setLoading(true, "Importing month data...");

      try {
        cloneMonthCollection(sourceMonth, actionElement.dataset.importType);
        rerender(renderApp, rootElement);
        onDataChange();
        showToast(`${actionElement.textContent.trim()} completed.`);
      } catch (error) {
        console.error("Import failed.", error);
        showToast("Import failed.");
      } finally {
        setLoading(false);
      }
    }
  });

  rootElement.addEventListener("change", (event) => {
    const target = event.target;
    const action = target.dataset.action;

    if (action === "change-month") {
      handleMonthChange(target, renderApp, rootElement, onDataChange);
      return;
    }

    if (action === "change-import-month") {
      setImportMonth(target.value);
      rerender(renderApp, rootElement);
      return;
    }

    if (action === "edit-checkbox") {
      commitStateChange({
        mutate: () => updateRow(target.dataset.collection, target.dataset.rowId, target.dataset.key, target.checked),
        renderApp,
        rootElement,
        onDataChange
      });
      return;
    }

    if (action === "toggle-card-bill-paid") {
      commitStateChange({
        mutate: () => setCardBillPaid(target.dataset.cardId, target.checked),
        renderApp,
        rootElement,
        onDataChange
      });
      return;
    }

    if (action === "edit-purchase-checkbox") {
      commitStateChange({
        mutate: () => updateCreditCardPurchase(target.dataset.cardId, target.dataset.purchaseId, target.dataset.key, target.checked),
        renderApp,
        rootElement,
        onDataChange
      });
      return;
    }

    if (action === "edit-field") {
      if (!(target instanceof HTMLSelectElement) && target.type !== "date") {
        return;
      }

      commitStateChange({
        mutate: () => updateRow(target.dataset.collection, target.dataset.rowId, target.dataset.key, target.value),
        renderApp,
        rootElement,
        onDataChange,
        focusMeta: captureFocus(target)
      });
      return;
    }

    if (action === "edit-card-field") {
      return;
    }

    if (action === "edit-purchase-field") {
      if (target.type === "checkbox") {
        return;
      }

      if (!(target instanceof HTMLSelectElement) && target.type !== "date") {
        return;
      }

      commitStateChange({
        mutate: () => updateCreditCardPurchase(target.dataset.cardId, target.dataset.purchaseId, target.dataset.key, target.value),
        renderApp,
        rootElement,
        onDataChange,
        focusMeta: captureFocus(target)
      });
    }
  });

  rootElement.addEventListener("input", (event) => {
    const target = event.target;
    const action = target.dataset.action;

    if (action === "edit-loan-increase") {
      setLoanIncreaseDraft(target.dataset.loanId, target.value);
      return;
    }

    if (action === "edit-field") {
      commitStateChange({
        mutate: () => updateRow(target.dataset.collection, target.dataset.rowId, target.dataset.key, target.value),
        renderApp,
        rootElement,
        onDataChange,
        focusMeta: captureFocus(target)
      });
      return;
    }

    if (action === "edit-card-field") {
      commitStateChange({
        mutate: () => updateCreditCard(target.dataset.cardId, target.dataset.key, target.value),
        renderApp,
        rootElement,
        onDataChange,
        focusMeta: captureFocus(target)
      });
      return;
    }

    if (action === "edit-purchase-field") {
      commitStateChange({
        mutate: () => updateCreditCardPurchase(target.dataset.cardId, target.dataset.purchaseId, target.dataset.key, target.value),
        renderApp,
        rootElement,
        onDataChange,
        focusMeta: captureFocus(target)
      });
    }
  });
}
