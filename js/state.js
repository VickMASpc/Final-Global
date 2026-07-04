import { carryOverFromPreviousMonth } from "./calculations.js";

let budgets = {};
let idCounter = 0;

export const uiState = {
  currentMonth: "",
  importMonth: "",
  activeTab: "plan",
  activePlanSubtab: "incoming-bills",
  saveState: "idle",
  loanIncreaseDrafts: {}
};

export function createMonthState() {
  return {
    plannedIncome: [],
    plannedBills: [],
    creditCards: [],
    income: [],
    fixed: [],
    semFixed: [],
    extra: [],
    loans: []
  };
}

function createStableId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCreditCard() {
  return {
    id: createStableId("card"),
    name: "New Card",
    billPaidThisMonth: false,
    purchases: []
  };
}

function createCreditCardPurchase() {
  return {
    id: createStableId("purchase"),
    description: "",
    totalAmount: "",
    installmentsCurrent: 1,
    installmentsTotal: 1,
    finished: false
  };
}

function createRow(collection) {
  switch (collection) {
    case "plannedIncome":
      return {
        id: createStableId("planned-income"),
        description: "",
        amount: "",
        received: false
      };
    case "plannedBills":
      return {
        id: createStableId("planned-bill"),
        description: "",
        amount: "",
        dueDate: "",
        category: "fixed",
        paid: false
      };
    case "income":
      return {
        id: createStableId("income"),
        description: "",
        amount: ""
      };
    case "fixed":
    case "semFixed":
    case "extra":
      return {
        id: createStableId(collection),
        description: "",
        amount: ""
      };
    case "loans":
      return {
        id: createStableId("loan"),
        name: "",
        amountLeft: "",
        monthlyPayment: ""
      };
    default:
      return {
        id: createStableId("row")
      };
  }
}

function isValidMonthKey(monthKey) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);
}

function normalizeText(value) {
  return value ?? "";
}

function normalizeMoneyString(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(Math.max(0, numericValue));
}

function normalizePlannedIncomeRow(item) {
  return {
    id: item.id || createRow("plannedIncome").id,
    description: normalizeText(item.description ?? item.source),
    amount: normalizeMoneyString(item.amount),
    received: Boolean(item.received)
  };
}

function normalizePlannedBillRow(item) {
  const rawCategory = normalizeText(item.category || "fixed").toLowerCase().replaceAll("-", "");
  const category = rawCategory === "semifixed" ? "semifixed" : rawCategory === "extra" ? "extra" : "fixed";

  return {
    id: item.id || createRow("plannedBills").id,
    description: normalizeText(item.description ?? item.bill),
    amount: normalizeMoneyString(item.amount),
    dueDate: normalizeText(item.dueDate),
    category,
    paid: Boolean(item.paid)
  };
}

function normalizeActualRow(item, collection) {
  return {
    id: item.id || createRow(collection).id,
    description: normalizeText(item.description ?? item.source ?? item.name),
    amount: normalizeMoneyString(item.amount)
  };
}

function normalizeLoanRow(item) {
  return {
    id: item.id || createRow("loans").id,
    name: normalizeText(item.name ?? item.loanName),
    amountLeft: normalizeMoneyString(item.amountLeft),
    monthlyPayment: normalizeMoneyString(item.monthlyPayment)
  };
}

function normalizePurchaseRow(item) {
  const installmentsTotal = Math.max(1, Number(item.installmentsTotal) || 1);

  return {
    id: item.id || createCreditCardPurchase().id,
    description: normalizeText(item.description),
    totalAmount: normalizeMoneyString(item.totalAmount),
    installmentsCurrent: Math.max(1, Number(item.installmentsCurrent) || 1),
    installmentsTotal,
    finished: Boolean(item.finished)
  };
}

function normalizeCreditCard(card) {
  return {
    id: card.id || createCreditCard().id,
    name: normalizeText(card.name),
    billPaidThisMonth: Boolean(card.billPaidThisMonth),
    purchases: Array.isArray(card.purchases) ? card.purchases.map(normalizePurchaseRow) : []
  };
}

function normalizeMonthData(monthData) {
  const base = createMonthState();
  const source = monthData && typeof monthData === "object" ? monthData : {};

  return {
    plannedIncome: Array.isArray(source.plannedIncome) ? source.plannedIncome.map(normalizePlannedIncomeRow) : base.plannedIncome,
    plannedBills: Array.isArray(source.plannedBills) ? source.plannedBills.filter((item) => item?.source !== "credit-card").map(normalizePlannedBillRow) : base.plannedBills,
    creditCards: Array.isArray(source.creditCards) ? source.creditCards.map(normalizeCreditCard) : base.creditCards,
    income: Array.isArray(source.income) ? source.income.filter((item) => !item?.derived).map((item) => normalizeActualRow(item, "income")) : base.income,
    fixed: Array.isArray(source.fixed) ? source.fixed.filter((item) => !item?.derived).map((item) => normalizeActualRow(item, "fixed")) : base.fixed,
    semFixed: Array.isArray(source.semFixed) ? source.semFixed.filter((item) => !item?.derived).map((item) => normalizeActualRow(item, "semFixed")) : base.semFixed,
    extra: Array.isArray(source.extra) ? source.extra.filter((item) => !item?.derived).map((item) => normalizeActualRow(item, "extra")) : base.extra,
    loans: Array.isArray(source.loans) ? source.loans.map(normalizeLoanRow) : base.loans
  };
}

function normalizeBudgets(nextBudgets) {
  if (!nextBudgets || typeof nextBudgets !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(nextBudgets)
      .filter(([monthKey]) => isValidMonthKey(monthKey))
      .map(([monthKey, monthData]) => [monthKey, normalizeMonthData(monthData)])
  );
}

function normalizeNonNegativeInput(value) {
  if (value === "") {
    return "";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(Math.max(0, numericValue));
}

function clearLoanIncreaseDraft(loanId) {
  delete uiState.loanIncreaseDrafts[loanId];
}

export function getCurrentMonth() {
  return uiState.currentMonth;
}

export function setCurrentMonth(month) {
  if (!isValidMonthKey(month)) {
    return ensureCurrentMonth();
  }

  uiState.currentMonth = month;
  return ensureCurrentMonth();
}

export function getImportMonth() {
  return uiState.importMonth;
}

export function setImportMonth(month) {
  uiState.importMonth = month;
}

export function getBudgets() {
  return budgets;
}

export function setBudgets(nextBudgets) {
  budgets = normalizeBudgets(nextBudgets);
}

export function ensureMonth(monthKey) {
  const existed = Boolean(budgets[monthKey]);

  if (!existed) {
    budgets[monthKey] = normalizeMonthData(carryOverFromPreviousMonth(budgets, monthKey));
  }

  return {
    monthData: budgets[monthKey],
    created: !existed
  };
}

export function initializeState(initialMonth) {
  uiState.currentMonth = initialMonth;
  uiState.importMonth = initialMonth;
  ensureMonth(initialMonth);
}

export function getCurrentMonthData() {
  return ensureMonth(uiState.currentMonth).monthData;
}

export function ensureCurrentMonth() {
  return ensureMonth(uiState.currentMonth);
}

export function setActiveTab(tabId) {
  uiState.activeTab = tabId;
}

export function setActivePlanSubtab(subtabId) {
  uiState.activePlanSubtab = subtabId;
}

export function setSaveState(status) {
  uiState.saveState = status;
}

export function addRow(collection) {
  const monthState = getCurrentMonthData();
  const row = createRow(collection);
  monthState[collection].push(row);
  return row;
}

export function setAllPlannedIncomeReceived(received) {
  const monthState = getCurrentMonthData();
  monthState.plannedIncome.forEach((row) => {
    row.received = Boolean(received);
  });
}

export function setAllPlannedBillsPaid(paid) {
  const monthState = getCurrentMonthData();
  monthState.plannedBills.forEach((row) => {
    row.paid = Boolean(paid);
  });
}

export function deleteRow(collection, rowId) {
  const monthState = getCurrentMonthData();
  monthState[collection] = monthState[collection].filter((item) => item.id !== rowId);

  if (collection === "loans") {
    clearLoanIncreaseDraft(rowId);
  }
}

export function getAvailableMonths() {
  return Object.keys(budgets).sort((left, right) => right.localeCompare(left));
}

export function cloneMonthCollection(sourceMonth, collection) {
  const source = ensureMonth(sourceMonth).monthData;
  const current = getCurrentMonthData();
  current[collection] = structuredClone(source[collection] || []);
}

export function addCreditCard() {
  const monthState = getCurrentMonthData();
  const card = createCreditCard();
  monthState.creditCards.push(card);
  return card;
}

export function deleteCreditCard(cardId) {
  const monthState = getCurrentMonthData();
  monthState.creditCards = monthState.creditCards.filter((card) => card.id !== cardId);
}

export function updateCreditCard(cardId, key, value) {
  const monthState = getCurrentMonthData();
  const card = monthState.creditCards.find((item) => item.id === cardId);

  if (!card) {
    return;
  }

  card[key] = value;
}

export function addCreditCardPurchase(cardId) {
  const monthState = getCurrentMonthData();
  const card = monthState.creditCards.find((item) => item.id === cardId);

  if (!card) {
    return null;
  }

  const purchase = createCreditCardPurchase();
  card.purchases.push(purchase);
  return purchase;
}

export function setAllCreditCardPurchasesFinished(cardId, finished) {
  const monthState = getCurrentMonthData();
  const card = monthState.creditCards.find((item) => item.id === cardId);

  if (!card) {
    return;
  }

  card.purchases.forEach((purchase) => {
    purchase.finished = Boolean(finished);
  });
}

export function updateCreditCardPurchase(cardId, purchaseId, key, value) {
  const monthState = getCurrentMonthData();
  const card = monthState.creditCards.find((item) => item.id === cardId);

  if (!card) {
    return;
  }

  const purchase = card.purchases.find((item) => item.id === purchaseId);

  if (!purchase) {
    return;
  }

  if (key === "finished") {
    purchase[key] = Boolean(value);
    return;
  }

  if (key === "totalAmount") {
    purchase[key] = normalizeNonNegativeInput(value);
    return;
  }

  if (key === "installmentsCurrent" || key === "installmentsTotal") {
    const normalizedValue = Math.max(1, Number(value) || 1);
    purchase[key] = normalizedValue;

    if (key === "installmentsTotal" && purchase.installmentsCurrent > normalizedValue) {
      purchase.installmentsCurrent = normalizedValue;
    }

    return;
  }

  purchase[key] = value;
}

export function deleteCreditCardPurchase(cardId, purchaseId) {
  const monthState = getCurrentMonthData();
  const card = monthState.creditCards.find((item) => item.id === cardId);

  if (!card) {
    return;
  }

  card.purchases = card.purchases.filter((purchase) => purchase.id !== purchaseId);
}

export function setCardBillPaid(cardId, paid) {
  updateCreditCard(cardId, "billPaidThisMonth", Boolean(paid));
}

export function getLoanIncreaseDraft(loanId) {
  return uiState.loanIncreaseDrafts[loanId] || "";
}

export function setLoanIncreaseDraft(loanId, value) {
  uiState.loanIncreaseDrafts[loanId] = normalizeNonNegativeInput(value);
}

export function applyLoanIncrease(loanId) {
  const draftValue = Number(getLoanIncreaseDraft(loanId)) || 0;
  const monthState = getCurrentMonthData();
  const loan = monthState.loans.find((item) => item.id === loanId);

  if (!loan || draftValue === 0) {
    return false;
  }

  loan.amountLeft = String((Number(loan.amountLeft) || 0) + draftValue);
  clearLoanIncreaseDraft(loanId);
  return true;
}

export function updateRow(collection, rowId, key, value) {
  const monthState = getCurrentMonthData();
  const row = monthState[collection].find((item) => item.id === rowId);

  if (!row) {
    return;
  }

  if (["amount", "amountLeft", "monthlyPayment"].includes(key)) {
    row[key] = normalizeNonNegativeInput(value);
    return;
  }

  row[key] = typeof row[key] === "boolean" ? Boolean(value) : value;
}

export function getBudgetsSnapshot() {
  return normalizeBudgets(budgets);
}
