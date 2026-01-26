import { NgClass, NgTemplateOutlet } from '@angular/common'
import { booleanAttribute, Component, OnInit, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-link',
  styleUrls: [ './link.component.scss' ],
  templateUrl: './link.component.html',
  imports: [ RouterLink, NgClass, NgTemplateOutlet, GlobalIconComponent ]
})
export class LinkComponent implements OnInit {
  readonly internalLink = input<string | any[]>(undefined)

  readonly href = input<string>(undefined)
  readonly target = input('_self')

  readonly title = input<string>(undefined)

  readonly className = input<string>(undefined)
  readonly inheritParentStyle = input(false, { transform: booleanAttribute })
  readonly inheritParentDimension = input(false, { transform: booleanAttribute })

  readonly tabindex = input<string | number>(undefined)

  readonly ariaLabel = input<string>(undefined)

  readonly icon = input<GlobalIconName>(undefined)

  builtClasses: string

  ngOnInit () {
    this.builtClasses = this.className() || ''

    if (this.inheritParentStyle()) {
      this.builtClasses += ' inherit-parent-style'
    }

    if (this.inheritParentDimension()) {
      this.builtClasses += ' inherit-parent-dimension'
    }
  }
}
