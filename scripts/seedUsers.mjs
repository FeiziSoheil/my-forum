import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/seedUsers.mjs");
    process.exit(1);
}

// ----- config -----
const TOTAL_USERS = 200;
const DEFAULT_PASSWORD = "Password123";
const SALT_ROUNDS = 12;

// ----- schema (kept in sync with src/models/User.ts) -----
const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, minlength: 3 },
        fullname: { type: String, required: true, minlength: 3 },
        email: { type: String, required: true, unique: true, minlength: 3 },
        password: { type: String, required: true, minlength: 3 },
        verified: { type: Boolean, default: false },
        avatar: { type: String, default: "" },
        bio: { type: String, default: "", maxlength: 160 },
    },
    { timestamps: true }
);

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// ----- random data pools -----
const firstNames = [
    "Ali", "Reza", "Sara", "Nima", "Mona", "Kian", "Yasin", "Leila", "Amir", "Hana",
    "Sina", "Parisa", "Kaveh", "Nazanin", "Behzad", "Shirin", "Omid", "Golnaz", "Farhad", "Maryam",
    "Arash", "Elham", "Babak", "Roya", "Kamran", "Sepideh", "Milad", "Tara", "Pouya", "Niloofar",
    "Hossein", "Mahsa", "Vahid", "Setareh", "Saeed", "Bahar", "Navid", "Donya", "Peyman", "Anahita",
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Lucas", "Mia", "Mason",
];

const lastNames = [
    "Mohammadi", "Hosseini", "Ahmadi", "Karimi", "Rezaei", "Moradi", "Jafari", "Kazemi", "Rahimi", "Sadeghi",
    "Ghorbani", "Bagheri", "Abbasi", "Yousefi", "Norouzi", "Salehi", "Ebrahimi", "Akbari", "Rostami", "Zare",
    "Smith", "Johnson", "Brown", "Davis", "Wilson", "Taylor", "Anderson", "Thomas", "Martin", "Clark",
];

const bios = [
    "Coffee lover and code enthusiast.",
    "Just here to share ideas.",
    "Frontend developer. React & Next.js.",
    "Traveler, reader, dreamer.",
    "Building things on the web.",
    "Photography and open source.",
    "Learning something new every day.",
    "Football fan and gamer.",
    "Designer with a passion for UX.",
    "Writing about tech and life.",
    "",
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function buildUsers(count) {
    const users = [];
    const usedUsernames = new Set();
    const usedEmails = new Set();

    while (users.length < count) {
        const first = rand(firstNames);
        const last = rand(lastNames);
        const suffix = randInt(1, 9999);
        const username = `${first.toLowerCase()}_${last.toLowerCase()}${suffix}`;
        const email = `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@example.com`;

        if (usedUsernames.has(username) || usedEmails.has(email)) continue;
        usedUsernames.add(username);
        usedEmails.add(email);

        users.push({
            username,
            fullname: `${first} ${last}`,
            email,
            verified: Math.random() < 0.6,
            bio: rand(bios),
            avatar: "",
        });
    }
    return users;
}

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log("Connected.");

    const users = buildUsers(TOTAL_USERS);

    console.log(`Hashing password for ${users.length} users...`);
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const docs = users.map((u) => ({ ...u, password: hashedPassword }));

    console.log("Inserting users...");
    let inserted = [];
    try {
        inserted = await UserModel.insertMany(docs, { ordered: false });
    } catch (err) {
        // ordered:false continues past duplicate-key errors; report what was inserted
        if (err.insertedDocs) {
            inserted = err.insertedDocs;
            console.warn(`Some inserts failed (likely duplicates). Inserted ${inserted.length}.`);
        } else {
            throw err;
        }
    }

    console.log(`Inserted ${inserted.length} users.`);

    const summary = inserted.map((u) => ({
        username: u.username,
        fullname: u.fullname,
        email: u.email,
        verified: u.verified,
    }));

    const outPath = join(__dirname, "seed-users.output.json");
    writeFileSync(
        outPath,
        JSON.stringify({ password: DEFAULT_PASSWORD, count: summary.length, users: summary }, null, 2),
        "utf-8"
    );
    console.log(`Wrote credentials list to ${outPath}`);

    await mongoose.disconnect();
    console.log("Done.");
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
