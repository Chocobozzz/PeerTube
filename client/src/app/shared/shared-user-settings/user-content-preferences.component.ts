import { ChangeDetectionStrategy, Component } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { BooleanBothQuery, UserUpdateMe } from '@peertube/peertube-models'
import { SelectOptionsItem } from '@pt-types'
import { SelectCategoriesComponent } from '../shared-forms/select/select-categories.component'
import { SelectLanguagesComponent } from '../shared-forms/select/select-languages.component'
import { SelectRadioComponent } from '../shared-forms/select/select-radio.component'
import { BuildFormArgumentTyped } from '../form-validators/form-validator.model'
import { AbstractUserVideoSettings } from './abstract-user-video-settings'

type Form = {
  videoLanguages: FormControl<string[]>
  videoCategories: FormControl<string[]>
  videoLive: FormControl<BooleanBothQuery>
}

@Component({
  selector: 'my-user-content-preferences',
  templateUrl: './user-content-preferences.component.html',
  styleUrls: [ './user-content-preferences.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, SelectLanguagesComponent, SelectCategoriesComponent, SelectRadioComponent ]
})
export class UserContentPreferencesComponent extends AbstractUserVideoSettings<Form> {
  protected readonly formKeys: BuildFormArgumentTyped<Form> = {
    videoLanguages: null,
    videoCategories: null,
    videoLive: null
  }

  protected readonly updatedMessage = $localize`Content preferences updated.`

  videoLiveItems: SelectOptionsItem[] = [
    {
      id: 'both',
      label: $localize`VOD & Live videos`
    },
    {
      id: 'false',
      label: $localize`VOD videos`
    },
    {
      id: 'true',
      label: $localize`Live videos`
    }
  ]

  protected patchForm () {
    this.form.patchValue({
      videoLanguages: this.user().videoLanguages,
      videoCategories: this.user().videoCategories?.map(c => c + '') ?? null,
      videoLive: this.user().videoLive || 'both'
    })
  }

  protected buildUpdateDetails (): UserUpdateMe | undefined {
    const videoLanguages = this.form.value.videoLanguages

    if (Array.isArray(videoLanguages) && videoLanguages.length > 20) {
      this.notifier.error($localize`Too many languages are enabled. Please enable them all or stay below 20 enabled languages.`)
      return undefined
    }

    // null means all categories
    const videoCategories = Array.isArray(this.form.value.videoCategories)
      ? this.form.value.videoCategories.map(c => parseInt(c, 10))
      : null

    return {
      videoLanguages,
      videoCategories,
      videoLive: this.form.value.videoLive
    }
  }
}
