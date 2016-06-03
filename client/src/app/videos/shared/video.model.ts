export class Video {
  author: string;
  by: string;
  createdDate: Date;
  description: string;
  duration: string;
  id: string;
  isLocal: boolean;
  magnetUri: string;
  name: string;
  podUrl: string;
  thumbnailPath: string;

  private static createByString(author: string, podUrl: string) {
    let [ host, port ] = podUrl.replace(/^https?:\/\//, '').split(':');

    if (port === '80' || port === '443') {
      port = '';
    } else {
      port = ':' + port;
    }

    return author + '@' + host + port;
  }

  private static createDurationString(duration: number) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const minutes_padding = minutes >= 10 ? '' : '0';
    const seconds_padding = seconds >= 10 ? '' : '0';

    return minutes_padding + minutes.toString() + ':' + seconds_padding + seconds.toString();
  }

  constructor(hash: {
    author: string,
    createdDate: string,
    description: string,
    duration: number;
    id: string,
    isLocal: boolean,
    magnetUri: string,
    name: string,
    podUrl: string,
    thumbnailPath: string
  }) {
    this.author  = hash.author;
    this.createdDate = new Date(hash.createdDate);
    this.description = hash.description;
    this.duration = Video.createDurationString(hash.duration);
    this.id = hash.id;
    this.isLocal = hash.isLocal;
    this.magnetUri = hash.magnetUri;
    this.name = hash.name;
    this.podUrl = hash.podUrl;
    this.thumbnailPath = hash.thumbnailPath;

    this.by = Video.createByString(hash.author, hash.podUrl);
  }

  isRemovableBy(user) {
    return this.isLocal === true && user && this.author === user.username;
  }
}
