export const UserRegistrationState = {
  PENDING: 1,
  REJECTED: 2,
  ACCEPTED: 3
}

export type UserRegistrationStateType = typeof UserRegistrationState[keyof typeof UserRegistrationState]
