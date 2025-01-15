import { Component, Input, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { logger } from '@root-helpers/logger'
import { USER_HANDLE_VALIDATOR } from '../form-validators/user-validators'
import { PeerTubeTemplateDirective } from '../shared-main/common/peertube-template.directive'
import { HelpComponent } from '../shared-main/buttons/help.component'
import { NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'

@Component({
  selector: 'my-remote-subscribe',
  templateUrl: './remote-subscribe.component.html',
  standalone: true,
  imports: [ FormsModule, ReactiveFormsModule, NgIf, HelpComponent, PeerTubeTemplateDirective ]
})
export class RemoteSubscribeComponent extends FormReactive implements OnInit {
  @Input() uri: string
  @Input() interact = false
  @Input() showHelp = false

  constructor (
    protected formReactiveService: FormReactiveService,
    private notifier: Notifier
  ) {
    super()
  }

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

    const protocol = window.location.protocol

    // Should not have CORS error because https://tools.ietf.org/html/rfc7033#section-5
    fetch(`${protocol}//${hostname}/.well-known/webfinger?resource=acct:${username}@${hostname}`)
      .then(response => response.json())
      .then(data => {
        if (!data || Array.isArray(data.links) === false) {
          throw new Error('Not links in webfinger response')
        }

        const link: { template: string } = data.links.find((link: any) => {
          return link && typeof link.template === 'string' && link.rel === 'http://ostatus.org/schema/1.0/subscribe'
        })

        if (link?.template.includes('{uri}')) {
          return link.template.replace('{uri}', encodeURIComponent(this.uri))
        }

        throw new Error('No subscribe template in webfinger response')
      })
      .then(window.open)
      .catch(err => {
        logger.error(err)

        this.notifier.error($localize`Cannot fetch information of this remote account`)
      })
  }
}
