import { ActivityVideoUrlObject, ActivityPlaylistUrlObject } from './common-objects.js'

export interface CacheFileObject {
  id: string
  type: 'CacheFile'
  object: string
  expires: string
  url: ActivityVideoUrlObject | ActivityPlaylistUrlObject
}
