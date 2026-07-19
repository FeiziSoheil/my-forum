import axios from 'axios';

const api = axios.create({
  // مسیر نسبی → درخواست‌ها همیشه به همان origin صفحه می‌روند (بدون CORS)
  // چه از localhost باز شود چه از IP شبکه یا دامنه
  baseURL: '/api',
  withCredentials: true, // ← cookie همیشه می‌چسبد
});

let isRefreshing = false; // جلوگیری از چندبار رفرش همزمان
let failedQueue: Array<(token: string) => void> = [];

const processQueue = (token: string) => {
  failedQueue.forEach(cb => cb(token));
  failedQueue = [];
};

api.interceptors.response.use(
  res => res, // پاسخ‌های موفق را رد می‌کند
  async err => {
    const originalRequest = err.config;

    // درخواست refresh نباید دوباره وارد چرخهٔ رفرش شود (جلوگیری از deadlock)
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    // فقط خطای ۴۰۱ و درخواستی که قبلاً رفرش نشده و خودِ رفرش نباشد
    if (err.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
      if (isRefreshing) {
        // درخواست‌های دیگر را در صف نگه می‌داریم
        return new Promise(resolve => {
          failedQueue.push(() => resolve(api(originalRequest)));
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ۱) رفرش را صدا می‌زنیم
        await api.post('/auth/refresh'); // ← body لازم نیست، چون rtk در cookie است
        // ۲) cookie جدید اتومات جایگزین شده → درخواست اصلی را تکرار می‌کنیم
        return api(originalRequest);
      } catch (refreshErr) {
        // رفرش هم ناموفق بود → لاگ‌اوت (اما در خود صفحهٔ /auth ری‌دایرکت لوپ نکن)
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
          window.location.href = '/auth';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
        processQueue('');
      }
    }

    return Promise.reject(err);
  }
);

export { api };