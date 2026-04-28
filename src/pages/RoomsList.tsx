import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion } from 'motion/react';
import { Users, Gamepad2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RoomsList() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    // Listen to waiting public rooms
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

  const handleJoinRoom = async (roomId: string, maxPlayers: number, currentPlayers: number) => {
    if (currentPlayers >= maxPlayers) {
      toast.error("Room is full");
      return;
    }
    try {
      const updates: any = {
        players: arrayUnion(user?.uid)
      };
      if (currentPlayers + 1 === maxPlayers) {
        updates.status = 'ready';
      }
      await updateDoc(doc(db, 'rooms', roomId), updates);
      navigate(`/room/${roomId}`);
    } catch(e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <header className="mb-8 mt-4 md:mt-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
          Active Rooms
        </h1>
        <p className="text-slate-400">Browse and join open arenas</p>
      </header>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input 
           type="text" 
           placeholder="Search arenas by name..." 
           className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={room.id}
            className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-md hover:bg-slate-900/60 transition-colors group flex flex-col"
          >
            <div className="flex justify-between items-start mb-6 flex-1">
              <div>
                <h3 className="font-bold text-xl text-white mb-2">{room.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Users className="w-4 h-4" />
                  {room.players.length} / {room.maxPlayers} Players
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-500/20">
                Free
              </div>
            </div>
            <button 
              onClick={() => handleJoinRoom(room.id, room.maxPlayers, room.players.length)}
              className="w-full py-3 bg-white/5 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all group-hover:shadow-lg group-hover:shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Gamepad2 className="w-5 h-5" />
              Join Match
            </button>
          </motion.div>
        ))}
        {rooms.length === 0 && (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-500 border border-dashed border-white/10 rounded-3xl">
            <Gamepad2 className="w-16 h-16 mb-4 opacity-50 text-indigo-500" />
            <p className="text-lg">No active arenas found.</p>
            <p className="text-sm mt-1">Check back later or create your own from the Dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
