import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { motion } from 'motion/react';
import { Coins, Trophy, UserPlus, Users, Search, Check, X, Clock, Loader2, UserMinus } from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, query, where, getDocs, doc, 
  getDoc, onSnapshot, arrayUnion, arrayRemove, writeBatch 
} from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Profile() {
  const { profile, user } = useAuthStore();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        // Fetch pending requests details
        if (data.friendRequests && data.friendRequests.length > 0) {
          const reqs = await Promise.all(
            data.friendRequests.map(async (uid: string) => {
              const uSnap = await getDoc(doc(db, 'users', uid));
              return { id: uid, ...uSnap.data() };
            })
          );
          setPendingRequests(reqs);
        } else {
          setPendingRequests([]);
        }

        // Fetch friends details
        if (data.friends && data.friends.length > 0) {
          const frs = await Promise.all(
            data.friends.map(async (uid: string) => {
              const uSnap = await getDoc(doc(db, 'users', uid));
              return { id: uid, ...uSnap.data() };
            })
          );
          setFriendsList(frs);
        } else {
          setFriendsList([]);
        }
        setIsLoadingData(false);
      }
    });

    return () => unsub();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim()));
      const snap = await getDocs(q);
      const results: any[] = [];
      snap.forEach(d => {
        if (d.id !== user?.uid) {
          results.push({ id: d.id, ...d.data() });
        }
      });
      setSearchResults(results);
      if (results.length === 0) toast.error("No user found with that email");
    } catch (error: any) {
      toast.error("Failed to search users");
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', targetUserId), {
        friendRequests: arrayUnion(user.uid)
      });
      batch.update(doc(db, 'users', user.uid), {
        sentRequests: arrayUnion(targetUserId)
      });
      await batch.commit();
      toast.success("Request sent!");
      // Update search results to show requested status
      setSearchResults(prev => prev.map(u => u.id === targetUserId ? { ...u, requested: true } : u));
    } catch (error) {
      toast.error("Failed to send request");
    }
  };

  const acceptFriendRequest = async (senderId: string) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.uid), {
        friends: arrayUnion(senderId),
        friendRequests: arrayRemove(senderId)
      });
      batch.update(doc(db, 'users', senderId), {
        friends: arrayUnion(user.uid),
        sentRequests: arrayRemove(user.uid)
      });
      await batch.commit();
      toast.success("Accepted!");
    } catch (error) {
      toast.error("Failed to accept request");
    }
  };

  const declineFriendRequest = async (senderId: string) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.uid), {
        friendRequests: arrayRemove(senderId)
      });
      batch.update(doc(db, 'users', senderId), {
        sentRequests: arrayRemove(user.uid)
      });
      await batch.commit();
      toast.success("Declined");
    } catch (error) {
      toast.error("Failed to decline request");
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    if (!confirm("Remove this friend?")) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.uid), {
        friends: arrayRemove(friendId)
      });
      batch.update(doc(db, 'users', friendId), {
        friends: arrayRemove(user.uid)
      });
      await batch.commit();
      toast.success("Friend removed");
    } catch (error) {
      toast.error("Failed to remove friend");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <header className="mb-8 mt-4 md:mt-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
          Player Profile
        </h1>
        <p className="text-slate-400">View stats and manage connections</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Profile & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-md flex flex-col items-center text-center shadow-2xl"
          >
            <img src={profile?.avatar} alt="Avatar" className="w-32 h-32 rounded-3xl border-4 border-slate-800 mb-6 shadow-xl" />
            <h2 className="text-2xl font-bold text-white mb-1">{profile?.name}</h2>
            <p className="text-slate-400 mb-6 text-sm flex items-center gap-2">
               {profile?.email}
            </p>

            <div className="w-full space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                 <span className="text-slate-400 text-sm">Level</span>
                 <span className="font-bold text-indigo-400 text-xl">{profile?.level}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                 <span className="text-slate-400 text-sm">Wealth</span>
                 <span className="font-bold text-yellow-500 flex items-center gap-1">
                   <Coins className="w-4 h-4" /> {profile?.coins}
                 </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                 <span className="text-slate-400 text-sm">Wins</span>
                 <span className="font-bold text-green-400 flex items-center gap-1">
                   <Trophy className="w-4 h-4" /> {profile?.wins}
                 </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Friends System */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Find Friends */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-400" /> Find Friends
            </h3>
            <div className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
              <form onSubmit={handleSearch} className="flex gap-3">
                <input 
                  type="email" 
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Enter friend's email..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={isSearching}
                  className="bg-indigo-500 hover:bg-indigo-400 font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-6 space-y-4">
                  {searchResults.map(result => {
                    const isFriend = profile?.friends?.includes(result.id);
                    const isSent = profile?.sentRequests?.includes(result.id) || result.requested;
                    const isPending = profile?.friendRequests?.includes(result.id);

                    return (
                      <div key={result.id} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <img src={result.avatar} alt="" className="w-12 h-12 rounded-xl bg-slate-800" />
                          <div>
                            <p className="font-bold text-white">{result.name}</p>
                            <p className="text-xs text-slate-500">Level {result.level}</p>
                          </div>
                        </div>
                        {isFriend ? (
                          <span className="text-slate-500 text-sm font-medium">Already Friends</span>
                        ) : isSent ? (
                          <span className="text-indigo-400 text-sm font-medium flex items-center gap-1">
                            <Clock className="w-4 h-4" /> Requested
                          </span>
                        ) : isPending ? (
                          <button 
                            onClick={() => acceptFriendRequest(result.id)}
                            className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold"
                          >
                            Accept
                          </button>
                        ) : (
                          <button 
                            onClick={() => sendFriendRequest(result.id)}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" /> Add Friend
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Friend Requests */}
          {pendingRequests.length > 0 && (
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" /> Pending Requests
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRequests.map(req => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={req.id}
                    className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-3xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img src={req.avatar} alt="" className="w-10 h-10 rounded-lg bg-slate-800" />
                      <div>
                        <p className="font-bold text-white text-sm">{req.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Wants to play</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                         onClick={() => acceptFriendRequest(req.id)}
                         className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                         onClick={() => declineFriendRequest(req.id)}
                         className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Friends List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Friends List
              </h3>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{friendsList.length} Connected</span>
            </div>
            
            {isLoadingData ? (
              <div className="py-20 flex justify-center">
                 <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : friendsList.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center text-slate-500 border-dashed">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg">No friends yet.</p>
                <p className="text-sm">Search for friends above to start playing together!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friendsList.map(friend => (
                  <motion.div 
                    whileHover={{ y: -4 }}
                    key={friend.id}
                    className="bg-slate-900/40 border border-white/5 p-4 rounded-3xl backdrop-blur-md flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={friend.avatar} alt="" className="w-12 h-12 rounded-2xl bg-slate-800" />
                        {friend.online && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white">{friend.name}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-slate-500 uppercase font-bold">Level {friend.level}</span>
                           <span className="w-1 h-1 rounded-full bg-slate-700" />
                           <span className={`text-[10px] font-bold uppercase ${friend.online ? 'text-green-500' : 'text-slate-600'}`}>
                             {friend.online ? 'Online' : 'Offline'}
                           </span>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => removeFriend(friend.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-500"
                      title="Remove Friend"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

