import { CommonModule, NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  booleanAttribute,
  inject,
  input,
  numberAttribute,
  output
} from '@angular/core'
import { AuthService, ScreenService, ServerService, User } from '@app/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, VideoPlaylistType, VideoPrivacy } from '@peertube/peertube-models'
import { first, switchMap } from 'rxjs/operators'
import { LinkType } from '../../../types/link.type'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { ActorHostComponent } from '../shared-actor/actor-host.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { LinkComponent } from '../shared-main/common/link.component'
import { DateToggleComponent } from '../shared-main/date/date-toggle.component'
import { Video } from '../shared-main/video/video.model'
import { VideoService } from '../shared-main/video/video.service'
import { VideoThumbnailComponent } from '../shared-thumbnail/video-thumbnail.component'
import { VideoPlaylistService } from '../shared-video-playlist/video-playlist.service'
import { VideoViewsCounterComponent } from '../shared-video/video-views-counter.component'
import { VideoActionsDisplayType, VideoActionsDropdownComponent } from './video-actions-dropdown.component'

export type MiniatureDisplayOptions = {
  date?: boolean
  views?: boolean
  avatar?: boolean
  privacyLabel?: boolean

  by?: boolean
  forceChannelInBy?: boolean
}

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    VideoThumbnailComponent,
    ActorAvatarComponent,
    LinkComponent,
    DateToggleComponent,
    VideoViewsCounterComponent,
    VideoActionsDropdownComponent,
    ActorHostComponent,
    GlobalIconComponent,
    NgbTooltipModule,
    NgTemplateOutlet
  ]
})
export class VideoMiniatureComponent implements OnInit {
  private screenService = inject(ScreenService)
  private serverService = inject(ServerService)
  private authService = inject(AuthService)
  private videoPlaylistService = inject(VideoPlaylistService)
  private videoService = inject(VideoService)
  private cd = inject(ChangeDetectorRef)

  readonly user = input.required<User>()
  readonly video = input.required<Video>()

  readonly displayOptions = input<MiniatureDisplayOptions>({
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: false,
    forceChannelInBy: false
  })

  readonly displayVideoActions = input(true)
  readonly videoActionsDisplayOptions = input<VideoActionsDisplayType>({
    playlist: true,
    download: false,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true
  })

  readonly actorImageSize = input(34, { transform: numberAttribute })

  readonly displayAsRow = input(false, { transform: booleanAttribute })

  readonly videoLinkType = input<LinkType>('internal')

  readonly videoBlocked = output()
  readonly videoUnblocked = output()
  readonly videoRemoved = output()
  readonly videoAccountMuted = output()

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

  ownerRouterLink: string | any[] = []
  ownerHref: string
  ownerTarget: string

  nsfwTooltip: string

  private ownerDisplayType: 'account' | 'videoChannel'
  private actionsLoaded = false

  get preferAuthorDisplayName () {
    return this.serverConfig.client.videos.miniature.preferAuthorDisplayName
  }

  get authorAccount () {
    return this.preferAuthorDisplayName
      ? this.video().account.displayName
      : this.video().account.name
  }

  get authorChannel () {
    return this.preferAuthorDisplayName
      ? this.video().channel.displayName
      : this.video().channel.name
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildVideoLink()
    this.buildOwnerLink()

    this.setUpBy()

    this.nsfwTooltip = this.videoService.buildNSFWTooltip(this.video())
    this.channelLinkTitle = $localize`${this.video().channel.name} (channel page)`

    // We rely on mouseenter to lazy load actions
    if (this.screenService.isInTouchScreen()) {
      this.loadActions()
    }
  }

  private buildVideoLink () {
    const videoLinkType = this.videoLinkType()
    const video = this.video()
    if (videoLinkType === 'internal' || !video.url) {
      this.videoRouterLink = Video.buildWatchUrl(video)
      return
    }

    if (videoLinkType === 'external') {
      this.videoRouterLink = null
      this.videoHref = video.url
      this.videoTarget = '_blank'
      return
    }

    // Lazy load
    this.videoRouterLink = [ '/search/lazy-load-video', { url: video.url } ]
  }

  private buildOwnerLink () {
    const video = this.video()

    const linkType = this.videoLinkType()

    if (linkType === 'internal' || !video.channel.url) {
      this.ownerRouterLink = `/c/${video.byVideoChannel}`
      return
    }

    if (linkType === 'external') {
      this.ownerRouterLink = null
      this.ownerHref = video.channel.url
      this.ownerTarget = '_blank'
      return
    }

    // Lazy load
    this.ownerRouterLink = [ '/search/lazy-load-channel', { url: video.channel.url } ]
  }

  // ---------------------------------------------------------------------------

  displayOwnerAccount () {
    return this.ownerDisplayType === 'account'
  }

  displayOwnerVideoChannel () {
    return this.ownerDisplayType === 'videoChannel'
  }

  isUnlistedVideo () {
    return this.video().privacy.id === VideoPrivacy.UNLISTED
  }

  isPrivateVideo () {
    return this.video().privacy.id === VideoPrivacy.PRIVATE
  }

  isPasswordProtectedVideo () {
    return this.video().privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }

  getAriaLabel () {
    return $localize`Watch video ${this.video().name}`
  }

  loadActions () {
    if (this.actionsLoaded) return
    if (this.displayVideoActions()) this.showActions = true

    this.loadWatchLater()

    this.actionsLoaded = true
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
    const body = { videoId: this.video().id }

    this.videoPlaylistService.addVideoInPlaylist(this.watchLaterPlaylist.id, body)
      .subscribe(
        res => {
          this.watchLaterPlaylist.playlistElementId = res.videoPlaylistElement.id
        }
      )
  }

  removeFromWatchLater () {
    this.videoPlaylistService.removeVideoFromPlaylist(
      this.watchLaterPlaylist.id,
      this.watchLaterPlaylist.playlistElementId,
      this.video().id
    )
      .subscribe(
        _ => {
          // empty
        }
      )
  }

  isWatchLaterPlaylistDisplayed () {
    return !this.screenService.isInTouchScreen() &&
      this.displayVideoActions() &&
      this.isUserLoggedIn() &&
      this.inWatchLaterPlaylist !== undefined
  }

  getClasses () {
    return {
      'display-as-row': this.displayAsRow(),
      'has-avatar': this.displayOptions().avatar
    }
  }

  // ---------------------------------------------------------------------------

  hasNSFWWarning () {
    return this.video().isNSFWWarnedForUser(this.user(), this.serverConfig)
  }

  hasNSFWBlur () {
    return this.video().isNSFWBlurForUser(this.user(), this.serverConfig)
  }

  // ---------------------------------------------------------------------------

  private setUpBy () {
    if (this.displayOptions().forceChannelInBy) {
      this.ownerDisplayType = 'videoChannel'
      return
    }

    this.ownerDisplayType = this.videoService.buildDefaultOwnerDisplayType(this.video())
  }

  private loadWatchLater () {
    if (this.screenService.isInTouchScreen() || !this.displayVideoActions() || !this.isUserLoggedIn()) return

    this.authService.userInformationLoaded
      .pipe(first(), switchMap(() => this.videoPlaylistService.listenToVideoPlaylistChange(this.video().id)))
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

    this.videoPlaylistService.runVideoExistsInPlaylistCheck(this.video().id)
  }
}
