'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/signupForm';
import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);

  // Random Unsplash themes for visual freshness
  const unsplashImages = [
    'https://images.unsplash.com/photo-1522199710521-72d69614c702?q=80&w=1500&auto=format&fit=crop', // workspace minimal
    'https://images.unsplash.com/photo-1525186402429-b4ff38bedbec?q=80&w=1500&auto=format&fit=crop', // creative team
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1500&auto=format&fit=crop', // futuristic abstract
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1500&auto=format&fit=crop', // laptop work
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=1500&auto=format&fit=crop', // tech aesthetic
  ];

  const randomImage =
    unsplashImages[Math.floor(Math.random() * unsplashImages.length)];

  const {isAuthenticated} = useAuth()
  console.log('isAuthenticated => ', isAuthenticated);
  

  if(isAuthenticated){
    redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
      <div className="flex flex-col lg:flex-row w-full max-w-7xl rounded-3xl overflow-hidden shadow-2xl bg-white/70 backdrop-blur-md border border-white/20">
        {/* LEFT SIDE — Image Section */}
        <div className="relative hidden lg:flex w-1/2 h-[680px] overflow-hidden">
          <img
            src={randomImage}
            alt="Creative workspace background"
            className="object-cover w-full h-full scale-105 transform hover:scale-110 transition-transform duration-1000 ease-out"
          />

          {/* Gradient overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/70 via-blue-800/60 to-transparent"></div>

          {/* Floating glass info card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-12 left-12 right-12 bg-white/15 backdrop-blur-lg border border-white/30 rounded-2xl p-6 shadow-lg text-white"
          >
            <h2 className="text-2xl font-semibold mb-2">Engage. Create. Grow.</h2>
            <p className="text-sm text-blue-100 mb-4 leading-relaxed">
              Step into a community built for thinkers and makers. 
              Every conversation here is a chance to inspire or be inspired.
            </p>

            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 text-sm bg-white/20 rounded-full">
                💬 Discussions
              </span>
              <span className="px-3 py-1 text-sm bg-white/20 rounded-full">
                ⚡ Inspiration
              </span>
              <span className="px-3 py-1 text-sm bg-white/20 rounded-full">
                🔒 Privacy
              </span>
            </div>
          </motion.div>

          {/* Floating logo bubble */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 left-10 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-lg"
          >
            <h1 className="text-white text-3xl font-extrabold tracking-tight">
              MyForum
            </h1>
            <p className="text-blue-100 text-xs mt-1">
              Minimal. Modern. Meaningful.
            </p>
          </motion.div>
        </div>

        {/* RIGHT SIDE — Auth Section */}
        <div className="w-full lg:w-1/2 p-8 relative">
          <div className=" backdrop-blur-xl rounded-3xl p-8  border border-white/30 relative z-10">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800">
                {isSignIn ? 'Welcome Back 👋' : 'Join the Community 🚀'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {isSignIn ? 'Sign in to continue' : 'Create your account to get started'}
              </p>
            </div>

           <div className='flex flex-col justify-center'>
             <AnimatePresence  
            
            mode="wait">
              {isSignIn ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                >
                  <SignInForm />
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ duration: 0.4 }}
                >
                  <SignUpForm />
                </motion.div>
              )}
            </AnimatePresence>

           </div>
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                {isSignIn ? "Don't have an account?" : 'Already registered?'}
                <button
                  onClick={() => setIsSignIn(!isSignIn)}
                  className="ml-2 text-indigo-600 font-semibold hover:text-blue-600 transition"
                >
                  {isSignIn ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-gray-400 text-xs mt-6 bottom-12 absolute left-0 right-0 ">
            © {new Date().getFullYear()} MyForum. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
