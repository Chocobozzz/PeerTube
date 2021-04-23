import { Component, OnInit } from '@angular/core'
import { empty } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { RestExtractor } from '@app/core'

import { ActivatedRoute, Router } from '@angular/router'
import { AccountService } from '@app/shared/shared-main/account'

@Component({
  selector: 'my-actor',
  template: ''
})
export class ActorsComponent implements OnInit {
  constructor (
    private accountService: AccountService,
    private route: ActivatedRoute,
    private restExtractor: RestExtractor,
    private router: Router
  ) {
  }

  ngOnInit () {
    const accountOrChannelName = this.route.snapshot.params['actorName'].replace('@', '')

    this.accountService
        .getAccount(accountOrChannelName)
        .pipe(
          catchError(res => {
            if (res.status === 404 && res.message === 'Account not found') {
              this.router.navigateByUrl(`/video-channels/${accountOrChannelName}`)
              return empty()
            }

            return this.restExtractor.handleError(res)
          })
        )
        .subscribe(() => {
          this.router.navigateByUrl(`/accounts/${accountOrChannelName}`)
        })
  }
}
