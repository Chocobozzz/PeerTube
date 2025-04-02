import { CommonModule } from '@angular/common'
import { Component, forwardRef, input, model } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { VideoChannel } from '@peertube/peertube-models'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'

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
    ActorAvatarComponent
  ]
})
export class ChannelToggleComponent implements ControlValueAccessor {
  readonly checked = model(false)
  readonly channel = input.required<VideoChannel>()
  readonly inputName = input<string>(undefined)
  readonly label = input($localize`Toggle this channel`)

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
