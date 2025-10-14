import { User } from "@/types/user";
import { Schema, models, model, Document } from "mongoose";



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
 

}, { timestamps: true })


export const UserModel = models.User || model<User & Document>("User", userSchema)