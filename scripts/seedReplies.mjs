import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/seedReplies.mjs");
    process.exit(1);
}

// ----- config -----
const MIN_REPLIES = 7;
const MAX_REPLIES = 13;
const MAX_NESTED = 3; // max nested replies per top-level reply (0..MAX_NESTED)

const { ObjectId } = mongoose.Types;

// ----- schemas (loose, kept in sync with src/models) -----
const userSchema = new mongoose.Schema({}, { strict: false });
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({}, { strict: false });
const PostModel = mongoose.models.Post || mongoose.model("Post", postSchema);

const ReplySchema = new mongoose.Schema(
    {
        content: { type: String, required: true, maxLength: 500, trim: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        parentPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
        parentReply: { type: mongoose.Schema.Types.ObjectId, ref: "Reply", default: null },
        threadLevel: { type: Number, default: 0, max: 5 },
        media: [{ type: { type: String }, url: String, alt: String, size: Number, uploadedAt: Date }],
        likesCount: { type: Number, default: 0 },
        repliesCount: { type: Number, default: 0 },
        likes: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, createdAt: Date }],
        tags: [String],
        mentions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, position: Number }],
        isDeleted: { type: Boolean, default: false },
        visibility: { type: String, enum: ["public", "followers", "private"], default: "public" },
    },
    { timestamps: true }
);
const ReplyModel = mongoose.models.Reply || mongoose.model("Reply", ReplySchema);

// ----- top-level reply pools per category -----
const topRepliesByCategory = {
    طنز: [
        "😂😂 دقیقاً همین بلا سر منم میاد!",
        "خندیدم به این حجم از واقعیت 😅",
        "این رو باید بزنن سردر خونه‌ها",
        "نه بابا، انگار زندگی منو نوشتی 😂",
        "ترکیدم از خنده، عین خودمه",
        "کاش می‌شد لایک بیشتر داد به این",
        "هق، چقدر آشنا بود این حس",
        "شما نویسنده‌ی زندگی منی انگار 😆",
    ],
    علمی: [
        "چه جالب! منبعش رو داری معرفی کنی؟",
        "واقعاً شگفت‌انگیزه طبیعت",
        "این رو نمی‌دونستم، ممنون که گفتی 🙏",
        "علم هر روز بیشتر منو غافلگیر می‌کنه",
        "دقیق و علمی، دمت گرم",
        "می‌شه بیشتر توضیح بدی این قسمتش رو؟",
        "این حقیقت ذهنم رو منفجر کرد 🤯",
        "عاشق این‌جور مطالب علمی‌ام",
    ],
    فرهنگی: [
        "چقدر قشنگ گفتی، کاملاً موافقم",
        "فرهنگ واقعاً هویت یه ملته",
        "این حرف باید همه‌جا نوشته بشه",
        "کتاب‌خوندن رو دست‌کم نگیریم واقعاً",
        "هنر روح آدم رو زنده نگه می‌داره",
        "چه نگاه عمیقی به فرهنگ داری 👌",
        "دقیقاً همینه، سنت و نوآوری با هم",
        "این پست رو ذخیره کردم، عالی بود",
    ],
    تاریخی: [
        "تاریخ ما پر از این افتخاراته",
        "این بخش تاریخ رو نمی‌دونستم، جالب بود",
        "باید بیشتر تاریخمون رو بشناسیم",
        "چه اطلاعات ارزشمندی، ممنون",
        "گذشته چراغ راه آینده‌ست واقعاً",
        "منبع تاریخی‌اش رو معرفی می‌کنی؟",
        "همیشه از تاریخ باستان لذت می‌برم",
        "این حقیقت تاریخی فوق‌العاده‌ست",
    ],
    روزمره: [
        "چه حس خوبی داشت خوندنش ☕",
        "منم امروز دقیقاً همین حال رو داشتم",
        "کاش همه روزها اینقدر آروم بودن",
        "لذت‌بردن از لحظه‌ها همینه دیگه",
        "این آرامش رو حس کردم موقع خوندن",
        "دمت گرم، حالم بهتر شد",
        "همین چیزای ساده خوشبختی‌ان",
        "منم عاشق صبح‌های آرومم 🌤️",
    ],
    فناوری: [
        "کاملاً درسته، تکنولوژی داره همه‌چی رو عوض می‌کنه",
        "به‌عنوان یه برنامه‌نویس تأییدش می‌کنم 😅",
        "این نکته طلایی بود، ممنون",
        "بک‌آپ! هزار بار این درس رو گرفتم",
        "آینده واقعاً برای یادگیرنده‌هاست",
        "کدنویسی تمیز نعمته واقعاً",
        "هوش مصنوعی داره دیوونه‌کننده پیش می‌ره",
        "این رو باید هر تازه‌کاری بخونه",
    ],
    ورزشی: [
        "انرژی گرفتم، الان می‌رم بدوم 🏃",
        "ورزش واقعاً همه‌چیز رو عوض می‌کنه",
        "رقابت با خود، بهترین جمله بود",
        "منم امروز تمرین داشتم، حس عالی",
        "سلامتی مهم‌ترین سرمایه‌ست",
        "دمت گرم، انگیزه دادی",
        "پیاده‌روی رو جدی گرفتم از امروز",
        "قهرمان‌ها همین‌طوری ساخته می‌شن 💪",
    ],
    فلسفی: [
        "چقدر عمیق بود این جمله",
        "خیلی وقت بود به این فکر نکرده بودم",
        "این حرف تا مدت‌ها ذهنم رو درگیر می‌کنه",
        "واقعاً تغییر تنها ثابت جهانه",
        "قشنگ به فکر فرو رفتم 🤔",
        "این دیدگاه رو دوست دارم",
        "آرامش‌بخش و پرمعنا بود، ممنون",
        "شناخت خود، سخت‌ترین سفره واقعاً",
    ],
    آشپزی: [
        "وای الان گشنم شد 😋",
        "دستور کاملش رو می‌ذاری لطفاً؟",
        "ته‌دیگ نقطه‌ضعف منم هست 😅",
        "بوی نون تازه بهترین حسه",
        "منم باید امتحانش کنم، مرسی",
        "آشپزی واقعاً آرامش‌بخشه",
        "عکسش رو هم می‌ذاشتی کامل می‌شد 🤤",
        "دستپختت حتماً عالیه!",
    ],
    انگیزشی: [
        "دقیقاً همون چیزی بود که امروز لازم داشتم 🙏",
        "قدم کوچیک هر روز، طلاست",
        "انگیزه گرفتم، دمت گرم",
        "این رو نوشتم رو دیوار اتاقم",
        "شروع‌کردن سخت‌ترین قسمتشه واقعاً",
        "باور به خود، همه‌چیزه",
        "ذخیره کردم که هر روز بخونمش",
        "ممنون که حالمون رو خوب می‌کنی ✨",
    ],
};

// ----- nested reply pool (short reactions, mostly generic) -----
const nestedReplies = [
    "کاملاً موافقم 👍",
    "دقیقاً!",
    "نکته‌ی خوبی بود",
    "منم همین نظر رو دارم",
    "آره واقعاً",
    "خیلی خوب گفتی",
    "این رو قبول دارم",
    "جالب شد برام",
    "حق با توئه",
    "چه خوب که گفتی",
    "منم همینو می‌خواستم بگم",
    "به نکته‌ی مهمی اشاره کردی",
    "لایک داره این حرف",
    "درسته، تجربه‌اش کردم",
    "ممنون بابت توضیحت 🙏",
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const DAY = 24 * 3600 * 1000;

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log("Connected.");

    const userDocs = await UserModel.find({}, { _id: 1 }).lean();
    const userIds = userDocs.map((u) => u._id);
    if (userIds.length === 0) {
        console.error("No users found. Run scripts/seedUsers.mjs first.");
        await mongoose.disconnect();
        process.exit(1);
    }

    const posts = await PostModel.find({ isDeleted: false }, { _id: 1, tags: 1, createdAt: 1 }).lean();
    if (posts.length === 0) {
        console.error("No posts found. Run scripts/seedPosts.mjs first.");
        await mongoose.disconnect();
        process.exit(1);
    }
    console.log(`Found ${posts.length} posts and ${userIds.length} users. Generating replies...`);

    const randUser = () => userIds[Math.floor(Math.random() * userIds.length)];
    const now = Date.now();

    let allReplies = [];
    const postUpdates = [];
    let topCount = 0;
    let nestedCount = 0;

    for (const post of posts) {
        const category = Array.isArray(post.tags) && topRepliesByCategory[post.tags[0]] ? post.tags[0] : null;
        const topPool = category ? topRepliesByCategory[category] : nestedReplies;

        const postCreated = post.createdAt ? new Date(post.createdAt).getTime() : now - 30 * DAY;
        const numTop = randInt(MIN_REPLIES, MAX_REPLIES);
        let postRepliesTotal = 0;

        for (let i = 0; i < numTop; i++) {
            const topId = new ObjectId();
            // top reply created sometime between post creation and now
            const topCreated = new Date(randInt(postCreated + 60 * 1000, now));

            const numNested = randInt(0, MAX_NESTED);
            const nestedDocs = [];
            for (let j = 0; j < numNested; j++) {
                const nestedCreated = new Date(randInt(topCreated.getTime() + 60 * 1000, now));
                nestedDocs.push({
                    content: rand(nestedReplies),
                    author: randUser(),
                    parentPost: post._id,
                    parentReply: topId,
                    threadLevel: 1,
                    media: [],
                    likesCount: 0,
                    repliesCount: 0,
                    likes: [],
                    tags: [],
                    mentions: [],
                    isDeleted: false,
                    visibility: "public",
                    createdAt: nestedCreated,
                    updatedAt: nestedCreated,
                });
            }

            allReplies.push({
                _id: topId,
                content: rand(topPool),
                author: randUser(),
                parentPost: post._id,
                parentReply: null,
                threadLevel: 0,
                media: [],
                likesCount: 0,
                repliesCount: numNested,
                likes: [],
                tags: [],
                mentions: [],
                isDeleted: false,
                visibility: "public",
                createdAt: topCreated,
                updatedAt: topCreated,
            });
            allReplies = allReplies.concat(nestedDocs);

            topCount += 1;
            nestedCount += numNested;
            postRepliesTotal += 1 + numNested;
        }

        postUpdates.push({
            updateOne: { filter: { _id: post._id }, update: { $set: { repliesCount: postRepliesTotal } } },
        });
    }

    console.log(`Prepared ${allReplies.length} replies (${topCount} top-level, ${nestedCount} nested). Inserting...`);

    const BATCH = 2000;
    let inserted = 0;
    for (let i = 0; i < allReplies.length; i += BATCH) {
        const batch = allReplies.slice(i, i + BATCH);
        const res = await ReplyModel.insertMany(batch, { ordered: false, timestamps: false });
        inserted += res.length;
        console.log(`  inserted ${inserted}/${allReplies.length}`);
    }

    console.log("Updating repliesCount on posts...");
    for (let i = 0; i < postUpdates.length; i += BATCH) {
        await PostModel.bulkWrite(postUpdates.slice(i, i + BATCH), { ordered: false });
    }

    console.log(`Done. Inserted ${inserted} replies across ${posts.length} posts.`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
