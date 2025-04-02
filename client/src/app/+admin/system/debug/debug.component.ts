import { Component, OnInit, inject } from '@angular/core'
import { Notifier } from '@app/core'
import { Debug } from '@peertube/peertube-models'
import { DebugService } from './debug.service'

@Component({
  templateUrl: './debug.component.html',
  styleUrls: [ './debug.component.scss' ],
  imports: []
})
export class DebugComponent implements OnInit {
  private debugService = inject(DebugService)
  private notifier = inject(Notifier)

  debug: Debug

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
