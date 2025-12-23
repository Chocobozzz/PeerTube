import { AccountSummary } from '../../actors/account.model.js'

export const VideoChannelActivityAction = {
  CREATE: 1,
  UPDATE: 2,
  DELETE: 3,
  UPDATE_CAPTIONS: 4,
  UPDATE_CHAPTERS: 5,
  UPDATE_PASSWORDS: 6,
  CREATE_STUDIO_TASKS: 7,
  UPDATE_SOURCE_FILE: 8,
  UPDATE_ELEMENTS: 9,
  REMOVE_CHANNEL_OWNERSHIP: 10,
  CREATE_CHANNEL_OWNERSHIP: 11
} as const

export type VideoChannelActivityActionType = typeof VideoChannelActivityAction[keyof typeof VideoChannelActivityAction]

// ---------------------------------------------------------------------------

export const VideoChannelActivityTarget = {
  VIDEO: 1,
  PLAYLIST: 2,
  CHANNEL: 3,
  CHANNEL_SYNC: 4,
  VIDEO_IMPORT: 5
} as const

export type VideoChannelActivityTargetType = typeof VideoChannelActivityTarget[keyof typeof VideoChannelActivityTarget]

// ---------------------------------------------------------------------------

// To add update diff later
export interface VideoChannelActivityDetails {
}

export interface VideoChannelActivity {
  id: number

  // The account may have been deleted
  account?: AccountSummary

  action: {
    id: VideoChannelActivityActionType
    label: string
  }

  targetType: {
    id: VideoChannelActivityTargetType
    label: string
  }

  details: VideoChannelActivityDetails

  createdAt: Date

  channel: {
    id: number
    name: string
    displayName: string
    url: string
  }

  video?: {
    id: number
    name: string
    uuid: string
    shortUUID: string
    url: string
    isLive: boolean
  }

  videoImport?: {
    id: number
    name: string
    uuid: string
    shortUUID: string
    url: string
    targetUrl: string
  }

  playlist?: {
    id: number
    name: string
    uuid: string
    shortUUID: string
    url: string
  }

  channelSync?: {
    id: number
    externalChannelUrl: string
  }
}
