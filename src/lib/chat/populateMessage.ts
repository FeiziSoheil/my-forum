import type { PopulateOptions } from "mongoose";

/** Shared populate chains for chat messages */
export const MESSAGE_POPULATE: PopulateOptions[] = [
  { path: "sender", select: "username fullname avatar" },
  {
    path: "replyTo",
    select: "content type media sender sharedPost storySnapshot isDeleted",
    populate: [
      { path: "sender", select: "username fullname avatar" },
      {
        path: "sharedPost",
        select: "content media author createdAt",
        populate: { path: "author", select: "username fullname avatar" },
      },
    ],
  },
  {
    path: "sharedPost",
    select: "content media author createdAt isDeleted",
    populate: { path: "author", select: "username fullname avatar" },
  },
  { path: "reactions.user", select: "username fullname avatar" },
];
