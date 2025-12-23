import { Component, OnInit, inject } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { Router } from '@angular/router'
import { LoginLinkComponent } from '@app/shared/shared-main/users/login-link.component'
import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'

@Component({
  selector: 'my-error-page',
  templateUrl: './error-page.component.html',
  styleUrls: [ './error-page.component.scss' ],
  imports: [ LoginLinkComponent ]
})
export class ErrorPageComponent implements OnInit {
  private titleService = inject(Title)
  private router = inject(Router)

  status: HttpStatusCodeType = HttpStatusCode.NOT_FOUND_404
  type: 'video' | 'other' = 'other'

  public constructor () {
    // Keep this in constructor so we getCurrentNavigation() doesn't return null
    const state = this.router.currentNavigation()?.extras.state
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
