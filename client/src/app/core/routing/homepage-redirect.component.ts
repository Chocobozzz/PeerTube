import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { is18nPath } from '@shared/core-utils/i18n/i18n'
import { RedirectService } from './redirect.service'

/*
 * We have to use a component instead of an homepage because of a weird issue when using router.navigate in guard
 *
 * Since we also want to use the `skipLocationChange` option, we cannot use a guard that returns a UrlTree
 * See https://github.com/angular/angular/issues/27148
*/

@Component({
  template: ''
})
export class HomepageRedirectComponent implements OnInit {

  constructor (
    private route: ActivatedRoute,
    private redirectService: RedirectService
  ) { }

  ngOnInit () {
    const url = this.route.snapshot.url

    if (url.length === 0 || is18nPath('/' + url[0])) {
      this.redirectService.redirectToHomepage(true)
    }
  }
}
