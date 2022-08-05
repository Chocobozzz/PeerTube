import { ActivityVideoUrlObject, ActivityPlaylistUrlObject } from './common-objects'

export interface CacheFileObject {
  id: string
  type: 'CacheFile'
  object: string
  expires: string
  url: ActivityVideoUrlObject | ActivityPlaylistUrlObject
}
