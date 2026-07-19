export interface PostPollOption {
  id: string;
  text: string;
  votesCount: number;
}

export interface PostPollVote {
  user: string;
  optionId: string;
  createdAt: Date;
}

export interface PostPoll {
  options: PostPollOption[];
  endsAt: Date | string;
  votesCount: number;
  /** Stored in DB only — stripped from API responses */
  votes?: PostPollVote[];
}

export interface Post {
  _id: string;
  content: string;
  author: {
    _id: string;
    fullname?: string;
    username: string;
    avatar?: string;
  };
  
  // Media
  media?: MediaItem[];

  /** Present when the post is a poll (or includes one) */
  poll?: PostPoll | null;
  
  // Interaction counts (denormalized)
  likesCount: number;
  repliesCount: number;
  repostsCount: number;
  viewsCount: number;
  
  // Detailed interaction data
  likes?: Like[];
  reposts?: Repost[];
  
  // Advanced features
  tags?: string[];
  mentions?: Mention[];
  
  // Status
  isDeleted: boolean;
  isPinned: boolean;
  pinnedAt?: Date;
  editedAt?: Date;
  
  // Visibility
  visibility: 'public' | 'followers' | 'private';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // UI state (not stored in DB)
  isLiked?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
  /** Viewer's selected poll option id (API-attached, votes array stripped) */
  myVoteOptionId?: string | null;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif' | 'file';
  url: string;
  alt?: string;
  size?: number;
  uploadedAt: Date;
}

export interface Like {
  user: string; // User ObjectId
  createdAt: Date;
}

export interface Repost {
  user: string; // User ObjectId
  createdAt: Date;
}

export interface Mention {
  user: string; // User ObjectId
  position: number;
}


export interface postRequest{
    id?:string,
    content:string,
    media?:string,
    mention?:string
}

export interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onMore?: (postId: string) => void;
  onDeleted?: (postId: string) => void;
  /** Show Follow next to author (e.g. post detail page) */
  showFollowButton?: boolean;
}

export interface Reply {
  _id: string;
  content: string;
  author: {
    _id: string;
    name?: string;
    fullname?: string;
    username: string;
    avatar?: string;
  };
  
  // Reference to original post
  parentPost: string; // Post ObjectId
  
  // For nested replies (flat list + indent). May be id or populated.
  parentReply?: string | {
    _id: string;
    content?: string;
    author: {
      _id: string;
      username: string;
      fullname?: string;
      avatar?: string;
    };
  };
  
  // Thread level: 0 = top-level, max 2
  threadLevel: number;
  
  // Media
  media?: MediaItem[];
  
  // Interaction counts (denormalized)
  likesCount: number;
  repliesCount: number;
  
  // Detailed interaction data
  likes?: Like[];
  
  // Advanced features
  tags?: string[];
  mentions?: Mention[];
  
  // Status
  isDeleted: boolean;
  editedAt?: Date;
  
  // Visibility
  visibility: 'public' | 'followers' | 'private';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // UI state (not stored in DB)
  isLiked?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
}

export interface ReplyCardProps {
  reply: Reply;
  onLike?: (replyId: string) => void;
  onReply?: (reply: Reply) => void;
  onRepost?: (replyId: string) => void;
  onShare?: (replyId: string) => void;
  onMore?: (replyId: string) => void;
  /** Hide nested reply action when at max depth */
  canNestReply?: boolean;
  /** Show Follow next to author (e.g. post detail page) */
  showFollowButton?: boolean;
}
