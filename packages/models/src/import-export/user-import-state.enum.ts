export const UserImportState = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  ERRORED: 4
} as const

export type UserImportStateType = typeof UserImportState[keyof typeof UserImportState]
