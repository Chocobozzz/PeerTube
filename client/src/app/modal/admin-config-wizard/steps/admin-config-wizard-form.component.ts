import { CdkStepperModule } from '@angular/cdk/stepper'
import { CommonModule } from '@angular/common'
import { Component, input, numberAttribute, output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ColorPickerModule } from 'primeng/colorpicker'
import { CustomIconComponent } from '../../../shared/shared-icons/custom-icon.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { CommunityBasedConfigComponent } from './usage-type/community-based-config.component'
import { InstitutionalConfigComponent } from './usage-type/institutional-config.component'
import { PrivateInstanceConfigComponent } from './usage-type/private-instance-config.component'
import { UsageType } from './usage-type/usage-type.model'

type PlatformType = 'community' | 'institution' | 'private'

@Component({
  selector: 'my-admin-config-wizard-form',
  templateUrl: './admin-config-wizard-form.component.html',
  styleUrls: [ './admin-config-wizard-form.component.scss', '../shared/admin-config-wizard-modal-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ColorPickerModule,
    CdkStepperModule,
    ButtonComponent,
    GlobalIconComponent,
    CommunityBasedConfigComponent,
    PrivateInstanceConfigComponent,
    InstitutionalConfigComponent,
    CustomIconComponent
  ]
})
export class AdminConfigWizardFormComponent {
  readonly currentStep = input.required({ transform: numberAttribute })
  readonly totalSteps = input.required({ transform: numberAttribute })

  readonly back = output()
  readonly next = output<UsageType>()
  readonly hide = output()

  iconKey = require('../../../../assets/images/feather/key.svg')
  iconInstitution = require('../../../../assets/images/feather/institution.svg')

  platformType: PlatformType
  usageType: { [id in PlatformType]: UsageType } = {
    community: UsageType.initForCommunity(),
    institution: UsageType.initForInstitution(),
    private: UsageType.initForPrivateInstance()
  }
}
