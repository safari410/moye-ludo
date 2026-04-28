import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Gamepad2, Play, Swords, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { profile, user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  useEffect(() => {
    // Listen to waiting public rooms mostly for quick join
    const q = query(
      collection(db, 'rooms'), 
      where('status', '==', 'waiting')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rm: any[] = [];
      snapshot.forEach((doc) => rm.push({ id: doc.id, ...doc.data() }));
      setRooms(rm);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async (maxPlayers: number = 4, withAI: boolean = false) => {
    if (!user) return;
    setIsCreating(true);
    setShowAIModal(false);
    try {
      const roomData = {
        name: withAI ? `Battle vs AI (${maxPlayers}P)` : `${profile?.name || 'Player'}'s Arena`,
        hostId: user.uid,
        players: [user.uid],
        maxPlayers,
        withAI,
        status: withAI ? 'ready' : 'waiting',
        entryFee: 0,
        createdAt: serverTimestamp(),
      };
      
      // If AI, add bots
      if (withAI) {
        const bots = Array.from({ length: maxPlayers - 1 }, (_, i) => `ai_bot_${i + 1}`);
        roomData.players = [user.uid, ...bots];
      }

      const roomRef = await addDoc(collection(db, 'rooms'), roomData);
      navigate(`/room/${roomRef.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickJoin = async () => {
     if (rooms.length === 0) {
        toast.error("No available rooms right now. Create one instead!");
        return;
     }
     
     // Find first room with space
     const availableRoom = rooms.find(r => r.players.length < r.maxPlayers);
     if (!availableRoom) {
        toast.error("All rooms are currently full.");
        return;
     }

     try {
       const updates: any = {
         players: arrayUnion(user?.uid)
       }
       if (availableRoom.players.length + 1 === availableRoom.maxPlayers) {
         updates.status = 'ready';
       }
       await updateDoc(doc(db, 'rooms', availableRoom.id), updates);
       navigate(`/room/${availableRoom.id}`);
     } catch(e: any) {
       toast.error(e.message);
     }
  };

  return (
    <div className="p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto w-full">
       <header className="mb-12 mt-4 md:mt-8 text-center">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-4">
            Welcome, {profile?.name || 'Commander'}
          </h1>
          <p className="text-xl text-slate-400">Ready to conquer the cosmic board?</p>
       </header>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleQuickJoin}
            className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl shadow-indigo-500/20 border border-white/10 group h-64"
          >
             <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Play className="w-8 h-8 text-white fill-current" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Quick Match</h2>
             <p className="text-white/80 text-center text-sm">Jump into any 4-player battle.</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAIModal(true)}
            disabled={isCreating}
            className="flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-3xl border border-white/5 shadow-xl hover:bg-slate-800 transition-colors group disabled:opacity-50 h-64"
          >
             <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-indigo-500/20 group-hover:border-indigo-500/50">
                <Gamepad2 className="w-8 h-8 text-white" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">VS Computer</h2>
             <p className="text-slate-400 text-center text-sm">Practice against AI bots.</p>
          </motion.button>

          <div className="flex flex-col gap-3 h-64">
             <button 
               onClick={() => handleCreateRoom(2)}
               className="flex-1 flex items-center justify-center gap-3 bg-slate-900/50 border border-white/5 rounded-2xl hover:bg-slate-800 transition-all font-bold text-white"
             >
               <Users className="w-5 h-5 text-blue-400" /> 2 Players
             </button>
             <button 
               onClick={() => handleCreateRoom(3)}
               className="flex-1 flex items-center justify-center gap-3 bg-slate-900/50 border border-white/5 rounded-2xl hover:bg-slate-800 transition-all font-bold text-white"
             >
                <Users className="w-5 h-5 text-purple-400" /> 3 Players
             </button>
             <button 
               onClick={() => handleCreateRoom(4)}
               className="flex-1 flex items-center justify-center gap-3 bg-slate-900/50 border border-white/5 rounded-2xl hover:bg-slate-800 transition-all font-bold text-white"
             >
                <Users className="w-5 h-5 text-indigo-400" /> 4 Players
             </button>
          </div>
       </div>

       <div className="mt-12 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
             onClick={() => navigate('/rooms')}
             className="py-6 bg-slate-900/50 hover:bg-slate-800 text-white rounded-3xl font-bold transition-all group border border-white/5 flex flex-col items-center justify-center gap-2"
           >
             <Swords className="w-8 h-8 text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
             <span className="text-lg">Public Lobby</span>
             <p className="text-xs text-slate-500 font-normal">Browse {rooms.length} arenas</p>
           </button>

           <button 
             onClick={() => navigate('/users')}
             className="py-6 bg-slate-900/50 hover:bg-slate-800 text-white rounded-3xl font-bold transition-all group border border-white/5 flex flex-col items-center justify-center gap-2"
           >
             <Users className="w-8 h-8 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
             <span className="text-lg">All Commanders</span>
             <p className="text-xs text-slate-500 font-normal">Connect or challenge anyone</p>
           </button>
       </div>

       {/* AI Selection Modal */}
       <AnimatePresence>
         {showAIModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
             >
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-white">Select Opponents</h2>
                 <button onClick={() => setShowAIModal(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
                    <X className="w-6 h-6" />
                 </button>
               </div>
               
               <p className="text-slate-400 mb-8">How many computer players do you want to challenge?</p>

               <div className="grid grid-cols-1 gap-4">
                 {[2, 3, 4].map(num => (
                   <button 
                    key={num}
                    onClick={() => handleCreateRoom(num, true)}
                    className="group bg-white/5 hover:bg-indigo-500 p-4 rounded-2xl border border-white/5 transition-all text-left flex items-center justify-between"
                   >
                     <div>
                       <span className="block font-bold text-white group-hover:text-white">{num} Player Mode</span>
                       <span className="text-sm text-slate-500 group-hover:text-indigo-100">{num - 1} Computer Players</span>
                     </div>
                     <Plus className="w-5 h-5 text-indigo-400 group-hover:text-white" />
                   </button>
                 ))}
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
}
