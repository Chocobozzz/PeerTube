import { ActivityCaptionUrlObject, ActivityIdentifierObject, ActivityPlaylistUrlObject } from './common-objects.js'

export interface VideoCaptionObject extends ActivityIdentifierObject {
  automaticallyGenerated: boolean

  url: (ActivityCaptionUrlObject | ActivityPlaylistUrlObject)[]
}
