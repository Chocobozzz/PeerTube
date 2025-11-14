import { NgClass, NgStyle } from '@angular/common'
import { Component, OnChanges, inject, input, output, viewChild } from '@angular/core'
import { RedirectService, ScreenService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoShareComponent } from '@app/shared/shared-share-modal/video-share.component'
import { SupportModalComponent } from '@app/shared/shared-support-modal/support-modal.component'
import { VideoDownloadComponent } from '@app/shared/shared-video-miniature/download/video-download.component'
import { VideoActionsDisplayType, VideoActionsDropdownComponent } from '@app/shared/shared-video-miniature/video-actions-dropdown.component'
import { VideoAddToPlaylistComponent } from '@app/shared/shared-video-playlist/video-add-to-playlist.component'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { UserVideoRateType, VideoCaption, VideoPrivacy } from '@peertube/peertube-models'
import { VideoRateComponent } from './video-rate.component'

@Component({
  selector: 'my-action-buttons',
  templateUrl: './action-buttons.component.html',
  styleUrls: [ './action-buttons.component.scss' ],
  imports: [
    VideoRateComponent,
    NgbTooltip,
    GlobalIconComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    VideoAddToPlaylistComponent,
    VideoDownloadComponent,
    VideoActionsDropdownComponent,
    NgClass,
    NgStyle,
    SupportModalComponent,
    VideoShareComponent
  ]
})
export class ActionButtonsComponent implements OnChanges {
  private screenService = inject(ScreenService)
  private redirectService = inject(RedirectService)

  readonly videoShareModal = viewChild<VideoShareComponent>('videoShareModal')
  readonly supportModal = viewChild<SupportModalComponent>('supportModal')
  readonly videoDownloadModal = viewChild<VideoDownloadComponent>('videoDownloadModal')

  readonly video = input<VideoDetails>(undefined)
  readonly videoPassword = input<string>(undefined)
  readonly videoCaptions = input<VideoCaption[]>(undefined)
  readonly playlist = input<VideoPlaylist>(undefined)

  readonly isUserLoggedIn = input<boolean>(undefined)
  readonly isUserOwner = input<boolean>(undefined)

  readonly transcriptionWidgetOpened = input<boolean>(undefined)

  readonly currentTime = input<number>(undefined)
  readonly currentPlaylistPosition = input<number>(undefined)

  readonly showTranscriptionWidget = output()
  readonly hideTranscriptionWidget = output()

  likesBarTooltipText = ''

  tooltipSupport = ''
  tooltipSaveToPlaylist = ''

  videoActionsOptions: VideoActionsDisplayType = {
    playlist: false,
    download: true,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true,
    liveInfo: true,
    generateTranscription: true,
    transcriptionWidget: true,
    transcoding: true
  }

  userRating: UserVideoRateType

  ngOnChanges () {
    this.setVideoLikesBarTooltipText()

    if (this.isUserLoggedIn()) {
      this.videoActionsOptions.download = true

      // Hide the tooltips for unlogged users in mobile view, this adds confusion with the popover
      if (!this.screenService.isInMobileView()) {
        this.tooltipSupport = $localize`Open the modal to support the video uploader`
        this.tooltipSaveToPlaylist = $localize`Save to playlist`
      }
    } else {
      this.videoActionsOptions.download = false
    }
  }

  showDownloadModal () {
    this.videoDownloadModal().show(this.video(), this.videoCaptions())
  }

  isVideoDownloadable () {
    const video = this.video()
    return video && video instanceof VideoDetails && video.downloadEnabled && !video.isLive
  }

  showSupportModal () {
    this.supportModal().show()
  }

  showShareModal () {
    this.videoShareModal().show(this.currentTime(), this.currentPlaylistPosition())
  }

  onRateUpdated (userRating: UserVideoRateType) {
    this.userRating = userRating
    this.setVideoLikesBarTooltipText()
  }

  onVideoRemoved () {
    this.redirectService.redirectToHomepage()
  }

  private setVideoLikesBarTooltipText () {
    this.likesBarTooltipText = `${this.video().likes} likes / ${this.video().dislikes} dislikes`
  }

  isVideoAddableToPlaylist () {
    const isPasswordProtected = this.video().privacy.id === VideoPrivacy.PASSWORD_PROTECTED

    if (!this.isUserLoggedIn()) return false

    if (isPasswordProtected) return this.isUserOwner()

    return true
  }
}
