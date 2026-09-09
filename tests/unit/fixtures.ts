export const USER_A = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "user-a@test.local",
  name: "User A",
  image: null,
};

export const USER_B = {
  id: "00000000-0000-4000-8000-00000000000b",
  email: "user-b@test.local",
  name: "User B",
  image: null,
};

export const TRANSACTION_ID = "10000000-0000-4000-8000-000000000001";
export const SERIES_ID = "20000000-0000-4000-8000-000000000001";
export const SERIES_TRANSACTION_IDS = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
] as const;

export function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: TRANSACTION_ID,
    title: "Conta de teste",
    type: "EXPENSE" as const,
    paymentMethod: "Pix",
    dueDate: new Date("2026-09-10T12:00:00.000Z"),
    amount: 100,
    isPaid: false,
    groupId: null,
    userId: USER_A.id,
    recurrence: "SINGLE" as const,
    frequency: null,
    installmentNumber: null,
    installmentTotal: null,
    createdAt: new Date("2026-09-01T12:00:00.000Z"),
    updatedAt: new Date("2026-09-01T12:00:00.000Z"),
    ...overrides,
  };
}

export function makeSeries() {
  return SERIES_TRANSACTION_IDS.map((id, index) =>
    makeTransaction({
      id,
      groupId: SERIES_ID,
      userId: USER_A.id,
      recurrence: "INSTALLMENT" as const,
      installmentNumber: index + 1,
      installmentTotal: 3,
      dueDate: new Date(`2026-09-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`),
    }),
  );
}