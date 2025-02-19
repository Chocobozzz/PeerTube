import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'

const images = {
  about: require('../../../assets/images/mascot/register/about.svg'),
  terms: require('../../../assets/images/mascot/register/terms.svg'),
  success: require('../../../assets/images/mascot/register/success.svg'),
  channel: require('../../../assets/images/mascot/register/channel.svg'),
  account: require('../../../assets/images/mascot/register/account.svg')
}

export type MascotImageName = keyof typeof images

@Component({
  selector: 'my-signup-mascot',
  styleUrls: [ './signup-mascot.component.scss' ],
  template: `<div class="root" [innerHTML]="html"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class SignupMascotComponent {
  private sanitize = inject(DomSanitizer)

  readonly imageName = input<MascotImageName>(undefined)

  get html () {
    return this.sanitize.bypassSecurityTrustHtml(images[this.imageName()])
  }
}
