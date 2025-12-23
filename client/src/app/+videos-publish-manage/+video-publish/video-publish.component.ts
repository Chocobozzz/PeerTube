import { NgClass, NgTemplateOutlet } from '@angular/common'
import { Component, HostListener, OnInit, inject, viewChild } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, AuthUser, CanComponentDeactivate, CanDeactivateGuard, HooksService, ServerService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, UserVideoQuota, VideoConstant, VideoPrivacyType } from '@peertube/peertube-models'
import { SelectChannelItem } from 'src/types'
import { HelpComponent } from '../../shared/shared-main/buttons/help.component'
import { ChannelsSetupMessageComponent } from '../../shared/shared-main/channel/channels-setup-message.component'
import { UserQuotaComponent } from '../../shared/shared-main/users/user-quota.component'
import { VideoManageType } from '../shared-manage/common/video-manage.type'
import { VideoManageController } from '../shared-manage/video-manage-controller.service'
import { VideoImportTorrentComponent } from './import/video-import-torrent.component'
import { VideoImportUrlComponent } from './import/video-import-url.component'
import { VideoGoLiveComponent } from './live/video-go-live.component'
import { VideoUploadComponent } from './upload/video-upload.component'
import { VideoPublishResolverData } from './video-publish.resolver'

@Component({
  selector: 'my-video-publish',
  templateUrl: './video-publish.component.html',
  styleUrls: [ './video-publish.component.scss' ],
  imports: [
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
    NgbNavOutlet,
    AlertComponent,
    VideoGoLiveComponent,
    VideoImportTorrentComponent,
    VideoImportUrlComponent,
    VideoUploadComponent,
    HelpComponent
  ]
})
export class VideoPublishComponent implements OnInit, CanComponentDeactivate {
  private auth = inject(AuthService)
  private hooks = inject(HooksService)
  private serverService = inject(ServerService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private manageController = inject(VideoManageController)
  private videoService = inject(VideoService)
  private canDeactivateGuard = inject(CanDeactivateGuard)

  readonly videoUpload = viewChild<VideoUploadComponent>('videoUpload')
  readonly videoImportUrl = viewChild<VideoImportUrlComponent>('videoImportUrl')
  readonly videoImportTorrent = viewChild<VideoImportTorrentComponent>('videoImportTorrent')
  readonly videoGoLive = viewChild<VideoGoLiveComponent>('videoGoLive')

  user: AuthUser = null

  secondStepType: VideoManageType
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
  highestPrivacy: VideoPrivacyType

  userChannels: SelectChannelItem[]
  userQuota: UserVideoQuota
  privacies: VideoConstant<VideoPrivacyType>[]

  private publishedIdQuery: string
  private uploadingQuery: string

  get isContactFormEnabled () {
    return this.serverConfig.email.enabled && this.serverConfig.contactForm.enabled
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    const data = this.route.snapshot.data.resolverData as VideoPublishResolverData
    const { videoChannels, userQuota, privacies } = data

    this.userChannels = videoChannels
    this.userQuota = userQuota
    this.privacies = privacies

    this.user = this.auth.getUser()

    this.serverConfig = this.serverService.getHTMLConfig()
    this.highestPrivacy = this.videoService.getHighestAvailablePrivacy(privacies)

    if (this.route.snapshot.fragment) {
      this.onNavChange(this.route.snapshot.fragment as VideoManageType)
    }

    this.buildUploadMessages()

    // videoQuota left lower than 10%
    if (this.user.videoQuota !== -1 && userQuota.videoQuotaUsed > this.user.videoQuota * 0.9) {
      this.hasNoQuotaLeft = true
    }

    // videoQuotaDaily left lower than 10%
    if (this.user.videoQuotaDaily !== -1 && userQuota.videoQuotaUsedDaily > this.user.videoQuotaDaily * 0.9) {
      this.hasNoQuotaLeftDaily = true
    }

    this.reset()

    this.route.queryParams.subscribe(params => {
      if (params.publishedId) {
        this.publishedIdQuery = params.publishedId
      } else if (params.uploading) {
        this.uploadingQuery = params.uploading
      } else if (this.publishedIdQuery || this.uploadingQuery) {
        this.tryToReset()
      }
    })
  }

  private async tryToReset () {
    const components = [
      this.videoUpload(),
      this.videoImportUrl(),
      this.videoImportTorrent(),
      this.videoGoLive()
    ]

    for (const component of components) {
      if (!component) continue

      // Restore old URL
      if (!await this.canDeactivateGuard.canDeactivate(component)) {
        if (this.publishedIdQuery) {
          this.manageController.silentRedirectOnManage(this.publishedIdQuery, this.route)
        } else if (this.uploadingQuery) {
          this.manageController.silentRedirectOnUploading(this.route)
        }

        return
      }

      component.reset()
    }

    this.reset()
  }

  private reset () {
    this.secondStepType = undefined
    this.videoName = undefined
    this.publishedIdQuery = undefined
    this.uploadingQuery = undefined

    this.manageController.setStore({
      userChannels: this.userChannels,
      userQuota: this.userQuota,
      privacies: this.privacies,
      videoEdit: undefined
    })
  }

  private async buildUploadMessages () {
    const noQuota =
      $localize`Sorry, the upload feature is disabled for your account. If you want to add videos, an admin must unlock your quota.`
    const autoBlock =
      // eslint-disable-next-line max-len
      $localize`Uploaded videos are reviewed before publishing for your account. If you want to add videos without moderation review, an admin must turn off your videos auto-block.`
    const quotaLeftDaily =
      // eslint-disable-next-line max-len
      $localize`Your daily video quota is insufficient. If you want to add more videos, you must wait for 24 hours or an admin must increase your daily quota.`
    const quotaLeft = $localize`Your video quota is insufficient. If you want to add more videos, an admin must increase your quota.`

    const uploadMessages = {
      noQuota,
      autoBlock,
      quotaLeftDaily,
      quotaLeft
    }

    this.uploadMessages = await this.hooks.wrapObject(uploadMessages, 'common', 'filter:upload.messages.create.result')
  }

  onNavChange (newActiveNav: VideoManageType) {
    this.activeNav = newActiveNav

    this.manageController.setConfig({
      manageType: newActiveNav,
      serverConfig: this.serverConfig
    })

    this.router.navigate([], { fragment: this.activeNav })
  }

  onFirstStepDone (type: VideoManageType, videoName: string) {
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
    if (this.secondStepType === 'upload') return this.videoUpload().canDeactivate()
    if (this.secondStepType === 'import-url') return this.videoImportUrl().canDeactivate()
    if (this.secondStepType === 'import-torrent') return this.videoImportTorrent().canDeactivate()
    if (this.secondStepType === 'go-live') return this.videoGoLive().canDeactivate()

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
