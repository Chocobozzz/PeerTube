import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { MarkdownService } from '@app/videos/shared'
import { NotificationsService } from 'angular2-notifications'

@Component({
  selector: 'my-about',
  templateUrl: './about.component.html',
  styleUrls: [ './about.component.scss' ]
})

export class AboutComponent implements OnInit {
  descriptionHTML = ''
  termsHTML = ''

  constructor (
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private markdownService: MarkdownService
  ) {}

  get instanceName () {
    return this.serverService.getConfig().instance.name
  }

  get userVideoQuota () {
    return this.serverService.getConfig().user.videoQuota
  }

  get isSignupAllowed () {
    return this.serverService.getConfig().signup.allowed
  }

  ngOnInit () {
    this.serverService.getAbout()
      .subscribe(
        res => {
          this.descriptionHTML = this.markdownService.textMarkdownToHTML(res.instance.description)
          this.termsHTML = this.markdownService.textMarkdownToHTML(res.instance.terms)
        },

        err => this.notificationsService.error('Error getting about from server', err)
      )
  }

}
