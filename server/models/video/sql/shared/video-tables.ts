
/**
 *
 * Class to build video attributes/join names we want to fetch from the database
 *
 */
export class VideoTables {

  constructor (readonly mode: 'get' | 'list') {

  }

  getChannelAttributesForUser () {
    return [ 'id', 'accountId' ]
  }

  getChannelAttributes () {
    let attributeKeys = [
      'id',
      'name',
      'description',
      'actorId'
    ]

    if (this.mode === 'get') {
      attributeKeys = attributeKeys.concat([
        'support',
        'createdAt',
        'updatedAt'
      ])
    }

    return attributeKeys
  }

  getUserAccountAttributes () {
    return [ 'id', 'userId' ]
  }

  getAccountAttributes () {
    let attributeKeys = [ 'id', 'name', 'actorId' ]

    if (this.mode === 'get') {
      attributeKeys = attributeKeys.concat([
        'description',
        'userId',
        'createdAt',
        'updatedAt'
      ])
    }

    return attributeKeys
  }

  getThumbnailAttributes () {
    let attributeKeys = [ 'id', 'type', 'filename' ]

    if (this.mode === 'get') {
      attributeKeys = attributeKeys.concat([
        'height',
        'width',
        'fileUrl',
        'automaticallyGenerated',
        'videoId',
        'videoPlaylistId',
        'createdAt',
        'updatedAt'
      ])
    }

    return attributeKeys
  }

  getFileAttributes () {
    return [
      'id',
      'createdAt',
      'updatedAt',
      'resolution',
      'size',
      'extname',
      'filename',
      'fileUrl',
      'torrentFilename',
      'torrentUrl',
      'infoHash',
      'fps',
      'metadataUrl',
      'videoStreamingPlaylistId',
      'videoId'
    ]
  }

  getStreamingPlaylistAttributes () {
    let playlistKeys = [ 'id', 'playlistUrl', 'type' ]

    if (this.mode === 'get') {
      playlistKeys = playlistKeys.concat([
        'p2pMediaLoaderInfohashes',
        'p2pMediaLoaderPeerVersion',
        'segmentsSha256Url',
        'videoId',
        'createdAt',
        'updatedAt'
      ])
    }

    return playlistKeys
  }

  getUserHistoryAttributes () {
    return [ 'id', 'currentTime' ]
  }

  getPlaylistAttributes () {
    return [
      'createdAt',
      'updatedAt',
      'url',
      'position',
      'startTimestamp',
      'stopTimestamp',
      'videoPlaylistId'
    ]
  }

  getTagAttributes () {
    return [ 'id', 'name' ]
  }

  getVideoTagAttributes () {
    return [ 'videoId', 'tagId', 'createdAt', 'updatedAt' ]
  }

  getBlacklistedAttributes () {
    return [ 'id', 'reason', 'unfederated' ]
  }

  getScheduleUpdateAttributes () {
    return [
      'id',
      'updateAt',
      'privacy',
      'videoId',
      'createdAt',
      'updatedAt'
    ]
  }

  getLiveAttributes () {
    return [
      'id',
      'streamKey',
      'saveReplay',
      'permanentLive',
      'videoId',
      'createdAt',
      'updatedAt'
    ]
  }

  getTrackerAttributes () {
    return [ 'id', 'url' ]
  }

  getVideoTrackerAttributes () {
    return [
      'videoId',
      'trackerId',
      'createdAt',
      'updatedAt'
    ]
  }

  getRedundancyAttributes () {
    return [ 'id', 'fileUrl' ]
  }

  getActorAttributes () {
    let attributeKeys = [
      'id',
      'preferredUsername',
      'url',
      'serverId',
      'avatarId'
    ]

    if (this.mode === 'get') {
      attributeKeys = attributeKeys.concat([
        'type',
        'followersCount',
        'followingCount',
        'inboxUrl',
        'outboxUrl',
        'sharedInboxUrl',
        'followersUrl',
        'followingUrl',
        'remoteCreatedAt',
        'createdAt',
        'updatedAt'
      ])
    }

    return attributeKeys
  }

  getAvatarAttributes () {
    let attributeKeys = [
      'id',
      'filename',
      'type',
      'fileUrl',
      'onDisk',
      'createdAt',
      'updatedAt'
    ]

    if (this.mode === 'get') {
      attributeKeys = attributeKeys.concat([
        'height',
        'width',
        'type'
      ])
    }

    return attributeKeys
  }

  getServerAttributes () {
    return [ 'id', 'host' ]
  }

  getVideoAttributes () {
    return [
      'id',
      'uuid',
      'name',
      'category',
      'licence',
      'language',
      'privacy',
      'nsfw',
      'description',
      'support',
      'duration',
      'views',
      'likes',
      'dislikes',
      'remote',
      'isLive',
      'url',
      'commentsEnabled',
      'downloadEnabled',
      'waitTranscoding',
      'state',
      'publishedAt',
      'originallyPublishedAt',
      'channelId',
      'createdAt',
      'updatedAt'
    ]
  }
}
