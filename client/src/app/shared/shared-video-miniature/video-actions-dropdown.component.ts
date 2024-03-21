import { NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnChanges, Output, ViewChild, booleanAttribute } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ScreenService, ServerService } from '@app/core'
import { NgbDropdown, NgbDropdownAnchor, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@peertube/peertube-models'
import { of } from 'rxjs'
import { Actor } from '../shared-main/account/actor.model'
import {
  ActionDropdownComponent,
  DropdownAction,
  DropdownButtonSize,
  DropdownDirection
} from '../shared-main/buttons/action-dropdown.component'
import { RedundancyService } from '../shared-main/video/redundancy.service'
import { VideoDetails } from '../shared-main/video/video-details.model'
import { Video } from '../shared-main/video/video.model'
import { VideoService } from '../shared-main/video/video.service'
import { BlocklistService } from '../shared-moderation/blocklist.service'
import { VideoReportComponent } from '../shared-moderation/report-modals'
import { VideoBlockComponent } from '../shared-moderation/video-block.component'
import { VideoBlockService } from '../shared-moderation/video-block.service'
import { LiveStreamInformationComponent } from '../shared-video-live/live-stream-information.component'
import { VideoAddToPlaylistComponent } from '../shared-video-playlist/video-add-to-playlist.component'
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
  studio?: boolean
  stats?: boolean
}

@Component({
  selector: 'my-video-actions-dropdown',
  templateUrl: './video-actions-dropdown.component.html',
  styleUrls: [ './video-actions-dropdown.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    NgbDropdown,
    NgbDropdownAnchor,
    NgbDropdownMenu,
    VideoAddToPlaylistComponent,
    ActionDropdownComponent,
    VideoDownloadComponent,
    VideoReportComponent,
    VideoBlockComponent,
    LiveStreamInformationComponent
  ]
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
    transcoding: false,
    studio: true,
    stats: true
  }
  @Input() placement = 'left'
  @Input() moreActions: DropdownAction<{ video: Video }>[][] = []
  @Input({ transform: booleanAttribute }) actionAvailabilityHint = false

  @Input() label: string

  @Input({ transform: booleanAttribute }) buttonStyled = false
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
  private hasMutedAccount = false

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private blocklistService: BlocklistService,
    private videoBlocklistService: VideoBlockService,
    private screenService: ScreenService,
    private videoService: VideoService,
    private redundancyService: RedundancyService,
    private serverService: ServerService
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

    const obs = this.video instanceof VideoDetails
      ? of(this.video)
      : this.videoService.getVideo({ videoId: this.video.uuid })

    obs.subscribe((videoDetails: VideoDetails) => {
      this.videoDownloadModal.show(videoDetails, this.videoCaptions)
    })
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

  isVideoEditable () {
    return this.video.isEditableBy(this.user, this.serverService.getHTMLConfig().videoStudio.enabled)
  }

  isVideoStatsAvailable () {
    return this.video.isOwnerOrHasSeeAllVideosRight(this.user)
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

  isVideoDownloadableByAnonymous () {
    return (
      this.video &&
      this.video.isLive !== true &&
      this.video instanceof VideoDetails &&
      this.video.downloadEnabled
    )
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

  canRunForcedTranscoding () {
    return this.video.canRunForcedTranscoding(this.user)
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
      message += ' ' + $localize`The live stream will be automatically terminated and replays won't be saved.`
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
            this.hasMutedAccount = true
            this.videoAccountMuted.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  unmuteVideoAccount () {
    const params = { nameWithHost: Actor.CREATE_BY_STRING(this.video.account.name, this.video.account.host) }

    this.blocklistService.unblockAccountByUser(params)
        .subscribe({
          next: () => {
            this.hasMutedAccount = false
            this.notifier.success($localize`Account ${params.nameWithHost} unmuted.`)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async removeVideoFiles (video: Video, type: 'hls' | 'web-videos') {
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

  runTranscoding (video: Video, type: 'hls' | 'web-video') {
    this.videoService.runTranscoding({ videoIds: [ video.id ], type, askForForceTranscodingIfNeeded: true })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Transcoding jobs created for "${video.name}".`)
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
          isDisplayed: () => {
            if (!this.displayOptions.download) return false

            return this.isVideoDownloadableByAnonymous() || this.video.isOwnerOrHasSeeAllVideosRight(this.user)
          },
          iconName: 'download',
          ownerOrModeratorPrivilege: () => {
            if (!this.actionAvailabilityHint) return undefined
            if (this.isVideoDownloadableByAnonymous()) return undefined

            return $localize`This option is visible only to you`
          }
        },
        {
          label: $localize`Display live information`,
          handler: ({ video }) => this.showLiveInfoModal(video),
          isDisplayed: () => this.displayOptions.liveInfo && this.isVideoLiveInfoAvailable(),
          iconName: 'live'
        },
        {
          label: $localize`Update`,
          linkBuilder: ({ video }) => [ '/videos/update', video.shortUUID ],
          iconName: 'edit',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.update && this.isVideoUpdatable()
        },
        {
          label: $localize`Studio`,
          linkBuilder: ({ video }) => [ '/studio/edit', video.shortUUID ],
          iconName: 'film',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.studio && this.isVideoEditable()
        },
        {
          label: $localize`Stats`,
          linkBuilder: ({ video }) => [ '/stats/videos', video.shortUUID ],
          iconName: 'stats',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.stats && this.isVideoStatsAvailable()
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
          isDisplayed: () => this.displayOptions.transcoding && this.canRunForcedTranscoding(),
          iconName: 'cog'
        },
        {
          label: $localize`Run Web Video transcoding`,
          handler: ({ video }) => this.runTranscoding(video, 'web-video'),
          isDisplayed: () => this.displayOptions.transcoding && this.canRunForcedTranscoding(),
          iconName: 'cog'
        },
        {
          label: $localize`Delete HLS files`,
          handler: ({ video }) => this.removeVideoFiles(video, 'hls'),
          isDisplayed: () => this.displayOptions.removeFiles && this.canRemoveVideoFiles(),
          iconName: 'delete'
        },
        {
          label: $localize`Delete Web Video files`,
          handler: ({ video }) => this.removeVideoFiles(video, 'web-videos'),
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
        },
        {
          label: $localize`Unmute account`,
          handler: () => this.unmuteVideoAccount(),
          isDisplayed: () => {
            return this.authService.isLoggedIn() && this.displayOptions.mute && this.isVideoAccountMutable() && this.hasMutedAccount
          },
          iconName: 'undo'
        }
      ]
    ]

    this.videoActions = this.videoActions.concat(this.moreActions)
  }
}
