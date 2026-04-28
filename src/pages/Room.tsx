import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion } from 'motion/react';
import { ArrowLeft, Play, User as UserIcon, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Firebase Error: ${operationType} on ${path}`);
  throw new Error(JSON.stringify(errInfo));
}

export default function Room() {
  const { roomId } = useParams<{roomId: string}>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [room, setRoom] = useState<any>(null);
  const [playersInfo, setPlayersInfo] = useState<any[]>([]);

  useEffect(() => {
    if (!roomId) return;
    
    const unsubscribe = onSnapshot(doc(db, 'rooms', roomId), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoom(data);
        
        if (data.status === 'playing') {
           navigate(`/game/${roomId}`); // The roomId will map 1:1 to gameId for simplicity
        }

        // Fetch user basic infos
        const pInfos = await Promise.all(data.players.map(async (pid: string) => {
          if (pid.startsWith('ai_')) {
            return { 
              id: pid, 
              name: `Bot ${pid.split('_').pop()}`, 
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${pid}`,
              online: true
            };
          }
          const uSnap = await getDoc(doc(db, 'users', pid));
          return uSnap.exists() ? { id: pid, ...uSnap.data()} : null;
        }));
        setPlayersInfo(pInfos.filter(Boolean));
      } else {
        toast.error("Room closed");
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [roomId, navigate]);

  useEffect(() => {
    if (room && room.status === 'ready' && room.hostId === user?.uid) {
      handleStartGame();
    }
  }, [room, user?.uid]);

  const handleStartGame = async () => {
    if (!room || room.hostId !== user?.uid) return;
    if (room.players.length < 2) {
      toast.error("Need at least 2 players");
      return;
    }

    try {
      // 1. Create a game state document using the roomId as the gameId for structural simplicity
      const gameRef = doc(db, 'games', roomId as string);
      
      // Setup initial board state
      const tokensPosition: Record<string, string> = {};
      
      room.players.forEach((pid: string) => {
        tokensPosition[`${pid}_1`] = 'base';
        tokensPosition[`${pid}_2`] = 'base';
        tokensPosition[`${pid}_3`] = 'base';
        tokensPosition[`${pid}_4`] = 'base';
      });

      try {
        await setDoc(gameRef, {
          roomId: roomId,
          currentTurn: room.players[0],
          diceValue: 0,
          consecutiveSixes: 0,
          players: room.players,
          tokensPosition,
          status: 'playing',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `games/${roomId}`);
      }

      try {
        await updateDoc(doc(db, 'rooms', roomId as string), {
          status: 'playing',
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
      }
    } catch(e: any) {
      console.error(e);
    }
  };

  if (!room) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl relative">
        <button onClick={() => navigate('/')} className="absolute left-0 top-0 p-3 bg-slate-900/50 hover:bg-slate-800 text-white rounded-full transition-colors border border-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="mt-20 flex flex-col items-center text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-sm font-medium border border-indigo-500/20 mb-4 cursor-pointer hover:bg-indigo-500/20 transition-colors"
                onClick={() => { navigator.clipboard.writeText(roomId || ''); toast.success("ID Copied!"); }}
          >
            Room ID: {roomId} <Copy className="w-3 h-3" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
            {room.name}
          </h1>
          <p className="text-slate-400">Waiting for players... ({room.players.length}/{room.maxPlayers})</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {[...Array(room.maxPlayers)].map((_, idx) => {
            const player = playersInfo[idx];
            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                key={idx} 
                className="aspect-square bg-slate-900/50 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden group"
              >
                {player ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img src={player.avatar} alt="P" className="w-16 h-16 rounded-full mb-3 ring-4 ring-slate-800" />
                    <span className="font-medium text-sm text-center">{player.name}</span>
                    {player.id === room.hostId && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 mt-1">Host</span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mb-3">
                      <UserIcon className="w-6 h-6 text-slate-700" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">Open Slot</span>
                  </>
                )}
              </motion.div>
            )
          })}
        </div>

        {user?.uid === room.hostId ? (
          <div className="flex justify-center">
             <button 
                onClick={handleStartGame}
                disabled={room.players.length < 2}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-transform transform active:scale-95 shadow-xl shadow-indigo-500/25 disabled:opacity-50 disabled:scale-100"
              >
                <Play className="w-6 h-6 fill-current" />
                Start Match
              </button>
          </div>
        ) : (
          <div className="text-center text-slate-400">
            Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  );
}
