import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL + '/api',
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

    // فقط خطای ۴۰۱ و درخواستی که قبلاً رفرش نشده
    if (err.response?.status === 401 && !originalRequest._retry) {
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
        // رفرش هم ناموفق بود → لاگ‌اوت
        window.location.href = '/auth';
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