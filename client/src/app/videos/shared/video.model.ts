export class Video {
  author: string;
  by: string;
  createdAt: Date;
  description: string;
  duration: string;
  id: string;
  isLocal: boolean;
  magnetUri: string;
  name: string;
  podHost: string;
  tags: string[];
  thumbnailPath: string;
  views: number;

  private static createByString(author: string, podHost: string) {
    return author + '@' + podHost;
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
    createdAt: string,
    description: string,
    duration: number;
    id: string,
    isLocal: boolean,
    magnetUri: string,
    name: string,
    podHost: string,
    tags: string[],
    thumbnailPath: string,
    views: number
  }) {
    this.author  = hash.author;
    this.createdAt = new Date(hash.createdAt);
    this.description = hash.description;
    this.duration = Video.createDurationString(hash.duration);
    this.id = hash.id;
    this.isLocal = hash.isLocal;
    this.magnetUri = hash.magnetUri;
    this.name = hash.name;
    this.podHost = hash.podHost;
    this.tags = hash.tags;
    this.thumbnailPath = hash.thumbnailPath;
    this.views = hash.views;

    this.by = Video.createByString(hash.author, hash.podHost);
  }

  isRemovableBy(user) {
    return this.isLocal === true && user && this.author === user.username;
  }
}
