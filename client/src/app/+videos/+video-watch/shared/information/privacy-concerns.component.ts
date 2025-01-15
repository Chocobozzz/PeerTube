import { Component, Input, OnInit } from '@angular/core'
import { ServerService, User, UserService } from '@app/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { isP2PEnabled } from '@root-helpers/video'
import { HTMLServerConfig, Video } from '@peertube/peertube-models'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-privacy-concerns',
  templateUrl: './privacy-concerns.component.html',
  styleUrls: [ './privacy-concerns.component.scss' ],
  standalone: true,
  imports: [ NgIf ]
})
export class PrivacyConcernsComponent implements OnInit {
  private static LS_PRIVACY_CONCERN_KEY = 'video-watch-privacy-concern'

  @Input() video: Video

  display = false

  private serverConfig: HTMLServerConfig

  constructor (
    private serverService: ServerService,
    private userService: UserService
  ) { }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.updateDisplay(user))
  }

  acceptedPrivacyConcern () {
    peertubeLocalStorage.setItem(PrivacyConcernsComponent.LS_PRIVACY_CONCERN_KEY, 'true')

    this.display = false
  }

  private updateDisplay (user: User) {
    if (isP2PEnabled(this.video, this.serverConfig, user.p2pEnabled) && !this.alreadyAccepted()) {
      this.display = true
    }
  }

  private alreadyAccepted () {
    return peertubeLocalStorage.getItem(PrivacyConcernsComponent.LS_PRIVACY_CONCERN_KEY) === 'true'
  }
}
