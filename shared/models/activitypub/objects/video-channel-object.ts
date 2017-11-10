import { ActivityIdentifierObject } from './common-objects'

export interface VideoChannelObject {
  type: 'VideoChannel'
  id: string
  name: string
  content: string
  uuid: string
  published: Date
  updated: Date
}
