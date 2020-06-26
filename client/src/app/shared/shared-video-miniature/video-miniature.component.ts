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
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig, VideoPlaylistType, VideoPrivacy, VideoState } from '@shared/models'
import { Video } from '../shared-main'
import { VideoPlaylistService } from '../shared-video-playlist'
import { VideoActionsDisplayType } from './video-actions-dropdown.component'

export type OwnerDisplayType = 'account' | 'videoChannel' | 'auto'
export type MiniatureDisplayOptions = {
  date?: boolean
  views?: boolean
  by?: boolean
  avatar?: boolean
  privacyLabel?: boolean
  privacyText?: boolean
  state?: boolean
  blacklistInfo?: boolean
  nsfw?: boolean
}
export type VideoLinkType = 'internal' | 'lazy-load' | 'external'

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoMiniatureComponent implements OnInit {
  @Input() user: User
  @Input() video: Video

  @Input() ownerDisplayType: OwnerDisplayType = 'account'
  @Input() displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }
  @Input() displayAsRow = false
  @Input() displayVideoActions = true
  @Input() fitWidth = false

  @Input() videoLinkType: VideoLinkType = 'internal'

  @Output() videoBlocked = new EventEmitter()
  @Output() videoUnblocked = new EventEmitter()
  @Output() videoRemoved = new EventEmitter()
  @Output() videoAccountMuted = new EventEmitter()

  videoActionsDisplayOptions: VideoActionsDisplayType = {
    playlist: true,
    download: false,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true
  }
  showActions = false
  serverConfig: ServerConfig

  addToWatchLaterText: string
  addedToWatchLaterText: string
  inWatchLaterPlaylist: boolean
  channelLinkTitle = ''

  watchLaterPlaylist: {
    id: number
    playlistElementId?: number
  }

  videoRouterLink: any[] = []
  videoHref: string
  videoTarget: string

  private ownerDisplayTypeChosen: 'account' | 'videoChannel'

  constructor (
    private screenService: ScreenService,
    private serverService: ServerService,
    private i18n: I18n,
    private authService: AuthService,
    private videoPlaylistService: VideoPlaylistService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private localeId: string
  ) {}

  get isVideoBlur () {
    return this.video.isVideoNSFWForUser(this.user, this.serverConfig)
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => {
          this.serverConfig = config
          this.buildVideoLink()
        })

    this.setUpBy()

    this.channelLinkTitle = this.i18n(
      '{{name}} (channel page)',
      { name: this.video.channel.name, handle: this.video.byVideoChannel }
    )

    // We rely on mouseenter to lazy load actions
    if (this.screenService.isInTouchScreen()) {
      this.loadActions()
    }
  }

  buildVideoLink () {
    if (this.videoLinkType === 'internal' || !this.video.url) {
      this.videoRouterLink = [ '/videos/watch', this.video.uuid ]
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
    return this.ownerDisplayTypeChosen === 'account'
  }

  displayOwnerVideoChannel () {
    return this.ownerDisplayTypeChosen === 'videoChannel'
  }

  isUnlistedVideo () {
    return this.video.privacy.id === VideoPrivacy.UNLISTED
  }

  isPrivateVideo () {
    return this.video.privacy.id === VideoPrivacy.PRIVATE
  }

  getStateLabel (video: Video) {
    if (!video.state) return ''

    if (video.privacy.id !== VideoPrivacy.PRIVATE && video.state.id === VideoState.PUBLISHED) {
      return this.i18n('Published')
    }

    if (video.scheduledUpdate) {
      const updateAt = new Date(video.scheduledUpdate.updateAt.toString()).toLocaleString(this.localeId)
      return this.i18n('Publication scheduled on ') + updateAt
    }

    if (video.state.id === VideoState.TO_TRANSCODE && video.waitTranscoding === true) {
      return this.i18n('Waiting transcoding')
    }

    if (video.state.id === VideoState.TO_TRANSCODE) {
      return this.i18n('To transcode')
    }

    if (video.state.id === VideoState.TO_IMPORT) {
      return this.i18n('To import')
    }

    return ''
  }

  getAvatarUrl () {
    if (this.ownerDisplayTypeChosen === 'account') {
      return this.video.accountAvatarUrl
    }

    return this.video.videoChannelAvatarUrl
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

    this.videoPlaylistService.addVideoInPlaylist(this.watchLaterPlaylist.id, body).subscribe(
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

  private setUpBy () {
    if (this.ownerDisplayType === 'account' || this.ownerDisplayType === 'videoChannel') {
      this.ownerDisplayTypeChosen = this.ownerDisplayType
      return
    }

    // If the video channel name an UUID (not really displayable, we changed this behaviour in v1.0.0-beta.12)
    // -> Use the account name
    if (
      this.video.channel.name === `${this.video.account.name}_channel` ||
      this.video.channel.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    ) {
      this.ownerDisplayTypeChosen = 'account'
    } else {
      this.ownerDisplayTypeChosen = 'videoChannel'
    }
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

    this.videoPlaylistService.runPlaylistCheck(this.video.id)
  }
}
