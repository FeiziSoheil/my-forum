import { Mongoose } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

interface GlobalMongoose {
  mongoose?: Mongoose;
}

declare global {
  var mongoose: GlobalMongoose;
}

let cached = global.mongoose;

if (!cached) cached = global.mongoose = {};

export async function dbConnect() {
  if (cached.mongoose) return cached.mongoose;
  const mongoose = new Mongoose();
  await mongoose.connect(MONGODB_URI);
  cached.mongoose = mongoose;
  return mongoose;
}