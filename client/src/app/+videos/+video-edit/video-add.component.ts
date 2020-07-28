import { Component, HostListener, OnInit, ViewChild } from '@angular/core'
import { AuthService, AuthUser, CanComponentDeactivate, ServerService } from '@app/core'
import { ServerConfig } from '@shared/models'
import { VideoImportTorrentComponent } from './video-add-components/video-import-torrent.component'
import { VideoImportUrlComponent } from './video-add-components/video-import-url.component'
import { VideoUploadComponent } from './video-add-components/video-upload.component'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [ './video-add.component.scss' ]
})
export class VideoAddComponent implements OnInit, CanComponentDeactivate {
  @ViewChild('videoUpload') videoUpload: VideoUploadComponent
  @ViewChild('videoImportUrl') videoImportUrl: VideoImportUrlComponent
  @ViewChild('videoImportTorrent') videoImportTorrent: VideoImportTorrentComponent

  user: AuthUser = null

  secondStepType: 'upload' | 'import-url' | 'import-torrent'
  videoName: string
  serverConfig: ServerConfig

  constructor (
    private auth: AuthService,
    private serverService: ServerService
  ) {}

  get userInformationLoaded () {
    return this.auth.userInformationLoaded
  }

  ngOnInit () {
    this.user = this.auth.getUser()

    this.serverConfig = this.serverService.getTmpConfig()

    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

    this.user = this.auth.getUser()
  }

  onFirstStepDone (type: 'upload' | 'import-url' | 'import-torrent', videoName: string) {
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

  canDeactivate (): { canDeactivate: boolean, text?: string} {
    if (this.secondStepType === 'upload') return this.videoUpload.canDeactivate()
    if (this.secondStepType === 'import-url') return this.videoImportUrl.canDeactivate()
    if (this.secondStepType === 'import-torrent') return this.videoImportTorrent.canDeactivate()

    return { canDeactivate: true }
  }

  isVideoImportHttpEnabled () {
    return this.serverConfig.import.videos.http.enabled
  }

  isVideoImportTorrentEnabled () {
    return this.serverConfig.import.videos.torrent.enabled
  }

  isInSecondStep () {
    return !!this.secondStepType
  }

  isRootUser () {
    return this.user.username === 'root'
  }
}
