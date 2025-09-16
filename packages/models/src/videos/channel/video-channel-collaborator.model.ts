import { AccountSummary } from '../../actors/index.js'

export const VideoChannelCollaboratorState = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
} as const

export type VideoChannelCollaboratorStateType = typeof VideoChannelCollaboratorState[keyof typeof VideoChannelCollaboratorState]

export interface VideoChannelCollaborator {
  account: AccountSummary

  state: {
    id: VideoChannelCollaboratorStateType
    label: string
  }

  createdAt: string
  updatedAt: string
}
