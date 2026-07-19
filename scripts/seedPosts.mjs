import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/seedPosts.mjs");
    process.exit(1);
}

// ----- config -----
const MIN_POSTS = 10;
const MAX_POSTS = 30;
const DAYS_BACK = 180; // posts spread across the last ~6 months

// ----- schemas (kept in sync with src/models) -----
const userSchema = new mongoose.Schema({}, { strict: false });
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const PostSchema = new mongoose.Schema(
    {
        content: { type: String, required: true, maxlength: 500, trim: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        media: [{ type: { type: String }, url: String, alt: String, size: Number, uploadedAt: Date }],
        likesCount: { type: Number, default: 0 },
        repliesCount: { type: Number, default: 0 },
        repostsCount: { type: Number, default: 0 },
        likes: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, createdAt: Date }],
        reposts: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, createdAt: Date }],
        tags: [String],
        mentions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, position: Number }],
        isDeleted: { type: Boolean, default: false },
        isPinned: { type: Boolean, default: false },
        pinnedAt: Date,
        visibility: { type: String, enum: ["public", "followers", "private"], default: "public" },
    },
    { timestamps: true }
);
const PostModel = mongoose.models.Post || mongoose.model("Post", PostSchema);

const replySchema = new mongoose.Schema({}, { strict: false });
const ReplyModel = mongoose.models.Reply || mongoose.model("Reply", replySchema);

const notificationSchema = new mongoose.Schema({}, { strict: false });
const NotificationModel =
    mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

// ----- content pools by category -----
const categories = {
    طنز: {
        tags: ["طنز", "خنده", "شوخی"],
        posts: [
            "رژیم گرفتن یعنی گشنگی کشیدن که بعداً با دو برابر خوردن جبرانش کنی.",
            "هیچی تو زندگی به اندازه‌ی «الان میام» گفتنِ مامان طولانی نیست.",
            "یه آدم بالغم که موقع خرج‌کردن پول، هنوز مثل بچه‌ها ذوق می‌کنم و موقع پس‌دادنش گریه‌ام می‌گیره.",
            "زنگ ساعت صبح رو گذاشتم که بیدار شم، ولی مغزم قرارداد جدا امضا کرده.",
            "بزرگ‌ترین دروغ تاریخ: «فقط یه قسمت دیگه ببینم می‌خوابم».",
            "وقتی یخچال رو باز می‌کنی، می‌بندی، دوباره باز می‌کنی، انگار غذا قراره خودش ظاهر شه.",
            "قوی‌ترین موجود دنیا اون کیسه‌ی خریدیه که همه‌ی وزنش رو یه‌جا میندازه رو انگشت‌هات.",
            "من به کائنات پیام دادم، کائنات گذاشت سین.",
            "هر وقت میگم دیگه قهوه نمی‌خورم، فنجون بهم می‌خنده.",
            "شنبه‌ها اختراع شدن که آدم بفهمه تعطیلات چقدر کوتاه بود.",
        ],
    },
    علمی: {
        tags: ["علم", "دانش", "کشف"],
        posts: [
            "نور خورشید حدود هشت دقیقه و بیست ثانیه طول می‌کشه تا به زمین برسه؛ یعنی همیشه گذشته رو می‌بینیم.",
            "مغز انسان حدود ۸۶ میلیارد نورون داره و مصرف انرژی‌اش تقریباً برابر یک لامپ ۲۰ واتیه.",
            "آب تنها ماده‌ای در طبیعته که در هر سه حالت جامد، مایع و گاز به‌راحتی روی زمین دیده می‌شه.",
            "زنبورهای عسل با رقصیدن به هم‌نوعانشون مسیر و فاصله‌ی گل‌ها رو نشون می‌دن.",
            "قلب یک نهنگ آبی اون‌قدر بزرگه که یک انسان می‌تونه از داخل رگ‌هاش رد بشه.",
            "کوانتوم مکانیک می‌گه یک ذره می‌تونه هم‌زمان در چند حالت باشه تا وقتی که اندازه‌گیری‌اش کنیم.",
            "استخوان‌های بدن انسان از فولاد هم‌وزن، مقاوم‌تر هستن.",
            "تعداد درخت‌های روی زمین از تعداد ستاره‌های کهکشان راه شیری بیشتره.",
            "دی‌ان‌ای یک انسان اگر باز شود، طولش به میلیاردها کیلومتر می‌رسد.",
            "سرعت نور در خلأ حدود ۳۰۰ هزار کیلومتر بر ثانیه است و هیچ چیز از آن سریع‌تر حرکت نمی‌کند.",
        ],
    },
    فرهنگی: {
        tags: ["فرهنگ", "هنر", "کتاب"],
        posts: [
            "کتاب خوندن مثل سفر کردنه، بدون اینکه از جات بلند شی.",
            "هر زبانی که یاد می‌گیری، یه پنجره‌ی تازه به دنیا باز می‌کنی.",
            "موسیقی زبان مشترک همه‌ی انسان‌هاست، حتی وقتی کلماتش رو نفهمیم.",
            "فرهنگ هر ملت در داستان‌ها و ضرب‌المثل‌هاش زنده می‌مونه.",
            "یه فیلم خوب می‌تونه دیدگاهت رو نسبت به زندگی برای همیشه عوض کنه.",
            "شعر حافظ بعد از قرن‌ها هنوز هم دل آدم رو آروم می‌کنه.",
            "هنر جایی شروع می‌شه که کلمات کم میارن.",
            "کتابخونه‌ها آروم‌ترین و در عین حال پرصداترین جاهای دنیان؛ پر از هزاران فکر.",
            "سنت‌ها ریشه‌ان و نوآوری‌ها شاخه؛ درخت فرهنگ به هر دو نیاز داره.",
            "هر نقاشی یک سکوت است که با رنگ حرف می‌زند.",
        ],
    },
    تاریخی: {
        tags: ["تاریخ", "گذشته", "تمدن"],
        posts: [
            "کوروش بزرگ اولین منشور حقوق بشر جهان را بیش از ۲۵۰۰ سال پیش صادر کرد.",
            "دیوار چین تنها سازه‌ی دست‌ساز بشر نیست که از فضا دیده می‌شه؛ این یک افسانه‌ی رایجه.",
            "کتابخانه‌ی اسکندریه یکی از بزرگ‌ترین مراکز علمی دنیای باستان بود.",
            "امپراتوری هخامنشی اولین سیستم پستی منظم تاریخ را راه‌اندازی کرد.",
            "اهرام مصر بیش از چهار هزار سال قدمت دارند و هنوز رازهای زیادی در خود دارند.",
            "ابن‌سینا در هزار سال پیش کتابی نوشت که قرن‌ها مرجع پزشکی اروپا بود.",
            "راه ابریشم فقط یک مسیر تجاری نبود، بلکه پلی برای تبادل فرهنگ و دانش بود.",
            "چاپخانه‌ی گوتنبرگ در قرن پانزدهم مسیر انتشار دانش را برای همیشه تغییر داد.",
            "تخت جمشید نماد شکوه معماری و مهندسی ایران باستان است.",
            "بسیاری از اختراعات دوران طلایی اسلام، پایه‌ی علم مدرن امروز شدند.",
        ],
    },
    روزمره: {
        tags: ["روزمره", "زندگی", "حال‌خوب"],
        posts: [
            "امروز صبح زودتر بیدار شدم و یه فنجون چای با آرامش خوردم؛ همین کافی بود روزم بسازه.",
            "بعضی روزها فقط باید بگذرن، لازم نیست همه‌شون خاص باشن.",
            "پیاده‌روی عصرگاهی بهترین دارو برای ذهن خسته‌ست.",
            "یه دورهمی ساده با دوستای قدیمی از هر مهمونی مجللی بهتره.",
            "امروز کلی کار عقب‌افتاده رو انجام دادم و حس سبکی عجیبی دارم.",
            "بارون که میاد، دلم می‌خواد فقط پشت پنجره بشینم و هیچ کاری نکنم.",
            "گاهی بزرگ‌ترین موفقیت روز، همون تختیه که مرتب کردی.",
            "قهوه‌ی صبح، موسیقی ملایم و یه دفتر خالی؛ شروع خوب یه روز.",
            "امروز به یه غریبه لبخند زدم و اون هم جوابمو داد؛ حس خوبی بود.",
            "شب‌ها قبل خواب چند صفحه کتاب می‌خونم؛ بهترین عادتیه که ساختم.",
        ],
    },
    فناوری: {
        tags: ["فناوری", "تکنولوژی", "برنامه‌نویسی"],
        posts: [
            "هوش مصنوعی داره سریع‌تر از چیزی که فکرش رو بکنیم زندگی‌مون رو عوض می‌کنه.",
            "بهترین کد اونیه که شش ماه بعد خودت هم بتونی بخونیش.",
            "رمز عبور قوی مثل مسواکه؛ نه با کسی به اشتراکش بذار، نه دیر عوضش کن.",
            "یادگیری یک زبان برنامه‌نویسی جدید، طرز فکرت رو هم عوض می‌کنه.",
            "آینده از آنِ کسانیه که یاد می‌گیرن چطور با ابزارهای جدید کار کنن.",
            "هر باگی یه فرصت برای یاد گرفتن یه چیز جدیده (هرچند وسط شب اصلاً حس نمی‌شه!).",
            "تکنولوژی باید زندگی رو ساده کنه، نه اینکه پیچیده‌ترش کنه.",
            "بک‌آپ گرفتن کاریه که یا الان انجامش می‌دی یا بعداً حسرتش رو می‌خوری.",
            "متن‌باز بودن یعنی دانش متعلق به همه‌ست.",
            "گوشی هوشمند بیشتر از فضاپیمای آپولو قدرت پردازش داره.",
        ],
    },
    ورزشی: {
        tags: ["ورزش", "سلامتی", "تناسب‌اندام"],
        posts: [
            "ورزش صبحگاهی انرژی کل روزت رو تنظیم می‌کنه.",
            "مهم نیست چقدر آروم می‌دوی، بازم از همه‌ی کسایی که رو کاناپه نشستن جلوتری.",
            "قهرمان‌ها یه شبه ساخته نمی‌شن؛ نتیجه‌ی هزاران تمرین بی‌سروصدان.",
            "بدن سالم، ذهن آروم؛ این دو تا از هم جدا نیستن.",
            "امروز رکورد شخصی‌مو زدم؛ رقابت اصلی همیشه با خودمونه.",
            "آب کافی بخور، درست بخواب، تکون بخور؛ سه تا قانون ساده‌ی سلامتی.",
            "فوتبال فقط یه بازی نیست، یه احساس مشترک بین میلیون‌ها آدمه.",
            "پیاده‌روی روزی سی دقیقه می‌تونه سال‌ها به عمرت اضافه کنه.",
            "شکست تو تمرین بهتر از پشیمونی تو مسابقه‌ست.",
            "ورزش تیمی بهت یاد می‌ده که برد و باخت رو با هم تقسیم کنی.",
        ],
    },
    فلسفی: {
        tags: ["فلسفه", "تفکر", "زندگی"],
        posts: [
            "شاید معنای زندگی همون جستجوی معنا باشه.",
            "ما آنچه فکر می‌کنیم می‌شویم؛ پس مراقب افکارت باش.",
            "خوشبختی مقصد نیست، شیوه‌ی سفر کردنه.",
            "هر پایانی، شروع یه چیز تازه‌ست، حتی اگه اون لحظه نبینیمش.",
            "آزادی واقعی یعنی مسئولیت انتخاب‌هات رو بپذیری.",
            "زمان تنها چیزیه که هیچ‌وقت پس نمیاد؛ عاقلانه خرجش کن.",
            "گاهی سکوت پرمعناترین جواب ممکنه.",
            "تغییر تنها چیز ثابت جهانه.",
            "شناختن خود، سخت‌ترین و مهم‌ترین سفر زندگیه.",
            "ترس از شکست، بزرگ‌ترین مانع شروع کردنه.",
        ],
    },
    آشپزی: {
        tags: ["آشپزی", "غذا", "دستپخت"],
        posts: [
            "راز یه غذای خوشمزه، فقط مواد اولیه نیست؛ حوصله‌ست.",
            "امروز اولین بار قرمه‌سبزی درست کردم و باورم نمی‌شه انقدر خوب شد!",
            "چای بعد از غذا، حق مسلم هر ایرانیه.",
            "بوی نون تازه از فر، هیچ عطری باهاش برابری نمی‌کنه.",
            "آشپزی یه جور مدیتیشنه؛ ذهنت آروم می‌شه وقتی داری خلق می‌کنی.",
            "ته‌دیگ، دلیل واقعی جنگ‌های خانوادگی سر میز شامه.",
            "یه دستور ساده: عشق رو با هر چی می‌پزی قاطی کن.",
            "صبحونه‌ی دسته‌جمعی آخر هفته، بهترین سنت خانوادگیه.",
            "ادویه‌ها روح غذان؛ کم و زیادشون همه‌چی رو عوض می‌کنه.",
            "غذای مونده‌ی دیشب، فردا ظهر خوشمزه‌تر می‌شه؛ این یه قانون علمیه!",
        ],
    },
    انگیزشی: {
        tags: ["انگیزشی", "موفقیت", "هدف"],
        posts: [
            "قدم کوچیک هر روز، بهتر از قدم بزرگیه که هیچ‌وقت برداشته نمی‌شه.",
            "شروع کن، لازم نیست عالی باشه؛ کامل‌کردنش کار بعدیه.",
            "بزرگ‌ترین سرمایه‌گذاری، روی خودته.",
            "هر «نه» که می‌شنوی، تو رو به «بله» بعدی نزدیک‌تر می‌کنه.",
            "رویاهات رو اونقدر بزرگ ببین که مجبور شی رشد کنی تا بهشون برسی.",
            "امروز کاری کن که فردا ازش تشکر کنی.",
            "انگیزه شروعت می‌ده، عادت ادامه‌ات می‌ده.",
            "مقایسه‌ی خودت با دیرروزِ خودت، تنها رقابت منصفانه‌ست.",
            "سختی‌ها موقتی‌ان، ولی تسلیم‌شدن دائمیه.",
            "باور به خودت، اولین قدم هر پیروزیه.",
        ],
    },
};

const categoryNames = Object.keys(categories);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function randomDate() {
    const now = Date.now();
    const past = now - DAYS_BACK * 24 * 3600 * 1000;
    return new Date(randInt(past, now));
}

function buildPostsForUser(userId) {
    const count = randInt(MIN_POSTS, MAX_POSTS);
    const docs = [];
    for (let i = 0; i < count; i++) {
        const catName = rand(categoryNames);
        const cat = categories[catName];
        const base = rand(cat.posts);
        // Inline #hashtags after whitespace so extractHashtags / display work
        const tagList = [catName, ...cat.tags];
        const hashtagLine = tagList.map((t) => `#${t}`).join(" ");
        let content = `${base}\n\n${hashtagLine}`;
        if (content.length > 500) {
            content = `${base.slice(0, Math.max(0, 500 - hashtagLine.length - 2))}\n\n${hashtagLine}`.slice(0, 500);
        }
        const created = randomDate();
        docs.push({
            content,
            author: userId,
            media: [],
            likesCount: 0,
            repliesCount: 0,
            repostsCount: 0,
            likes: [],
            reposts: [],
            // lowercase without # — matches extractHashtags output
            tags: tagList.map((t) => t.toLowerCase()),
            mentions: [],
            isDeleted: false,
            isPinned: false,
            visibility: "public",
            createdAt: created,
            updatedAt: created,
        });
    }
    return docs;
}

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log("Connected.");

    const users = await UserModel.find({}, { _id: 1 }).lean();
    if (users.length === 0) {
        console.error("No users found. Run scripts/seedUsers.mjs first.");
        await mongoose.disconnect();
        process.exit(1);
    }

    // Wipe existing posts/replies (and post/reply notifications) before insert
    const [repliesWipe, postsWipe, notifsWipe] = await Promise.all([
        ReplyModel.deleteMany({}),
        PostModel.deleteMany({}),
        NotificationModel.deleteMany({
            $or: [{ post: { $ne: null } }, { reply: { $ne: null } }],
        }),
    ]);
    console.log(
        `Wiped ${postsWipe.deletedCount} posts, ${repliesWipe.deletedCount} replies, ${notifsWipe.deletedCount} post/reply notifications.`
    );

    console.log(`Found ${users.length} users. Generating posts (${MIN_POSTS}-${MAX_POSTS} each)...`);

    let allDocs = [];
    for (const u of users) {
        allDocs = allDocs.concat(buildPostsForUser(u._id));
    }
    console.log(`Prepared ${allDocs.length} posts. Inserting in batches...`);

    const BATCH = 1000;
    let inserted = 0;
    for (let i = 0; i < allDocs.length; i += BATCH) {
        const batch = allDocs.slice(i, i + BATCH);
        const res = await PostModel.insertMany(batch, { ordered: false, timestamps: false });
        inserted += res.length;
        console.log(`  inserted ${inserted}/${allDocs.length}`);
    }

    console.log(`Done. Inserted ${inserted} posts for ${users.length} users.`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
