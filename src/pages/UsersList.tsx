import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, doc, addDoc, serverTimestamp, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion } from 'motion/react';
import { Users, Search, Swords, Shield, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersList() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const u: any[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== user?.uid) {
          u.push({ id: doc.id, ...doc.data() });
        }
      });
      setUsers(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const sendInvite = async (targetUser: any) => {
    try {
      // Create a room first (hidden from public list temporarily)
      const roomRef = await addDoc(collection(db, 'rooms'), {
        name: `${profile?.name} vs ${targetUser.name}`,
        hostId: user?.uid,
        players: [user?.uid],
        maxPlayers: 2,
        status: 'inviting',
        createdAt: serverTimestamp()
      });

      // Create the invite notification
      await addDoc(collection(db, 'invites'), {
        fromId: user?.uid,
        fromName: profile?.name,
        fromAvatar: profile?.avatar,
        toId: targetUser.id,
        roomId: roomRef.id,
        status: 'pending',
        type: 'game_invite',
        createdAt: serverTimestamp()
      });

      toast.success(`Invite sent to ${targetUser.name}!`);
      navigate(`/room/${roomRef.id}`);
    } catch (e: any) {
      toast.error("Failed to send invite");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <header className="mb-12 mt-4 md:mt-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
          Global Commanders
        </h1>
        <p className="text-slate-400">Battle any player in the Aether network</p>
      </header>

      <div className="mb-8 relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input 
           type="text" 
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           placeholder="Search commanders by name or email..." 
           className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((u, idx) => (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.03 }}
               key={u.id}
               className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex flex-col group hover:bg-slate-900/60 transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                 <div className="relative">
                    <img src={u.avatar} alt="" className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-white/5" />
                    {u.online && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full shadow-lg" />}
                 </div>
                 <div>
                    <h3 className="font-bold text-white text-lg">{u.name}</h3>
                    <div className="flex items-center gap-2">
                       <Shield className="w-3.5 h-3.5 text-indigo-400" />
                       <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Level {u.level}</span>
                    </div>
                 </div>
              </div>

              <div className="flex gap-2">
                 <button 
                  onClick={() => sendInvite(u)}
                  className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                 >
                   <Swords className="w-4 h-4" /> Challenge
                 </button>
                 <button 
                  onClick={() => toast("Messaging coming soon!", { icon: '💬' })}
                  className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
                 >
                    <MessageCircle className="w-5 h-5" />
                 </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
