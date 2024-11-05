import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit } from '@angular/core'
import { HooksService } from '@app/core/plugins/hooks.service'

const icons = {
  // misc icons
  'markdown': require('../../../assets/images/misc/markdown.svg'),
  'language': require('../../../assets/images/misc/language.svg'),
  'video-lang': require('../../../assets/images/misc/video-lang.svg'),
  'support': require('../../../assets/images/misc/support.svg'),
  'peertube-x': require('../../../assets/images/misc/peertube-x.svg'),
  'robot': require('../../../assets/images/misc/miscellaneous-services.svg'), // material ui
  'playlist-add': require('../../../assets/images/misc/playlist-add.svg'), // material ui
  'follower': require('../../../assets/images/misc/account-arrow-left.svg'), // material ui
  'following': require('../../../assets/images/misc/account-arrow-right.svg'), // material ui
  'tip': require('../../../assets/images/misc/tip.svg'), // material ui
  'flame': require('../../../assets/images/misc/flame.svg'),

  // feather/lucide icons
  'menu': require('../../../assets/images/feather/menu.svg'),
  'history': require('../../../assets/images/feather/history.svg'),
  'registry': require('../../../assets/images/feather/registry.svg'),
  'subscriptions': require('../../../assets/images/feather/subscriptions.svg'),
  'videos': require('../../../assets/images/feather/videos.svg'),
  'add': require('../../../assets/images/feather/plus.svg'),
  'alert': require('../../../assets/images/feather/alert.svg'),
  'overview': require('../../../assets/images/feather/overview.svg'),
  'moderation': require('../../../assets/images/feather/moderation.svg'),
  'config': require('../../../assets/images/feather/config.svg'),
  'award': require('../../../assets/images/feather/award.svg'),
  'bell': require('../../../assets/images/feather/bell.svg'),
  'opened-bell': require('../../../assets/images/feather/opened-bell.svg'),
  'channel': require('../../../assets/images/feather/channel.svg'),
  'chevrons-up': require('../../../assets/images/feather/chevrons-up.svg'),
  'chevron-left': require('../../../assets/images/feather/chevron-left.svg'),
  'circle-tick': require('../../../assets/images/feather/check-circle.svg'),
  'clock-arrow-down': require('../../../assets/images/feather/clock-arrow-down.svg'),
  'clock': require('../../../assets/images/feather/clock.svg'),
  'cloud-download': require('../../../assets/images/feather/cloud-download.svg'),
  'cloud-error': require('../../../assets/images/feather/cloud-off.svg'),
  'codesandbox': require('../../../assets/images/feather/codesandbox.svg'),
  'cog': require('../../../assets/images/feather/cog.svg'),
  'columns': require('../../../assets/images/feather/columns.svg'),
  'keyboard': require('../../../assets/images/feather/keyboard.svg'),
  'copy': require('../../../assets/images/feather/copy.svg'),
  'cross': require('../../../assets/images/feather/x.svg'),
  'delete': require('../../../assets/images/feather/delete.svg'),
  'dislike': require('../../../assets/images/feather/dislike.svg'),
  'download': require('../../../assets/images/feather/download.svg'),
  'edit': require('../../../assets/images/feather/edit-2.svg'),
  'exit-fullscreen': require('../../../assets/images/feather/minimize.svg'),
  'external-link': require('../../../assets/images/feather/external-link.svg'),
  'eye-close': require('../../../assets/images/feather/eye-off.svg'),
  'eye-open': require('../../../assets/images/feather/eye.svg'),
  'film': require('../../../assets/images/feather/film.svg'),
  'filter': require('../../../assets/images/feather/filter.svg'),
  'flag': require('../../../assets/images/feather/flag.svg'),
  'fullscreen': require('../../../assets/images/feather/maximize.svg'),
  'globe': require('../../../assets/images/feather/globe.svg'),
  'help': require('../../../assets/images/feather/help.svg'),
  'home': require('../../../assets/images/feather/home.svg'),
  'like': require('../../../assets/images/feather/like.svg'),
  'live': require('../../../assets/images/feather/live.svg'),
  'message-circle': require('../../../assets/images/feather/message-circle.svg'),
  'more-horizontal': require('../../../assets/images/feather/more-horizontal.svg'),
  'more-vertical': require('../../../assets/images/feather/more-vertical.svg'),
  'move-right': require('../../../assets/images/feather/move-right.svg'),
  'no': require('../../../assets/images/feather/no.svg'),
  'ownership-change': require('../../../assets/images/feather/share.svg'),
  'p2p': require('../../../assets/images/feather/airplay.svg'),
  'play': require('../../../assets/images/feather/play.svg'),
  'playlists': require('../../../assets/images/feather/playlists.svg'),
  'refresh': require('../../../assets/images/feather/refresh-cw.svg'),
  'repeat': require('../../../assets/images/feather/repeat.svg'),
  'search': require('../../../assets/images/feather/search.svg'),
  'share': require('../../../assets/images/feather/share-2.svg'),
  'shield': require('../../../assets/images/misc/shield.svg'),
  'sign-in': require('../../../assets/images/feather/log-in.svg'),
  'sign-out': require('../../../assets/images/feather/log-out.svg'),
  'stats': require('../../../assets/images/feather/stats.svg'),
  'syndication': require('../../../assets/images/feather/syndication.svg'),
  'tick': require('../../../assets/images/feather/check.svg'),
  'trending': require('../../../assets/images/feather/trending.svg'),
  'undo': require('../../../assets/images/feather/undo.svg'),
  'upload': require('../../../assets/images/feather/upload.svg'),
  'user-add': require('../../../assets/images/feather/user-plus.svg'),
  'user-x': require('../../../assets/images/feather/user-x.svg'),
  'user': require('../../../assets/images/feather/user.svg'),
  'users': require('../../../assets/images/feather/users.svg')
}

export type GlobalIconName = keyof typeof icons

@Component({
  selector: 'my-global-icon',
  template: '',
  styleUrls: [ './global-icon.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class GlobalIconComponent implements OnInit {
  @Input({ required: true }) iconName: GlobalIconName

  constructor (
    private el: ElementRef,
    private hooks: HooksService
  ) { }

  async ngOnInit () {
    const nativeElement = this.el.nativeElement as HTMLElement

    nativeElement.innerHTML = await this.hooks.wrapFun(
      this.getSVGContent.bind(this),
      { name: this.iconName },
      'common',
      'filter:internal.common.svg-icons.get-content.params',
      'filter:internal.common.svg-icons.get-content.result'
    )
    nativeElement.ariaHidden = 'true'
  }

  private getSVGContent (options: { name: GlobalIconName }) {
    return icons[options.name]
  }
}
