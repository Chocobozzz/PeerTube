import { Injectable } from '@angular/core'

@Injectable()
export class PeerTubeBadgeService {
  // First string is badge column type
  // Inner Map is value -> badge name
  private valueToBadge = new Map<string, Map<string, string>>()
  private badgesUsed = new Set<string>()

  getRandomBadge (type: string, value: string): string {
    if (!this.valueToBadge.has(type)) {
      this.valueToBadge.set(type, new Map())
    }

    const badges = this.valueToBadge.get(type)
    const badge = badges.get(value)
    if (badge) return badge

    const toTry = [
      'badge-yellow',
      'badge-purple',
      'badge-blue',
      'badge-brown',
      'badge-green',
      'badge-secondary'
    ]

    for (const badge of toTry) {
      if (!this.badgesUsed.has(badge)) {
        this.badgesUsed.add(badge)
        badges.set(value, badge)
        return badge
      }
    }

    // Reset, we used all available badges
    this.badgesUsed.clear()

    return this.getRandomBadge(type, value)
  }
}
