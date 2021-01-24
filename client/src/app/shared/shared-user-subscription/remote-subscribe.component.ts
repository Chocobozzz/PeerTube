import { Component, Input, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { USER_HANDLE_VALIDATOR } from '../form-validators/user-validators'

@Component({
  selector: 'my-remote-subscribe',
  templateUrl: './remote-subscribe.component.html',
  styleUrls: ['./remote-subscribe.component.scss']
})
export class RemoteSubscribeComponent extends FormReactive implements OnInit {
  @Input() uri: string
  @Input() interact = false
  @Input() showHelp = false

  constructor (
    protected formValidatorService: FormValidatorService,
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
    this.check()
    if (!this.form.valid) return

    this.formValidated()
  }

  formValidated () {
    const address = this.form.value['text']
    const [ username, hostname ] = address.split('@')

    const protocol = window.location.protocol

    // Should not have CORS error because https://tools.ietf.org/html/rfc7033#section-5
    fetch(`${protocol}//${hostname}/.well-known/webfinger?resource=acct:${username}@${hostname}`)
      .then(response => response.json())
      .then(data => new Promise((res, rej) => {
        if (!data || Array.isArray(data.links) === false) return rej()

        const link: { template: string } = data.links.find((link: any) => {
          return link && typeof link.template === 'string' && link.rel === 'http://ostatus.org/schema/1.0/subscribe'
        })

        if (link && link.template.includes('{uri}')) {
          res(link.template.replace('{uri}', encodeURIComponent(this.uri)))
        }
      }))
      .then(window.open)
      .catch(err => {
        console.error(err)

        this.notifier.error($localize`Cannot fetch information of this remote account`)
      })
  }
}
