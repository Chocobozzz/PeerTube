import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  templateUrl: './moderation.component.html',
  styleUrls: [ ]
})
export class ModerationComponent implements OnInit {
  autoBlockVideosEnabled = false

  constructor (
    private serverService: ServerService
  ) { }

  ngOnInit (): void {
    const serverConfig = this.serverService.getHTMLConfig()

    this.autoBlockVideosEnabled = serverConfig.autoBlacklist.videos.ofUsers.enabled
  }
}
