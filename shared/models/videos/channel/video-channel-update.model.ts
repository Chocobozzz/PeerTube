export interface VideoChannelUpdate {
  displayName?: string
  description?: string
  support?: string

  bulkVideosSupportUpdate?: boolean
  enableSync?: boolean
  externalChannelUrl?: string
}
