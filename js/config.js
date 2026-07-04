export const APP_TITLE = "Global Access Budget";

export const FIREBASE_CONFIG = {
  apiKey: ["AIzaSyCzemXQS40", "ea1PTJrIkLRTJ", "CmJysUXF2_w"].join(""),
  authDomain: "global-access-budget.firebaseapp.com",
  projectId: "global-access-budget",
  storageBucket: "global-access-budget.firebasestorage.app",
  messagingSenderId: "996912333170",
  appId: "1:996912333170:web:c199acfa4f5d111d65ddeb",
  measurementId: "G-7Z9CBPPC9E"
};

export const SHARED_DOCUMENT_ID = "Budget_Global_Shared_Master";

export const MAIN_TABS = [
  { id: "plan", label: "Plan" },
  { id: "expenses", label: "Expenses" },
  { id: "extract", label: "Budget Extract" }
];

export const PLAN_SUBTABS = [
  { id: "incoming-bills", label: "Incoming Bills" },
  { id: "credit-cards", label: "Credit Cards" }
];

export const BILL_CATEGORIES = [
  { value: "fixed", label: "Fixed" },
  { value: "semifixed", label: "Semi-Fixed" },
  { value: "extra", label: "Extra" }
];

export const IMPORT_ACTIONS = [
  { id: "plannedIncome", label: "Import Income" },
  { id: "plannedBills", label: "Import Bills" },
  { id: "fixed", label: "Import Fixed" },
  { id: "semFixed", label: "Import Semi-Fixed" }
];
