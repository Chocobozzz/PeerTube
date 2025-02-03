import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, HostListener, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import {
  AuthService,
  AuthUser,
  CanComponentDeactivate,
  HooksService,
  ServerService,
  UserService
} from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ChannelsSetupMessageComponent } from '../../shared/shared-main/channel/channels-setup-message.component'
import { UserQuotaComponent } from '../../shared/shared-main/users/user-quota.component'
import { VideoEditType } from './shared/video-edit.type'
import { VideoGoLiveComponent } from './video-add-components/video-go-live.component'
import { VideoImportTorrentComponent } from './video-add-components/video-import-torrent.component'
import { VideoImportUrlComponent } from './video-add-components/video-import-url.component'
import { VideoUploadComponent } from './video-add-components/video-upload.component'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [ './video-add.component.scss' ],
  imports: [
    NgIf,
    RouterLink,
    NgTemplateOutlet,
    UserQuotaComponent,
    ChannelsSetupMessageComponent,
    NgbNav,
    NgClass,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    VideoUploadComponent,
    VideoImportUrlComponent,
    VideoImportTorrentComponent,
    VideoGoLiveComponent,
    NgbNavOutlet,
    AlertComponent
  ]
})
export class VideoAddComponent implements OnInit, CanComponentDeactivate {
  @ViewChild('videoUpload') videoUpload: VideoUploadComponent
  @ViewChild('videoImportUrl') videoImportUrl: VideoImportUrlComponent
  @ViewChild('videoImportTorrent') videoImportTorrent: VideoImportTorrentComponent
  @ViewChild('videoGoLive') videoGoLive: VideoGoLiveComponent

  user: AuthUser = null

  secondStepType: VideoEditType
  videoName: string

  activeNav: string

  uploadMessages: {
    noQuota: string
    autoBlock: string
    quotaLeftDaily: string
    quotaLeft: string
  }

  hasNoQuotaLeft = false
  hasNoQuotaLeftDaily = false

  serverConfig: HTMLServerConfig

  constructor (
    private auth: AuthService,
    private userService: UserService,
    private hooks: HooksService,
    private serverService: ServerService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get isContactFormEnabled () {
    return this.serverConfig.email.enabled && this.serverConfig.contactForm.enabled
  }

  get userInformationLoaded () {
    return this.auth.userInformationLoaded
  }

  ngOnInit () {
    this.user = this.auth.getUser()

    this.serverConfig = this.serverService.getHTMLConfig()

    if (this.route.snapshot.fragment) {
      this.onNavChange(this.route.snapshot.fragment)
    }

    this.buildUploadMessages()

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => {
        // videoQuota left lower than 10%
        if (data.videoQuotaUsed > this.user.videoQuota * 0.9) {
          this.hasNoQuotaLeft = true
        }

        // unlimited videoQuota
        if (this.user.videoQuota === -1) {
          this.hasNoQuotaLeft = false
        }

        // videoQuotaDaily left lower than 10%
        if (data.videoQuotaUsedDaily > this.user.videoQuotaDaily * 0.9) {
          this.hasNoQuotaLeftDaily = true
        }

        // unlimited videoQuotaDaily
        if (this.user.videoQuotaDaily === -1) {
          this.hasNoQuotaLeftDaily = false
        }
      })
  }

  private async buildUploadMessages () {
    // eslint-disable-next-line max-len
    const noQuota = $localize`Sorry, the upload feature is disabled for your account. If you want to add videos, an admin must unlock your quota.`
    // eslint-disable-next-line max-len
    const autoBlock = $localize`Uploaded videos are reviewed before publishing for your account. If you want to add videos without moderation review, an admin must turn off your videos auto-block.`
    // eslint-disable-next-line max-len
    const quotaLeftDaily = $localize`Your daily video quota is insufficient. If you want to add more videos, you must wait for 24 hours or an admin must increase your daily quota.`
    // eslint-disable-next-line max-len
    const quotaLeft = $localize`Your video quota is insufficient. If you want to add more videos, an admin must increase your quota.`

    const uploadMessages = {
      noQuota,
      autoBlock,
      quotaLeftDaily,
      quotaLeft
    }

    this.uploadMessages = await this.hooks.wrapObject(uploadMessages, 'common', 'filter:upload.messages.create.result')
  }

  onNavChange (newActiveNav: string) {
    this.activeNav = newActiveNav

    this.router.navigate([], { fragment: this.activeNav })
  }

  onFirstStepDone (type: VideoEditType, videoName: string) {
    this.secondStepType = type
    this.videoName = videoName
  }

  onError () {
    this.videoName = undefined
    this.secondStepType = undefined
  }

  @HostListener('window:beforeunload', [ '$event' ])
  onUnload (event: any) {
    const { text, canDeactivate } = this.canDeactivate()

    if (canDeactivate) return

    event.returnValue = text
    return text
  }

  canDeactivate (): { canDeactivate: boolean, text?: string } {
    if (this.secondStepType === 'upload') return this.videoUpload.canDeactivate()
    if (this.secondStepType === 'import-url') return this.videoImportUrl.canDeactivate()
    if (this.secondStepType === 'import-torrent') return this.videoImportTorrent.canDeactivate()
    if (this.secondStepType === 'go-live') return this.videoGoLive.canDeactivate()

    return { canDeactivate: true }
  }

  isVideoImportHttpEnabled () {
    return this.serverConfig.import.videos.http.enabled
  }

  isVideoImportTorrentEnabled () {
    return this.serverConfig.import.videos.torrent.enabled
  }

  isVideoLiveEnabled () {
    return this.serverConfig.live.enabled
  }

  isInSecondStep () {
    return !!this.secondStepType
  }

  isRootUser () {
    return this.user.username === 'root'
  }
}
