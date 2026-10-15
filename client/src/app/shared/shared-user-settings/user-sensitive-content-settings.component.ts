import { ChangeDetectionStrategy, Component } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NSFWFlag, NSFWFlagType, NSFWPolicyType, UserUpdateMe } from '@peertube/peertube-models'
import { SelectOptionsItem } from '@pt-types'
import { SelectRadioComponent } from '../shared-forms/select/select-radio.component'
import { BuildFormArgumentTyped } from '../form-validators/form-validator.model'
import { AbstractUserVideoSettings } from './abstract-user-video-settings'

type NSFWFlagPolicyType = NSFWPolicyType | 'default'

type Form = {
  nsfwPolicy: FormControl<NSFWPolicyType>
  nsfwFlagViolent: FormControl<NSFWFlagPolicyType>
  nsfwFlagSex: FormControl<NSFWFlagPolicyType>
}

@Component({
  selector: 'my-user-sensitive-content-settings',
  templateUrl: './user-sensitive-content-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, ReactiveFormsModule, SelectRadioComponent ]
})
export class UserSensitiveContentSettingsComponent extends AbstractUserVideoSettings<Form> {
  protected readonly formKeys: BuildFormArgumentTyped<Form> = {
    nsfwPolicy: null,
    nsfwFlagViolent: null,
    nsfwFlagSex: null
  }

  protected readonly updatedMessage = $localize`Sensitive content settings updated.`

  nsfwItems: SelectOptionsItem[] = [
    {
      id: 'do_not_list',
      label: $localize`Hide`
    },
    {
      id: 'blur',
      label: $localize`Blur`
    },
    {
      id: 'warn',
      label: $localize`Warn`
    },
    {
      id: 'display',
      label: $localize`Display`
    }
  ]

  nsfwFlagItems: SelectOptionsItem[] = [
    {
      id: 'default',
      label: $localize`Default`
    },
    {
      id: 'do_not_list',
      label: $localize`Hide`
    },
    {
      id: 'blur',
      label: $localize`Blur`
    },
    {
      id: 'warn',
      label: $localize`Warn`
    },
    {
      id: 'display',
      label: $localize`Display`
    }
  ]

  isNsfwFlagsEnabled () {
    return this.serverService.getHTMLConfig().nsfwFlagsSettings.enabled
  }

  protected override onFormBuilt () {
    this.updateNSFWDefaultLabel(this.user().nsfwPolicy)
    this.form.controls.nsfwPolicy.valueChanges.subscribe(nsfwPolicy => this.updateNSFWDefaultLabel(nsfwPolicy))
  }

  protected patchForm () {
    const defaultNSFWPolicy = this.serverService.getHTMLConfig().instance.defaultNSFWPolicy

    this.form.patchValue({
      nsfwPolicy: this.user().nsfwPolicy || defaultNSFWPolicy,
      nsfwFlagViolent: this.buildNSFWFormFlag(NSFWFlag.VIOLENT),
      nsfwFlagSex: this.buildNSFWFormFlag(NSFWFlag.EXPLICIT_SEX)
    })
  }

  protected buildUpdateDetails (): UserUpdateMe {
    return {
      nsfwPolicy: this.form.value.nsfwPolicy,

      nsfwFlagsDisplayed: this.buildNSFWUpdateFlag('display'),
      nsfwFlagsHidden: this.buildNSFWUpdateFlag('do_not_list'),
      nsfwFlagsWarned: this.buildNSFWUpdateFlag('warn'),
      nsfwFlagsBlurred: this.buildNSFWUpdateFlag('blur')
    }
  }

  protected override expandOnlyKeys (onlyKeys: string[]) {
    const hasNSFWFlags = onlyKeys.includes('nsfwFlagViolent') || onlyKeys.includes('nsfwFlagSex')

    return hasNSFWFlags
      ? [ ...onlyKeys, 'nsfwFlagsDisplayed', 'nsfwFlagsHidden', 'nsfwFlagsWarned', 'nsfwFlagsBlurred' ]
      : onlyKeys
  }

  private buildNSFWFormFlag (flag: NSFWFlagType): NSFWFlagPolicyType {
    const user = this.user()

    if ((user.nsfwFlagsDisplayed & flag) === flag) return 'display'
    if ((user.nsfwFlagsWarned & flag) === flag) return 'warn'
    if ((user.nsfwFlagsBlurred & flag) === flag) return 'blur'
    if ((user.nsfwFlagsHidden & flag) === flag) return 'do_not_list'

    return 'default'
  }

  private buildNSFWUpdateFlag (type: NSFWPolicyType): number {
    let result = NSFWFlag.NONE

    if (this.form.value.nsfwFlagViolent === type) result |= NSFWFlag.VIOLENT
    if (this.form.value.nsfwFlagSex === type) result |= NSFWFlag.EXPLICIT_SEX

    return result
  }

  private updateNSFWDefaultLabel (nsfwPolicy: NSFWPolicyType) {
    const defaultItem = this.nsfwFlagItems.find(item => item.id === 'default')
    const nsfwPolicyLabel = this.nsfwItems.find(i => i.id === nsfwPolicy).label

    defaultItem.label = $localize`Default (${nsfwPolicyLabel})`
  }
}
