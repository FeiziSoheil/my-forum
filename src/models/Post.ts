import { Post } from "@/types/post";
import { models, Schema, model } from "mongoose";

export const PostSchema = new Schema({
    content: {
        type: String,
        default: '',
        maxlength: [500, 'Content cannot be more than 500 characters'],
        trim: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Media
    media: [{
        type: {
            type: String,
            enum: ['image', 'video', 'gif', 'file'],
            required: true
        },
        url: {
            type: String,
            required: true
        },
        alt: String,
        size: Number,
        uploadedAt: { type: Date, default: Date.now }
    }],

    // Poll (optional; embedded votes for single-choice)
    poll: {
        options: [{
            id: { type: String, required: true },
            text: { type: String, required: true, maxlength: 25 },
            votesCount: { type: Number, default: 0 },
        }],
        endsAt: Date,
        votesCount: { type: Number, default: 0 },
        votes: [{
            user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            optionId: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
        }],
    },
    
    // Interactions (denormalized counts)
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    repostsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    
    // Interactions (detailed data)
    likes: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
    reposts: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
    
    // Advanced features
    tags: [String],
    mentions: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        position: Number
    }],
    
    // Status
    isDeleted: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    pinnedAt: Date,
    editedAt: Date,
    
    // Visibility
    visibility: {
        type: String,
        enum: ['public', 'followers', 'private'],
        default: 'public'
    }
}, {
    timestamps: true
});

PostSchema.index({ tags: 1 });
// Phase 3: feed / following / affinity / trending compound indexes
PostSchema.index({ isDeleted: 1, createdAt: -1 });
PostSchema.index({ isDeleted: 1, author: 1, createdAt: -1 });
PostSchema.index({ isDeleted: 1, tags: 1, createdAt: -1 });
PostSchema.index({ isDeleted: 1, visibility: 1, createdAt: -1 });
PostSchema.index({
  isDeleted: 1,
  createdAt: -1,
  likesCount: -1,
  repliesCount: -1,
  viewsCount: -1,
});
PostSchema.index({ content: "text" }, { name: "post_content_text", default_language: "none" });

export const PostModel =  models.Post || model<Post>('Post', PostSchema);
