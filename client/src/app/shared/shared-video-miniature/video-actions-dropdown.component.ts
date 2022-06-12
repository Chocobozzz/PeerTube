import { Component, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ScreenService } from '@app/core'
import { BlocklistService, VideoBlockComponent, VideoBlockService, VideoReportComponent } from '@app/shared/shared-moderation'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@shared/models'
import {
  Actor,
  DropdownAction,
  DropdownButtonSize,
  DropdownDirection,
  RedundancyService,
  Video,
  VideoDetails,
  VideoService
} from '../shared-main'
import { LiveStreamInformationComponent } from '../shared-video-live'
import { VideoAddToPlaylistComponent } from '../shared-video-playlist'
import { VideoDownloadComponent } from './video-download.component'

export type VideoActionsDisplayType = {
  playlist?: boolean
  download?: boolean
  update?: boolean
  blacklist?: boolean
  delete?: boolean
  report?: boolean
  duplicate?: boolean
  mute?: boolean
  liveInfo?: boolean
  removeFiles?: boolean
  transcoding?: boolean
}

@Component({
  selector: 'my-video-actions-dropdown',
  templateUrl: './video-actions-dropdown.component.html',
  styleUrls: [ './video-actions-dropdown.component.scss' ]
})
export class VideoActionsDropdownComponent implements OnChanges {
  @ViewChild('playlistDropdown') playlistDropdown: NgbDropdown
  @ViewChild('playlistAdd') playlistAdd: VideoAddToPlaylistComponent

  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent
  @ViewChild('videoReportModal') videoReportModal: VideoReportComponent
  @ViewChild('videoBlockModal') videoBlockModal: VideoBlockComponent
  @ViewChild('liveStreamInformationModal') liveStreamInformationModal: LiveStreamInformationComponent

  @Input() video: Video | VideoDetails
  @Input() videoCaptions: VideoCaption[] = []

  @Input() displayOptions: VideoActionsDisplayType = {
    playlist: false,
    download: true,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true,
    liveInfo: false,
    removeFiles: false,
    transcoding: false
  }
  @Input() placement = 'left'

  @Input() label: string

  @Input() buttonStyled = false
  @Input() buttonSize: DropdownButtonSize = 'normal'
  @Input() buttonDirection: DropdownDirection = 'vertical'

  @Output() videoFilesRemoved = new EventEmitter()
  @Output() videoRemoved = new EventEmitter()
  @Output() videoUnblocked = new EventEmitter()
  @Output() videoBlocked = new EventEmitter()
  @Output() videoAccountMuted = new EventEmitter()
  @Output() transcodingCreated = new EventEmitter()
  @Output() modalOpened = new EventEmitter()

  videoActions: DropdownAction<{ video: Video }>[][] = []

  private loaded = false

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private blocklistService: BlocklistService,
    private videoBlocklistService: VideoBlockService,
    private screenService: ScreenService,
    private videoService: VideoService,
    private redundancyService: RedundancyService
  ) { }

  get user () {
    return this.authService.getUser()
  }

  ngOnChanges () {
    if (this.loaded) {
      this.loaded = false
      if (this.playlistAdd) this.playlistAdd.reload()
    }

    this.buildActions()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  loadDropdownInformation () {
    if (!this.isUserLoggedIn() || this.loaded === true) return

    this.loaded = true

    if (this.displayOptions.playlist) this.playlistAdd.load()
  }

  /* Show modals */

  showDownloadModal () {
    this.modalOpened.emit()

    this.videoDownloadModal.show(this.video as VideoDetails, this.videoCaptions)
  }

  showReportModal () {
    this.modalOpened.emit()

    this.videoReportModal.show()
  }

  showBlockModal () {
    this.modalOpened.emit()

    this.videoBlockModal.show([ this.video ])
  }

  showLiveInfoModal (video: Video) {
    this.modalOpened.emit()

    this.liveStreamInformationModal.show(video)
  }

  /* Actions checker */

  isVideoUpdatable () {
    return this.video.isUpdatableBy(this.user)
  }

  isVideoRemovable () {
    return this.video.isRemovableBy(this.user)
  }

  isVideoBlockable () {
    return this.video.isBlockableBy(this.user)
  }

  isVideoUnblockable () {
    return this.video.isUnblockableBy(this.user)
  }

  isVideoLiveInfoAvailable () {
    return this.video.isLiveInfoAvailableBy(this.user)
  }

  isVideoDownloadable () {
    return this.video &&
      this.video.isLive !== true &&
      this.video instanceof VideoDetails &&
      this.video.downloadEnabled
  }

  canVideoBeDuplicated () {
    return !this.video.isLive && this.video.canBeDuplicatedBy(this.user)
  }

  isVideoAccountMutable () {
    return this.video.account.id !== this.user.account.id
  }

  canRemoveVideoFiles () {
    return this.video.canRemoveFiles(this.user)
  }

  canRunTranscoding () {
    return this.video.canRunTranscoding(this.user)
  }

  /* Action handlers */

  async unblockVideo () {
    const confirmMessage = $localize`Do you really want to unblock ${this.video.name}? It will be available again in the videos list.`

    const res = await this.confirmService.confirm(confirmMessage, $localize`Unblock ${this.video.name}`)
    if (res === false) return

    this.videoBlocklistService.unblockVideo(this.video.id)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Video ${this.video.name} unblocked.`)

            this.video.blacklisted = false
            this.video.blacklistedReason = null

            this.videoUnblocked.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async removeVideo () {
    this.modalOpened.emit()

    let message = $localize`Do you really want to delete ${this.video.name}?`
    if (this.video.isLive) {
      message += ' ' + $localize`The live stream will be automatically terminated.`
    }

    const res = await this.confirmService.confirm(message, $localize`Delete ${this.video.name}`)
    if (res === false) return

    this.videoService.removeVideo(this.video.id)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Video ${this.video.name} deleted.`)
            this.videoRemoved.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  duplicateVideo () {
    this.redundancyService.addVideoRedundancy(this.video)
        .subscribe({
          next: () => {
            const message = $localize`${this.video.name} will be duplicated by your instance.`
            this.notifier.success(message)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  muteVideoAccount () {
    const params = { nameWithHost: Actor.CREATE_BY_STRING(this.video.account.name, this.video.account.host) }

    this.blocklistService.blockAccountByUser(params)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Account ${params.nameWithHost} muted.`)
            this.videoAccountMuted.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async removeVideoFiles (video: Video, type: 'hls' | 'webtorrent') {
    const confirmMessage = $localize`Do you really want to remove "${this.video.name}" files?`

    const res = await this.confirmService.confirm(confirmMessage, $localize`Remove "${this.video.name}" files`)
    if (res === false) return

    this.videoService.removeVideoFiles([ video.id ], type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Removed files of ${video.name}.`)
          this.videoFilesRemoved.emit()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  runTranscoding (video: Video, type: 'hls' | 'webtorrent') {
    this.videoService.runTranscoding([ video.id ], type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Transcoding jobs created for ${video.name}.`)
          this.transcodingCreated.emit()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  onVideoBlocked () {
    this.videoBlocked.emit()
  }

  getPlaylistDropdownPlacement () {
    if (this.screenService.isInSmallView()) {
      return 'bottom-right'
    }

    return 'bottom-left bottom-right'
  }

  private buildActions () {
    this.videoActions = [
      [
        {
          label: $localize`Save to playlist`,
          handler: () => this.playlistDropdown.toggle(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.playlist,
          iconName: 'playlist-add'
        }
      ],
      [ // actions regarding the video
        {
          label: $localize`Download`,
          handler: () => this.showDownloadModal(),
          isDisplayed: () => this.displayOptions.download && this.isVideoDownloadable(),
          iconName: 'download'
        },
        {
          label: $localize`Display live information`,
          handler: ({ video }) => this.showLiveInfoModal(video),
          isDisplayed: () => this.displayOptions.liveInfo && this.isVideoLiveInfoAvailable(),
          iconName: 'live'
        },
        {
          label: $localize`Update`,
          linkBuilder: ({ video }) => [ '/videos/update', video.uuid ],
          iconName: 'edit',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.update && this.isVideoUpdatable()
        },
        {
          label: $localize`Block`,
          handler: () => this.showBlockModal(),
          iconName: 'no',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.blacklist && this.isVideoBlockable()
        },
        {
          label: $localize`Unblock`,
          handler: () => this.unblockVideo(),
          iconName: 'undo',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.blacklist && this.isVideoUnblockable()
        },
        {
          label: $localize`Mirror`,
          handler: () => this.duplicateVideo(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.duplicate && this.canVideoBeDuplicated(),
          iconName: 'cloud-download'
        },
        {
          label: $localize`Delete`,
          handler: () => this.removeVideo(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.delete && this.isVideoRemovable(),
          iconName: 'delete'
        },
        {
          label: $localize`Report`,
          handler: () => this.showReportModal(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.report,
          iconName: 'flag'
        }
      ],
      [
        {
          label: $localize`Run HLS transcoding`,
          handler: ({ video }) => this.runTranscoding(video, 'hls'),
          isDisplayed: () => this.displayOptions.transcoding && this.canRunTranscoding(),
          iconName: 'cog'
        },
        {
          label: $localize`Run WebTorrent transcoding`,
          handler: ({ video }) => this.runTranscoding(video, 'webtorrent'),
          isDisplayed: () => this.displayOptions.transcoding && this.canRunTranscoding(),
          iconName: 'cog'
        },
        {
          label: $localize`Delete HLS files`,
          handler: ({ video }) => this.removeVideoFiles(video, 'hls'),
          isDisplayed: () => this.displayOptions.removeFiles && this.canRemoveVideoFiles(),
          iconName: 'delete'
        },
        {
          label: $localize`Delete WebTorrent files`,
          handler: ({ video }) => this.removeVideoFiles(video, 'webtorrent'),
          isDisplayed: () => this.displayOptions.removeFiles && this.canRemoveVideoFiles(),
          iconName: 'delete'
        }
      ],
      [ // actions regarding the account/its server
        {
          label: $localize`Mute account`,
          handler: () => this.muteVideoAccount(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.mute && this.isVideoAccountMutable(),
          iconName: 'no'
        }
      ]
    ]
  }
}
