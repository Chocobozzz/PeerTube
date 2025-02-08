import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { Debug } from '@peertube/peertube-models'
import { DebugService } from './debug.service'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'

@Component({
  templateUrl: './debug.component.html',
  styleUrls: [ './debug.component.scss' ],
  imports: [
    GlobalIconComponent
  ]
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
        .subscribe({
          next: debug => this.debug = debug,

          error: err => this.notifier.error(err.message)
        })
  }
}
