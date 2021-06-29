import { Component, Input, OnChanges, OnInit, ViewChild } from '@angular/core'
import { RedirectService, ScreenService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main'
import { VideoShareComponent } from '@app/shared/shared-share-modal'
import { SupportModalComponent } from '@app/shared/shared-support-modal'
import { VideoActionsDisplayType, VideoDownloadComponent } from '@app/shared/shared-video-miniature'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { UserVideoRateType, VideoCaption } from '@shared/models/videos'

@Component({
  selector: 'my-action-buttons',
  templateUrl: './action-buttons.component.html',
  styleUrls: [ './action-buttons.component.scss' ]
})
export class ActionButtonsComponent implements OnInit, OnChanges {
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('supportModal') supportModal: SupportModalComponent
  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent

  @Input() video: VideoDetails
  @Input() videoCaptions: VideoCaption[]
  @Input() playlist: VideoPlaylist

  @Input() isUserLoggedIn: boolean

  @Input() currentTime: number
  @Input() currentPlaylistPosition: number

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
    liveInfo: true
  }

  userRating: UserVideoRateType

  constructor (
    private screenService: ScreenService,
    private redirectService: RedirectService
  ) { }

  ngOnInit () {
    // Hide the tooltips for unlogged users in mobile view, this adds confusion with the popover
    if (this.isUserLoggedIn || !this.screenService.isInMobileView()) {
      this.tooltipSupport = $localize`Support options for this video`
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
}
