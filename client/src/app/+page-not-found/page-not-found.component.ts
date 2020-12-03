import { Component, OnInit } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

@Component({
  selector: 'my-page-not-found',
  templateUrl: './page-not-found.component.html',
  styleUrls: [ './page-not-found.component.scss' ]
})
export class PageNotFoundComponent implements OnInit {
  status = HttpStatusCode.NOT_FOUND_404

  public constructor (
    private titleService: Title
  ) {}

  ngOnInit () {
    if (this.pathname.includes('teapot')) {
      this.status = HttpStatusCode.I_AM_A_TEAPOT_418
      this.titleService.setTitle($localize`I'm a teapot` + ' - PeerTube')
    }
  }

  get pathname () {
    return window.location.pathname
  }

  getMascotName () {
    switch (this.status) {
      case HttpStatusCode.I_AM_A_TEAPOT_418:
        return 'happy'
      case HttpStatusCode.NOT_FOUND_404:
      default:
        return 'defeated'
    }
  }
}
