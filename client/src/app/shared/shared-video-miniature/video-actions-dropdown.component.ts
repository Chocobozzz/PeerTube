import { Component, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ScreenService } from '@app/core'
import { VideoBlockComponent, VideoBlockService, VideoReportComponent, BlocklistService } from '@app/shared/shared-moderation'
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoCaption } from '@shared/models'
import { DropdownAction, DropdownButtonSize, DropdownDirection, RedundancyService, Video, VideoDetails, VideoService, Actor } from '../shared-main'
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
    mute: true
  }
  @Input() placement = 'left'

  @Input() label: string

  @Input() buttonStyled = false
  @Input() buttonSize: DropdownButtonSize = 'normal'
  @Input() buttonDirection: DropdownDirection = 'vertical'

  @Output() videoRemoved = new EventEmitter()
  @Output() videoUnblocked = new EventEmitter()
  @Output() videoBlocked = new EventEmitter()
  @Output() videoAccountMuted = new EventEmitter()
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
    private redundancyService: RedundancyService,
    private i18n: I18n
  ) { }

  get user () {
    return this.authService.getUser()
  }

  ngOnChanges () {
    if (this.loaded) {
      this.loaded = false
      this.playlistAdd.reload()
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

    this.videoBlockModal.show()
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

  isVideoDownloadable () {
    return this.video && this.video instanceof VideoDetails && this.video.downloadEnabled
  }

  canVideoBeDuplicated () {
    return this.video.canBeDuplicatedBy(this.user)
  }

  isVideoAccountMutable () {
    return this.video.account.id !== this.user.account.id
  }

  /* Action handlers */

  async unblockVideo () {
    const confirmMessage = this.i18n(
      'Do you really want to unblock this video? It will be available again in the videos list.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Unblock'))
    if (res === false) return

    this.videoBlocklistService.unblockVideo(this.video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video {{name}} unblocked.', { name: this.video.name }))

            this.video.blacklisted = false
            this.video.blockedReason = null

            this.videoUnblocked.emit()
          },

          err => this.notifier.error(err.message)
        )
  }

  async removeVideo () {
    this.modalOpened.emit()

    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this video?'), this.i18n('Delete'))
    if (res === false) return

    this.videoService.removeVideo(this.video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video {{videoName}} deleted.', { videoName: this.video.name }))

            this.videoRemoved.emit()
          },

          error => this.notifier.error(error.message)
        )
  }

  duplicateVideo () {
    this.redundancyService.addVideoRedundancy(this.video)
        .subscribe(
          () => {
            const message = this.i18n('This video will be duplicated by your instance.')
            this.notifier.success(message)
          },

          err => this.notifier.error(err.message)
        )
  }

  muteVideoAccount () {
    const params = { nameWithHost: Actor.CREATE_BY_STRING(this.video.account.name, this.video.account.host) }

    this.blocklistService.blockAccountByUser(params)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Account {{nameWithHost}} muted.', params))

            this.videoAccountMuted.emit()
          },

          err => this.notifier.error(err.message)
        )
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
          label: this.i18n('Save to playlist'),
          handler: () => this.playlistDropdown.toggle(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.playlist,
          iconName: 'playlist-add'
        }
      ],
      [ // actions regarding the video
        {
          label: this.i18n('Download'),
          handler: () => this.showDownloadModal(),
          isDisplayed: () => this.displayOptions.download && this.isVideoDownloadable(),
          iconName: 'download'
        },
        {
          label: this.i18n('Update'),
          linkBuilder: ({ video }) => [ '/videos/update', video.uuid ],
          iconName: 'edit',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.update && this.isVideoUpdatable()
        },
        {
          label: this.i18n('Block'),
          handler: () => this.showBlockModal(),
          iconName: 'no',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.blacklist && this.isVideoBlockable()
        },
        {
          label: this.i18n('Unblock'),
          handler: () => this.unblockVideo(),
          iconName: 'undo',
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.blacklist && this.isVideoUnblockable()
        },
        {
          label: this.i18n('Mirror'),
          handler: () => this.duplicateVideo(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.duplicate && this.canVideoBeDuplicated(),
          iconName: 'cloud-download'
        },
        {
          label: this.i18n('Delete'),
          handler: () => this.removeVideo(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.delete && this.isVideoRemovable(),
          iconName: 'delete'
        },
        {
          label: this.i18n('Report'),
          handler: () => this.showReportModal(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.report,
          iconName: 'flag'
        }
      ],
      [ // actions regarding the account/its server
        {
          label: this.i18n('Mute account'),
          handler: () => this.muteVideoAccount(),
          isDisplayed: () => this.authService.isLoggedIn() && this.displayOptions.mute && this.isVideoAccountMutable(),
          iconName: 'no'
        }
      ]
    ]
  }
}
