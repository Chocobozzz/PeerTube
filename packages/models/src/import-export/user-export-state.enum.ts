export const UserExportState = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  ERRORED: 4
} as const

export type UserExportStateType = typeof UserExportState[keyof typeof UserExportState]
