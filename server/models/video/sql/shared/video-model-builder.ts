
import { AccountModel } from '@server/models/account/account'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist'
import { ActorModel } from '@server/models/actor/actor'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy'
import { ServerModel } from '@server/models/server/server'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { TrackerModel } from '@server/models/server/tracker'
import { UserVideoHistoryModel } from '@server/models/user/user-video-history'
import { VideoInclude } from '@shared/models'
import { ScheduleVideoUpdateModel } from '../../schedule-video-update'
import { TagModel } from '../../tag'
import { ThumbnailModel } from '../../thumbnail'
import { VideoModel } from '../../video'
import { VideoBlacklistModel } from '../../video-blacklist'
import { VideoChannelModel } from '../../video-channel'
import { VideoFileModel } from '../../video-file'
import { VideoLiveModel } from '../../video-live'
import { VideoStreamingPlaylistModel } from '../../video-streaming-playlist'
import { VideoTableAttributes } from './video-table-attributes'

type SQLRow = { [id: string]: string | number }

/**
 *
 * Build video models from SQL rows
 *
 */

export class VideoModelBuilder {
  private videosMemo: { [ id: number ]: VideoModel }
  private videoStreamingPlaylistMemo: { [ id: number ]: VideoStreamingPlaylistModel }
  private videoFileMemo: { [ id: number ]: VideoFileModel }

  private thumbnailsDone: Set<any>
  private historyDone: Set<any>
  private blacklistDone: Set<any>
  private accountBlocklistDone: Set<any>
  private serverBlocklistDone: Set<any>
  private liveDone: Set<any>
  private redundancyDone: Set<any>
  private scheduleVideoUpdateDone: Set<any>

  private trackersDone: Set<string>
  private tagsDone: Set<string>

  private videos: VideoModel[]

  private readonly buildOpts = { raw: true, isNewRecord: false }

  constructor (
    readonly mode: 'get' | 'list',
    readonly tables: VideoTableAttributes
  ) {

  }

  buildVideosFromRows (options: {
    rows: SQLRow[]
    include?: VideoInclude
    rowsWebTorrentFiles?: SQLRow[]
    rowsStreamingPlaylist?: SQLRow[]
  }) {
    const { rows, rowsWebTorrentFiles, rowsStreamingPlaylist, include } = options

    this.reinit()

    for (const row of rows) {
      this.buildVideoAndAccount(row)

      const videoModel = this.videosMemo[row.id]

      this.setUserHistory(row, videoModel)
      this.addThumbnail(row, videoModel)

      if (!rowsWebTorrentFiles) {
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
      } else {
        if (include & VideoInclude.BLACKLISTED) {
          this.setBlacklisted(row, videoModel)
        }

        if (include & VideoInclude.BLOCKED_OWNER) {
          this.setBlockedOwner(row, videoModel)
          this.setBlockedServer(row, videoModel)
        }
      }
    }

    this.grabSeparateWebTorrentFiles(rowsWebTorrentFiles)
    this.grabSeparateStreamingPlaylistFiles(rowsStreamingPlaylist)

    return this.videos
  }

  private reinit () {
    this.videosMemo = {}
    this.videoStreamingPlaylistMemo = {}
    this.videoFileMemo = {}

    this.thumbnailsDone = new Set()
    this.historyDone = new Set()
    this.blacklistDone = new Set()
    this.liveDone = new Set()
    this.redundancyDone = new Set()
    this.scheduleVideoUpdateDone = new Set()

    this.accountBlocklistDone = new Set()
    this.serverBlocklistDone = new Set()

    this.trackersDone = new Set()
    this.tagsDone = new Set()

    this.videos = []
  }

  private grabSeparateWebTorrentFiles (rowsWebTorrentFiles?: SQLRow[]) {
    if (!rowsWebTorrentFiles) return

    for (const row of rowsWebTorrentFiles) {
      const id = row['VideoFiles.id']
      if (!id) continue

      const videoModel = this.videosMemo[row.id]
      this.addWebTorrentFile(row, videoModel)
      this.addRedundancy(row, 'VideoFiles', this.videoFileMemo[id])
    }
  }

  private grabSeparateStreamingPlaylistFiles (rowsStreamingPlaylist?: SQLRow[]) {
    if (!rowsStreamingPlaylist) return

    for (const row of rowsStreamingPlaylist) {
      const id = row['VideoStreamingPlaylists.id']
      if (!id) continue

      const videoModel = this.videosMemo[row.id]

      this.addStreamingPlaylist(row, videoModel)
      this.addStreamingPlaylistFile(row)
      this.addRedundancy(row, 'VideoStreamingPlaylists', this.videoStreamingPlaylistMemo[id])
    }
  }

  private buildVideoAndAccount (row: SQLRow) {
    if (this.videosMemo[row.id]) return

    const videoModel = new VideoModel(this.grab(row, this.tables.getVideoAttributes(), ''), this.buildOpts)

    videoModel.UserVideoHistories = []
    videoModel.Thumbnails = []
    videoModel.VideoFiles = []
    videoModel.VideoStreamingPlaylists = []
    videoModel.Tags = []
    videoModel.Trackers = []

    this.buildAccount(row, videoModel)

    this.videosMemo[row.id] = videoModel

    // Keep rows order
    this.videos.push(videoModel)
  }

  private buildAccount (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoChannel.Account.id']
    if (!id) return

    const channelModel = new VideoChannelModel(this.grab(row, this.tables.getChannelAttributes(), 'VideoChannel'), this.buildOpts)
    channelModel.Actor = this.buildActor(row, 'VideoChannel')

    const accountModel = new AccountModel(this.grab(row, this.tables.getAccountAttributes(), 'VideoChannel.Account'), this.buildOpts)
    accountModel.Actor = this.buildActor(row, 'VideoChannel.Account')

    accountModel.BlockedBy = []

    channelModel.Account = accountModel

    videoModel.VideoChannel = channelModel
  }

  private buildActor (row: SQLRow, prefix: string) {
    const actorPrefix = `${prefix}.Actor`
    const avatarPrefix = `${actorPrefix}.Avatar`
    const serverPrefix = `${actorPrefix}.Server`

    const avatarModel = row[`${avatarPrefix}.id`] !== null
      ? new ActorImageModel(this.grab(row, this.tables.getAvatarAttributes(), avatarPrefix), this.buildOpts)
      : null

    const serverModel = row[`${serverPrefix}.id`] !== null
      ? new ServerModel(this.grab(row, this.tables.getServerAttributes(), serverPrefix), this.buildOpts)
      : null

    if (serverModel) serverModel.BlockedBy = []

    const actorModel = new ActorModel(this.grab(row, this.tables.getActorAttributes(), actorPrefix), this.buildOpts)
    actorModel.Avatar = avatarModel
    actorModel.Server = serverModel

    return actorModel
  }

  private setUserHistory (row: SQLRow, videoModel: VideoModel) {
    const id = row['userVideoHistory.id']
    if (!id || this.historyDone.has(id)) return

    const attributes = this.grab(row, this.tables.getUserHistoryAttributes(), 'userVideoHistory')
    const historyModel = new UserVideoHistoryModel(attributes, this.buildOpts)
    videoModel.UserVideoHistories.push(historyModel)

    this.historyDone.add(id)
  }

  private addThumbnail (row: SQLRow, videoModel: VideoModel) {
    const id = row['Thumbnails.id']
    if (!id || this.thumbnailsDone.has(id)) return

    const attributes = this.grab(row, this.tables.getThumbnailAttributes(), 'Thumbnails')
    const thumbnailModel = new ThumbnailModel(attributes, this.buildOpts)
    videoModel.Thumbnails.push(thumbnailModel)

    this.thumbnailsDone.add(id)
  }

  private addWebTorrentFile (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoFiles.id']
    if (!id || this.videoFileMemo[id]) return

    const attributes = this.grab(row, this.tables.getFileAttributes(), 'VideoFiles')
    const videoFileModel = new VideoFileModel(attributes, this.buildOpts)
    videoModel.VideoFiles.push(videoFileModel)

    this.videoFileMemo[id] = videoFileModel
  }

  private addStreamingPlaylist (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoStreamingPlaylists.id']
    if (!id || this.videoStreamingPlaylistMemo[id]) return

    const attributes = this.grab(row, this.tables.getStreamingPlaylistAttributes(), 'VideoStreamingPlaylists')
    const streamingPlaylist = new VideoStreamingPlaylistModel(attributes, this.buildOpts)
    streamingPlaylist.VideoFiles = []

    videoModel.VideoStreamingPlaylists.push(streamingPlaylist)

    this.videoStreamingPlaylistMemo[id] = streamingPlaylist
  }

  private addStreamingPlaylistFile (row: SQLRow) {
    const id = row['VideoStreamingPlaylists.VideoFiles.id']
    if (!id || this.videoFileMemo[id]) return

    const streamingPlaylist = this.videoStreamingPlaylistMemo[row['VideoStreamingPlaylists.id']]

    const attributes = this.grab(row, this.tables.getFileAttributes(), 'VideoStreamingPlaylists.VideoFiles')
    const videoFileModel = new VideoFileModel(attributes, this.buildOpts)
    streamingPlaylist.VideoFiles.push(videoFileModel)

    this.videoFileMemo[id] = videoFileModel
  }

  private addRedundancy (row: SQLRow, prefix: string, to: VideoFileModel | VideoStreamingPlaylistModel) {
    if (!to.RedundancyVideos) to.RedundancyVideos = []

    const redundancyPrefix = `${prefix}.RedundancyVideos`
    const id = row[`${redundancyPrefix}.id`]

    if (!id || this.redundancyDone.has(id)) return

    const attributes = this.grab(row, this.tables.getRedundancyAttributes(), redundancyPrefix)
    const redundancyModel = new VideoRedundancyModel(attributes, this.buildOpts)
    to.RedundancyVideos.push(redundancyModel)

    this.redundancyDone.add(id)
  }

  private addTag (row: SQLRow, videoModel: VideoModel) {
    if (!row['Tags.name']) return

    const key = `${row['Tags.VideoTagModel.videoId']}-${row['Tags.VideoTagModel.tagId']}`
    if (this.tagsDone.has(key)) return

    const attributes = this.grab(row, this.tables.getTagAttributes(), 'Tags')
    const tagModel = new TagModel(attributes, this.buildOpts)
    videoModel.Tags.push(tagModel)

    this.tagsDone.add(key)
  }

  private addTracker (row: SQLRow, videoModel: VideoModel) {
    if (!row['Trackers.id']) return

    const key = `${row['Trackers.VideoTrackerModel.videoId']}-${row['Trackers.VideoTrackerModel.trackerId']}`
    if (this.trackersDone.has(key)) return

    const attributes = this.grab(row, this.tables.getTrackerAttributes(), 'Trackers')
    const trackerModel = new TrackerModel(attributes, this.buildOpts)
    videoModel.Trackers.push(trackerModel)

    this.trackersDone.add(key)
  }

  private setBlacklisted (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoBlacklist.id']
    if (!id || this.blacklistDone.has(id)) return

    const attributes = this.grab(row, this.tables.getBlacklistedAttributes(), 'VideoBlacklist')
    videoModel.VideoBlacklist = new VideoBlacklistModel(attributes, this.buildOpts)

    this.blacklistDone.add(id)
  }

  private setBlockedOwner (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoChannel.Account.AccountBlocklist.id']
    if (!id) return

    const key = `${videoModel.id}-${id}`
    if (this.accountBlocklistDone.has(key)) return

    const attributes = this.grab(row, this.tables.getBlocklistAttributes(), 'VideoChannel.Account.AccountBlocklist')
    videoModel.VideoChannel.Account.BlockedBy.push(new AccountBlocklistModel(attributes, this.buildOpts))

    this.accountBlocklistDone.add(key)
  }

  private setBlockedServer (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoChannel.Account.Actor.Server.ServerBlocklist.id']
    if (!id || this.serverBlocklistDone.has(id)) return

    const key = `${videoModel.id}-${id}`
    if (this.serverBlocklistDone.has(key)) return

    const attributes = this.grab(row, this.tables.getBlocklistAttributes(), 'VideoChannel.Account.Actor.Server.ServerBlocklist')
    videoModel.VideoChannel.Account.Actor.Server.BlockedBy.push(new ServerBlocklistModel(attributes, this.buildOpts))

    this.serverBlocklistDone.add(key)
  }

  private setScheduleVideoUpdate (row: SQLRow, videoModel: VideoModel) {
    const id = row['ScheduleVideoUpdate.id']
    if (!id || this.scheduleVideoUpdateDone.has(id)) return

    const attributes = this.grab(row, this.tables.getScheduleUpdateAttributes(), 'ScheduleVideoUpdate')
    videoModel.ScheduleVideoUpdate = new ScheduleVideoUpdateModel(attributes, this.buildOpts)

    this.scheduleVideoUpdateDone.add(id)
  }

  private setLive (row: SQLRow, videoModel: VideoModel) {
    const id = row['VideoLive.id']
    if (!id || this.liveDone.has(id)) return

    const attributes = this.grab(row, this.tables.getLiveAttributes(), 'VideoLive')
    videoModel.VideoLive = new VideoLiveModel(attributes, this.buildOpts)

    this.liveDone.add(id)
  }

  private grab (row: SQLRow, attributes: string[], prefix: string) {
    const result: { [ id: string ]: string | number } = {}

    for (const a of attributes) {
      const key = prefix
        ? prefix + '.' + a
        : a

      result[a] = row[key]
    }

    return result
  }
}
