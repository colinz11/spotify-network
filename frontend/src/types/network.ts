export interface User {
  name: string;
  id: string;
}

export interface NetworkUser {
  user_id: string;
  username: string;
  followers: User[];
  following: User[];
  follower_count: number;
  following_count: number;
}

export interface NetworkData {
  users: NetworkUser[];
}

export interface GraphNode {
  id: string;
  username?: string;
  follower_count?: number;
  following_count?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'follower' | 'following' | 'mutual';
  value?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
} 