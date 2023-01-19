import { UserRegistrationState } from './user-registration-state.model'

export interface UserRegistration {
  id: number

  state: {
    id: UserRegistrationState
    label: string
  }

  registrationReason: string
  moderationResponse: string

  username: string
  email: string
  emailVerified: boolean

  accountDisplayName: string

  channelHandle: string
  channelDisplayName: string

  createdAt: Date
  updatedAt: Date

  user?: {
    id: number
  }
}
