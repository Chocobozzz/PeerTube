import { filter, first, map, tap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router'
import { getParameterByName } from '../shared/misc/utils'
import { AuthService, ServerService, Notifier } from '@app/core'
import { of } from 'rxjs'
import { ServerConfig } from '@shared/models'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ]
})

export class HeaderComponent implements OnInit {
  searchValue = ''

  private serverConfig: ServerConfig

  constructor (
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private serverService: ServerService,
    private authService: AuthService,
    private notifier: Notifier
  ) {}

  ngOnInit () {
    this.router.events
        .pipe(
          filter(e => e instanceof NavigationEnd),
          map(() => getParameterByName('search', window.location.href))
        )
        .subscribe(searchQuery => this.searchValue = searchQuery || '')

    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig().subscribe(
      config => this.serverConfig = config,

      err => this.notifier.error(err.message)
    )
  }

  get routerLink () {
    if (this.isUserLoggedIn()) {
      return [ '/videos/upload' ]
    } else if (this.isRegistrationAllowed()) {
      return [ '/signup' ]
    } else {
      return [ '/login', { fromUpload: true } ]
    }
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

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isRegistrationAllowed () {
    return this.serverConfig.signup.allowed &&
           this.serverConfig.signup.allowedForCurrentIP
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
