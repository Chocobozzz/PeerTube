export class Video {
  id: string;
  name: string;
  description: string;
  magnetUri: string;
  podUrl: string;
  isLocal: boolean;
  thumbnailPath: string;
  author: string;
  createdDate: Date;
  by: string;
  duration: string;

  private static createDurationString(duration: number): string {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const minutes_padding = minutes >= 10 ? '' : '0';
    const seconds_padding = seconds >= 10 ? '' : '0';

    return minutes_padding + minutes.toString() + ':' + seconds_padding + seconds.toString();
  }

  private static createByString(author: string, podUrl: string): string {
    let [ host, port ] = podUrl.replace(/^https?:\/\//, '').split(':');

    if (port === '80' || port === '443') {
      port = '';
    } else {
      port = ':' + port;
    }

    return author + '@' + host + port;
  }

  constructor(hash: {
    id: string,
    name: string,
    description: string,
    magnetUri: string,
    podUrl: string,
    isLocal: boolean,
    thumbnailPath: string,
    author: string,
    createdDate: string,
    duration: number;
  }) {
    this.id = hash.id;
    this.name = hash.name;
    this.description = hash.description;
    this.magnetUri = hash.magnetUri;
    this.podUrl = hash.podUrl;
    this.isLocal = hash.isLocal;
    this.thumbnailPath = hash.thumbnailPath;
    this.author  = hash.author;
    this.createdDate = new Date(hash.createdDate);
    this.duration = Video.createDurationString(hash.duration);
    this.by = Video.createByString(hash.author, hash.podUrl);
  }

  isRemovableBy(user): boolean {
    return this.isLocal === true && user && this.author === user.username;
  }
}
