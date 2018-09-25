import { Component, Input, OnInit } from '@angular/core'
import { FormReactive } from '@app/shared/forms/form-reactive'
import {
  FormValidatorService,
  UserValidatorsService
} from '@app/shared/forms/form-validators'

@Component({
  selector: 'my-remote-subscribe',
  templateUrl: './remote-subscribe.component.html',
  styleUrls: ['./remote-subscribe.component.scss']
})
export class RemoteSubscribeComponent extends FormReactive implements OnInit {
  @Input() account: string
  @Input() interact = false
  @Input() showHelp = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      text: this.userValidatorsService.USER_EMAIL
    })
  }

  onValidKey () {
    this.onValueChanged()
    if (!this.form.valid) return

    this.formValidated()
  }

  formValidated () {
    const address = this.form.value['text']
    const [ , hostname ] = address.split('@')
    window.open(`https://${hostname}/authorize_interaction?acct=${this.account}`)
  }
}
