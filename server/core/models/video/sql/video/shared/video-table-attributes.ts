/**
 *
 * Class to build video attributes/join names we want to fetch from the database
 *
 */
export class VideoTableAttributes {

  constructor (private readonly mode: 'get' | 'list') {

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
        'onDisk',
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
      'videoId',
      'width',
      'height',
      'storage'
    ]
  }

  getStreamingPlaylistAttributes () {
    return [
      'id',
      'playlistUrl',
      'playlistFilename',
      'type',
      'p2pMediaLoaderInfohashes',
      'p2pMediaLoaderPeerVersion',
      'segmentsSha256Filename',
      'segmentsSha256Url',
      'videoId',
      'createdAt',
      'updatedAt',
      'storage'
    ]
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

  getBlocklistAttributes () {
    return [ 'id' ]
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
      'latencyMode',
      'videoId',
      'replaySettingId',
      'createdAt',
      'updatedAt'
    ]
  }

  getVideoSourceAttributes () {
    return [
      'id',
      'inputFilename',
      'keptOriginalFilename',
      'resolution',
      'size',
      'width',
      'height',
      'fps',
      'metadata',
      'createdAt'
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
      'serverId'
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
      'width',
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
      'aspectRatio',
      'url',
      'commentsEnabled',
      'downloadEnabled',
      'waitTranscoding',
      'state',
      'publishedAt',
      'originallyPublishedAt',
      'inputFileUpdatedAt',
      'channelId',
      'createdAt',
      'updatedAt',
      'moveJobsRunning'
    ]
  }
}
