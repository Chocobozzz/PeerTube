import { CommonModule } from '@angular/common'
import { Component, forwardRef, inject, input, model } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { AuthService } from '@app/core'
import { VideoChannel } from '@peertube/peertube-models'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { CollaboratorStateComponent } from '../shared-main/channel/collaborator-state.component'

@Component({
  selector: 'my-channel-toggle',
  styleUrls: [ './channel-toggle.component.scss' ],
  templateUrl: './channel-toggle.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChannelToggleComponent),
      multi: true
    }
  ],
  standalone: true,
  imports: [
    CommonModule,
    ActorAvatarComponent,
    CollaboratorStateComponent
  ]
})
export class ChannelToggleComponent implements ControlValueAccessor {
  private authService = inject(AuthService)

  readonly checked = model(false)
  readonly channel = input.required<VideoChannel>()
  readonly inputName = input<string>(undefined)
  readonly label = input($localize`Toggle this channel`)

  get user () {
    return this.authService.getUser()
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (checked: boolean) {
    this.checked.set(checked)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  toggle () {
    this.checked.set(!this.checked())
    this.propagateChange(this.checked())
  }
}
