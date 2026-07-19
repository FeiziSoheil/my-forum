import { Schema, models, model } from "mongoose";
import { Reply } from "@/types/post";

export const ReplySchema = new Schema({
    content: {
        type: String,
        required: true,
        maxLength: 500,
        trim: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Reference to original post
    parentPost: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    
    // For nested replies (Reddit-like)
    parentReply: {
        type: Schema.Types.ObjectId,
        ref: 'Reply',
        default: null
    },
    
    // Thread level: 0 = top-level, max 2 (three levels total)
    threadLevel: { 
        type: Number, 
        default: 0,
        max: 2
    },
    
    // Media (same as Post)
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
    
    // Interactions (denormalized counts only)
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    
    // Interactions (detailed data)
    likes: [{
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

export const ReplyModel = models.Reply || model<Reply>('Reply', ReplySchema);
