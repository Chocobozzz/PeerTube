import { User } from '@app/core'
import { splitIntoArray, toBoolean } from '@app/helpers'
import { getAllPrivacies } from '@peertube/peertube-core-utils'
import {
  BooleanBothQuery,
  NSFWFlag,
  NSFWPolicyType,
  VideoInclude,
  VideoIncludeType,
  VideoPrivacyType,
  VideosCommonQuery,
  VideoSortField
} from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import debug from 'debug'

const debugLogger = debug('peertube:videos:VideoFilters')

type VideoFiltersKeys = {
  [id in keyof AttributesOnly<VideoFilters>]: any
}

export type VideoFilterScope = 'local' | 'federated'

export type VideoFilterActive = {
  key: string
  canRemove: boolean
  label: string
  value?: string
  rawValue?: string[] | number[]
}

export class VideoFilters {
  sort: VideoSortField

  languageOneOf: string[]
  categoryOneOf: number[]

  scope: VideoFilterScope
  allVideos: boolean

  live: BooleanBothQuery

  search: string

  private nsfwPolicy: NSFWPolicyType
  private nsfwFlagsDisplayed: number
  private nsfwFlagsHidden: number
  private nsfwFlagsWarned: number
  private nsfwFlagsBlurred: number

  private defaultValues = new Map<keyof VideoFilters, any>([
    [ 'sort', undefined ],
    [ 'languageOneOf', undefined ],
    [ 'categoryOneOf', undefined ],
    [ 'scope', undefined ],
    [ 'allVideos', false ],
    [ 'live', 'both' ],
    [ 'search', '' ]
  ])

  private activeFilters: VideoFilterActive[] = []

  private onChangeCallbacks: (() => void)[] = []
  private oldFormObjectString: string

  private customizedByUser = false

  private readonly hiddenFields: string[] = []

  constructor (defaultSort: string, defaultScope: VideoFilterScope, hiddenFields: string[] = []) {
    this.setDefaultSort(defaultSort)
    this.setDefaultScope(defaultScope)

    this.hiddenFields = hiddenFields

    this.reset({ triggerChange: false })
  }

  // ---------------------------------------------------------------------------

  onChange (cb: () => void) {
    this.onChangeCallbacks.push(cb)
  }

  private triggerChange () {
    if (this.onChangeCallbacks.length === 0) return

    // Don't run on change if the values did not change
    const currentFormObjectString = JSON.stringify(this.toFormObject())

    const noChanges = !!this.oldFormObjectString && currentFormObjectString === this.oldFormObjectString

    debugLogger('Checking if we need to trigger change', { changes: !noChanges })

    if (noChanges) return

    this.oldFormObjectString = currentFormObjectString

    for (const cb of this.onChangeCallbacks) {
      cb()
    }
  }

  // ---------------------------------------------------------------------------

  setDefaultScope (scope: VideoFilterScope) {
    this.defaultValues.set('scope', scope)
  }

  setDefaultSort (sort: string) {
    this.defaultValues.set('sort', sort)
  }

  setDefaultLanguages (languages: string[]) {
    this.defaultValues.set('languageOneOf', languages)
  }

  setNSFWPolicy (user: Pick<User, 'nsfwPolicy' | 'nsfwFlagsDisplayed' | 'nsfwFlagsHidden' | 'nsfwFlagsWarned' | 'nsfwFlagsBlurred'>) {
    this.nsfwPolicy = user.nsfwPolicy
    this.nsfwFlagsDisplayed = user.nsfwFlagsDisplayed
    this.nsfwFlagsHidden = user.nsfwFlagsHidden
    this.nsfwFlagsWarned = user.nsfwFlagsWarned
    this.nsfwFlagsBlurred = user.nsfwFlagsBlurred
  }

  // ---------------------------------------------------------------------------

  private reset (options: {
    specificKey?: string
    triggerChange?: boolean // default true
  }) {
    const { specificKey, triggerChange = true } = options

    debugLogger('Reset video filters', { specificKey })

    for (const [ key, value ] of this.defaultValues) {
      if (specificKey && specificKey !== key) continue
      ;(this as any)[key] = value
    }

    this.buildActiveFilters()

    if (triggerChange) {
      this.triggerChange()
    }
  }

  // ---------------------------------------------------------------------------

  load (obj: Partial<AttributesOnly<VideoFilters>>, customizedByUser?: boolean) {
    debugLogger('Loading object in video filters', { obj, customizedByUser })

    this.reset({ triggerChange: false })

    if (customizedByUser) this.customizedByUser = customizedByUser

    if (obj.sort !== undefined) this.sort = obj.sort

    if (obj.languageOneOf !== undefined) this.languageOneOf = splitIntoArray(obj.languageOneOf)
    if (obj.categoryOneOf !== undefined) this.categoryOneOf = splitIntoArray(obj.categoryOneOf)

    if (obj.scope !== undefined) this.scope = obj.scope
    if (obj.allVideos !== undefined) this.allVideos = toBoolean(obj.allVideos)

    if (obj.live !== undefined) this.live = obj.live

    if (obj.search !== undefined) this.search = obj.search

    this.buildActiveFilters()
    this.triggerChange()
  }

  clone () {
    debugLogger('Cloning video filters', { videoFilters: this })

    const cloned = new VideoFilters(this.defaultValues.get('sort'), this.defaultValues.get('scope'), this.hiddenFields)

    cloned.setNSFWPolicy({
      nsfwPolicy: this.nsfwPolicy,
      nsfwFlagsDisplayed: this.nsfwFlagsDisplayed,
      nsfwFlagsHidden: this.nsfwFlagsHidden,
      nsfwFlagsWarned: this.nsfwFlagsWarned,
      nsfwFlagsBlurred: this.nsfwFlagsBlurred
    })

    cloned.load(this.toUrlObject(), this.customizedByUser)

    return cloned
  }

  // ---------------------------------------------------------------------------

  hasBeenCustomizedByUser () {
    return this.customizedByUser
  }

  // ---------------------------------------------------------------------------

  private buildActiveFilters () {
    this.activeFilters = []

    this.activeFilters.push({
      key: 'nsfw',
      canRemove: false,
      label: $localize`Sensitive content`,
      value: this.getNSFWValue()
    })

    this.activeFilters.push({
      key: 'scope',
      canRemove: false,
      label: $localize`Scope`,
      value: this.scope === 'federated'
        ? $localize`All platforms`
        : $localize`This platform`
    })

    if (this.languageOneOf && this.languageOneOf.length !== 0) {
      this.activeFilters.push({
        key: 'languageOneOf',
        canRemove: true,
        label: $localize`Languages`,
        value: this.languageOneOf.map(l => l.toUpperCase()).join(', '),
        rawValue: this.languageOneOf
      })
    }

    if (this.categoryOneOf && this.categoryOneOf.length !== 0) {
      this.activeFilters.push({
        key: 'categoryOneOf',
        canRemove: true,
        label: $localize`Categories`,
        value: this.categoryOneOf.join(', '),
        rawValue: this.categoryOneOf
      })
    }

    if (this.allVideos) {
      this.activeFilters.push({
        key: 'allVideos',
        canRemove: true,
        label: $localize`All videos`
      })
    }

    if (this.live === 'true') {
      this.activeFilters.push({
        key: 'live',
        canRemove: true,
        label: $localize`Only lives`
      })
    } else if (this.live === 'false') {
      this.activeFilters.push({
        key: 'live',
        canRemove: true,
        label: $localize`Only VOD`
      })
    }

    this.activeFilters = this.activeFilters
      .filter(a => this.hiddenFields.includes(a.key) === false)
  }

  getActiveFilters () {
    return this.activeFilters
  }

  // ---------------------------------------------------------------------------

  toFormObject (): VideoFiltersKeys {
    const result: Partial<VideoFiltersKeys> = {}

    for (const [ key ] of this.defaultValues) {
      result[key] = this[key]
    }

    return result as VideoFiltersKeys
  }

  toUrlObject () {
    const result: { [id: string]: any } = {}

    for (const [ key, defaultValue ] of this.defaultValues) {
      if (this[key] !== defaultValue) {
        result[key] = this[key]
      }
    }

    return result
  }

  toVideosAPIObject () {
    let isLocal: boolean
    let include: VideoIncludeType
    let privacyOneOf: VideoPrivacyType[]

    if (this.scope === 'local') {
      isLocal = true
    }

    if (this.allVideos) {
      include = VideoInclude.NOT_PUBLISHED_STATE
      privacyOneOf = getAllPrivacies()
    }

    let isLive: boolean
    if (this.live === 'true') isLive = true
    else if (this.live === 'false') isLive = false

    return {
      ...this.buildNSFWVideosAPIObject(),

      sort: this.sort,
      languageOneOf: this.languageOneOf,
      categoryOneOf: this.categoryOneOf,
      search: this.search,
      isLocal,
      include,
      privacyOneOf,
      isLive
    }
  }

  private buildNSFWVideosAPIObject (): Partial<Pick<VideosCommonQuery, 'nsfw' | 'nsfwFlagsExcluded' | 'nsfwFlagsIncluded'>> {
    if (this.allVideos) {
      return { nsfw: 'both', nsfwFlagsExcluded: NSFWFlag.NONE }
    }

    const nsfw: BooleanBothQuery = this.nsfwPolicy === 'do_not_list'
      ? 'false'
      : 'both'

    let nsfwFlagsIncluded = NSFWFlag.NONE
    let nsfwFlagsExcluded = NSFWFlag.NONE

    if (this.nsfwPolicy === 'do_not_list') {
      nsfwFlagsIncluded |= this.nsfwFlagsDisplayed
      nsfwFlagsIncluded |= this.nsfwFlagsWarned
      nsfwFlagsIncluded |= this.nsfwFlagsBlurred
    } else {
      nsfwFlagsExcluded |= this.nsfwFlagsHidden
    }

    return { nsfw, nsfwFlagsIncluded, nsfwFlagsExcluded }
  }

  // ---------------------------------------------------------------------------

  getNSFWSettingsLabel () {
    let result = this.getGlobalNSFWLabel()

    if (this.hasCustomNSFWFlags()) {
      result += $localize` Some videos with a specific sensitive content category have a different policy.`
    }

    return result
  }

  private getGlobalNSFWLabel () {
    if (this.nsfwPolicy === 'do_not_list') return $localize`Sensitive content hidden.`
    if (this.nsfwPolicy === 'warn') return $localize`Sensitive content has a warning.`
    if (this.nsfwPolicy === 'blur') return $localize`Sensitive content has a warning and the thumbnail is blurred.`

    return $localize`Sensitive content is displayed.`
  }

  private getNSFWValue () {
    if (this.hasCustomNSFWFlags()) {
      if (this.nsfwPolicy === 'do_not_list') return $localize`hidden (with exceptions)`
      if (this.nsfwPolicy === 'warn') return $localize`warned (with exceptions)`
      if (this.nsfwPolicy === 'blur') return $localize`blurred (with exceptions)`

      return $localize`displayed (with exceptions)`
    }

    if (this.nsfwPolicy === 'do_not_list') return $localize`hidden`
    if (this.nsfwPolicy === 'warn') return $localize`warned`
    if (this.nsfwPolicy === 'blur') return $localize`blurred`

    return $localize`displayed`
  }

  private hasCustomNSFWFlags () {
    return this.nsfwFlagsDisplayed || this.nsfwFlagsHidden || this.nsfwFlagsWarned || this.nsfwFlagsBlurred
  }
}
