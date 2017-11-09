import { ActivityIdentifierObject } from './common-objects'

export interface VideoChannelObject {
  type: 'VideoChannel'
  name: string
  content: string
  uuid: ActivityIdentifierObject
}
