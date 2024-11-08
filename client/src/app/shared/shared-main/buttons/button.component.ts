import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, Input, OnChanges, booleanAttribute } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { LoaderComponent } from '../common/loader.component'

@Component({
  selector: 'my-button',
  styleUrls: [ './button.component.scss' ],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ NgIf, NgClass, NgbTooltip, NgTemplateOutlet, RouterLink, LoaderComponent, GlobalIconComponent ]
})

export class ButtonComponent implements OnChanges {
  @Input() label = ''
  @Input() theme: 'orange' | 'grey' = 'grey'
  @Input() icon: GlobalIconName
  @Input() ptRouterLink: string[] | string
  @Input() title: string
  @Input({ transform: booleanAttribute }) loading = false
  @Input({ transform: booleanAttribute }) disabled = false
  @Input({ transform: booleanAttribute }) responsiveLabel = false

  classes: { [id: string]: boolean } = {}

  ngOnChanges () {
    this.buildClasses()
  }

  private buildClasses () {
    console.log('build classes')

    this.classes = {
      'peertube-button': !this.ptRouterLink,
      'peertube-button-link': !!this.ptRouterLink,
      'orange-button': this.theme === 'orange',
      'grey-button': this.theme === 'grey',
      'icon-only': !this.label,
      'has-icon': !!this.icon,
      'responsive-label': this.responsiveLabel
    }
  }
}
