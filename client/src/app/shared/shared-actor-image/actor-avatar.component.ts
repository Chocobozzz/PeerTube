import { CommonModule, NgTemplateOutlet } from '@angular/common'
import { Component, ElementRef, OnChanges, OnInit, booleanAttribute, inject, input, numberAttribute, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { ActorImage } from '@peertube/peertube-models'
import { Account } from '../shared-main/account/account.model'
import { Actor } from '../shared-main/account/actor.model'
import { VideoChannel } from '../shared-main/channel/video-channel.model'

export type ActorAvatarInput = {
  name: string
  avatars: Pick<ActorImage, 'width' | 'fileUrl'>[]
}

export type ActorAvatarType = 'channel' | 'account' | 'instance' | 'unlogged'

@Component({
  selector: 'my-actor-avatar',
  styleUrls: [ './actor-avatar.component.scss' ],
  templateUrl: './actor-avatar.component.html',
  imports: [ CommonModule, NgTemplateOutlet, RouterLink ]
})
export class ActorAvatarComponent implements OnInit, OnChanges {
  private el = inject(ElementRef)

  readonly avatarEl = viewChild<ElementRef>('avatarEl')

  readonly actor = input.required<ActorAvatarInput>()
  readonly actorType = input.required<ActorAvatarType>()

  readonly previewImage = input<string>(undefined)

  readonly size = input(120, { transform: numberAttribute })
  readonly responseSize = input(false, { transform: booleanAttribute })

  // Use an external link
  readonly href = input<string>(undefined)
  // Use routerLink
  readonly internalHref = input<string | any[]>(undefined)

  readonly title = input<string>()

  getTitle () {
    if (this.title()) return this.title()
    if (this.isAccount()) return $localize`${this.actor().name} (account page)`
    if (this.isChannel()) return $localize`${this.actor().name} (channel page)`
    if (this.isInstance()) return $localize`${this.actor().name} (instance page)`

    return ''
  }

  classes: string[] = []
  defaultAvatarUrl: string
  avatarUrl: string

  ngOnInit () {
    this.buildDefaultAvatarUrl()

    this.buildAvatarUrl()
    this.buildClasses()
  }

  ngOnChanges () {
    this.buildAvatarUrl()
    this.buildClasses()
  }

  private buildClasses () {
    let avatarSize = '100%'
    let fontSize = '22px'

    this.classes = [ 'avatar' ]

    const size = this.size()
    if (size && !this.responseSize()) {
      avatarSize = `${size}px`

      if (size <= 18) {
        fontSize = '13px'
      } else if (size >= 100) {
        fontSize = '40px'
      } else if (size >= 120) {
        fontSize = '46px'
      }
    }

    if (this.isChannel()) {
      this.classes.push('channel')
    } else if (this.isAccount()) {
      this.classes.push('account')
    } else if (this.isInstance()) {
      this.classes.push('instance')
    }

    // No avatar, use actor name initial
    if (this.displayActorInitial()) {
      this.classes.push('initial')
      this.classes.push(this.getColorTheme())
    }

    const elStyle = (this.el.nativeElement as HTMLElement).style
    elStyle.setProperty('--co-avatar-size', avatarSize)
    elStyle.setProperty('--co-font-size', fontSize)
  }

  private buildDefaultAvatarUrl () {
    // TODO: have a default instance avatar

    this.defaultAvatarUrl = this.isChannel()
      ? VideoChannel.GET_DEFAULT_AVATAR_URL(this.getSizeNumber())
      : Account.GET_DEFAULT_AVATAR_URL(this.getSizeNumber())
  }

  private buildAvatarUrl () {
    const actor = this.actor()
    if (!actor) {
      this.avatarUrl = ''
      return
    }

    if (this.isAccount() || this.isChannel() || this.isInstance()) {
      this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(actor, this.getSizeNumber())
      return
    }

    this.avatarUrl = ''
  }

  displayImage () {
    if (this.actorType() === 'unlogged') return true
    if (this.previewImage()) return true

    return !!(this.actor() && this.avatarUrl)
  }

  displayActorInitial () {
    return !this.displayImage() && this.actor() && !this.avatarUrl
  }

  displayPlaceholder () {
    return this.actorType() !== 'unlogged' && !this.actor()
  }

  getActorInitial () {
    const name = this.actor()?.name
    if (!name) return ''

    return name.slice(0, 1)
  }

  private isAccount () {
    return this.actorType() === 'account'
  }

  private isChannel () {
    return this.actorType() === 'channel'
  }

  private isInstance () {
    return this.actorType() === 'instance'
  }

  private getSizeNumber () {
    const size = this.size()
    if (size) return +size

    return undefined
  }

  private getColorTheme () {
    const initialLowercase = this.getActorInitial().toLowerCase()

    // Keep consistency with CSS
    const themes = {
      '0123456789abc': 'blue',
      'def': 'green',
      'ghi': 'purple',
      'jkl': 'gray',
      'mno': 'yellow',
      'pqr': 'orange',
      'stvu': 'red',
      'wxyz': 'dark-blue'
    }

    const theme = objectKeysTyped(themes)
      .find(chars => chars.includes(initialLowercase))

    return themes[theme] || 'blue'
  }
}
