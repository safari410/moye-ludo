/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';
import { auth, db } from './lib/firebase';
import { useAuthStore } from './store/authStore';

// Layout
import AppLayout from './layouts/AppLayout';

// Pages
import AuthPage from './pages/Auth';
import Home from './pages/Home';
import Room from './pages/Room';
import Game from './pages/Game';
import RoomsList from './pages/RoomsList';
import UsersList from './pages/UsersList';
import Profile from './pages/Profile';
import GlobalListeners from './components/GlobalListeners';

export default function App() {
  const { user, setUser, setProfile, setLoading, loading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create profile
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const snapshot = await getDoc(profileRef);
        if (snapshot.exists()) {
          setProfile(snapshot.data() as any);
        } else {
          // Initialize new user
          const newProfile = {
            name: firebaseUser.displayName || 'Player',
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            coins: 1000,
            level: 1,
            wins: 0,
            losses: 0,
            friends: [],
            friendRequests: [],
            sentRequests: [],
            online: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile as any);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
        <GlobalListeners />
        <Routes>
          <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
          
          <Route element={user ? <AppLayout /> : <Navigate to="/auth" />}>
            <Route path="/" element={<Home />} />
            <Route path="/rooms" element={<RoomsList />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route path="/room/:roomId" element={user ? <Room /> : <Navigate to="/auth" />} />
          <Route path="/game/:gameId" element={user ? <Game /> : <Navigate to="/auth" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
