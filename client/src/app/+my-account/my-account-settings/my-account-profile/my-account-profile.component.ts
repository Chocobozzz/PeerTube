import { NgClass } from '@angular/common'
import { Component, OnInit, inject, model } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, User, UserService } from '@app/core'
import { USER_DESCRIPTION_VALIDATOR, USER_DISPLAY_NAME_REQUIRED_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { MarkdownTextareaComponent } from '@app/shared/shared-forms/markdown-textarea.component'
import { HelpComponent } from '@app/shared/shared-main/buttons/help.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'

@Component({
  selector: 'my-account-profile',
  templateUrl: './my-account-profile.component.html',
  styleUrls: [ './my-account-profile.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, AlertComponent, HelpComponent, MarkdownTextareaComponent ]
})
export class MyAccountProfileComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)
  private userService = inject(UserService)

  readonly user = model<User>()

  error: string = null

  ngOnInit () {
    this.buildForm({
      'username': null,
      'display-name': USER_DISPLAY_NAME_REQUIRED_VALIDATOR,
      'description': USER_DESCRIPTION_VALIDATOR
    })
    this.form.controls['username'].disable()

    this.form.patchValue({
      'username': this.user().username,
      'display-name': this.user().account.displayName,
      'description': this.user().account.description
    })
  }

  get instanceHost () {
    return window.location.host
  }

  updateMyProfile () {
    const displayName = this.form.value['display-name']
    const description = this.form.value['description'] || null

    this.error = null

    this.userService.updateMyProfile({ displayName, description })
      .subscribe({
        next: () => {
          this.user.update(u => {
            // FIXME: Use immutability
            u.account.displayName = displayName
            u.account.description = description

            return u
          })

          this.notifier.success($localize`Profile updated.`)
        },

        error: err => this.error = err.message
      })
  }
}
