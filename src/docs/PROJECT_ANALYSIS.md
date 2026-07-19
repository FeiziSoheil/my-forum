# تحلیل پروژه Forum — Parakgram

## خلاصه پروژه

**Parakgram** (برگرفته از «پرک» — ستاره سهیل) یک اپلیکیشن اجتماعی/فوروم وب است که با **Next.js 15** و **TypeScript** ساخته شده. محصول فعلی فراتر از احراز هویت و پست است و شامل فید، پاسخ تو در تو، استوری، پیام مستقیم، نوتیفیکیشن، فالو، تگ، جستجو (Explore) و پروفایل می‌شود.

این سند وضعیت **واقعی محصول فعلی** را توصیف می‌کند — نه برنامهٔ ایده‌آل و نه نسخهٔ قدیمی «فقط auth + پست».

## تکنولوژی‌ها

### Frontend

| فناوری | نقش |
| --- | --- |
| Next.js 15.5.4 (App Router) | فریمورک و روتینگ |
| React 19.1.0 | UI |
| TypeScript 5 | تایپ |
| Tailwind CSS 4 | استایل |
| shadcn/ui + Radix | کامپوننت‌های پایه |
| TanStack Query | کش و state سمت کلاینت |
| React Hook Form + Zod | فرم و اعتبارسنجی |
| Framer Motion / Swiper | انیمیشن و گالری |
| next-themes | تم روشن/تاریک و تم‌های سفارشی |
| Lucide React | آیکون |

### Backend & داده

| فناوری | نقش |
| --- | --- |
| MongoDB + Mongoose 8.19 | پایگاه داده و ODM |
| JWT (`jose`) + کوکی `atk` / `rtk` | احراز هویت |
| bcrypt | هش پسورد |
| Axios | کلاینت HTTP |
| formidable / آپلود محلی | رسانه در `public/uploads` |
| SSE (stream routes) | نوتیفیکیشن و چت زنده |

### مدل‌های اصلی (`src/models`)

`User` · `Post` · `Reply` · `Story` · `Conversation` · `Message` · `Notification`

## ساختار پروژه (خلاصه)

```
src/
├── app/
│   ├── api/           # Route Handlers (auth, post, user, stories, conversations, notifications, tags, users)
│   ├── auth/          # ورود / ثبت‌نام
│   ├── likes/         # Activity (نوتیفیکیشن‌ها)
│   ├── messages/      # لیست و اتاق چت
│   ├── post/          # جزئیات پست + ساخت پست
│   ├── profile/       # پروفایل من و دیگران (+ followers/following)
│   ├── search/        # Explore (Users / Tags / Posts)
│   ├── settings/      # ویرایش پروفایل + تم
│   ├── stories/new/   # ساخت استوری
│   └── tag/[slug]/    # فید بر اساس تگ
├── components/        # UI دامنه: auth, chat, post, profile, stories, …
├── hook/              # React Query hooks
├── layout/            # Header + Navigation
├── lib/               # auth, db, chat, mentions, tags, notifications, …
├── models/            # Mongoose
├── middleware.ts      # محافظت روت‌ها + callbackUrl
└── types/
scripts/               # seedUsers, seedPosts, seedReplies, backfillTags
```

## کارهای انجام‌شده (وضعیت واقعی)

### احراز هویت و نشست

- ثبت‌نام، ورود، خروج، `/api/auth/me`، رفرش توکن
- کوکی‌های امن Access/Refresh؛ middleware برای روت‌های محافظت‌شده
- ریدایرکت به `/auth` با `callbackUrl` امن؛ بازگشت پس از login/register
- محافظت `/settings` (و همچنین `/profile`، `/messages`، `/likes`، `/post/new`، `/stories/new`)
- **ندارد:** بازیابی/تغییر پسورد، Remember me، تأیید ایمیل واقعی (فیلد `verified` وجود دارد ولی فلو کامل نیست)

### پست، لایک، ریپاست، تگ، منشن

- ساخت پست (متن + رسانه، استخراج هشتگ و منشن)
- فید با cursor pagination؛ فیلتر `tag` و جستجوی متنی `q`
- لایک / آنلایک، ریپاست / برداشتن ریپاست
- ویرایش و حذف پست (API)
- صفحهٔ تگ `/tag/[slug]`
- پیشنهاد تگ: `GET /api/tags/suggest`

### پاسخ‌ها (از جمله تو در تو — P4)

- پاسخ به پست و لایک پاسخ
- ویرایش / حذف پاسخ
- پاسخ تو در تو با `parentReply` و `threadLevel` (۰ تا ۲؛ حداکثر عمق ۲)
- UI تخت با تورفتگی (`ReplyCard`)؛ دکمهٔ Reply در عمق حداکثر غیرفعال می‌شود

### پروفایل و فالو (P1)

- پروفایل خودم و دیگران: پست‌ها / پاسخ‌ها / ریپاست‌ها
- ویرایش پروفایل (آواتار با crop، نام، bio و …) از Settings و API `PATCH /api/user`
- فالو / آنفالو
- لیست followers / following (API + صفحات؛ شمارنده‌ها قابل کلیک)

### استوری

- متن و تصویر؛ لایک، ویو، viewers، پاسخ استوری (به‌سمت DM)
- ریل و viewer در UI؛ انقضا ۲۴ ساعته در کوئری
- **ندارد:** استوری ویدیو؛ job پاکسازی TTL برای اسناد منقضی

### پیام مستقیم (P3)

- گفتگوی ۱:۱؛ متن و تصویر؛ ریپلای داخل چت؛ ری‌اکشن
- اشتراک پست / پاسخ استوری در چت
- soft-delete پیام (`deletedAt`)؛ forward به گفتگو/کاربر دیگر
- SSE برای استریم پیام‌ها
- حذف stub آفلاین و دکمهٔ voice از UI
- **ندارد:** گروه، voice message، presence واقعی؛ نوتیفیکیشن جدا برای DM

### نوتیفیکیشن / Activity (P0)

- صفحه `/likes` با برچسب ناوبری **Activity**
- انواع: like_post، like_reply، repost، follow، reply، mention، like_story، story_reply
- لیست، خواندن، unread-count، SSE stream
- حذف stubهای **Subscription** و **Forgot password** از ناوبری/منو

### جستجو / Explore (P2)

- `/search` با تب‌های Users / Tags / Posts
- دکمهٔ جستجو در Header
- کاربران: `GET /api/users/search`؛ تگ‌ها: suggest؛ پست‌ها: `GET /api/post?q=`

### تنظیمات (جزئی)

- `/settings`: ویرایش پروفایل + انتخاب تم
- **ندارد:** حریم خصوصی، ترجیحات نوتیف، حذف حساب، تغییر پسورد

### زیر و تم

- تم روشن/تاریک و تم‌های سفارشی (`src/lib/themes.ts`)
- Layout شرطی، Header، Navigation پایین با badge پیام و Activity

## صفحات اصلی

| مسیر | توضیح | محافظت |
| --- | --- | --- |
| `/` | فید خانه + استوری ریل | خیر |
| `/auth` | ورود / ثبت‌نام (+ `callbackUrl`) | مهمان |
| `/post/new` | ساخت پست | ✅ |
| `/post/[id]` | جزئیات پست + پاسخ‌های تو در تو | خیر |
| `/tag/[slug]` | فید تگ | خیر |
| `/search` | Explore | خیر |
| `/likes` | Activity | ✅ |
| `/messages` · `/messages/[id]` | چت | ✅ |
| `/profile` · `/profile/(me)/*` | پروفایل من | ✅ |
| `/profile/[username]/*` | پروفایل عمومی + followers/following | ✅ (پیشوند) |
| `/settings` | تنظیمات جزئی | ✅ |
| `/stories/new` | ساخت استوری | ✅ |

## نمای کلی API

احراز هویت با کوکی `atk` مگر خلافش ذکر شود.

### Auth — `/api/auth`

| متد | مسیر | توضیح |
| --- | --- | --- |
| `POST` | `/register` · `/login` | ثبت‌نام / ورود + کوکی |
| `POST` | `/logout` | حذف کوکی |
| `GET` | `/me` | کاربر جاری |
| `POST` | `/refresh` | تمدید access با `rtk` |

### Posts & replies — `/api/post`

| متد | مسیر | توضیح |
| --- | --- | --- |
| `GET` | `/post` | لیست؛ `limit`، `cursor`، `tag`، `q` |
| `POST` | `/post` | ساخت پست (multipart) |
| `GET` · `PATCH` · `DELETE` | `/post/[id]` | جزئیات / ویرایش / حذف |
| `POST` · `DELETE` | `/post/[id]/like` | لایک |
| `POST` · `DELETE` | `/post/[id]/repost` | ریپاست |
| `GET` · `POST` | `/post/[id]/replies` | لیست / ساخت (اختیاری `parentReply`) |
| `PATCH` · `DELETE` | `.../replies/[replyId]` | ویرایش / حذف پاسخ |
| `POST` · `DELETE` | `.../replies/[replyId]/like` | لایک پاسخ |

### User & social — `/api/user` · `/api/users`

| متد | مسیر | توضیح |
| --- | --- | --- |
| `PATCH` | `/user` | به‌روزرسانی پروفایل من |
| `GET` | `/user/posts` · `/replies` · `/reposts` | محتوای من |
| `GET` | `/user/[username]` | پروفایل عمومی |
| `GET` | `/user/[username]/posts` · `/replies` · `/reposts` | محتوای کاربر |
| `POST` · `DELETE` | `/user/[username]/follow` | فالو / آنفالو |
| `GET` | `/user/[username]/followers` · `/following` | لیست‌ها |
| `GET` | `/users/search` | جستجوی کاربر |

### Stories — `/api/stories`

| متد | مسیر | توضیح |
| --- | --- | --- |
| `GET` · `POST` | `/stories` | لیست فعال / ساخت |
| `GET` · `DELETE` | `/stories/[id]` | جزئیات / حذف |
| `POST` | `/stories/[id]/like` · `/view` · `/reply` | تعامل |
| `GET` | `/stories/[id]/viewers` | بینندگان |

### Chat — `/api/conversations`

| متد | مسیر | توضیح |
| --- | --- | --- |
| `GET` · `POST` | `/conversations` | لیست / شروع گفتگو |
| `GET` | `/conversations/[id]` | جزئیات |
| `GET` · `POST` | `.../messages` | تاریخچه / ارسال |
| `DELETE` | `.../messages/[messageId]` | soft-delete |
| `POST` | `.../messages/[messageId]/forward` | فوروارد |
| `POST` · `DELETE` | `.../messages/[messageId]/react` | ری‌اکشن |
| `POST` | `.../read` | علامت خوانده‌شده |
| `GET` | `.../stream` | SSE |

### Notifications — `/api/notifications`

| متد | مسیر | توضیح |
| --- | --- | --- |
| `GET` | `/notifications` | لیست |
| `POST` | `/notifications/read` | خواندن |
| `GET` | `/unread-count` · `/stream` | شمارش / SSE |

### Tags

| متد | مسیر | توضیح |
| --- | --- | --- |
| `GET` | `/api/tags/suggest` | پیشنهاد هشتگ |

## دادهٔ آزمایشی (Seed)

| اسکریپت | کاربرد |
| --- | --- |
| `scripts/seedUsers.mjs` | حدود ۲۰۰ کاربر رندوم؛ پسورد مشترک `Password123`؛ خروجی `scripts/seed-users.output.json` |
| `scripts/seedPosts.mjs` | پست‌های آزمایشی |
| `scripts/seedReplies.mjs` | پاسخ‌های آزمایشی |
| `scripts/backfillTags.mjs` | پر کردن تگ‌های استخراج‌شده |

```bash
node --env-file=.env scripts/seedUsers.mjs
```

## اجرای پروژه

```bash
npm install
npm run dev      # Turbopack
npm run build && npm start
```

## کارهای باقی‌مانده (صادقانه)

مرتب‌شده تقریباً بر اساس ارزش محصول / پیچیدگی:

| اولویت پیشنهادی | مورد | وضعیت |
| --- | --- | --- |
| بالا | Bookmarks / ذخیره‌ها | پیاده‌سازی نشده |
| بالا | بازیابی / تغییر پسورد · Remember me | پیاده‌سازی نشده |
| بالا | فلو تأیید ایمیل | فقط فیلد `verified`؛ بدون فلو کامل |
| متوسط | Block / mute / report | پیاده‌سازی نشده |
| متوسط | Visibility و pin پست | در اسکیما هست؛ در محصول استفاده نشده |
| متوسط | فید فقط Following | پیاده‌سازی نشده |
| متوسط | عمق Settings (حریم خصوصی، ترجیح نوتیف، حذف حساب) | جزئی |
| متوسط | نوتیفیکیشن برای DM | پیاده‌سازی نشده |
| پایین‌تر | چت گروهی · voice · presence واقعی | پیاده‌سازی نشده |
| پایین‌تر | استوری ویدیو · پاکسازی TTL استوری‌های منقضی | ناقص |
| اختیاری | Subscription / اشتراک ویژه | حذف stub؛ فیچر نیست |
| انجام‌شده در این دور | به‌روزرسانی همین سند (قبلاً ~۷۰٪ و فقط auth+پست بود) | ✅ |

### موارد تکمیل‌شده در دور اخیر (P0–P4)

- **P0:** برچسب Activity؛ حذف Subscription و Forgot password؛ محافظت Settings؛ `callbackUrl`
- **P1:** API و صفحات followers/following + شمارنده‌های قابل کلیک
- **P2:** Explore `/search`؛ جستجو در Header؛ `GET /api/post?q=`
- **P3:** soft-delete و forward چت؛ حذف Offline stub و دکمه voice
- **P4:** پاسخ تو در تو تا `threadLevel` ۲ با UI تورفتگی

## وضعیت کلی پیشرفت

برآورد نسبت به یک محصول اجتماعی کامل (نه فقط MVP پست):

| حوزه | پیشرفت تقریبی |
| --- | --- |
| احراز هویت و نشست | ~۸۵٪ (بدون reset/verify/email flow) |
| پست / پاسخ / لایک / ریپاست / تگ | ~۹۰٪ (بدون bookmark، pin، visibility، فید following) |
| پروفایل و فالو | ~۹۵٪ |
| استوری | ~۷۵٪ (بدون ویدیو و TTL cleanup) |
| پیام مستقیم | ~۸۰٪ (۱:۱ قوی؛ بدون گروه/voice/presence/DM notif) |
| نوتیفیکیشن / Activity | ~۸۵٪ (بدون نوتیف DM و ترجیحات) |
| جستجو / Explore | ~۹۰٪ |
| تنظیمات | ~۴۰٪ |
| **پیشرفت کلی محصول** | **~۸۸٪** |

عدد قبلی سند (~۷۰٪) مربوط به حالت قدیمی «عمدتاً auth + پست» بود و دیگر معتبر نیست.
