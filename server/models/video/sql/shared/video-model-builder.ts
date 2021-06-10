import { pick } from 'lodash'
import { AccountModel } from '@server/models/account/account'
import { ActorModel } from '@server/models/actor/actor'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy'
import { ServerModel } from '@server/models/server/server'
import { TrackerModel } from '@server/models/server/tracker'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history'
import { ScheduleVideoUpdateModel } from '../../schedule-video-update'
import { TagModel } from '../../tag'
import { ThumbnailModel } from '../../thumbnail'
import { VideoModel } from '../../video'
import { VideoBlacklistModel } from '../../video-blacklist'
import { VideoChannelModel } from '../../video-channel'
import { VideoFileModel } from '../../video-file'
import { VideoLiveModel } from '../../video-live'
import { VideoStreamingPlaylistModel } from '../../video-streaming-playlist'
import { VideoAttributes } from './video-attributes'

/**
 *
 * Build video models from SQL rows
 *
 */

export class VideoModelBuilder {
  private videosMemo: { [ id: number ]: VideoModel }
  private videoStreamingPlaylistMemo: { [ id: number ]: VideoStreamingPlaylistModel }
  private videoFileMemo: { [ id: number ]: VideoFileModel }

  private thumbnailsDone: Set<number>
  private historyDone: Set<number>
  private blacklistDone: Set<number>
  private liveDone: Set<number>
  private redundancyDone: Set<number>
  private scheduleVideoUpdateDone: Set<number>

  private trackersDone: Set<string>
  private tagsDone: Set<string>

  private videos: VideoModel[]

  private readonly buildOpts = { raw: true, isNewRecord: false }

  constructor (
    readonly mode: 'get' | 'list',
    readonly videoAttributes: VideoAttributes
  ) {

  }

  buildVideosFromRows (rows: any[], rowsWebtorrentFiles?: any[], rowsStreamingPlaylist?: any[]) {
    this.reinit()

    for (const row of rows) {
      this.buildVideo(row)

      const videoModel = this.videosMemo[row.id]

      this.setUserHistory(row, videoModel)
      this.addThumbnail(row, videoModel)

      if (!rowsWebtorrentFiles) {
        this.addWebTorrentFile(row, videoModel)
      }

      if (!rowsStreamingPlaylist) {
        this.addStreamingPlaylist(row, videoModel)
        this.addStreamingPlaylistFile(row)
      }

      if (this.mode === 'get') {
        this.addTag(row, videoModel)
        this.addTracker(row, videoModel)
        this.setBlacklisted(row, videoModel)
        this.setScheduleVideoUpdate(row, videoModel)
        this.setLive(row, videoModel)

        if (!rowsWebtorrentFiles && row.VideoFiles.id) {
          this.addRedundancy(row.VideoFiles.RedundancyVideos, this.videoFileMemo[row.VideoFiles.id])
        }

        if (!rowsStreamingPlaylist && row.VideoStreamingPlaylists.id) {
          this.addRedundancy(row.VideoStreamingPlaylists.RedundancyVideos, this.videoStreamingPlaylistMemo[row.VideoStreamingPlaylists.id])
        }
      }
    }

    for (const row of rowsWebtorrentFiles || []) {
      const videoModel = this.videosMemo[row.id]
      this.addWebTorrentFile(row, videoModel)
      this.addRedundancy(row.VideoFiles.RedundancyVideos, this.videoFileMemo[row.VideoFiles.id])
    }

    for (const row of rowsStreamingPlaylist || []) {
      const videoModel = this.videosMemo[row.id]

      this.addStreamingPlaylist(row, videoModel)
      this.addStreamingPlaylistFile(row)
      this.addRedundancy(row.VideoStreamingPlaylists.RedundancyVideos, this.videoStreamingPlaylistMemo[row.VideoStreamingPlaylists.id])
    }

    return this.videos
  }

  private reinit () {
    this.videosMemo = {}
    this.videoStreamingPlaylistMemo = {}
    this.videoFileMemo = {}

    this.thumbnailsDone = new Set<number>()
    this.historyDone = new Set<number>()
    this.blacklistDone = new Set<number>()
    this.liveDone = new Set<number>()
    this.redundancyDone = new Set<number>()
    this.scheduleVideoUpdateDone = new Set<number>()

    this.trackersDone = new Set<string>()
    this.tagsDone = new Set<string>()

    this.videos = []
  }

  private buildVideo (row: any) {
    if (this.videosMemo[row.id]) return

    // Build Channel
    const channel = row.VideoChannel
    const channelModel = new VideoChannelModel(pick(channel, this.videoAttributes.getChannelAttributes()), this.buildOpts)
    channelModel.Actor = this.buildActor(channel.Actor)

    const account = row.VideoChannel.Account
    const accountModel = new AccountModel(pick(account, this.videoAttributes.getAccountAttributes()), this.buildOpts)
    accountModel.Actor = this.buildActor(account.Actor)

    channelModel.Account = accountModel

    const videoModel = new VideoModel(pick(row, this.videoAttributes.getVideoAttributes()), this.buildOpts)
    videoModel.VideoChannel = channelModel

    this.videosMemo[row.id] = videoModel

    videoModel.UserVideoHistories = []
    videoModel.Thumbnails = []
    videoModel.VideoFiles = []
    videoModel.VideoStreamingPlaylists = []
    videoModel.Tags = []
    videoModel.Trackers = []

    // Keep rows order
    this.videos.push(videoModel)
  }

  private buildActor (rowActor: any) {
    const avatarModel = rowActor.Avatar.id !== null
      ? new ActorImageModel(pick(rowActor.Avatar, this.videoAttributes.getAvatarAttributes()), this.buildOpts)
      : null

    const serverModel = rowActor.Server.id !== null
      ? new ServerModel(pick(rowActor.Server, this.videoAttributes.getServerAttributes()), this.buildOpts)
      : null

    const actorModel = new ActorModel(pick(rowActor, this.videoAttributes.getActorAttributes()), this.buildOpts)
    actorModel.Avatar = avatarModel
    actorModel.Server = serverModel

    return actorModel
  }

  private setUserHistory (row: any, videoModel: VideoModel) {
    if (!row.userVideoHistory?.id || this.historyDone.has(row.userVideoHistory.id)) return

    const attributes = pick(row.userVideoHistory, this.videoAttributes.getUserHistoryAttributes())
    const historyModel = new UserVideoHistoryModel(attributes, this.buildOpts)
    videoModel.UserVideoHistories.push(historyModel)

    this.historyDone.add(row.userVideoHistory.id)
  }

  private addThumbnail (row: any, videoModel: VideoModel) {
    if (!row.Thumbnails?.id || this.thumbnailsDone.has(row.Thumbnails.id)) return

    const attributes = pick(row.Thumbnails, this.videoAttributes.getThumbnailAttributes())
    const thumbnailModel = new ThumbnailModel(attributes, this.buildOpts)
    videoModel.Thumbnails.push(thumbnailModel)

    this.thumbnailsDone.add(row.Thumbnails.id)
  }

  private addWebTorrentFile (row: any, videoModel: VideoModel) {
    if (!row.VideoFiles?.id || this.videoFileMemo[row.VideoFiles.id]) return

    const attributes = pick(row.VideoFiles, this.videoAttributes.getFileAttributes())
    const videoFileModel = new VideoFileModel(attributes, this.buildOpts)
    videoModel.VideoFiles.push(videoFileModel)

    this.videoFileMemo[row.VideoFiles.id] = videoFileModel
  }

  private addStreamingPlaylist (row: any, videoModel: VideoModel) {
    if (!row.VideoStreamingPlaylists?.id || this.videoStreamingPlaylistMemo[row.VideoStreamingPlaylists.id]) return

    const attributes = pick(row.VideoStreamingPlaylists, this.videoAttributes.getStreamingPlaylistAttributes())
    const streamingPlaylist = new VideoStreamingPlaylistModel(attributes, this.buildOpts)
    streamingPlaylist.VideoFiles = []

    videoModel.VideoStreamingPlaylists.push(streamingPlaylist)

    this.videoStreamingPlaylistMemo[streamingPlaylist.id] = streamingPlaylist
  }

  private addStreamingPlaylistFile (row: any) {
    if (!row.VideoStreamingPlaylists?.VideoFiles?.id || this.videoFileMemo[row.VideoStreamingPlaylists.VideoFiles.id]) return

    const streamingPlaylist = this.videoStreamingPlaylistMemo[row.VideoStreamingPlaylists.id]

    const attributes = pick(row.VideoStreamingPlaylists.VideoFiles, this.videoAttributes.getFileAttributes())
    const videoFileModel = new VideoFileModel(attributes, this.buildOpts)
    streamingPlaylist.VideoFiles.push(videoFileModel)

    this.videoFileMemo[row.VideoStreamingPlaylists.VideoFiles.id] = videoFileModel
  }

  private addRedundancy (redundancyRow: any, to: VideoFileModel | VideoStreamingPlaylistModel) {
    if (!to.RedundancyVideos) to.RedundancyVideos = []

    if (!redundancyRow?.id || this.redundancyDone.has(redundancyRow.id)) return

    const attributes = pick(redundancyRow, this.videoAttributes.getRedundancyAttributes())
    const redundancyModel = new VideoRedundancyModel(attributes, this.buildOpts)
    to.RedundancyVideos.push(redundancyModel)

    this.redundancyDone.add(redundancyRow.id)
  }

  private addTag (row: any, videoModel: VideoModel) {
    if (!row.Tags?.name) return
    const association = row.Tags.VideoTagModel

    const key = `${association.videoId}-${association.tagId}`
    if (this.tagsDone.has(key)) return

    const attributes = pick(row.Tags, this.videoAttributes.getTagAttributes())
    const tagModel = new TagModel(attributes, this.buildOpts)
    videoModel.Tags.push(tagModel)

    this.tagsDone.add(key)
  }

  private addTracker (row: any, videoModel: VideoModel) {
    if (!row.Trackers?.id) return
    const association = row.Trackers.VideoTrackerModel

    const key = `${association.videoId}-${association.trackerId}`
    if (this.trackersDone.has(key)) return

    const attributes = pick(row.Trackers, this.videoAttributes.getTrackerAttributes())
    const trackerModel = new TrackerModel(attributes, this.buildOpts)
    videoModel.Trackers.push(trackerModel)

    this.trackersDone.add(key)
  }

  private setBlacklisted (row: any, videoModel: VideoModel) {
    if (!row.VideoBlacklist?.id) return
    if (this.blacklistDone.has(row.VideoBlacklist.id)) return

    const attributes = pick(row.VideoBlacklist, this.videoAttributes.getBlacklistedAttributes())
    videoModel.VideoBlacklist = new VideoBlacklistModel(attributes, this.buildOpts)

    this.blacklistDone.add(row.VideoBlacklist.id)
  }

  private setScheduleVideoUpdate (row: any, videoModel: VideoModel) {
    if (!row.ScheduleVideoUpdate?.id) return
    if (this.scheduleVideoUpdateDone.has(row.ScheduleVideoUpdate.id)) return

    const attributes = pick(row.ScheduleVideoUpdate, this.videoAttributes.getScheduleUpdateAttributes())
    videoModel.ScheduleVideoUpdate = new ScheduleVideoUpdateModel(attributes, this.buildOpts)

    this.scheduleVideoUpdateDone.add(row.ScheduleVideoUpdate.id)
  }

  private setLive (row: any, videoModel: VideoModel) {
    if (!row.VideoLive?.id) return
    if (this.liveDone.has(row.VideoLive.id)) return

    const attributes = pick(row.VideoLive, this.videoAttributes.getLiveAttributes())
    videoModel.VideoLive = new VideoLiveModel(attributes, this.buildOpts)

    this.liveDone.add(row.ScheduleVideoUpdate.id)
  }
}
