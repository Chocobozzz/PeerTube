import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, LOCALE_ID, OnInit, Output } from '@angular/core'
import { User } from '../users'
import { Video } from './video.model'
import { ServerService } from '@app/core'
import { VideoPrivacy, VideoState } from '../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoActionsDisplayType } from '@app/shared/video/video-actions-dropdown.component'
import { ScreenService } from '@app/shared/misc/screen.service'

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
    report: true
  }
  showActions = false

  private ownerDisplayTypeChosen: 'account' | 'videoChannel'

  constructor (
    private screenService: ScreenService,
    private serverService: ServerService,
    private i18n: I18n,
    @Inject(LOCALE_ID) private localeId: string
  ) { }

  get isVideoBlur () {
    return this.video.isVideoNSFWForUser(this.user, this.serverService.getConfig())
  }

  ngOnInit () {
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
}
