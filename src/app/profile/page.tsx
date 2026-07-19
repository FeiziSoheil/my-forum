import { redirect } from 'next/navigation';

export default function ProfilePage() {
  // Redirect to posts by default
  redirect('/profile/posts');
}