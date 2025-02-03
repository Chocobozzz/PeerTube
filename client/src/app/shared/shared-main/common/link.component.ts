import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { booleanAttribute, Component, Input, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-link',
  styleUrls: [ './link.component.scss' ],
  templateUrl: './link.component.html',
  imports: [ NgIf, RouterLink, NgClass, NgTemplateOutlet, GlobalIconComponent ]
})
export class LinkComponent implements OnInit {
  @Input() internalLink?: string | any[]

  @Input() href?: string
  @Input() target = '_self'

  @Input() title?: string

  @Input() className?: string
  @Input({ transform: booleanAttribute }) inheritParentStyle = false
  @Input({ transform: booleanAttribute }) inheritParentDimension = false

  @Input() tabindex: string | number

  @Input() ariaLabel: string

  @Input() icon: GlobalIconName

  builtClasses: string

  ngOnInit () {
    this.builtClasses = this.className || ''

    if (this.inheritParentStyle) {
      this.builtClasses += ' inherit-parent-style'
    }

    if (this.inheritParentDimension) {
      this.builtClasses += ' inherit-parent-dimension'
    }
  }
}
