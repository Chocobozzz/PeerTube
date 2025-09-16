import { AccountSummary } from '../../actors/index.js'

export const VideoChannelCollaboratorState = {
  PENDING: 1,
  ACCEPTED: 2,
  REJECTED: 3
} as const

export type VideoChannelCollaboratorStateType = typeof VideoChannelCollaboratorState[keyof typeof VideoChannelCollaboratorState]

export interface VideoChannelCollaborator {
  id: number
  account: AccountSummary

  state: {
    id: VideoChannelCollaboratorStateType
    label: string
  }

  createdAt: string
  updatedAt: string
}
