import { Component, Input, OnChanges, OnInit, ViewChild } from '@angular/core'
import { RedirectService, ScreenService } from '@app/core'
import { UserVideoRateType, VideoCaption, VideoPrivacy } from '@peertube/peertube-models'
import {
  VideoActionsDisplayType,
  VideoActionsDropdownComponent
} from '../../../../shared/shared-video-miniature/video-actions-dropdown.component'
import { VideoAddToPlaylistComponent } from '../../../../shared/shared-video-playlist/video-add-to-playlist.component'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { NgbTooltip, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap'
import { NgIf, NgClass, NgStyle } from '@angular/common'
import { VideoRateComponent } from './video-rate.component'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoShareComponent } from '@app/shared/shared-share-modal/video-share.component'
import { SupportModalComponent } from '@app/shared/shared-support-modal/support-modal.component'
import { VideoDownloadComponent } from '@app/shared/shared-video-miniature/video-download.component'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'

@Component({
  selector: 'my-action-buttons',
  templateUrl: './action-buttons.component.html',
  styleUrls: [ './action-buttons.component.scss' ],
  standalone: true,
  imports: [
    VideoRateComponent,
    NgIf,
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
export class ActionButtonsComponent implements OnInit, OnChanges {
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('supportModal') supportModal: SupportModalComponent
  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent

  @Input() video: VideoDetails
  @Input() videoPassword: string
  @Input() videoCaptions: VideoCaption[]
  @Input() playlist: VideoPlaylist

  @Input() isUserLoggedIn: boolean
  @Input() isUserOwner: boolean

  @Input() currentTime: number
  @Input() currentPlaylistPosition: number

  likesBarTooltipText = ''

  tooltipSupport = ''
  tooltipSaveToPlaylist = ''

  videoActionsOptions: VideoActionsDisplayType = {
    playlist: false,
    download: true,
    update: true,
    studio: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true,
    liveInfo: true,
    stats: true
  }

  userRating: UserVideoRateType

  constructor (
    private screenService: ScreenService,
    private redirectService: RedirectService
  ) { }

  ngOnInit () {
    // Hide the tooltips for unlogged users in mobile view, this adds confusion with the popover
    if (this.isUserLoggedIn || !this.screenService.isInMobileView()) {
      this.tooltipSupport = $localize`Open the modal to support the video uploader`
      this.tooltipSaveToPlaylist = $localize`Save to playlist`
    }
  }

  ngOnChanges () {
    this.setVideoLikesBarTooltipText()
  }

  showDownloadModal () {
    this.videoDownloadModal.show(this.video, this.videoCaptions)
  }

  isVideoDownloadable () {
    return this.video && this.video instanceof VideoDetails && this.video.downloadEnabled && !this.video.isLive
  }

  showSupportModal () {
    this.supportModal.show()
  }

  showShareModal () {
    this.videoShareModal.show(this.currentTime, this.currentPlaylistPosition)
  }

  onRateUpdated (userRating: UserVideoRateType) {
    this.userRating = userRating
    this.setVideoLikesBarTooltipText()
  }

  onVideoRemoved () {
    this.redirectService.redirectToHomepage()
  }

  private setVideoLikesBarTooltipText () {
    this.likesBarTooltipText = `${this.video.likes} likes / ${this.video.dislikes} dislikes`
  }

  isVideoAddableToPlaylist () {
    const isPasswordProtected = this.video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED

    if (!this.isUserLoggedIn) return false

    if (isPasswordProtected) return this.isUserOwner

    return true
  }
}
