import { Component, OnChanges, booleanAttribute, inject, input, output, viewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ScreenService, ServerService } from '@app/core'
import { NgbDropdown, NgbDropdownAnchor, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap'
import { VideoCaption } from '@peertube/peertube-models'
import { of } from 'rxjs'
import { Actor } from '../shared-main/account/actor.model'
import {
  ActionDropdownComponent,
  DropdownAction,
  DropdownButtonIcon,
  DropdownButtonSize
} from '../shared-main/buttons/action-dropdown.component'
import { VideoCaptionService } from '../shared-main/video-caption/video-caption.service'
import { RedundancyService } from '../shared-main/video/redundancy.service'
import { VideoDetails } from '../shared-main/video/video-details.model'
import { Video } from '../shared-main/video/video.model'
import { VideoService } from '../shared-main/video/video.service'
import { BlocklistService } from '../shared-moderation/blocklist.service'
import { VideoReportComponent } from '../shared-moderation/report-modals'
import { VideoBlockComponent } from '../shared-moderation/video-block.component'
import { VideoBlockService } from '../shared-moderation/video-block.service'
import { VideoAddToPlaylistComponent } from '../shared-video-playlist/video-add-to-playlist.component'
import { VideoDownloadComponent } from './download/video-download.component'

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
  generateTranscription?: boolean
  transcriptionWidget?: boolean
}

@Component({
  selector: 'my-video-actions-dropdown',
  templateUrl: './video-actions-dropdown.component.html',
  styleUrls: [ './video-actions-dropdown.component.scss' ],
  imports: [
    NgbDropdown,
    NgbDropdownAnchor,
    NgbDropdownMenu,
    VideoAddToPlaylistComponent,
    ActionDropdownComponent,
    VideoDownloadComponent,
    VideoReportComponent,
    VideoBlockComponent
  ]
})
export class VideoActionsDropdownComponent implements OnChanges {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private blocklistService = inject(BlocklistService)
  private videoBlocklistService = inject(VideoBlockService)
  private screenService = inject(ScreenService)
  private videoService = inject(VideoService)
  private videoCaptionService = inject(VideoCaptionService)
  private redundancyService = inject(RedundancyService)
  private serverService = inject(ServerService)

  readonly playlistDropdown = viewChild<NgbDropdown>('playlistDropdown')
  readonly playlistAdd = viewChild<VideoAddToPlaylistComponent>('playlistAdd')

  readonly videoDownloadModal = viewChild<VideoDownloadComponent>('videoDownloadModal')
  readonly videoReportModal = viewChild<VideoReportComponent>('videoReportModal')
  readonly videoBlockModal = viewChild<VideoBlockComponent>('videoBlockModal')

  readonly video = input<Video | VideoDetails>(undefined)
  readonly videoCaptions = input<VideoCaption[]>([])

  readonly displayOptions = input<VideoActionsDisplayType>({
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
    generateTranscription: false,
    transcriptionWidget: false
  })
  readonly placement = input('auto')
  readonly moreActions = input<DropdownAction<{
    video: Video
  }>[][]>([])
  readonly actionAvailabilityHint = input(false, { transform: booleanAttribute })

  readonly label = input<string>(undefined)

  readonly buttonStyled = input(false, { transform: booleanAttribute })
  readonly buttonSize = input<DropdownButtonSize>('normal')
  readonly buttonIcon = input<DropdownButtonIcon>('more-vertical')

  readonly transcriptionWidgetOpened = input<boolean>(undefined)

  readonly videoFilesRemoved = output()
  readonly videoRemoved = output()
  readonly videoUnblocked = output()
  readonly videoBlocked = output()
  readonly videoAccountMuted = output()
  readonly transcodingCreated = output()
  readonly modalOpened = output()
  readonly videoExistsInPlaylistChange = output()

  readonly showTranscriptionWidget = output()
  readonly hideTranscriptionWidget = output()

  videoActions: DropdownAction<{ video: Video }>[][] = []

  dropdownOpened = false

  private hasMutedAccount = false

  get user () {
    return this.authService.getUser()
  }

  ngOnChanges () {
    const playlistAdd = this.playlistAdd()
    if (playlistAdd) playlistAdd.reload()

    this.buildActions()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  // ---------------------------------------------------------------------------
  // Show modals
  // ---------------------------------------------------------------------------

  showDownloadModal () {
    this.modalOpened.emit()

    const video = this.video()
    const obs = video instanceof VideoDetails
      ? of(video)
      : this.videoService.getVideo({ videoId: video.uuid })

    obs.subscribe((videoDetails: VideoDetails) => {
      this.videoDownloadModal().show(videoDetails, this.videoCaptions())
    })
  }

  showReportModal () {
    this.modalOpened.emit()

    this.videoReportModal().show()
  }

  showBlockModal () {
    this.modalOpened.emit()

    this.videoBlockModal().show([ this.video() ])
  }

  // ---------------------------------------------------------------------------
  // Actions checker
  // ---------------------------------------------------------------------------

  isVideoUpdatable () {
    if (!this.user) return false

    return this.video().isUpdatableBy(this.user)
  }

  isVideoEditable () {
    if (!this.user) return false

    return this.video().isEditableBy(this.user, this.serverService.getHTMLConfig().videoStudio.enabled)
  }

  isVideoStatsAvailable () {
    if (!this.user) return false

    const video = this.video()
    return video.isLocal && video.isOwnerOrHasSeeAllVideosRight(this.user)
  }

  isVideoRemovable () {
    if (!this.user) return false

    return this.video().isRemovableBy(this.user)
  }

  isVideoBlockable () {
    if (!this.user) return false

    return this.video().isBlockableBy(this.user)
  }

  isVideoUnblockable () {
    if (!this.user) return false

    return this.video().isUnblockableBy(this.user)
  }

  isVideoLiveInfoAvailable () {
    if (!this.user) return false

    return this.video().isLiveInfoAvailableBy(this.user)
  }

  canGenerateTranscription () {
    if (!this.user) return false

    return this.video().canGenerateTranscription(this.user, this.serverService.getHTMLConfig().videoTranscription.enabled)
  }

  // ---------------------------------------------------------------------------

  isVideoDownloadableByAnonymous () {
    const video = this.video()
    return (
      video &&
      video.isLive !== true &&
      video instanceof VideoDetails &&
      video.downloadEnabled
    )
  }

  isVideoDownloadableByUser () {
    if (!this.user) return false

    const video = this.video()
    return (
      video &&
      video.isLive !== true &&
      video.isOwnerOrHasSeeAllVideosRight(this.user)
    )
  }

  // ---------------------------------------------------------------------------

  canVideoBeDuplicated () {
    if (!this.user) return false

    const video = this.video()
    return !video.isLive && video.canBeDuplicatedBy(this.user)
  }

  isVideoAccountMutable () {
    if (!this.user) return false

    return this.video().account.id !== this.user.account.id
  }

  canRemoveVideoFiles () {
    if (!this.user) return false

    return this.video().canRemoveAllHLSOrWebFiles(this.user)
  }

  canRunTranscoding () {
    if (!this.user) return false

    return this.video().canRunTranscoding(this.user)
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async unblockVideo () {
    const confirmMessage = $localize`Do you really want to unblock ${this.video().name}? It will be available again in the videos list.`

    const res = await this.confirmService.confirm(confirmMessage, $localize`Unblock ${this.video().name}`)
    if (res === false) return

    this.videoBlocklistService.unblockVideo(this.video().id)
      .subscribe({
        next: () => {
          const video = this.video()
          this.notifier.success($localize`Video ${video.name} unblocked.`)

          video.blacklisted = false
          video.blacklistedReason = null

          this.videoUnblocked.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async removeVideo () {
    this.modalOpened.emit()

    let message = $localize`Do you really want to delete ${this.video().name}?`
    const video = this.video()
    if (video.isLive) {
      message += ' ' + $localize`The live stream will be automatically terminated and replays won't be saved.`
    }

    const res = await this.confirmService.confirm(message, $localize`Delete ${video.name}`)
    if (res === false) return

    this.videoService.removeVideo(video.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Video ${this.video().name} deleted.`)
          this.videoRemoved.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  duplicateVideo () {
    this.redundancyService.addVideoRedundancy(this.video())
      .subscribe({
        next: () => {
          const message = $localize`${this.video().name} will be duplicated by your platform.`
          this.notifier.success(message)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  muteVideoAccount () {
    const params = { nameWithHost: Actor.CREATE_BY_STRING(this.video().account.name, this.video().account.host) }

    this.blocklistService.blockAccountByUser(params)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Account ${params.nameWithHost} muted.`)
          this.hasMutedAccount = true
          this.videoAccountMuted.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  unmuteVideoAccount () {
    const params = { nameWithHost: Actor.CREATE_BY_STRING(this.video().account.name, this.video().account.host) }

    this.blocklistService.unblockAccountByUser(params)
      .subscribe({
        next: () => {
          this.hasMutedAccount = false
          this.notifier.success($localize`Account ${params.nameWithHost} unmuted.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async removeVideoFiles (video: Video, type: 'hls' | 'web-videos') {
    const confirmMessage = $localize`Do you really want to remove "${this.video().name}" files?`

    const res = await this.confirmService.confirm(confirmMessage, $localize`Remove "${this.video().name}" files`)
    if (res === false) return

    this.videoService.removeVideoFiles([ video.id ], type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Removed files of ${video.name}.`)
          this.videoFilesRemoved.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  runTranscoding (video: Video, type: 'hls' | 'web-video') {
    this.videoService.runTranscoding({ videos: [ video ], type })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Transcoding job created for "${video.name}".`)
          this.transcodingCreated.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  generateCaption (video: Video) {
    this.videoCaptionService.generateCaption({ videos: [ video ] })
      .subscribe({
        next: result => {
          if (result.success) this.notifier.success($localize`Transcription job created for "${video.name}".`)
          else if (result.alreadyBeingTranscribed) this.notifier.info($localize`This video is already being transcribed.`)
          else if (result.alreadyHasCaptions) this.notifier.info($localize`This video already has captions.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  onVideoBlocked () {
    this.videoBlocked.emit()
  }

  getPlaylistDropdownPlacement () {
    if (this.screenService.isInSmallView()) {
      return 'bottom-right auto'
    }

    return 'bottom-left bottom-right auto'
  }

  private buildActions () {
    this.videoActions = [
      [
        {
          label: $localize`Save to playlist`,
          handler: () => this.playlistDropdown().toggle(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().playlist,
          iconName: 'playlist-add'
        }
      ],
      [ // public actions regarding the video
        {
          label: $localize`Download`,
          handler: () => this.showDownloadModal(),
          isDisplayed: () => {
            if (!this.displayOptions().download) return false

            return this.isVideoDownloadableByAnonymous() || this.isVideoDownloadableByUser()
          },
          iconName: 'download',
          ownerOrModeratorPrivilege: () => {
            if (!this.actionAvailabilityHint()) return undefined
            if (this.isVideoDownloadableByAnonymous()) return undefined

            return $localize`This option is visible only to you`
          }
        },
        {
          label: $localize`Show transcription`,
          handler: () => this.showTranscriptionWidget.emit(),
          isDisplayed: () => {
            if (!this.displayOptions().transcriptionWidget) return false
            if (this.transcriptionWidgetOpened()) return false

            const videoCaptions = this.videoCaptions()
            return Array.isArray(videoCaptions) && videoCaptions.length !== 0
          },
          iconName: 'video-lang'
        },
        {
          label: $localize`Hide transcription`,
          handler: () => this.hideTranscriptionWidget.emit(),
          isDisplayed: () => {
            if (!this.displayOptions().transcriptionWidget) return false

            return this.transcriptionWidgetOpened() === true
          },
          iconName: 'video-lang'
        }
      ],
      [ // private actions regarding the video
        {
          label: $localize`Live information`,
          linkBuilder: ({ video }) => [ '/videos/manage', video.shortUUID, 'live-settings' ],
          isDisplayed: () => this.displayOptions().liveInfo && this.isVideoLiveInfoAvailable(),
          iconName: 'live'
        },
        {
          label: $localize`Manage`,
          linkBuilder: ({ video }) => [ '/videos/manage', video.shortUUID ],
          iconName: 'film',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().update && this.isVideoUpdatable()
        },
        {
          label: $localize`Block`,
          handler: () => this.showBlockModal(),
          iconName: 'no',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().blacklist && this.isVideoBlockable()
        },
        {
          label: $localize`Unblock`,
          handler: () => this.unblockVideo(),
          iconName: 'undo',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().blacklist && this.isVideoUnblockable()
        },
        {
          label: $localize`Mirror`,
          handler: () => this.duplicateVideo(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().duplicate && this.canVideoBeDuplicated(),
          iconName: 'cloud-download'
        },
        {
          label: $localize`Delete`,
          handler: () => this.removeVideo(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().delete && this.isVideoRemovable(),
          iconName: 'delete'
        },
        {
          label: $localize`Report`,
          handler: () => this.showReportModal(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().report,
          iconName: 'flag'
        }
      ],
      [
        {
          label: $localize`Run HLS transcoding`,
          handler: ({ video }) => this.runTranscoding(video, 'hls'),
          isDisplayed: () => this.displayOptions().transcoding && this.canRunTranscoding(),
          iconName: 'cog'
        },
        {
          label: $localize`Run Web Video transcoding`,
          handler: ({ video }) => this.runTranscoding(video, 'web-video'),
          isDisplayed: () => this.displayOptions().transcoding && this.canRunTranscoding(),
          iconName: 'cog'
        },
        {
          label: $localize`Delete HLS files`,
          handler: ({ video }) => this.removeVideoFiles(video, 'hls'),
          isDisplayed: () => this.displayOptions().removeFiles && this.canRemoveVideoFiles(),
          iconName: 'delete'
        },
        {
          label: $localize`Delete Web Video files`,
          handler: ({ video }) => this.removeVideoFiles(video, 'web-videos'),
          isDisplayed: () => this.displayOptions().removeFiles && this.canRemoveVideoFiles(),
          iconName: 'delete'
        }
      ],
      [
        {
          label: $localize`Generate caption`,
          handler: ({ video }) => this.generateCaption(video),
          isDisplayed: () => this.displayOptions().generateTranscription && this.canGenerateTranscription(),
          iconName: 'video-lang'
        }
      ],
      [ // actions regarding the account/its server
        {
          label: $localize`Mute account`,
          handler: () => this.muteVideoAccount(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions().mute && this.isVideoAccountMutable(),
          iconName: 'no'
        },
        {
          label: $localize`Unmute account`,
          handler: () => this.unmuteVideoAccount(),
          isDisplayed: () => {
            return this.authService.isLoggedIn() && this.displayOptions().mute && this.isVideoAccountMutable() && this.hasMutedAccount
          },
          iconName: 'undo'
        }
      ]
    ]

    this.videoActions = this.videoActions.concat(this.moreActions())
  }
}
