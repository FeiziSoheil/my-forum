
export interface User {
    _id?: string;
    username: string;
    fullname: string,
    email: string;
    password: string;
    verified: boolean;
    bio?: string;
    avatar?: string;
    banner?: string;
    location?: string;
    isPrivate?: boolean;
    isDeleted?: boolean;
    lastSeenAt?: Date | string | null;
    followersCount?: number;
    followingCount?: number;
    isFollowing?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface PublicProfile {
    _id: string;
    username: string;
    fullname: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    location?: string;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
    /** True when the viewer has a pending follow request to a private account. */
    isRequested: boolean;
    isPrivate: boolean;
    // Whether the current viewer is allowed to see this profile's details/posts.
    // For a private account this is only true for the owner or existing followers.
    // A pending request alone does NOT grant canView.
    canView: boolean;
    createdAt?: string | Date;
}

export interface FollowListUser {
    _id: string;
    username: string;
    fullname: string;
    avatar?: string;
    isFollowing: boolean;
}

export type SuggestionReason = "mutuals" | "shared_interests" | "popular";

export interface SuggestedUser {
    _id: string;
    username: string;
    fullname: string;
    avatar?: string;
    mutualCount?: number;
    reason: SuggestionReason;
    isFollowing: boolean;
    isRequested: boolean;
}

export interface FollowListPage {
    users: FollowListUser[];
    hasMore: boolean;
    nextCursor?: string;
    locked?: boolean;
}

export interface RegisterRequest {
    username: string;
    fullname: string
    email: string;
    password: string;
    confirmPassword: string;
}

export interface loginRequest{
    loginId:string
    password:string
    remember?:boolean
}