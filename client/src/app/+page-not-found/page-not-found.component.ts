import { Component, OnInit } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { Router } from '@angular/router'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

@Component({
  selector: 'my-page-not-found',
  templateUrl: './page-not-found.component.html',
  styleUrls: [ './page-not-found.component.scss' ]
})
export class PageNotFoundComponent implements OnInit {
  status = HttpStatusCode.NOT_FOUND_404
  type: string

  public constructor (
    private titleService: Title,
    private router: Router
  ) {
    const state = this.router.getCurrentNavigation()?.extras.state
    this.type = state?.type || this.type
    this.status = state?.obj.status || this.status
  }

  ngOnInit () {
    if (this.pathname.includes('teapot')) {
      this.status = HttpStatusCode.I_AM_A_TEAPOT_418
      this.titleService.setTitle($localize`I'm a teapot` + ' - PeerTube')
    }
  }

  get pathname () {
    return window.location.pathname
  }

  getRessourceName () {
    switch (this.type) {
      case 'video':
        return $localize`video`
      default:
        return $localize`ressource`
    }
  }

  getMascotName () {
    switch (this.status) {
      case HttpStatusCode.I_AM_A_TEAPOT_418:
        return 'happy'
      case HttpStatusCode.FORBIDDEN_403:
        return 'arguing'
      case HttpStatusCode.NOT_FOUND_404:
      default:
        return 'defeated'
    }
  }
}
