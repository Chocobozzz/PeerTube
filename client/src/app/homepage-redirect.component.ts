import { Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { is18nPath } from '@peertube/peertube-core-utils'
import { RedirectService } from './core/routing/redirect.service'

/*
 * Historically use a component instead of an homepage because of a weird issue when using router.navigate in guard
 *
 * Since we also want to use the `skipLocationChange` option, we couldn't use a guard that returns a UrlTree
 * See https://github.com/angular/angular/issues/27148
 * The issue is fixed but we keep this component it works well and is simple enough
 */

@Component({
  template: '',
  standalone: true
})
export class HomepageRedirectComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private redirectService = inject(RedirectService)

  ngOnInit () {
    const url = this.route.snapshot.url

    if (url.length === 0 || is18nPath('/' + url[0])) {
      this.redirectService.redirectToHomepage({ skipLocationChange: true })
    }
  }
}
