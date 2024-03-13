import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'

const images = {
  about: require('!!raw-loader?!../../../assets/images/mascot/register/about.svg').default,
  terms: require('!!raw-loader?!../../../assets/images/mascot/register/terms.svg').default,
  success: require('!!raw-loader?!../../../assets/images/mascot/register/success.svg').default,
  channel: require('!!raw-loader?!../../../assets/images/mascot/register/channel.svg').default,
  account: require('!!raw-loader?!../../../assets/images/mascot/register/account.svg').default
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
  @Input() imageName: MascotImageName

  constructor (private sanitize: DomSanitizer) {

  }

  get html () {
    return this.sanitize.bypassSecurityTrustHtml(images[this.imageName])
  }
}
