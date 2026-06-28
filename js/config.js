export const APP_TITLE = "Global Access Budget";
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
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
