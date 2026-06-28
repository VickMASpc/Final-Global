function emptyMonthData() {
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

export function money(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(2));
}

export function sumAmounts(items) {
  return money(items.reduce((total, item) => total + money(item.amount), 0));
}

function getPreviousMonthKey(monthKey) {
  const [yearString, monthString] = monthKey.split("-");
  const year = Number(yearString);
  const month = Number(monthString);

  if (!year || !month) {
    return "";
  }

  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = previousDate.getUTCFullYear();
  const previousMonth = String(previousDate.getUTCMonth() + 1).padStart(2, "0");
  return `${previousYear}-${previousMonth}`;
}

function createDerivedIncomeRow(item) {
  return {
    id: `derived-income-${item.id}`,
    description: item.description,
    amount: money(item.amount),
    derived: true,
    derivedType: "planned-income",
    linkedId: item.id
  };
}

function createDerivedExpenseRow(item, category) {
  return {
    id: `derived-expense-${item.id}`,
    description: item.description,
    amount: money(item.amount),
    derived: true,
    derivedType: item.source === "credit-card" ? "credit-card-bill" : "planned-bill",
    linkedId: item.id,
    linkedCardId: item.linkedCardId || "",
    category
  };
}

export function deriveCreditCardBills(monthData) {
  return monthData.creditCards
    .map((card) => {
      const amount = money(
        card.purchases.reduce((total, purchase) => {
          if (purchase.finished) {
            return total;
          }

          const currentInstallment = Number(purchase.installmentsCurrent);
          const totalInstallments = Number(purchase.installmentsTotal);

          if (!totalInstallments || currentInstallment > totalInstallments) {
            return total;
          }

          return total + money(purchase.totalAmount) / totalInstallments;
        }, 0)
      );

      if (amount <= 0) {
        return null;
      }

      return {
        id: `card-bill-${card.id}`,
        description: `${card.name} Bill`,
        amount,
        dueDate: "",
        category: "semifixed",
        paid: Boolean(card.billPaidThisMonth),
        source: "credit-card",
        linkedCardId: card.id,
        derived: true
      };
    })
    .filter(Boolean);
}

export function deriveActualsFromPlan(monthData) {
  const actuals = {
    income: monthData.income.map((item) => ({
      ...item,
      amount: money(item.amount),
      derived: false
    })),
    fixed: monthData.fixed.map((item) => ({
      ...item,
      amount: money(item.amount),
      derived: false
    })),
    semFixed: monthData.semFixed.map((item) => ({
      ...item,
      amount: money(item.amount),
      derived: false
    })),
    extra: monthData.extra.map((item) => ({
      ...item,
      amount: money(item.amount),
      derived: false
    }))
  };

  monthData.plannedIncome.forEach((item) => {
    if (item.received) {
      actuals.income.push(createDerivedIncomeRow(item));
    }
  });

  const allPlannedBills = [...monthData.plannedBills, ...deriveCreditCardBills(monthData)];

  allPlannedBills.forEach((bill) => {
    if (!bill.paid) {
      return;
    }

    if (bill.category === "fixed") {
      actuals.fixed.push(createDerivedExpenseRow(bill, "fixed"));
    }

    if (bill.category === "semifixed") {
      actuals.semFixed.push(createDerivedExpenseRow(bill, "semifixed"));
    }

    if (bill.category === "extra") {
      actuals.extra.push(createDerivedExpenseRow(bill, "extra"));
    }
  });

  return actuals;
}

export function calculateTotals(monthData) {
  const actuals = deriveActualsFromPlan(monthData);
  const totalIncome = sumAmounts(actuals.income);
  const totalFixed = sumAmounts(actuals.fixed);
  const totalSemiFixed = sumAmounts(actuals.semFixed);
  const totalExtra = sumAmounts(actuals.extra);
  const totalLoans = money(monthData.loans.reduce((total, loan) => total + money(loan.monthlyPayment), 0));
  const totalExpenses = money(totalFixed + totalSemiFixed + totalExtra + totalLoans);

  return {
    totalIncome,
    totalFixed,
    totalSemiFixed,
    totalExtra,
    totalExpenses,
    finalBalance: money(totalIncome - totalExpenses)
  };
}

export function carryOverFromPreviousMonth(budgets, currentMonth) {
  const previousMonthKey = getPreviousMonthKey(currentMonth);
  const previousMonth = previousMonthKey ? budgets[previousMonthKey] : null;
  const nextMonth = emptyMonthData();

  if (!previousMonth) {
    return nextMonth;
  }

  nextMonth.creditCards = previousMonth.creditCards
    .map((card) => {
      const purchases = card.purchases
        .filter((purchase) => !purchase.finished)
        .map((purchase) => ({
          ...structuredClone(purchase),
          installmentsCurrent: Number(purchase.installmentsCurrent) + 1,
          finished: false
        }))
        .filter((purchase) => Number(purchase.installmentsCurrent) <= Number(purchase.installmentsTotal));

      return {
        id: card.id,
        name: card.name,
        billPaidThisMonth: false,
        purchases
      };
    })
    .filter((card) => card.purchases.length > 0 || card.name);

  return nextMonth;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(money(value));
}

export function calculateMonthsLeft(amountLeft, monthlyPayment) {
  const amount = money(amountLeft);
  const payment = money(monthlyPayment);

  if (!payment) {
    return 0;
  }

  return Math.max(0, Math.ceil(amount / payment));
}
