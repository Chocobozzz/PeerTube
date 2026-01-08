import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier, ServerService } from '@app/core'
import { Debug } from '@peertube/peertube-models'
import { DebugService } from './debug.service'

@Component({
  templateUrl: './debug.component.html',
  styleUrls: [ './debug.component.scss' ],
  imports: [ FormsModule ]
})
export class DebugComponent implements OnInit {
  private debugService = inject(DebugService)
  private notifier = inject(Notifier)
  private server = inject(ServerService)

  debug: Debug
  testEmail: string

  ngOnInit (): void {
    this.load()
  }

  isEmailDisabled () {
    return this.server.getHTMLConfig().email.enabled === false
  }

  load () {
    this.debugService.getDebug()
      .subscribe({
        next: debug => this.debug = debug,

        error: err => this.notifier.handleError(err)
      })
  }

  sendTestEmails () {
    this.debugService.testEmails(this.testEmail)
      .subscribe({
        next: () => {
          this.testEmail = ''

          this.notifier.success($localize`Emails will be sent!`)
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
