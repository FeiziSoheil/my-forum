import { User } from "@/types/user";
import { Schema, models, model, Document, type Model } from "mongoose";



const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3
    },
    fullname: {
        type: String,
        required: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        minlength: 3
    },
    password: {
        type: String,
        required: true,
        minlength: 3
    },
    verified: {
        type: Boolean,
        default: false
    },
    avatar: {
        type: String,
        default: ''
    },
    banner: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: '',
        maxlength: 160
    },
    location: {
        type: String,
        default: '',
        maxlength: 100
    },

    // Account-level privacy. When true, only the owner and existing
    // followers can view the profile details/posts.
    isPrivate: {
        type: Boolean,
        default: false
    },

    // Soft-delete flags. A deleted account can no longer authenticate,
    // but its documents are preserved for referential integrity.
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },

    // Password reset flow (token-based). We store only the SHA-256 hash of
    // the reset token so the raw token is never persisted.
    resetPasswordToken: {
        type: String,
        default: null,
        select: false
    },
    resetPasswordExpires: {
        type: Date,
        default: null,
        select: false
    },

    // Presence: updated by client heartbeat while on /messages.
    // Online = lastSeenAt within PRESENCE_ONLINE_MS (see lib/presence/constants).
    lastSeenAt: {
        type: Date,
        default: null,
        index: true,
    },

    // Follow relationship (denormalized counts)
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

    // Follow relationship (detailed data)
    followers: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
    following: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],


}, { timestamps: true })

// Next.js HMR keeps the first compiled model. Re-add any new paths so
// updates like `banner` are not stripped under mongoose strict mode.
export const UserModel: Model<User & Document> =
    (models.User as Model<User & Document>) ||
    model<User & Document>("User", userSchema)

if (!UserModel.schema.path("banner")) {
    UserModel.schema.add({
        banner: { type: String, default: "" },
    })
}
