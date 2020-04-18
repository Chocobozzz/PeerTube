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
import { User } from '../users'
import { Video } from './video.model'
import { AuthService, ServerService } from '@app/core'
import { ServerConfig, VideoPlaylistType, VideoPrivacy, VideoState } from '../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoActionsDisplayType } from '@app/shared/video/video-actions-dropdown.component'
import { ScreenService } from '@app/shared/misc/screen.service'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { switchMap } from 'rxjs/operators'

export type OwnerDisplayType = 'account' | 'videoChannel' | 'auto'
export type MiniatureDisplayOptions = {
  date?: boolean
  views?: boolean
  by?: boolean
  privacyLabel?: boolean
  privacyText?: boolean
  state?: boolean
  blacklistInfo?: boolean
  nsfw?: boolean
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

  @Input() ownerDisplayType: OwnerDisplayType = 'account'
  @Input() displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }
  @Input() displayAsRow = false
  @Input() displayVideoActions = true

  @Output() videoBlacklisted = new EventEmitter()
  @Output() videoUnblacklisted = new EventEmitter()
  @Output() videoRemoved = new EventEmitter()

  videoActionsDisplayOptions: VideoActionsDisplayType = {
    playlist: true,
    download: false,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true
  }
  showActions = false
  serverConfig: ServerConfig

  addToWatchLaterText: string
  addedToWatchLaterText: string
  inWatchLaterPlaylist: boolean

  watchLaterPlaylist: {
    id: number
    playlistElementId?: number
  }

  private ownerDisplayTypeChosen: 'account' | 'videoChannel'

  constructor (
    private screenService: ScreenService,
    private serverService: ServerService,
    private i18n: I18n,
    private authService: AuthService,
    private videoPlaylistService: VideoPlaylistService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private localeId: string
  ) {

  }

  get isVideoBlur () {
    return this.video.isVideoNSFWForUser(this.user, this.serverConfig)
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.setUpBy()

    // We rely on mouseenter to lazy load actions
    if (this.screenService.isInTouchScreen()) {
      this.loadActions()
    }
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

  loadActions () {
    if (this.displayVideoActions) this.showActions = true

    this.loadWatchLater()
  }

  onVideoBlacklisted () {
    this.videoBlacklisted.emit()
  }

  onVideoUnblacklisted () {
    this.videoUnblacklisted.emit()
  }

  onVideoRemoved () {
    this.videoRemoved.emit()
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
    return this.isUserLoggedIn() && this.inWatchLaterPlaylist !== undefined
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
