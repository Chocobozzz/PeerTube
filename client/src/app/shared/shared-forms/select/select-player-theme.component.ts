import { Component, forwardRef, inject, input, OnInit } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ServerService } from '@app/core'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'
import { PlayerChannelSettings, PlayerTheme, PlayerVideoSettings, VideoChannel } from '@peertube/peertube-models'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectOptionsComponent } from './select-options.component'

@Component({
  selector: 'my-select-player-theme',
  template: `
  <my-select-options
    [inputId]="inputId()"

    [items]="themes"

    [(ngModel)]="selectedId"
    (ngModelChange)="onModelChange()"
    filter="false"
  ></my-select-options>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectPlayerThemeComponent),
      multi: true
    }
  ],
  imports: [ FormsModule, SelectOptionsComponent ]
})
export class SelectPlayerThemeComponent implements ControlValueAccessor, OnInit {
  private serverService = inject(ServerService)
  private playerSettingsService = inject(PlayerSettingsService)

  readonly inputId = input.required<string>()
  readonly mode = input.required<'instance' | 'video' | 'channel'>()

  readonly channel = input<Pick<VideoChannel, 'name' | 'displayName'>>()

  themes: SelectOptionsItem<PlayerVideoSettings['theme']>[]
  selectedId: PlayerTheme

  ngOnInit () {
    if (this.mode() === 'video' && !this.channel()) {
      throw new Error('Channel must be specified in video mode')
    }

    this.buildOptions()
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (id: PlayerTheme) {
    this.selectedId = id
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedId)
  }

  private buildOptions () {
    const config = this.serverService.getHTMLConfig()
    const instanceName = config.instance.name
    const instancePlayerTheme = this.getLabelOf(config.defaults.player.theme)

    this.themes = []

    if (this.mode() === 'channel' || this.mode() === 'video') {
      this.themes.push(
        { id: 'instance-default', label: $localize`${instanceName} setting (${instancePlayerTheme})` }
      )
    }

    if (this.mode() === 'video') {
      this.themes.push(
        { id: 'channel-default', label: $localize`${this.channel().displayName} setting` }
      )

      this.scheduleChannelUpdate()
    }

    this.themes = this.themes.concat(this.getPlayerThemes())
  }

  private scheduleChannelUpdate () {
    this.playerSettingsService.getChannelSettings({ channelHandle: this.channel().name, raw: true }).subscribe({
      next: settings => {
        this.themes.find(t => t.id === 'channel-default').label = this.buildChannelLabel(settings)
      }
    })
  }

  private buildChannelLabel (channelRawPlayerSettings: PlayerChannelSettings) {
    const config = this.serverService.getHTMLConfig()
    const instanceName = config.instance.name
    const instancePlayerTheme = this.getLabelOf(config.defaults.player.theme)

    const channelRawTheme = channelRawPlayerSettings.theme

    const channelPlayerTheme = channelRawTheme === 'instance-default'
      ? $localize`from ${instanceName} setting\: ${instancePlayerTheme}`
      : this.getLabelOf(channelRawTheme)

    return $localize`${this.channel().displayName} channel setting (${channelPlayerTheme})`
  }

  private getLabelOf (playerTheme: PlayerTheme) {
    return this.getPlayerThemes().find(t => t.id === playerTheme)?.label
  }

  private getPlayerThemes (): SelectOptionsItem<PlayerVideoSettings['theme']>[] {
    return [
      { id: 'galaxy', label: $localize`Galaxy`, description: $localize`Original theme` },
      { id: 'lucide', label: $localize`Lucide`, description: $localize`A clean and modern theme` }
    ]
  }
}
