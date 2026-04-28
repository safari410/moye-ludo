import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, X, Check, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GlobalListeners() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeInvite, setActiveInvite] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Listen for incoming game invites
    const q = query(
      collection(db, 'invites'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const invite = { id: change.doc.id, ...change.doc.data() };
          setActiveInvite(invite);
          // Auto play sound?
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async () => {
    if (!activeInvite) return;
    try {
      // 1. Update invite status
      await updateDoc(doc(db, 'invites', activeInvite.id), {
        status: 'accepted'
      });

      // 2. Add user to the room
      await updateDoc(doc(db, 'rooms', activeInvite.roomId), {
        players: arrayUnion(user?.uid),
        status: 'ready' // Room becomes ready when invite accepted
      });

      // 3. Clear local state and navigate
      const roomId = activeInvite.roomId;
      setActiveInvite(null);
      navigate(`/room/${roomId}`);
      toast.success("Joined match!");
    } catch (e: any) {
      toast.error("Failed to join match");
    }
  };

  const handleDecline = async () => {
    if (!activeInvite) return;
    try {
      await updateDoc(doc(db, 'invites', activeInvite.id), {
        status: 'declined'
      });
      setActiveInvite(null);
    } catch (e) {}
  };

  return (
    <AnimatePresence>
      {activeInvite && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bottom-8 right-8 z-[100] w-80"
        >
          <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl shadow-2xl shadow-indigo-500/20 backdrop-blur-xl">
             <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                   <img src={activeInvite.fromAvatar} alt="" className="w-12 h-12 rounded-2xl bg-slate-800" />
                   <div className="absolute -top-1 -right-1 bg-indigo-500 p-1 rounded-full border-2 border-slate-900">
                      <Bell className="w-2.5 h-2.5 text-white" />
                   </div>
                </div>
                <div>
                   <h3 className="font-bold text-white text-sm">Challenge Received!</h3>
                   <p className="text-xs text-slate-400"><b>{activeInvite.fromName}</b> wants to battle</p>
                </div>
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={handleAccept}
                  className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                >
                   <Check className="w-4 h-4" /> Accept
                </button>
                <button 
                  onClick={handleDecline}
                  className="px-4 py-2.5 bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                >
                   <X className="w-4 h-4" />
                </button>
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
