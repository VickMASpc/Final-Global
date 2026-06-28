import {
  APP_TITLE,
  BILL_CATEGORIES,
  IMPORT_ACTIONS,
  MAIN_TABS,
  PLAN_SUBTABS
} from "./config.js";
import {
  calculateMonthsLeft,
  calculateTotals,
  deriveActualsFromPlan,
  deriveCreditCardBills,
  formatCurrency
} from "./calculations.js";
import {
  getAvailableMonths,
  getCurrentMonth,
  getCurrentMonthData,
  getImportMonth,
  getLoanIncreaseDraft,
  uiState
} from "./state.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMainTabs() {
  return MAIN_TABS.map(
    (tab) => `
      <button
        type="button"
        class="tab-button ${uiState.activeTab === tab.id ? "is-active" : ""}"
        data-action="switch-tab"
        data-tab="${tab.id}"
      >
        ${tab.label}
      </button>
    `
  ).join("");
}

function renderPlanSubtabs() {
  return PLAN_SUBTABS.map(
    (tab) => `
      <button
        type="button"
        class="subtab-button ${uiState.activePlanSubtab === tab.id ? "is-active" : ""}"
        data-action="switch-plan-subtab"
        data-subtab="${tab.id}"
      >
        ${tab.label}
      </button>
    `
  ).join("");
}

function renderInputCell({ attrs = {}, type = "text", value = "", placeholder = "", readOnly = false }) {
  const attributeString = Object.entries(attrs)
    .map(([key, attrValue]) => `${key}="${escapeHtml(attrValue)}"`)
    .join(" ");
  const numericAttributes = type === "number" ? ' min="0" inputmode="decimal"' : "";

  return `
    <input
      class="field ${readOnly ? "field-readonly" : ""}"
      type="${type}"
      value="${escapeHtml(value)}"
      placeholder="${escapeHtml(placeholder)}"
      ${readOnly ? "readonly" : ""}
      ${numericAttributes}
      ${attributeString}
    >
  `;
}

function renderSelectCell({ attrs = {}, value, options, disabled = false }) {
  const attributeString = Object.entries(attrs)
    .map(([key, attrValue]) => `${key}="${escapeHtml(attrValue)}"`)
    .join(" ");

  return `
    <select
      class="select-field ${disabled ? "field-readonly" : ""}"
      ${disabled ? "disabled" : ""}
      ${attributeString}
    >
      ${options
        .map(
          (option) => `
            <option value="${option.value}" ${option.value === value ? "selected" : ""}>
              ${option.label}
            </option>
          `
        )
        .join("")}
    </select>
  `;
}

function renderCheckboxCell({ attrs = {}, checked = false, disabled = false }) {
  const attributeString = Object.entries(attrs)
    .map(([key, attrValue]) => `${key}="${escapeHtml(attrValue)}"`)
    .join(" ");

  return `
    <div class="cell-checkbox">
      <input
        class="checkbox"
        type="checkbox"
        ${checked ? "checked" : ""}
        ${disabled ? "disabled" : ""}
        ${attributeString}
      >
    </div>
  `;
}

function renderDeleteCell({ collection, rowId, isDerived = false, action = "delete-row", cardId = "" }) {
  if (isDerived) {
    return `<span class="table-note">Derived</span>`;
  }

  const extraAttrs = cardId ? ` data-card-id="${escapeHtml(cardId)}"` : "";

  return `
    <button
      type="button"
      class="btn btn-danger"
      aria-label="Delete item"
      data-action="${action}"
      data-collection="${escapeHtml(collection)}"
      data-row-id="${escapeHtml(rowId)}"${extraAttrs}
    >
      Delete
    </button>
  `;
}

function renderStatusBadge(label, tone = "neutral") {
  return `<span class="status-badge status-${tone}">${label}</span>`;
}

function renderEmptyStateRow(message, columnCount) {
  return `
    <tr>
      <td colspan="${columnCount}">
        <div class="table-empty-state">${message}</div>
      </td>
    </tr>
  `;
}

function renderPlannedIncomeTable(monthState) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Planned Income</h2>
          <p>Checking received instantly derives readonly rows inside Received Income.</p>
        </div>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
              <th>Received</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            ${monthState.plannedIncome
              .map(
                (row) => `
                  <tr class="${row.received ? "row-highlight" : ""}">
                    <td>${renderInputCell({
                      value: row.description,
                      placeholder: "Salary, freelance, reimbursement...",
                      attrs: {
                        "aria-label": "Planned income description",
                        "data-action": "edit-field",
                        "data-collection": "plannedIncome",
                        "data-row-id": row.id,
                        "data-key": "description"
                      }
                    })}</td>
                    <td>${renderInputCell({
                      type: "number",
                      value: row.amount,
                      placeholder: "0.00",
                      attrs: {
                        "aria-label": "Planned income amount",
                        "data-action": "edit-field",
                        "data-collection": "plannedIncome",
                        "data-row-id": row.id,
                        "data-key": "amount"
                      }
                    })}</td>
                    <td>${renderCheckboxCell({
                      checked: row.received,
                      attrs: {
                        "aria-label": "Mark planned income as received",
                        "data-action": "edit-checkbox",
                        "data-collection": "plannedIncome",
                        "data-row-id": row.id,
                        "data-key": "received"
                      }
                    })}</td>
                    <td>${renderDeleteCell({ collection: "plannedIncome", rowId: row.id })}</td>
                  </tr>
                `
              )
              .join("") || renderEmptyStateRow("No planned income entries yet.", 4)}
          </tbody>
        </table>
      </div>
      <div class="table-actions">
        <button type="button" class="btn btn-primary" data-action="add-row" data-collection="plannedIncome">Add Planned Income</button>
      </div>
    </section>
  `;
}

function renderPlannedBillRow(row) {
  const isCardBill = row.source === "credit-card";

  return `
    <tr class="${row.paid ? "row-highlight" : ""} ${isCardBill ? "row-derived" : ""}">
      <td>
        ${renderInputCell({
          value: row.description,
          placeholder: "Rent, electricity, insurance...",
          readOnly: isCardBill,
          attrs: isCardBill
            ? {}
            : {
                "aria-label": "Planned bill description",
                "data-action": "edit-field",
                "data-collection": "plannedBills",
                "data-row-id": row.id,
                "data-key": "description"
              }
        })}
        ${isCardBill ? renderStatusBadge("Card Bill", "info") : ""}
      </td>
      <td>${renderInputCell({
        type: "number",
        value: row.amount,
        placeholder: "0.00",
        readOnly: isCardBill,
        attrs: isCardBill
          ? {}
          : {
              "aria-label": "Planned bill amount",
              "data-action": "edit-field",
              "data-collection": "plannedBills",
              "data-row-id": row.id,
              "data-key": "amount"
            }
      })}</td>
      <td>${renderInputCell({
        type: "date",
        value: row.dueDate,
        readOnly: isCardBill,
        attrs: isCardBill
          ? {}
          : {
              "aria-label": "Planned bill due date",
              "data-action": "edit-field",
              "data-collection": "plannedBills",
              "data-row-id": row.id,
              "data-key": "dueDate"
            }
      })}</td>
      <td>
        ${
          isCardBill
            ? renderInputCell({ value: "Semi-Fixed", readOnly: true })
            : renderSelectCell({
                value: row.category,
                options: BILL_CATEGORIES,
                attrs: {
                  "aria-label": "Planned bill category",
                  "data-action": "edit-field",
                  "data-collection": "plannedBills",
                  "data-row-id": row.id,
                  "data-key": "category"
                }
              })
        }
      </td>
      <td>${renderCheckboxCell({
        checked: row.paid,
        attrs: isCardBill
          ? {
              "aria-label": "Mark generated card bill as paid",
              "data-action": "toggle-card-bill-paid",
              "data-card-id": row.linkedCardId
            }
          : {
              "aria-label": "Mark planned bill as paid",
              "data-action": "edit-checkbox",
              "data-collection": "plannedBills",
              "data-row-id": row.id,
              "data-key": "paid"
            }
      })}</td>
      <td>${renderDeleteCell({
        collection: "plannedBills",
        rowId: row.id,
        isDerived: isCardBill
      })}</td>
    </tr>
  `;
}

function renderBillsTable(monthState) {
  const allPlannedBills = [...monthState.plannedBills, ...deriveCreditCardBills(monthState)];

  return `
    <div class="subtab-panel ${uiState.activePlanSubtab === "incoming-bills" ? "is-active" : ""}" data-subtab-panel="incoming-bills">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Incoming Bills</h3>
            <p>Paid bills derive readonly expense rows in the matching expense table.</p>
          </div>
        </div>
        <div class="table-shell">
          <table class="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Category</th>
                <th>Paid</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              ${allPlannedBills.map(renderPlannedBillRow).join("") || renderEmptyStateRow("No planned bills yet.", 6)}
            </tbody>
          </table>
        </div>
        <div class="table-actions">
          <button type="button" class="btn btn-primary" data-action="add-row" data-collection="plannedBills">Add Bill</button>
        </div>
      </section>
    </div>
  `;
}

function renderCardPurchaseRows(card) {
  return card.purchases
    .map(
      (purchase) => `
        <tr class="${purchase.finished ? "row-muted" : ""}">
          <td>${renderInputCell({
            value: purchase.description,
            placeholder: "Laptop, trip, office chair...",
            attrs: {
              "aria-label": "Credit card purchase description",
              "data-action": "edit-purchase-field",
              "data-card-id": card.id,
              "data-purchase-id": purchase.id,
              "data-key": "description"
            }
          })}</td>
          <td>${renderInputCell({
            type: "number",
            value: purchase.totalAmount,
            placeholder: "0.00",
            attrs: {
              "aria-label": "Credit card purchase total amount",
              "data-action": "edit-purchase-field",
              "data-card-id": card.id,
              "data-purchase-id": purchase.id,
              "data-key": "totalAmount"
            }
          })}</td>
          <td>${renderInputCell({
            type: "number",
            value: purchase.installmentsCurrent,
            attrs: {
              "aria-label": "Current installment number",
              "data-action": "edit-purchase-field",
              "data-card-id": card.id,
              "data-purchase-id": purchase.id,
              "data-key": "installmentsCurrent"
            }
          })}</td>
          <td>${renderInputCell({
            type: "number",
            value: purchase.installmentsTotal,
            attrs: {
              "aria-label": "Total installment count",
              "data-action": "edit-purchase-field",
              "data-card-id": card.id,
              "data-purchase-id": purchase.id,
              "data-key": "installmentsTotal"
            }
          })}</td>
          <td>${renderCheckboxCell({
            checked: purchase.finished,
            attrs: {
              "aria-label": "Mark credit card purchase finished",
              "data-action": "edit-purchase-checkbox",
              "data-card-id": card.id,
              "data-purchase-id": purchase.id,
              "data-key": "finished"
            }
          })}</td>
          <td>${renderDeleteCell({
            collection: "creditCardPurchases",
            rowId: purchase.id,
            action: "delete-purchase",
            cardId: card.id
          })}</td>
        </tr>
      `
    )
    .join("");
}

function renderCreditCards(monthState) {
  const generatedBills = deriveCreditCardBills(monthState);

  return `
    <div class="subtab-panel ${uiState.activePlanSubtab === "credit-cards" ? "is-active" : ""}" data-subtab-panel="credit-cards">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Credit Cards</h3>
            <p>Monthly bills are generated automatically from active installment purchases.</p>
          </div>
          <button type="button" class="btn btn-primary" data-action="add-credit-card">Add Credit Card Account</button>
        </div>
        <div class="credit-card-stack">
          ${
            monthState.creditCards.length
              ? monthState.creditCards
                  .map((card) => {
                    const generatedBill = generatedBills.find((bill) => bill.linkedCardId === card.id);

                    return `
                      <article class="credit-card-panel">
                        <div class="panel-header">
                          <div>
                            <h3>${escapeHtml(card.name || "Credit Card")}</h3>
                            <p>Monthly bill: <strong>${formatCurrency(generatedBill?.amount || 0)}</strong></p>
                          </div>
                          <div class="button-row">
                            ${card.billPaidThisMonth ? renderStatusBadge("Bill Paid", "success") : renderStatusBadge("Bill Open", "warning")}
                            <button type="button" class="btn btn-danger" data-action="delete-credit-card" data-card-id="${escapeHtml(card.id)}">Delete Card</button>
                          </div>
                        </div>
                        <div class="credit-card-meta">
                          <div>
                            <label class="control-label">Card Name</label>
                            ${renderInputCell({
                              value: card.name,
                              placeholder: "Card name",
                              attrs: {
                                "aria-label": "Credit card name",
                                "data-action": "edit-card-field",
                                "data-card-id": card.id,
                                "data-key": "name"
                              }
                            })}
                          </div>
                          <div>
                            <label class="control-label">Bill Status</label>
                            <div class="save-indicator ${card.billPaidThisMonth ? "" : "is-dirty"}">
                              ${card.billPaidThisMonth ? "Paid This Month" : "Awaiting Payment"}
                            </div>
                          </div>
                        </div>
                        <div class="table-shell">
                          <table class="data-table">
                            <thead>
                              <tr>
                                <th>Description</th>
                                <th>Total Amount</th>
                                <th>Current Installment</th>
                                <th>Total Installments</th>
                                <th>Finished</th>
                                <th>Delete</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${renderCardPurchaseRows(card) || renderEmptyStateRow("No card purchases yet.", 6)}
                            </tbody>
                          </table>
                        </div>
                        <div class="table-actions">
                          <button type="button" class="btn btn-primary" data-action="add-purchase" data-card-id="${escapeHtml(card.id)}">Add Purchase</button>
                        </div>
                      </article>
                    `;
                  })
                  .join("")
              : `<div class="empty-state">
                  <strong>No credit card accounts yet.</strong>
                  <p>Add a card, then enter installment purchases to generate its monthly bill automatically.</p>
                </div>`
          }
        </div>
      </section>
    </div>
  `;
}

function renderPlanTab(monthState) {
  return `
    <div class="tab-panel ${uiState.activeTab === "plan" ? "is-active" : ""}" data-tab-panel="plan">
      <div class="stack">
        ${renderPlannedIncomeTable(monthState)}
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Plan Details</h2>
              <p>Incoming bills and credit card bills both feed the actual expense tables.</p>
            </div>
          </div>
          <div class="subtab-list" role="tablist" aria-label="Plan detail tabs">
            ${renderPlanSubtabs()}
          </div>
          <div class="stack plan-stack">
            ${renderBillsTable(monthState)}
            ${renderCreditCards(monthState)}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderActualRow(collection, row) {
  return `
    <tr class="${row.derived ? "row-derived row-highlight" : ""}">
      <td>
        ${renderInputCell({
          value: row.description,
          readOnly: row.derived,
          placeholder: "Description",
          attrs: row.derived
            ? {}
            : {
                "aria-label": `${collection} description`,
                "data-action": "edit-field",
                "data-collection": collection,
                "data-row-id": row.id,
                "data-key": "description"
              }
        })}
        ${row.derived ? renderStatusBadge("Derived", row.derivedType === "credit-card-bill" ? "info" : "neutral") : renderStatusBadge("Manual", "neutral")}
      </td>
      <td>${renderInputCell({
        type: "number",
        value: row.amount,
        readOnly: row.derived,
        placeholder: "0.00",
        attrs: row.derived
          ? {}
          : {
              "aria-label": `${collection} amount`,
              "data-action": "edit-field",
              "data-collection": collection,
              "data-row-id": row.id,
              "data-key": "amount"
            }
      })}</td>
      <td>${renderDeleteCell({ collection, rowId: row.id, isDerived: row.derived })}</td>
    </tr>
  `;
}

function renderExpenseTable({ title, description, collection, rows, addLabel }) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
      </div>
      <div class="table-shell">
        <table class="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => renderActualRow(collection, row)).join("") || renderEmptyStateRow(`No ${title.toLowerCase()} yet.`, 3)}
          </tbody>
        </table>
      </div>
      <div class="table-actions">
        <button type="button" class="btn btn-primary" data-action="add-row" data-collection="${collection}">${addLabel}</button>
      </div>
    </section>
  `;
}

function renderLoansTable(monthState) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Long-Lasting Expenses / Loans</h2>
          <p>Increase amounts adjust principal immediately and months left recalculates from state.</p>
        </div>
      </div>
      <div class="table-shell">
        <table class="data-table loan-table">
          <thead>
            <tr>
              <th>Loan Name</th>
              <th>Amount Left</th>
              <th>Monthly Payment</th>
              <th>Months Left</th>
              <th>Increase Amount</th>
              <th>Apply</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            ${monthState.loans
              .map(
                (row) => `
                  <tr>
                    <td>${renderInputCell({
                      value: row.name,
                      placeholder: "Student loan, vehicle loan...",
                      attrs: {
                        "aria-label": "Loan name",
                        "data-action": "edit-field",
                        "data-collection": "loans",
                        "data-row-id": row.id,
                        "data-key": "name"
                      }
                    })}</td>
                    <td>${renderInputCell({
                      type: "number",
                      value: row.amountLeft,
                      placeholder: "0.00",
                      attrs: {
                        "aria-label": "Loan amount left",
                        "data-action": "edit-field",
                        "data-collection": "loans",
                        "data-row-id": row.id,
                        "data-key": "amountLeft"
                      }
                    })}</td>
                    <td>${renderInputCell({
                      type: "number",
                      value: row.monthlyPayment,
                      placeholder: "0.00",
                      attrs: {
                        "aria-label": "Loan monthly payment",
                        "data-action": "edit-field",
                        "data-collection": "loans",
                        "data-row-id": row.id,
                        "data-key": "monthlyPayment"
                      }
                    })}</td>
                    <td><input class="field field-readonly" type="text" readonly value="${calculateMonthsLeft(row.amountLeft, row.monthlyPayment)}"></td>
                    <td>${renderInputCell({
                      type: "number",
                      value: getLoanIncreaseDraft(row.id),
                      placeholder: "0.00",
                      attrs: {
                        "aria-label": "Increase loan amount",
                        "data-action": "edit-loan-increase",
                        "data-loan-id": row.id
                      }
                    })}</td>
                    <td><button type="button" class="btn btn-secondary" data-action="apply-loan-increase" data-loan-id="${escapeHtml(row.id)}">Apply</button></td>
                    <td>${renderDeleteCell({ collection: "loans", rowId: row.id })}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="table-actions">
        <button type="button" class="btn btn-primary" data-action="add-row" data-collection="loans">Add Loan</button>
      </div>
    </section>
  `;
}

function renderExpensesTab(monthState) {
  const actuals = deriveActualsFromPlan(monthState);

  return `
    <div class="tab-panel ${uiState.activeTab === "expenses" ? "is-active" : ""}" data-tab-panel="expenses">
      <div class="stack">
        ${renderExpenseTable({
          title: "Received Income",
          description: "Manual income entries can coexist with readonly income derived from planned items.",
          collection: "income",
          rows: actuals.income,
          addLabel: "Add Received Income"
        })}
        ${renderExpenseTable({
          title: "Fixed Expenses",
          description: "Paid fixed planned bills appear here as readonly derived rows.",
          collection: "fixed",
          rows: actuals.fixed,
          addLabel: "Add Fixed Expense"
        })}
        ${renderExpenseTable({
          title: "Semi-Fixed Expenses",
          description: "Semi-fixed planned bills and paid card bills appear here automatically.",
          collection: "semFixed",
          rows: actuals.semFixed,
          addLabel: "Add Semi-Fixed Expense"
        })}
        ${renderExpenseTable({
          title: "Extra Expenses",
          description: "Paid extra planned bills appear here as derived expense rows.",
          collection: "extra",
          rows: actuals.extra,
          addLabel: "Add Extra Expense"
        })}
        ${renderLoansTable(monthState)}
      </div>
    </div>
  `;
}

function renderExtractTab(monthState) {
  const totals = calculateTotals(monthState);

  return `
    <div class="tab-panel ${uiState.activeTab === "extract" ? "is-active" : ""}" data-tab-panel="extract">
      <section class="section-header">
        <h2>Budget Extract</h2>
        <p>Totals are calculated directly from state, including derived actuals and monthly loan payments.</p>
      </section>
      <div class="summary-grid">
        ${[
          ["Total Received Income", totals.totalIncome, "neutral"],
          ["Fixed Expenses", totals.totalFixed, "neutral"],
          ["Semi-Fixed Expenses", totals.totalSemiFixed, "neutral"],
          ["Total Extra Expenses", totals.totalExtra, "neutral"],
          ["Total Expenses", totals.totalExpenses, "neutral"],
          ["Final Balance", totals.finalBalance, totals.finalBalance >= 0 ? "positive" : "negative"]
        ]
          .map(
            ([label, value, tone]) => `
              <article class="summary-card ${tone === "positive" ? "summary-positive" : ""} ${tone === "negative" ? "summary-negative" : ""}">
                <p class="summary-label">${label}</p>
                <p class="summary-value">${formatCurrency(value)}</p>
                <p class="summary-note">${tone === "negative" ? "Expenses exceed income." : tone === "positive" ? "Income remains above total expenses." : "Live state-based calculation."}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderHeader() {
  const availableMonths = getAvailableMonths();
  const importMonth = getImportMonth();
  const saveLabelMap = {
    idle: "Ready",
    dirty: "Changes pending",
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed"
  };

  return `
    <header class="page-header">
      <div class="title-block">
        <h1>${APP_TITLE}</h1>
        <p>Shared monthly budgeting workspace with derived actuals, installment card billing, and state-driven totals.</p>
      </div>
      <div class="toolbar-grid">
        <section class="control-card">
          <label for="monthPicker">Month</label>
          <input id="monthPicker" class="field" type="month" value="${getCurrentMonth()}" data-action="change-month">
        </section>
        <section class="control-card">
          <span class="control-label">Save Status</span>
          <div class="save-indicator ${uiState.saveState === "dirty" || uiState.saveState === "saving" ? "is-dirty" : ""}">
            ${saveLabelMap[uiState.saveState] || "Ready"}
          </div>
        </section>
        <section class="control-card">
          <label for="importMonthPicker">Import From Month</label>
          <select id="importMonthPicker" class="select-field" data-action="change-import-month">
            ${availableMonths
              .map(
                (month) => `
                  <option value="${month}" ${month === importMonth ? "selected" : ""}>
                    ${month}
                  </option>
                `
              )
              .join("") || renderEmptyStateRow("No loans added yet.", 7)}
          </select>
        </section>
        <section class="control-card">
          <span class="control-label">Import Actions</span>
          <div class="button-row">
            ${IMPORT_ACTIONS.map(
              (action) => `
                <button type="button" class="btn btn-secondary" data-action="import-month-data" data-import-type="${action.id}">
                  ${action.label}
                </button>
              `
            ).join("")}
          </div>
        </section>
      </div>
    </header>
  `;
}

export function renderApp(rootElement) {
  const monthState = getCurrentMonthData();

  rootElement.innerHTML = `
    ${renderHeader()}
    <main class="content-shell">
      <div class="tab-list" role="tablist" aria-label="Main budget sections">
        ${renderMainTabs()}
      </div>
      ${renderPlanTab(monthState)}
      ${renderExpensesTab(monthState)}
      ${renderExtractTab(monthState)}
    </main>
  `;
}
