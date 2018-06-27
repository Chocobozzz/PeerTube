import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { MarkdownService } from '@app/videos/shared'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ]
})

export class AboutInstanceComponent implements OnInit {
  shortDescription = ''
  descriptionHTML = ''
  termsHTML = ''

  constructor (
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private markdownService: MarkdownService,
    private i18n: I18n
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
          this.shortDescription = res.instance.shortDescription
          this.descriptionHTML = this.markdownService.textMarkdownToHTML(res.instance.description)
          this.termsHTML = this.markdownService.textMarkdownToHTML(res.instance.terms)
        },

        err => this.notificationsService.error(this.i18n('Error getting about from server'), err)
      )
  }

}
