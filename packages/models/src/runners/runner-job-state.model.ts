export const RunnerJobState = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  ERRORED: 4,
  WAITING_FOR_PARENT_JOB: 5,
  CANCELLED: 6,
  PARENT_ERRORED: 7,
  PARENT_CANCELLED: 8,
  COMPLETING: 9
} as const

export type RunnerJobStateType = typeof RunnerJobState[keyof typeof RunnerJobState]
