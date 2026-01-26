import { AfterViewInit, Component, ElementRef, OnInit, inject, input, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { VideoEdit } from '@app/+videos-publish-manage/shared-manage/common/video-edit.model'
import { VideoManageController } from '@app/+videos-publish-manage/shared-manage/video-manage-controller.service'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { PeerTubeProblemDocument, ServerErrorCode, UserVideoQuota, VideoPrivacyType } from '@peertube/peertube-models'
import debug from 'debug'
import { forkJoin, switchMap } from 'rxjs'
import { SelectChannelItem } from 'src/types'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { VideoManageContainerComponent } from '../../shared-manage/video-manage-container.component'
import { DragDropDirective } from '../shared/drag-drop.directive'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'

const debugLogger = debug('peertube:video-publish')

@Component({
  selector: 'my-video-import-torrent',
  templateUrl: './video-import-torrent.component.html',
  styleUrls: [
    '../shared/common-publish.scss',
    './video-import-torrent.component.scss'
  ],
  imports: [
    GlobalIconComponent,
    NgbTooltip,
    HelpComponent,
    FormsModule,
    DragDropDirective,
    SelectChannelComponent,
    ReactiveFormsModule,
    AlertComponent,
    VideoManageContainerComponent
  ]
})
export class VideoImportTorrentComponent implements OnInit, AfterViewInit, CanComponentDeactivate {
  private authService = inject(AuthService)
  private loadingBar = inject(LoadingBarService)
  private notifier = inject(Notifier)
  private videoService = inject(VideoService)
  private playerSettingsService = inject(PlayerSettingsService)
  private videoImportService = inject(VideoImportService)
  private hooks = inject(HooksService)
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)
  private route = inject(ActivatedRoute)

  readonly userChannels = input.required<SelectChannelItem[]>()
  readonly userQuota = input.required<UserVideoQuota>()
  readonly highestPrivacy = input.required<VideoPrivacyType>()

  readonly firstStepDone = output<string>()
  readonly firstStepError = output()

  readonly torrentfileInput = viewChild<ElementRef<HTMLInputElement>>('torrentfileInput')

  firstStep = true
  firstStepChannelId: number
  firstStepMagnetUri = ''

  isImportingVideo = false

  ngOnInit (): void {
    this.firstStepChannelId = this.userChannels()[0].id
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-torrent-import.init', 'video-edit')
  }

  canDeactivate () {
    if (this.firstStep) return { canDeactivate: true }

    let text = ''

    if (this.manageController.hasPendingChanges()) {
      text = $localize`Your video is being imported. But there are unsaved changes: are you sure you want to leave this page?`
    }

    return { canDeactivate: !text, text }
  }

  onVideoUpdated () {
    this.notifier.success($localize`Changes saved.`)
  }

  reset () {
    this.firstStep = true
    this.isImportingVideo = false
    this.firstStepMagnetUri = ''
  }

  isMagnetUrlValid () {
    return !!this.firstStepMagnetUri
  }

  fileChange () {
    const torrentfile = this.torrentfileInput().nativeElement.files[0]
    if (!torrentfile) return

    this.importVideo(torrentfile)
  }

  setTorrentFile (files: FileList) {
    this.torrentfileInput().nativeElement.files = files
    this.fileChange()
  }

  importVideo (torrentfile?: Blob) {
    if (this.isImportingVideo) return
    this.isImportingVideo = true

    const serverConfig = this.serverService.getHTMLConfig()

    const videoEdit = VideoEdit.createFromImport(serverConfig, {
      torrentfile,
      magnetUri: this.firstStepMagnetUri,
      channelId: this.firstStepChannelId,
      support: this.userChannels().find(c => c.id === this.firstStepChannelId).support ?? '',
      user: this.authService.getUser()
    })
    this.manageController.setConfig({ manageType: 'import-torrent', serverConfig: this.serverService.getHTMLConfig() })
    this.manageController.setVideoEdit(videoEdit)

    this.loadingBar.useRef().start()

    this.videoImportService.importVideo(videoEdit.toVideoImportCreate(this.highestPrivacy()))
      .pipe(switchMap(({ video }) => {
        return forkJoin([
          this.videoService.getVideo({ videoId: video.uuid }),
          this.playerSettingsService.getVideoSettings({ videoId: video.uuid, raw: true })
        ])
      }))
      .subscribe({
        next: async ([ video, playerSettings ]) => {
          await videoEdit.loadFromAPI({ video, playerSettings, loadPrivacy: false })

          this.loadingBar.useRef().complete()

          debugLogger(`Torrent/magnet import created`)

          this.manageController.silentRedirectOnManage(videoEdit.getVideoAttributes().shortUUID, this.route)

          this.firstStep = false
          this.isImportingVideo = false
          this.firstStepDone.emit(videoEdit.getVideoAttributes().name)
        },

        error: err => {
          this.isImportingVideo = false

          this.loadingBar.useRef().complete()
          this.firstStepError.emit()

          const error = err.body as PeerTubeProblemDocument

          if (error?.code === ServerErrorCode.INCORRECT_FILES_IN_TORRENT) {
            this.notifier.error($localize`Torrents with only 1 file are supported.`)

            return
          }

          this.notifier.handleError(err)
        }
      })
  }
}
