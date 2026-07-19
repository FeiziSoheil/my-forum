import { models, Schema, model } from "mongoose";

export const BookmarkSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    post: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

BookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
BookmarkSchema.index({ user: 1, _id: -1 });

export const BookmarkModel = models.Bookmark || model('Bookmark', BookmarkSchema);
