import { filter, first, map, tap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
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
    const queryParams: any = {
      search: this.searchValue
    }

    const o = this.auth.isLoggedIn()
      ? this.loadUserLanguages(queryParams)
      : of(true)

    o.subscribe(() => this.router.navigate([ '/search' ], { queryParams }))
  }

  private loadUserLanguages (queryParams: any) {
    return this.auth.userInformationLoaded
               .pipe(
                 first(),
                 tap(() => Object.assign(queryParams, { languageOneOf: this.auth.getUser().videoLanguages }))
               )
  }
}
