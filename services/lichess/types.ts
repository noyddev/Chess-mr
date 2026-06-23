export interface LichessUser {
  id: string;
  username: string;
  perfs: {
    [key: string]: {
      games: number;
      rating: number;
      rd: number;
      prog: number;
    };
  };
  createdAt: number;
  seenAt: number;
  variant: {
    default: boolean;
  };
  features?: {
    broadcast?: boolean;
    challenge?: boolean;
    clockBot?: boolean;
    engine?: boolean;
    follow?: boolean;
    learn?: boolean;
    study?: boolean;
  };
  title?: string;
  country?: string;
  location?: string;
  bio?: string;
  firstName?: string;
  lastName?: string;
  links?: string;
  follows?: {
    following: string[];
    followers: string[];
  };
}

export interface LichessUserStatus {
  id: string;
  name: string;
  online: boolean;
  playing: boolean;
  streaming: boolean;
  instant?: boolean;
  engine?: boolean;
  booster?: boolean;
 封闭?: boolean;
  follow?: boolean;
}

export interface LichessPerformanceStats {
  [key: string]: {
    games: number;
    win: number;
    loss: number;
    draw: number;
    tb?: number;
    p: number;
    d: number;
    w: number;
    l: number;
    r: number;
    rp?: number;
    avgOp?: number;
    avgD?: number;
    high?: number;
    provisionable?: number;
  };
}
