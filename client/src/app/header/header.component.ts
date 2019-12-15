import { filter, first, map, tap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router'
import { getParameterByName } from '../shared/misc/utils'
import { AuthService } from '@app/core'
import { of } from 'rxjs'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ]
})

export class HeaderComponent implements OnInit {
  searchValue = ''

  constructor (
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {}

  ngOnInit () {
    this.router.events
        .pipe(
          filter(e => e instanceof NavigationEnd),
          map(() => getParameterByName('search', window.location.href))
        )
        .subscribe(searchQuery => this.searchValue = searchQuery || '')
  }

  doSearch () {
    const queryParams: Params = {}

    if (window.location.pathname === '/search' && this.route.snapshot.queryParams) {
      Object.assign(queryParams, this.route.snapshot.queryParams)
    }

    Object.assign(queryParams, { search: this.searchValue })

    const o = this.auth.isLoggedIn()
      ? this.loadUserLanguagesIfNeeded(queryParams)
      : of(true)

    o.subscribe(() => this.router.navigate([ '/search' ], { queryParams }))
  }

  private loadUserLanguagesIfNeeded (queryParams: any) {
    if (queryParams && queryParams.languageOneOf) return of(queryParams)

    return this.auth.userInformationLoaded
               .pipe(
                 first(),
                 tap(() => Object.assign(queryParams, { languageOneOf: this.auth.getUser().videoLanguages }))
               )
  }
}
