/**
 * NodeInfo schema version 2.0.
 */
export interface HttpNodeinfoDiasporaSoftwareNsSchema20 {
  /**
   * The schema version, must be 2.0.
   */
  version: '2.0'
  /**
   * Metadata about server software in use.
   */
  software: {
    /**
     * The canonical name of this server software.
     */
    name: string
    /**
     * The version of this server software.
     */
    version: string
  }
  /**
   * The protocols supported on this server.
   */
  protocols: (
    | 'activitypub'
    | 'buddycloud'
    | 'dfrn'
    | 'diaspora'
    | 'libertree'
    | 'ostatus'
    | 'pumpio'
    | 'tent'
    | 'xmpp'
    | 'zot')[]
  /**
   * The third party sites this server can connect to via their application API.
   */
  services: {
    /**
     * The third party sites this server can retrieve messages from for combined display with regular traffic.
     */
    inbound: ('atom1.0' | 'gnusocial' | 'imap' | 'pnut' | 'pop3' | 'pumpio' | 'rss2.0' | 'twitter')[]
    /**
     * The third party sites this server can publish messages to on the behalf of a user.
     */
    outbound: (
      | 'atom1.0'
      | 'blogger'
      | 'buddycloud'
      | 'diaspora'
      | 'dreamwidth'
      | 'drupal'
      | 'facebook'
      | 'friendica'
      | 'gnusocial'
      | 'google'
      | 'insanejournal'
      | 'libertree'
      | 'linkedin'
      | 'livejournal'
      | 'mediagoblin'
      | 'myspace'
      | 'pinterest'
      | 'pnut'
      | 'posterous'
      | 'pumpio'
      | 'redmatrix'
      | 'rss2.0'
      | 'smtp'
      | 'tent'
      | 'tumblr'
      | 'twitter'
      | 'wordpress'
      | 'xmpp')[]
  }
  /**
   * Whether this server allows open self-registration.
   */
  openRegistrations: boolean
  /**
   * Usage statistics for this server.
   */
  usage: {
    /**
     * statistics about the users of this server.
     */
    users: {
      /**
       * The total amount of on this server registered users.
       */
      total?: number
      /**
       * The amount of users that signed in at least once in the last 180 days.
       */
      activeHalfyear?: number
      /**
       * The amount of users that signed in at least once in the last 30 days.
       */
      activeMonth?: number
    }
    /**
     * The amount of posts that were made by users that are registered on this server.
     */
    localPosts?: number
    /**
     * The amount of comments that were made by users that are registered on this server.
     */
    localComments?: number
  }
  /**
   * Free form key value pairs for software specific values. Clients should not rely on any specific key present.
   */
  metadata: {
    [k: string]: any
  }
}
