import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { saveFile } from "@/lib/fileHandler";
import { resolveMentionsFromContent } from "@/lib/mentions/resolveMentions";
import { createNotification } from "@/lib/notifications/createNotification";
import { getRankedForYouPosts } from "@/lib/recommendations/rankPosts";
import { visibilityClause } from "@/lib/recommendations/visibility";
import { extractHashtags } from "@/lib/tags/extractHashtags";
import { PostModel } from "@/models/Post";
import { BookmarkModel } from "@/models/Bookmark";
import { UserModel } from "@/models/User";
import { MediaItem } from "@/types/post";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getOptionalUserId, isLikedBy, isRepostedBy, LikeRef, RepostRef } from "@/lib/auth/session";
import { getFollowingIds } from "@/lib/follow/edges";
import {
  contentRegexClause,
  contentSearchClause,
} from "@/lib/search/contentQuery";
import { parsePollFormValue } from "@/lib/poll/parsePoll";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
import type { PostPoll } from "@/types/post";

const VISIBILITY_VALUES = ['public', 'followers', 'private'] as const;
type Visibility = typeof VISIBILITY_VALUES[number];

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        const cookieStore = cookies();
        const atk = (await cookieStore).get('atk')?.value
        if (!atk) {
            return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
        }

        const payload = await verifyAccessToken(atk)
        const userId = payload.uid as string

        const formData = await req.formData();
        const contentRaw = formData.get('content');
        const content = typeof contentRaw === 'string' ? contentRaw : '';
        const mediaFiles = formData.getAll('media') as File[];
        const visibilityInput = (formData.get('visibility') as string) || 'public';
        const visibility: Visibility = (VISIBILITY_VALUES as readonly string[]).includes(visibilityInput)
            ? (visibilityInput as Visibility)
            : 'public';

        const pollRaw = formData.get('poll');
        let poll: Omit<PostPoll, "votes"> | undefined;

        if (pollRaw != null && pollRaw !== '') {
            const parsed = parsePollFormValue(pollRaw);
            if (!parsed.ok) {
                return NextResponse.json({ error: parsed.error }, { status: 400 });
            }
            poll = parsed.poll;
        }

        const trimmed = content.trim();
        if (!poll && trimmed.length === 0) {
            return NextResponse.json(
                { error: 'Content is required when there is no poll.' },
                { status: 400 }
            );
        }
        if (content.length > 500) {
            return NextResponse.json({ error: 'Content cannot be more than 500 characters.' }, { status: 400 });
        }

        // Poll posts are text (+ optional caption); media is not combined in phase 1.
        const media: MediaItem[] = []
        if (!poll) {
            for (const file of mediaFiles) {
                if (file && file.size > 0) {
                    const mediaResult = await saveFile(file);
                    if (mediaResult) {
                        media.push(mediaResult);
                    }
                }
            }
        }

        const tagsArray = extractHashtags(trimmed);
        const mentionsArray = await resolveMentionsFromContent(trimmed);

        const newPost = {
            content: trimmed,
            author: userId,
            media,
            ...(poll
                ? {
                    poll: {
                        ...poll,
                        votes: [],
                    },
                }
                : {}),
            tags: tagsArray,
            mentions: mentionsArray,
            likesCount: 0,
            repliesCount: 0,
            repostsCount: 0,
            viewsCount: 0,
            likes: [],
            reposts: [],
            isDeleted: false,
            isPinned: false,
            visibility
        }
        const post = await PostModel.create(newPost)

        await Promise.all(
            mentionsArray.map((m) =>
                createNotification({
                    recipient: m.user,
                    actor: userId,
                    type: "mention",
                    post: post._id.toString(),
                })
            )
        );

        const lean = post.toObject();
        const safePost = withPollViewerState(lean, userId);

        return NextResponse.json({ msg: 'post create successfull ', post: safePost }, { status: 201 })




    } catch (err) {
        console.error('POST /api/post error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }

}


export async function GET(req:NextRequest) {
    try{
        await dbConnect()
      
        const MAX_LIMIT = 50
        const limit = Math.min(
            parseInt(req.nextUrl.searchParams.get('limit') || '10'),
            MAX_LIMIT
        )
        const cursor = req.nextUrl.searchParams.get('cursor')
        const tag = req.nextUrl.searchParams.get('tag')?.trim().toLowerCase()
        const q = (req.nextUrl.searchParams.get('q') || '').trim()
        const feed = req.nextUrl.searchParams.get('feed')
        const userId = await getOptionalUserId(req)

        // Viewer's following list (for visibility + following feed).
        let followingIds: ObjectId[] = []
        if (userId) {
            followingIds = await getFollowingIds(userId)
        }

        // Following feed requires auth; empty follow list => empty feed.
        if (feed === 'following' && (!userId || followingIds.length === 0)) {
            return NextResponse.json({ hasMore: false, posts: [], nextCursor: null }, { status: 200 })
        }

        // Personalized For you ranking (authenticated only).
        if (feed === 'for-you' && userId) {
            const ranked = await getRankedForYouPosts({
                userId,
                limit,
                cursor,
            })

            const posts = ranked.posts
            await PostModel.populate(posts, {
                path: 'author',
                select: 'username fullname avatar',
            })

            let bookmarkedSet = new Set<string>()
            if (posts.length > 0) {
                const ids = posts.map((p) => p._id)
                const bookmarks = await BookmarkModel.find({
                    user: userId,
                    post: { $in: ids },
                })
                    .select('post')
                    .lean() as unknown as { post: ObjectId }[]
                bookmarkedSet = new Set(bookmarks.map((b) => b.post.toString()))
            }

            const postsWithLike = posts.map((post) =>
                withPollViewerState(
                    {
                        ...post,
                        isLiked: isLikedBy(post.likes as LikeRef[] | undefined, userId),
                        isReposted: isRepostedBy(post.reposts as RepostRef[] | undefined, userId),
                        isBookmarked: bookmarkedSet.has(String(post._id)),
                    },
                    userId
                )
            )

            return NextResponse.json(
                {
                    hasMore: ranked.hasMore,
                    posts: postsWithLike,
                    nextCursor: ranked.nextCursor,
                },
                { status: 200 }
            )
        }

        // Bookmarks feed requires auth.
        let bookmarkedPostIds: ObjectId[] = []
        if (feed === 'bookmarks') {
            if (!userId) {
                return NextResponse.json({ hasMore: false, posts: [], nextCursor: null }, { status: 200 })
            }
            const bms = await BookmarkModel.find({ user: userId }).select('post').lean() as unknown as { post: ObjectId }[]
            bookmarkedPostIds = bms.map((b) => b.post)
            if (bookmarkedPostIds.length === 0) {
                return NextResponse.json({ hasMore: false, posts: [], nextCursor: null }, { status: 200 })
            }
        }

        let query: Record<string, unknown> = {isDeleted:false}
        let useTextScore = false

        if (tag) {
            query.tags = tag
        }

        if (q.length > 0) {
            const search = contentSearchClause(q)
            Object.assign(query, search.filter)
            useTextScore = search.useTextScore
        }

        if (feed === 'following') {
            query.author = { $in: followingIds }
        }

        if (feed === 'bookmarks') {
            query._id = { $in: bookmarkedPostIds }
        }

        // Account-level privacy: exclude posts authored by private accounts
        // unless the viewer is the author or already follows them. Per-post
        // visibility handles followers/private posts, but a *public* post by a
        // private account must not leak into the global/following feed.
        const allowedAuthorIds = new Set<string>(followingIds.map((id) => id.toString()))
        if (userId) allowedAuthorIds.add(userId)
        const privateAuthors = await UserModel.find({ isPrivate: true })
            .select('_id')
            .lean() as unknown as { _id: ObjectId }[]
        const blockedAuthorIds = privateAuthors
            .map((u) => u._id)
            .filter((id) => !allowedAuthorIds.has(id.toString()))
        if (blockedAuthorIds.length > 0) {
            query.author = {
                ...(query.author as Record<string, unknown> | undefined),
                $nin: blockedAuthorIds,
            }
        }

        if(cursor){
            query._id = { ...(query._id as Record<string, unknown> | undefined), $lt: new ObjectId(cursor) }
        }

        // Enforce per-post visibility for the current viewer.
        query = { ...query, ...visibilityClause(userId, followingIds) }

        async function fetchPosts(filter: Record<string, unknown>, textScore: boolean) {
            const qy = PostModel.find(filter)
                .populate('author', 'username fullname avatar')
                .limit(limit + 1)
            if (textScore) {
                return qy
                    .select({ score: { $meta: 'textScore' } })
                    .sort({ score: { $meta: 'textScore' }, _id: -1 })
                    .lean()
            }
            return qy.sort({ _id: -1 }).lean()
        }

        let posts
        try {
            posts = await fetchPosts(query, useTextScore)
        } catch (err) {
            // Text index may not exist yet — fall back to regex
            if (useTextScore && q.length > 0) {
                const { $text: _drop, ...rest } = query as Record<string, unknown> & {
                    $text?: unknown
                }
                void _drop
                Object.assign(rest, contentRegexClause(q))
                query = rest
                useTextScore = false
                posts = await fetchPosts(query, false)
            } else {
                throw err
            }
        }

        const hasMore = posts.length > limit
        if(hasMore){
            posts.pop()
        }


        const nextCursor = posts.length > 0 ? posts[posts.length -1]._id : null

        let bookmarkedSet = new Set<string>()
        if (userId && posts.length > 0) {
            const ids = posts.map((p) => p._id)
            const bookmarks = await BookmarkModel.find({ user: userId, post: { $in: ids } })
                .select('post')
                .lean() as unknown as { post: ObjectId }[]
            bookmarkedSet = new Set(bookmarks.map((b) => b.post.toString()))
        }

        const postsWithLike = posts.map(post =>
            withPollViewerState(
                {
                    ...post,
                    isLiked: isLikedBy(post.likes as LikeRef[] | undefined, userId),
                    isReposted: isRepostedBy(post.reposts as RepostRef[] | undefined, userId),
                    isBookmarked: bookmarkedSet.has(String(post._id))
                },
                userId
            )
        )


        return NextResponse.json({
            hasMore,
            posts: postsWithLike,
            nextCursor : nextCursor?.toString()
        },{status:200})




    }catch(err){
        console.error('GET /api/post error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch posts' },
            { status: 500 }
        );
        
    }
}