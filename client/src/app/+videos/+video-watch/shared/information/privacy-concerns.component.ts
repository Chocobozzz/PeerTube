import { Component, Input, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { HTMLServerConfig, Video } from '@shared/models'
import { getStoredP2PEnabled } from '../../../../../assets/player/peertube-player-local-storage'
import { isWebRTCDisabled } from '../../../../../assets/player/utils'

@Component({
  selector: 'my-privacy-concerns',
  templateUrl: './privacy-concerns.component.html',
  styleUrls: [ './privacy-concerns.component.scss' ]
})
export class PrivacyConcernsComponent implements OnInit {
  private static LOCAL_STORAGE_PRIVACY_CONCERN_KEY = 'video-watch-privacy-concern'

  @Input() video: Video

  display = true

  private serverConfig: HTMLServerConfig

  constructor (
    private serverService: ServerService
  ) { }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    if (isWebRTCDisabled() || this.isTrackerDisabled() || this.isP2PDisabled() || this.alreadyAccepted()) {
      this.display = false
    }
  }

  acceptedPrivacyConcern () {
    peertubeLocalStorage.setItem(PrivacyConcernsComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'true')
    this.display = false
  }

  private isTrackerDisabled () {
    return this.video.isLocal && this.serverConfig.tracker.enabled === false
  }

  private isP2PDisabled () {
    return getStoredP2PEnabled() === false
  }

  private alreadyAccepted () {
    return peertubeLocalStorage.getItem(PrivacyConcernsComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY) === 'true'
  }
}
