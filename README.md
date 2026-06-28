# Global Access Budget

Static shared budgeting app built with plain HTML, CSS, and vanilla JavaScript.

## Static App Only

- No framework
- No build tools
- No backend server
- No authentication
- No per-user storage
- Deployable as static files

You can host the project on any static hosting platform that can serve ES modules and allow browser access to Firebase.

## Firebase Setup

Edit [js/config.js](C:/Users/Victor/Documents/Finance/js/config.js) and replace the placeholder `FIREBASE_CONFIG` values:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`

The app uses one shared Firestore document for everyone:

- `artifacts/{appId}/users/Budget_Global_Shared_Master/budgets/allData`

There is no login and no per-user split. All users read and write the same shared budget dataset.

## Running Locally

You can run the app in either of these ways:

1. Open [index.html](C:/Users/Victor/Documents/Finance/index.html) directly in a browser.
2. Use a simple static server, for example:

```powershell
cd C:\Users\Victor\Documents\Finance
python -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

Using a static server is preferred when testing module loading and Firebase behavior.

## File Structure

- [index.html](C:/Users/Victor/Documents/Finance/index.html): app shell
- [css/styles.css](C:/Users/Victor/Documents/Finance/css/styles.css): visual system and responsive layout
- [js/config.js](C:/Users/Victor/Documents/Finance/js/config.js): Firebase and global constants only
- [js/state.js](C:/Users/Victor/Documents/Finance/js/state.js): state schema, normalization, access, and mutations
- [js/storage.js](C:/Users/Victor/Documents/Finance/js/storage.js): Firebase load and save only
- [js/calculations.js](C:/Users/Victor/Documents/Finance/js/calculations.js): pure derivations and totals
- [js/render.js](C:/Users/Victor/Documents/Finance/js/render.js): DOM rendering only
- [js/events.js](C:/Users/Victor/Documents/Finance/js/events.js): delegated event handling and user actions
- [js/app.js](C:/Users/Victor/Documents/Finance/js/app.js): startup orchestration, autosave, loading, and toast plumbing

## Core Features

- Shared month-based budget data stored in Firestore
- Planned income that derives readonly actual received-income rows
- Planned bills that derive readonly actual expense rows when paid
- Credit cards with installment purchases and generated monthly bills
- Card bill payment flowing into Semi-Fixed Expenses
- Month carry-over for unfinished credit card installments
- Loan tracking with immediate months-left recalculation
- Import selected collections from another saved month
- Autosave with visible save state

## Manual Test Checklist

- Add planned income, mark it received, verify readonly actual income appears and totals update.
- Add a planned bill, mark it paid, verify the readonly expense appears in the correct actual table and totals update.
- Add a credit card purchase, verify the card generates a monthly planned bill.
- Mark the generated credit card bill as paid, verify it appears in Semi-Fixed Expenses.
- Switch months, verify each month keeps separate data.
- Import income, bills, fixed expenses, or semi-fixed expenses from a previous month.
- Create a new month after card purchases exist, verify unfinished installments carry over and `installmentsCurrent` advances.
- Add a loan, set `amountLeft` and `monthlyPayment`, then increase the amount and verify months left recalculates.
- Refresh the page and verify Firestore-backed data reloads when valid Firebase config is in place.

## Notes

- If Firebase is not configured or Firestore is unavailable, the app continues locally for the current session and shows a load or save toast.
- Derived rows are intentionally readonly and cannot be manually deleted.
