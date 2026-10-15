import { ChangeDetectionStrategy, Component } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { UserUpdateMe } from '@peertube/peertube-models'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { BuildFormArgumentTyped } from '../form-validators/form-validator.model'
import { AbstractUserVideoSettings } from './abstract-user-video-settings'

type Form = {
  p2pEnabled: FormControl<boolean>
  autoPlayVideo: FormControl<boolean>
  autoPlayNextVideo: FormControl<boolean>
}

@Component({
  selector: 'my-user-player-settings',
  templateUrl: './user-player-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, PeertubeCheckboxComponent ]
})
export class UserPlayerSettingsComponent extends AbstractUserVideoSettings<Form> {
  protected readonly formKeys: BuildFormArgumentTyped<Form> = {
    p2pEnabled: null,
    autoPlayVideo: null,
    autoPlayNextVideo: null
  }

  protected readonly updatedMessage = $localize`Player settings updated.`

  protected patchForm () {
    this.form.patchValue({
      p2pEnabled: this.user().p2pEnabled,
      autoPlayVideo: this.user().autoPlayVideo === true,
      autoPlayNextVideo: this.user().autoPlayNextVideo
    })
  }

  protected buildUpdateDetails (): UserUpdateMe {
    const { p2pEnabled, autoPlayVideo, autoPlayNextVideo } = this.form.value

    return { p2pEnabled, autoPlayVideo, autoPlayNextVideo }
  }
}
