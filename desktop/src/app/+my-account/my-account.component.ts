import { Component } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html'
})
export class MyAccountComponent {

  constructor (
    private serverService: ServerService
  ) {}

  isVideoImportEnabled () {
    return this.serverService.getConfig().import.videos.http.enabled
  }
}
