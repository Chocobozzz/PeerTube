import { getAPIUrl, getEmbedUrl } from '@app/helpers'
import { buildPlaylistWatchPath, peertubeTranslate } from '@peertube/peertube-core-utils'
import {
  AccountSummary,
  ConstantLabel,
  VideoPlaylist as ServerVideoPlaylist,
  Thumbnail,
  VideoChannelSummary,
  VideoPlaylistPrivacyType,
  VideoPlaylistType,
  VideoPlaylistType_Type
} from '@peertube/peertube-models'
import { findAppropriateThumbnailFileUrl } from '@root-helpers/images'
import { Actor } from '../shared-main/account/actor.model'

export class VideoPlaylist implements ServerVideoPlaylist {
  id: number
  uuid: string
  shortUUID: string

  isLocal: boolean

  url: string

  displayName: string
  description: string
  privacy: ConstantLabel<VideoPlaylistPrivacyType>

  videosLength: number

  type: ConstantLabel<VideoPlaylistType_Type>

  createdAt: Date | string
  updatedAt: Date | string

  ownerAccount: AccountSummary

  videoChannelPosition: number
  videoChannel?: VideoChannelSummary

  thumbnails: Thumbnail[]

  thumbnailPath: string
  thumbnailUrl: string

  embedPath: string
  embedUrl: string

  ownerBy: string

  videoChannelBy?: string

  static buildWatchUrl (playlist: Pick<VideoPlaylist, 'uuid' | 'shortUUID'>) {
    return buildPlaylistWatchPath({ shortUUID: playlist.shortUUID || playlist.uuid })
  }

  constructor (hash: ServerVideoPlaylist, translations: { [id: string]: string }) {
    this.id = hash.id
    this.uuid = hash.uuid
    this.shortUUID = hash.shortUUID

    this.url = hash.url
    this.isLocal = hash.isLocal

    this.displayName = hash.displayName

    this.description = hash.description
    this.privacy = hash.privacy

    this.embedPath = hash.embedPath
    this.embedUrl = hash.embedUrl || (getEmbedUrl() + hash.embedPath)

    this.videosLength = hash.videosLength

    this.type = hash.type

    this.thumbnails = hash.thumbnails

    this.createdAt = new Date(hash.createdAt)
    this.updatedAt = new Date(hash.updatedAt)

    this.ownerAccount = hash.ownerAccount
    this.ownerBy = Actor.CREATE_BY_STRING(hash.ownerAccount.name, hash.ownerAccount.host)

    this.videoChannelPosition = hash.videoChannelPosition

    if (hash.videoChannel) {
      this.videoChannel = hash.videoChannel
      this.videoChannelBy = Actor.CREATE_BY_STRING(hash.videoChannel.name, hash.videoChannel.host)
    }

    this.privacy.label = peertubeTranslate(this.privacy.label, translations)

    if (this.type.id === VideoPlaylistType.WATCH_LATER) {
      this.displayName = peertubeTranslate(this.displayName, translations)
    }
  }

  getThumbnailUrl (width: number) {
    const defaultUrl = getAPIUrl() + '/client/assets/images/default-playlist.jpg'

    return findAppropriateThumbnailFileUrl(this.thumbnails, width, '16:9') || defaultUrl
  }
}
