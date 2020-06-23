import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { Debug } from '@shared/models'
import { DebugService } from './debug.service'

@Component({
  templateUrl: './debug.component.html',
  styleUrls: [ './debug.component.scss' ]
})
export class DebugComponent implements OnInit {
  debug: Debug

  constructor (
    private debugService: DebugService,
    private notifier: Notifier
  ) {
  }

  ngOnInit (): void {
    this.load()
  }

  load () {
    this.debugService.getDebug()
        .subscribe(
          debug => this.debug = debug,

          err => this.notifier.error(err.message)
        )
  }
}
