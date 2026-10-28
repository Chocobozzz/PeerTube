import { ChangeDetectionStrategy, Component } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { UserUpdateMe, VideoAIUsage, VideoAIUsageType } from '@peertube/peertube-models'
import { BuildFormArgumentTyped } from '../form-validators/form-validator.model'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { AbstractUserVideoSettings } from './abstract-user-video-settings'

type Form = {
  hideAIGenerated: FormControl<boolean>
  hideContainsAI: FormControl<boolean>
  hideNotSpecified: FormControl<boolean>
}

@Component({
  selector: 'my-user-ai-content-settings',
  templateUrl: './user-ai-content-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, PeertubeCheckboxComponent ]
})
export class UserAIContentSettingsComponent extends AbstractUserVideoSettings<Form> {
  protected readonly formKeys: BuildFormArgumentTyped<Form> = {
    hideAIGenerated: null,
    hideContainsAI: null,
    hideNotSpecified: null
  }

  protected readonly updatedMessage = $localize`AI-generated content settings updated.`

  private readonly formKeyToAIUsage: { [id in keyof Form]: VideoAIUsageType } = {
    hideAIGenerated: VideoAIUsage.AI_GENERATED,
    hideContainsAI: VideoAIUsage.CONTAINS_AI,
    hideNotSpecified: VideoAIUsage.NOT_SPECIFIED
  }

  protected patchForm () {
    const hidden = this.user().aiUsagesHidden || []

    this.form.patchValue({
      hideAIGenerated: hidden.includes(VideoAIUsage.AI_GENERATED),
      hideContainsAI: hidden.includes(VideoAIUsage.CONTAINS_AI),
      hideNotSpecified: hidden.includes(VideoAIUsage.NOT_SPECIFIED)
    })
  }

  protected buildUpdateDetails (): UserUpdateMe {
    const aiUsagesHidden = (Object.keys(this.formKeyToAIUsage) as (keyof Form)[])
      .filter(key => this.form.value[key] === true)
      .map(key => this.formKeyToAIUsage[key])

    return { aiUsagesHidden }
  }

  // All checkboxes are mapped to the same user update key
  protected override expandOnlyKeys (onlyKeys: string[]) {
    return [ ...onlyKeys, 'aiUsagesHidden' ]
  }
}
