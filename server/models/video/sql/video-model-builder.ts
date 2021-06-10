import { pick } from 'lodash'
import { AccountModel } from '@server/models/account/account'
import { ActorModel } from '@server/models/actor/actor'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { ServerModel } from '@server/models/server/server'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history'
import { ThumbnailModel } from '../thumbnail'
import { VideoModel } from '../video'
import { VideoChannelModel } from '../video-channel'
import { VideoFileModel } from '../video-file'
import { VideoStreamingPlaylistModel } from '../video-streaming-playlist'

function buildVideosFromRows (rows: any[]) {
  const videosMemo: { [ id: number ]: VideoModel } = {}
  const videoStreamingPlaylistMemo: { [ id: number ]: VideoStreamingPlaylistModel } = {}

  const thumbnailsDone = new Set<number>()
  const historyDone = new Set<number>()
  const videoFilesDone = new Set<number>()

  const videos: VideoModel[] = []

  const avatarKeys = [ 'id', 'filename', 'fileUrl', 'onDisk', 'createdAt', 'updatedAt' ]
  const actorKeys = [ 'id', 'preferredUsername', 'url', 'serverId', 'avatarId' ]
  const serverKeys = [ 'id', 'host' ]
  const videoFileKeys = [
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
    'videoId',
    'videoStreamingPlaylistId'
  ]
  const videoStreamingPlaylistKeys = [ 'id', 'type', 'playlistUrl' ]
  const videoKeys = [
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
  const buildOpts = { raw: true }

  function buildActor (rowActor: any) {
    const avatarModel = rowActor.Avatar.id !== null
      ? new ActorImageModel(pick(rowActor.Avatar, avatarKeys), buildOpts)
      : null

    const serverModel = rowActor.Server.id !== null
      ? new ServerModel(pick(rowActor.Server, serverKeys), buildOpts)
      : null

    const actorModel = new ActorModel(pick(rowActor, actorKeys), buildOpts)
    actorModel.Avatar = avatarModel
    actorModel.Server = serverModel

    return actorModel
  }

  for (const row of rows) {
    if (!videosMemo[row.id]) {
      // Build Channel
      const channel = row.VideoChannel
      const channelModel = new VideoChannelModel(pick(channel, [ 'id', 'name', 'description', 'actorId' ]), buildOpts)
      channelModel.Actor = buildActor(channel.Actor)

      const account = row.VideoChannel.Account
      const accountModel = new AccountModel(pick(account, [ 'id', 'name' ]), buildOpts)
      accountModel.Actor = buildActor(account.Actor)

      channelModel.Account = accountModel

      const videoModel = new VideoModel(pick(row, videoKeys), buildOpts)
      videoModel.VideoChannel = channelModel

      videoModel.UserVideoHistories = []
      videoModel.Thumbnails = []
      videoModel.VideoFiles = []
      videoModel.VideoStreamingPlaylists = []

      videosMemo[row.id] = videoModel
      // Don't take object value to have a sorted array
      videos.push(videoModel)
    }

    const videoModel = videosMemo[row.id]

    if (row.userVideoHistory?.id && !historyDone.has(row.userVideoHistory.id)) {
      const historyModel = new UserVideoHistoryModel(pick(row.userVideoHistory, [ 'id', 'currentTime' ]), buildOpts)
      videoModel.UserVideoHistories.push(historyModel)

      historyDone.add(row.userVideoHistory.id)
    }

    if (row.Thumbnails?.id && !thumbnailsDone.has(row.Thumbnails.id)) {
      const thumbnailModel = new ThumbnailModel(pick(row.Thumbnails, [ 'id', 'type', 'filename' ]), buildOpts)
      videoModel.Thumbnails.push(thumbnailModel)

      thumbnailsDone.add(row.Thumbnails.id)
    }

    if (row.VideoFiles?.id && !videoFilesDone.has(row.VideoFiles.id)) {
      const videoFileModel = new VideoFileModel(pick(row.VideoFiles, videoFileKeys), buildOpts)
      videoModel.VideoFiles.push(videoFileModel)

      videoFilesDone.add(row.VideoFiles.id)
    }

    if (row.VideoStreamingPlaylists?.id && !videoStreamingPlaylistMemo[row.VideoStreamingPlaylists.id]) {
      const streamingPlaylist = new VideoStreamingPlaylistModel(pick(row.VideoStreamingPlaylists, videoStreamingPlaylistKeys), buildOpts)
      streamingPlaylist.VideoFiles = []

      videoModel.VideoStreamingPlaylists.push(streamingPlaylist)

      videoStreamingPlaylistMemo[streamingPlaylist.id] = streamingPlaylist
    }

    if (row.VideoStreamingPlaylists?.VideoFiles?.id && !videoFilesDone.has(row.VideoStreamingPlaylists.VideoFiles.id)) {
      const streamingPlaylist = videoStreamingPlaylistMemo[row.VideoStreamingPlaylists.id]

      const videoFileModel = new VideoFileModel(pick(row.VideoStreamingPlaylists.VideoFiles, videoFileKeys), buildOpts)
      streamingPlaylist.VideoFiles.push(videoFileModel)

      videoFilesDone.add(row.VideoStreamingPlaylists.VideoFiles.id)
    }
  }

  return videos
}

export {
  buildVideosFromRows
}
