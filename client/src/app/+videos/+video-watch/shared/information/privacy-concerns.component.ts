import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { HTMLServerConfig } from '@shared/models'
import { getStoredP2PEnabled } from '../../../../../assets/player/peertube-player-local-storage'
import { isWebRTCDisabled } from '../../../../../assets/player/utils'

@Component({
  selector: 'my-privacy-concerns',
  templateUrl: './privacy-concerns.component.html',
  styleUrls: [ './privacy-concerns.component.scss' ]
})
export class PrivacyConcernsComponent implements OnInit {
  private static LOCAL_STORAGE_PRIVACY_CONCERN_KEY = 'video-watch-privacy-concern'

  hasAlreadyAcceptedPrivacyConcern = false

  private serverConfig: HTMLServerConfig

  constructor (
    private serverService: ServerService
  ) { }

  async ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()
    if (
      isWebRTCDisabled() ||
      this.serverConfig.tracker.enabled === false ||
      getStoredP2PEnabled() === false ||
      peertubeLocalStorage.getItem(PrivacyConcernsComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY) === 'true'
    ) {
      this.hasAlreadyAcceptedPrivacyConcern = true
    }
  }

  declinedPrivacyConcern () {
    peertubeLocalStorage.setItem(PrivacyConcernsComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'false')
    this.hasAlreadyAcceptedPrivacyConcern = false
  }

  acceptedPrivacyConcern () {
    peertubeLocalStorage.setItem(PrivacyConcernsComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'true')
    this.hasAlreadyAcceptedPrivacyConcern = true
  }
}
