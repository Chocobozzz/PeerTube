import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { NavigationStart, Router } from '@angular/router'
import { filter } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent implements OnInit {

  libraryLabel = ''

  constructor (
    private serverService: ServerService,
    private router: Router,
    private i18n: I18n
  ) {}

  ngOnInit () {
    console.log(this.router.url)
    this.updateLibraryLabel(this.router.url)

    this.router.events
        .pipe(filter(event => event instanceof NavigationStart))
        .subscribe((event: NavigationStart) => this.updateLibraryLabel(event.url))
  }

  isVideoImportEnabled () {
    return this.serverService.getConfig().import.videos.http.enabled
  }

  private updateLibraryLabel (url: string) {
    const [ path ] = url.split('?')

    if (path === '/my-account/video-channels') {
      this.libraryLabel = this.i18n('Channels')
    } else if (path === '/my-account/videos') {
      this.libraryLabel = this.i18n('Videos')
    } else if (path === '/my-account/subscriptions') {
      this.libraryLabel = this.i18n('Subscriptions')
    } else if (path === '/my-account/video-imports') {
      this.libraryLabel = this.i18n('Video imports')
    } else {
      this.libraryLabel = ''
    }
  }
}
