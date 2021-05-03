import { Component, OnInit } from '@angular/core'
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import { ActivatedRoute, Router } from '@angular/router'
import { RestExtractor } from '@app/core'
import { ActorService } from '@app/shared/shared-main/account'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

@Component({
  selector: 'my-root',
  template: ''
})
export class RootComponent implements OnInit {
  constructor (
    private actorService: ActorService,
    private route: ActivatedRoute,
    private restExtractor: RestExtractor,
    private router: Router
  ) {
  }

  ngOnInit () {
    this.route.params
        .pipe(
          map(params => params[ 'actorName' ]),
          distinctUntilChanged(),
          switchMap(actorName => this.actorService.getActorType(actorName)),
          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, 'other', [
            HttpStatusCode.BAD_REQUEST_400,
            HttpStatusCode.NOT_FOUND_404
          ]))
        )
        .subscribe(actorType => {
          const actorName = this.route.snapshot.params[ 'actorName' ]

          if (actorType === 'Account') {
            this.router.navigate([ `/a/${actorName}` ], { state: { type: 'others', obj: { status: 200 } }, skipLocationChange: true })
          }

          if (actorType === 'VideoChannel') {
            this.router.navigate([ `/c/${actorName}` ], { state: { type: 'others', obj: { status: 200 } }, skipLocationChange: true })
          }
        })
  }
}
