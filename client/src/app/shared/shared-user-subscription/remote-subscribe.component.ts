import { Component, OnInit, inject, input } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { logger } from '@root-helpers/logger'
import { isIOS } from '@root-helpers/web-browser'
import { USER_HANDLE_VALIDATOR } from '../form-validators/user-validators'
import { HelpComponent } from '../shared-main/buttons/help.component'

@Component({
  selector: 'my-remote-subscribe',
  templateUrl: './remote-subscribe.component.html',
  imports: [ FormsModule, ReactiveFormsModule, HelpComponent ]
})
export class RemoteSubscribeComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)

  readonly uri = input<string>(undefined)
  readonly interact = input(false)
  readonly showHelp = input(false)

  ngOnInit () {
    this.buildForm({
      text: USER_HANDLE_VALIDATOR
    })
  }

  onValidKey () {
    this.forceCheck()
    if (!this.form.valid) return

    this.formValidated()
  }

  formValidated () {
    let address = this.form.value['text'] || ''
    address = address.replace(/^@/, '')

    const [ username, hostname ] = address.split('@')

    // Should not have CORS error because https://tools.ietf.org/html/rfc7033#section-5
    fetch(`https://${hostname}/.well-known/webfinger?resource=acct:${username}@${hostname}`)
      .then(response => response.json())
      .then(data => {
        if (!data || Array.isArray(data.links) === false) {
          throw new Error('Not links in webfinger response')
        }

        const link: { template: string } = data.links.find((link: any) => {
          return link && typeof link.template === 'string' && link.rel === 'http://ostatus.org/schema/1.0/subscribe'
        })

        if (link?.template.includes('{uri}')) {
          return link.template.replace('{uri}', encodeURIComponent(this.uri()))
        }

        throw new Error('No subscribe template in webfinger response')
      })
      .then(url => {
        if (isIOS()) return window.location.href = url

        return window.open(url)
      })
      .catch(err => {
        logger.error(err)

        this.notifier.error($localize`Cannot fetch information of this remote account`)
      })
  }
}
