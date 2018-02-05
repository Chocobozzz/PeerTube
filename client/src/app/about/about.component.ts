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

  ngOnInit () {
    this.serverService.getAbout()
      .subscribe(
        res => {
          this.descriptionHTML = this.markdownService.markdownToHTML(res.instance.description)
          this.termsHTML = this.markdownService.markdownToHTML(res.instance.terms)
        },

        err => this.notificationsService.error('Error', err)
      )
  }

}
