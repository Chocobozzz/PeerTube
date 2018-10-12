import { Component, OnDestroy, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { NavigationStart, Router } from '@angular/router'
import { filter } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent implements OnInit, OnDestroy {

  libraryLabel = ''
  miscLabel = ''

  private routeSub: Subscription

  constructor (
    private serverService: ServerService,
    private router: Router,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.updateLabels(this.router.url)

    this.routeSub = this.router.events
        .pipe(filter(event => event instanceof NavigationStart))
        .subscribe((event: NavigationStart) => this.updateLabels(event.url))
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  isVideoImportEnabled () {
    const importConfig = this.serverService.getConfig().import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }

  private updateLabels (url: string) {
    const [ path ] = url.split('?')

    if (path.startsWith('/my-account/video-channels')) {
      this.libraryLabel = this.i18n('Channels')
    } else if (path.startsWith('/my-account/videos')) {
      this.libraryLabel = this.i18n('Videos')
    } else if (path.startsWith('/my-account/subscriptions')) {
      this.libraryLabel = this.i18n('Subscriptions')
    } else if (path.startsWith('/my-account/video-imports')) {
      this.libraryLabel = this.i18n('Video imports')
    } else {
      this.libraryLabel = ''
    }

    if (path.startsWith('/my-account/blocklist/accounts')) {
      this.miscLabel = this.i18n('Muted accounts')
    } else if (path.startsWith('/my-account/blocklist/servers')) {
      this.miscLabel = this.i18n('Muted instances')
    } else {
      this.miscLabel = ''
    }
  }
}
