import { switchMap } from 'rxjs/operators'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  Input,
  LOCALE_ID,
  OnInit,
  Output
} from '@angular/core'
import { AuthService, ScreenService, ServerService, User } from '@app/core'
import { HTMLServerConfig, VideoExistInPlaylist, VideoPlaylistType, VideoPrivacy, VideoState } from '@shared/models'
import { LinkType } from '../../../types/link.type'
import { ActorAvatarSize } from '../shared-actor-image/actor-avatar.component'
import { Video, VideoService } from '../shared-main'
import { VideoPlaylistService } from '../shared-video-playlist'
import { VideoActionsDisplayType } from './video-actions-dropdown.component'

export type MiniatureDisplayOptions = {
  date?: boolean
  views?: boolean
  avatar?: boolean
  privacyLabel?: boolean
  privacyText?: boolean
  state?: boolean
  blacklistInfo?: boolean
  nsfw?: boolean

  by?: boolean
  forceChannelInBy?: boolean
}
@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoMiniatureComponent implements OnInit {
  @Input() user: User
  @Input() video: Video
  @Input() containedInPlaylists: VideoExistInPlaylist[]

  @Input() displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false,
    forceChannelInBy: false
  }

  @Input() displayVideoActions = true
  @Input() videoActionsDisplayOptions: VideoActionsDisplayType = {
    playlist: true,
    download: false,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true,
    studio: false,
    stats: false
  }

  @Input() actorImageSize: ActorAvatarSize = '40'

  @Input() displayAsRow = false

  @Input() videoLinkType: LinkType = 'internal'

  @Output() videoBlocked = new EventEmitter()
  @Output() videoUnblocked = new EventEmitter()
  @Output() videoRemoved = new EventEmitter()
  @Output() videoAccountMuted = new EventEmitter()

  showActions = false
  serverConfig: HTMLServerConfig

  addToWatchLaterText: string
  addedToWatchLaterText: string
  inWatchLaterPlaylist: boolean
  channelLinkTitle = ''

  watchLaterPlaylist: {
    id: number
    playlistElementId?: number
  }

  videoRouterLink: string | any[] = []
  videoHref: string
  videoTarget: string

  private ownerDisplayType: 'account' | 'videoChannel'

  constructor (
    private screenService: ScreenService,
    private serverService: ServerService,
    private authService: AuthService,
    private videoPlaylistService: VideoPlaylistService,
    private videoService: VideoService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private localeId: string
  ) {}

  get authorAccount () {
    return this.serverConfig.client.videos.miniature.preferAuthorDisplayName
      ? this.video.account.displayName
      : this.video.byAccount
  }

  get authorChannel () {
    return this.serverConfig.client.videos.miniature.preferAuthorDisplayName
      ? this.video.channel.displayName
      : this.video.byVideoChannel
  }

  get isVideoBlur () {
    return this.video.isVideoNSFWForUser(this.user, this.serverConfig)
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()
    this.buildVideoLink()

    this.setUpBy()

    this.channelLinkTitle = $localize`${this.video.channel.name} (channel page)`

    // We rely on mouseenter to lazy load actions
    if (this.screenService.isInTouchScreen()) {
      this.loadActions()
    }
  }

  buildVideoLink () {
    if (this.videoLinkType === 'internal' || !this.video.url) {
      this.videoRouterLink = Video.buildWatchUrl(this.video)
      return
    }

    if (this.videoLinkType === 'external') {
      this.videoRouterLink = null
      this.videoHref = this.video.url
      this.videoTarget = '_blank'
      return
    }

    // Lazy load
    this.videoRouterLink = [ '/search/lazy-load-video', { url: this.video.url } ]
  }

  displayOwnerAccount () {
    return this.ownerDisplayType === 'account'
  }

  displayOwnerVideoChannel () {
    return this.ownerDisplayType === 'videoChannel'
  }

  isUnlistedVideo () {
    return this.video.privacy.id === VideoPrivacy.UNLISTED
  }

  isPrivateVideo () {
    return this.video.privacy.id === VideoPrivacy.PRIVATE
  }

  isPasswordProtectedVideo () {
    return this.video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }

  getStateLabel (video: Video) {
    if (!video.state) return ''

    if (video.privacy.id !== VideoPrivacy.PRIVATE && video.state.id === VideoState.PUBLISHED) {
      return $localize`Published`
    }

    if (video.scheduledUpdate) {
      const updateAt = new Date(video.scheduledUpdate.updateAt.toString()).toLocaleString(this.localeId)
      return $localize`Publication scheduled on ${updateAt}`
    }

    if (video.state.id === VideoState.TRANSCODING_FAILED) {
      return $localize`Transcoding failed`
    }

    if (video.state.id === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED) {
      return $localize`Move to external storage failed`
    }

    if (video.state.id === VideoState.TO_TRANSCODE && video.waitTranscoding === true) {
      return $localize`Waiting transcoding`
    }

    if (video.state.id === VideoState.TO_TRANSCODE) {
      return $localize`To transcode`
    }

    if (video.state.id === VideoState.TO_IMPORT) {
      return $localize`To import`
    }

    if (video.state.id === VideoState.TO_EDIT) {
      return $localize`To edit`
    }

    return ''
  }

  loadActions () {
    if (this.displayVideoActions) this.showActions = true

    this.loadWatchLater()
  }

  onVideoBlocked () {
    this.videoBlocked.emit()
  }

  onVideoUnblocked () {
    this.videoUnblocked.emit()
  }

  onVideoRemoved () {
    this.videoRemoved.emit()
  }

  onVideoAccountMuted () {
    this.videoAccountMuted.emit()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  onWatchLaterClick (currentState: boolean) {
    if (currentState === true) this.removeFromWatchLater()
    else this.addToWatchLater()

    this.inWatchLaterPlaylist = !currentState
  }

  addToWatchLater () {
    const body = { videoId: this.video.id }

    this.videoPlaylistService.addVideoInPlaylist(this.watchLaterPlaylist.id, body)
      .subscribe(
        res => {
          this.watchLaterPlaylist.playlistElementId = res.videoPlaylistElement.id
        }
      )
  }

  removeFromWatchLater () {
    this.videoPlaylistService.removeVideoFromPlaylist(this.watchLaterPlaylist.id, this.watchLaterPlaylist.playlistElementId, this.video.id)
        .subscribe(
          _ => { /* empty */ }
        )
  }

  isWatchLaterPlaylistDisplayed () {
    return this.displayVideoActions && this.isUserLoggedIn() && this.inWatchLaterPlaylist !== undefined
  }

  getClasses () {
    return {
      'display-as-row': this.displayAsRow
    }
  }

  private setUpBy () {
    if (this.displayOptions.forceChannelInBy) {
      this.ownerDisplayType = 'videoChannel'
      return
    }

    this.ownerDisplayType = this.videoService.buildDefaultOwnerDisplayType(this.video)
  }

  private loadWatchLater () {
    if (!this.isUserLoggedIn() || this.inWatchLaterPlaylist !== undefined) return

    this.authService.userInformationLoaded
        .pipe(switchMap(() => this.videoPlaylistService.listenToVideoPlaylistChange(this.video.id)))
        .subscribe(existResult => {
          const watchLaterPlaylist = this.authService.getUser().specialPlaylists.find(p => p.type === VideoPlaylistType.WATCH_LATER)
          const existsInWatchLater = existResult.find(r => r.playlistId === watchLaterPlaylist.id)
          this.inWatchLaterPlaylist = false

          this.watchLaterPlaylist = {
            id: watchLaterPlaylist.id
          }

          if (existsInWatchLater) {
            this.inWatchLaterPlaylist = true
            this.watchLaterPlaylist.playlistElementId = existsInWatchLater.playlistElementId
          }

          this.cd.markForCheck()
        })

    this.videoPlaylistService.runVideoExistsInPlaylistCheck(this.video.id)
  }
}
