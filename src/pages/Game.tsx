import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp, arrayUnion, runTransaction } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, LogOut, Navigation, Send, Trophy, Smile } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPlayerPath, SAFE_ZONE_COORDS } from '../lib/ludoEngine';
import { EmojiPicker } from '../components/EmojiPicker';

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
  toast.error(`Game Error: ${operationType} on ${path}`);
}

export default function Game() {
  const { gameId } = useParams<{gameId: string}>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user || !gameId) return;

    try {
      await updateDoc(doc(db, 'games', gameId), {
        chatMessages: arrayUnion({
          senderId: user.uid,
          senderName: profile?.name || 'Player',
          text: chatMessage.trim(),
          timestamp: Date.now()
        })
      });
      setChatMessage("");
      setShowEmoji(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `games/${gameId}/chat`);
    }
  };

  const [showRules, setShowRules] = useState(false);
  const [tokenCoords, setTokenCoords] = useState<any[]>([]);

  const [isRolling, setIsRolling] = useState(false);
  const [visualDice, setVisualDice] = useState<number | null>(null);
  const prevDiceRef = useRef<number | null>(null);

  useEffect(() => {
    if (game?.diceValue && game.diceValue !== prevDiceRef.current) {
      let count = 0;
      const maxCount = 8;
      const interval = setInterval(() => {
        setVisualDice(Math.floor(Math.random() * 6) + 1);
        setIsRolling(true);
        count++;
        if (count >= maxCount) {
          clearInterval(interval);
          setVisualDice(game.diceValue);
          setIsRolling(false);
        }
      }, 80);
    } else if (!game?.diceValue) {
      setVisualDice(null);
      setIsRolling(false);
    }
    prevDiceRef.current = game?.diceValue;
  }, [game?.diceValue]);

  const [animatingToken, setAnimatingToken] = useState<{ id: string, path: any[], currentStep: number } | null>(null);
  const prevTokensRef = useRef<any>(null);

  useEffect(() => {
    if (game?.tokensPosition && prevTokensRef.current) {
      const movedTokenId = Object.keys(game.tokensPosition).find(
        id => game.tokensPosition[id] !== prevTokensRef.current[id]
      );

      if (movedTokenId) {
        const from = prevTokensRef.current[movedTokenId];
        const to = game.tokensPosition[movedTokenId];
        
        if (typeof from === 'number' && typeof to === 'number' && to > from) {
          const pid = movedTokenId.split('_')[0];
          const pIdx = game.players.indexOf(pid);
          const fullPath = getPlayerPath(pIdx);
          const steps = [];
          for (let i = from; i <= to; i++) {
             steps.push(i);
          }
          setAnimatingToken({ id: movedTokenId, path: steps, currentStep: 0 });
        } else if (from === 'base' && typeof to === 'number') {
           setAnimatingToken({ id: movedTokenId, path: ['base', 0], currentStep: 0 });
        } else {
           setAnimatingToken(null);
        }
      }
    }
    prevTokensRef.current = game?.tokensPosition;
  }, [game?.tokensPosition, game?.players]);

  useEffect(() => {
    if (animatingToken) {
      const timer = setTimeout(() => {
        if (animatingToken.currentStep < animatingToken.path.length - 1) {
          setAnimatingToken({
            ...animatingToken,
            currentStep: animatingToken.currentStep + 1
          });
        } else {
          setAnimatingToken(null);
        }
      }, 200); 
      return () => clearTimeout(timer);
    }
  }, [animatingToken]);

  const checkWinner = (tokens: any, players: string[]) => {
    for (const pid of players) {
      if (pid.startsWith('empty_')) continue;
      let finishedCount = 0;
      for (let i = 1; i <= 4; i++) {
        if (tokens[`${pid}_${i}`] === 'finished') finishedCount++;
      }
      if (finishedCount === 4) return pid;
    }
    return null;
  };

  const getNextTurnIdx = (currentIndex: number) => {
    let nextIdx = (currentIndex + 1) % game.players.length;
    while (game.players[nextIdx].startsWith('empty_')) {
      nextIdx = (nextIdx + 1) % game.players.length;
    }
    return nextIdx;
  };

  const moveToken = async (tokenId: string) => {
    if (!game || game.currentTurn !== user?.uid || !game.diceValue || animatingToken) return;

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'games', gameId as string);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game not found";

        const serverGame = gameDoc.data();
        if (serverGame.currentTurn !== user?.uid || !serverGame.diceValue) {
           throw "Not your turn or no dice value!";
        }

        const lastUnderscore = tokenId.lastIndexOf('_');
        const pid = tokenId.substring(0, lastUnderscore);
        if (pid !== user.uid) throw "Not your token!";

        const currentPos = serverGame.tokensPosition[tokenId];
        const dice = serverGame.diceValue;
        
        console.log("--- MOVE ATTEMPT ---");
        console.log("currentTurn:", serverGame.currentTurn);
        console.log("diceValue:", dice);
        console.log("tokenPositions BEFORE:", JSON.parse(JSON.stringify(serverGame.tokensPosition)));

        let nextPos: any = currentPos;

        let tokenFinished = false;
        if (currentPos === 'base') {
          if (dice === 6) nextPos = 0;
          else throw "Cannot move from base without a 6!"; 
        } else if (currentPos === 'finished') {
          throw "Token already finished!";
        } else {
          const pIdx = serverGame.players.indexOf(pid);
          if (pIdx === -1) throw "Player not found";
          const playerPath = getPlayerPath(pIdx);
          if (currentPos + dice > playerPath.length) {
            throw "Need exact roll to finish!";
          } else if (currentPos + dice === playerPath.length) {
            nextPos = 'finished';
            tokenFinished = true;
          } else {
            nextPos = currentPos + dice;
          }
        }

        const newTokens = { ...serverGame.tokensPosition, [tokenId]: nextPos };
        
        console.log("tokenPositions AFTER:", JSON.parse(JSON.stringify(newTokens)));
        console.log("--- END MOVE ---");

        const pIdx = serverGame.players.indexOf(pid);
        const playerPath = getPlayerPath(pIdx);
        
        let captureHappened = false;
        if (typeof nextPos === 'number') {
          const targetCoord = playerPath[nextPos];
          const isSafe = SAFE_ZONE_COORDS.some(c => c[0] === targetCoord[0] && c[1] === targetCoord[1]);

          if (!isSafe) {
            Object.entries(newTokens).forEach(([tid, pos]) => {
              const otherLastUnderscore = tid.lastIndexOf('_');
              const otherPid = tid.substring(0, otherLastUnderscore);
              
              if (otherPid === pid || pos === 'base' || pos === 'finished') return;
              
              const otherPIdx = serverGame.players.indexOf(otherPid);
              const otherPath = getPlayerPath(otherPIdx);
              const otherCoord = otherPath[pos as number];
              
              if (otherCoord[0] === targetCoord[0] && otherCoord[1] === targetCoord[1]) {
                newTokens[tid] = 'base';
                captureHappened = true;
              }
            });
          }
        }

        const winner = checkWinner(newTokens, serverGame.players);
        const pCurrentIdx = serverGame.players.indexOf(pid);
        
        const getNextTurn = (currentIndex: number) => {
          let nextIdx = (currentIndex + 1) % serverGame.players.length;
          while (serverGame.players[nextIdx].startsWith('empty_')) {
            nextIdx = (nextIdx + 1) % serverGame.players.length;
          }
          return nextIdx;
        };
        
        const nextTurnIdx = (dice === 6 || captureHappened || tokenFinished) ? pCurrentIdx : getNextTurn(pCurrentIdx);

        transaction.update(gameRef, {
          tokensPosition: newTokens,
          diceValue: null,
          consecutiveSixes: (dice === 6 || captureHappened) ? (serverGame.consecutiveSixes || 0) : 0,
          currentTurn: winner ? pid : serverGame.players[nextTurnIdx],
          status: winner ? 'finished' : 'playing',
          winner: winner || null,
          updatedAt: serverTimestamp()
        });
      });
      console.log('Transaction success');
    } catch (err: any) {
      console.error("Move error:", err);
      // Just catch, don't show toast for every click since they might double click
    }
  };

  // Cache for profile data
  const [profileCache, setProfileCache] = useState<Record<string, any>>({});

  // Listen to game state
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'games', gameId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGame(data);
        
        // Fetch missing player details
        const missingPids = data.players.filter((pid: string) => !profileCache[pid]);
        
        if (missingPids.length > 0) {
          const newProfiles = { ...profileCache };
          await Promise.all(
            missingPids.map(async (pid: string) => {
              if (pid.startsWith('ai_')) {
                newProfiles[pid] = { 
                  id: pid, 
                  name: `Bot ${pid.split('_').pop()}`, 
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${pid}`,
                  online: true,
                  level: '?'
                };
              } else {
                try {
                  const up = await getDoc(doc(db, 'users', pid));
                  if (up.exists()) {
                    newProfiles[pid] = { id: pid, ...up.data() };
                  } else {
                    newProfiles[pid] = { id: pid, name: 'Guest', avatar: '', online: false };
                  }
                } catch (err) {
                  console.error("Error fetching user profile:", pid, err);
                }
              }
            })
          );
          setProfileCache(newProfiles);
          setPlayers(data.players.map((pid: string) => newProfiles[pid]));
        } else {
          setPlayers(data.players.map((pid: string) => profileCache[pid]));
        }
      }
    }, (error) => {
      // Don't show toast for offline, it might be transient
      if (error.code !== 'unavailable') {
        handleFirestoreError(error, OperationType.GET, `games/${gameId}`);
      }
    });

    return () => unsub();
  }, [gameId, profileCache]);

  // AI Turn Logic (Host handles AI turns)
  useEffect(() => {
    if (!game || game.status !== 'playing' || !game.currentTurn.startsWith('ai_')) return;
    
    // Only host (or first human player) executes AI logic to prevent multiple executions
    const hostId = players.find(p => !p.id.startsWith('ai_'))?.id;
    if (user?.uid !== hostId) return;

    const aiTimeout = setTimeout(async () => {
      try {
        const pid = game.currentTurn;
        if (!pid || !pid.startsWith('ai')) return;

        const pIdx = game.players.indexOf(pid);
        const tokens = game.tokensPosition;
        if (pIdx === -1) return;

        if (game.diceValue === null) {
          // AI Rolls
          let val = Math.floor(Math.random() * 6) + 1;
          
          let consecutive = (game.consecutiveSixes || 0);
          if (val === 6) consecutive++; else consecutive = 0;

          if (consecutive === 3) {
             const nextIdx = getNextTurnIdx(game.players.indexOf(pid));
             await updateDoc(doc(db, 'games', gameId as string), {
               diceValue: val,
               consecutiveSixes: 0,
               currentTurn: game.players[nextIdx],
               updatedAt: serverTimestamp()
             });
             setTimeout(() => {
               if (gameId) updateDoc(doc(db, 'games', gameId), { diceValue: null });
             }, 1500);
             return;
          }

          const movableTokens = Object.keys(tokens).filter(tid => {
            const lastIdx = tid.lastIndexOf('_');
            if (tid.substring(0, lastIdx) !== pid) return false;
            const pos = tokens[tid];
            if (pos === 'finished') return false;
            if (pos === 'base') return val === 6;
            return pos + val <= getPlayerPath(pIdx).length;
          });

          if (movableTokens.length === 0) {
             const nextIdx = val === 6 ? game.players.indexOf(pid) : getNextTurnIdx(game.players.indexOf(pid));
             await updateDoc(doc(db, 'games', gameId as string), {
               diceValue: val,
               consecutiveSixes: val === 6 ? consecutive : 0,
               currentTurn: game.players[nextIdx],
               updatedAt: serverTimestamp()
             });
             setTimeout(() => {
               if (gameId) updateDoc(doc(db, 'games', gameId), { diceValue: null });
             }, 1500);
             return;
          }

          await updateDoc(doc(db, 'games', gameId as string), {
            diceValue: val,
            consecutiveSixes: consecutive,
            updatedAt: serverTimestamp()
          });
        } else {
          // AI Moves
          const val = game.diceValue;
          const movableTokens = Object.keys(tokens).filter(tid => {
            const lastIdx = tid.lastIndexOf('_');
            if (tid.substring(0, lastIdx) !== pid) return false;
            const pos = tokens[tid];
            if (pos === 'finished') return false;
            if (pos === 'base') return val === 6;
            return pos + val <= getPlayerPath(pIdx).length;
          });

          let nextTokens = { ...tokens };
          let captureHappened = false;

          let tokenFinished = false;
          if (movableTokens.length > 0) {
            const chosenToken = movableTokens.sort((a, b) => {
              const posA = tokens[a] === 'base' ? -1 : tokens[a];
              const posB = tokens[b] === 'base' ? -1 : tokens[b];
              return (posB as number) - (posA as number);
            })[0];

            let nextPos: any = tokens[chosenToken];
            if (nextPos === 'base') nextPos = 0;
            else {
               nextPos += val;
               if (nextPos === getPlayerPath(pIdx).length) {
                 nextPos = 'finished';
                 tokenFinished = true;
               }
            }
            nextTokens[chosenToken] = nextPos;

            if (typeof nextPos === 'number') {
              const playerPath = getPlayerPath(pIdx);
              const targetCoord = playerPath[nextPos];
              if (targetCoord) {
                const isSafe = SAFE_ZONE_COORDS.some(c => c[0] === targetCoord[0] && c[1] === targetCoord[1]);
                if (!isSafe) {
                  Object.entries(nextTokens).forEach(([tid, pos]) => {
                    const oLastIdx = tid.lastIndexOf('_');
                    const oPid = tid.substring(0, oLastIdx);
                    
                    if (oPid === pid || pos === 'base' || pos === 'finished') return;
                    
                    const otherPIdx = game.players.indexOf(oPid);
                    const otherPath = getPlayerPath(otherPIdx);
                    const otherCoord = otherPath[pos as number];
                    
                    if (otherCoord && otherCoord[0] === targetCoord[0] && otherCoord[1] === targetCoord[1]) {
                      nextTokens[tid] = 'base';
                      captureHappened = true;
                    }
                  });
                }
              }
            }
          }

          const winner = checkWinner(nextTokens, game.players);
          const pCurrentIdx = game.players.indexOf(pid);
          const nextTurnIdx = (val === 6 || captureHappened || tokenFinished) ? pCurrentIdx : getNextTurnIdx(pCurrentIdx);

          await updateDoc(doc(db, 'games', gameId as string), {
            tokensPosition: nextTokens,
            diceValue: null,
            currentTurn: winner ? pid : game.players[nextTurnIdx],
            status: winner ? 'finished' : 'playing',
            winner: winner || null,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error("AI turn error:", err);
      }
    }, game.diceValue ? 2500 : 1500);

    return () => clearTimeout(aiTimeout);
  }, [game?.currentTurn, game?.status, players, user?.uid, gameId]);

  // Canvas drawing loop
  useEffect(() => {
    if (!canvasRef.current || !game) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const size = Math.min(canvas.width, canvas.height);
      const cellSize = size / 15;
      
      // Background base
      ctx.fillStyle = '#0f172a'; 
      ctx.fillRect(0, 0, size, size);

      const colors = {
        red: { main: '#ef4444', light: '#fca5a5', dark: '#991b1b', bg: '#450a0a' },
        green: { main: '#22c55e', light: '#86efac', dark: '#166534', bg: '#052e16' },
        yellow: { main: '#eab308', light: '#fde047', dark: '#854d0e', bg: '#422006' },
        blue: { main: '#3b82f6', light: '#93c5fd', dark: '#1e40af', bg: '#172554' },
        neutral: { main: '#1e293b', border: '#334155' }
      };

      // Draw Grid helper
      const drawCell = (r: number, c: number, color: string, isSafe: boolean = false, arrow: string = null) => {
        const x = c * cellSize;
        const y = r * cellSize;
        
        ctx.fillStyle = colors.neutral.main;
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = colors.neutral.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        if (color) {
          const grad = ctx.createLinearGradient(x, y, x+cellSize, y+cellSize);
          grad.addColorStop(0, color);
          grad.addColorStop(1, color + 'aa');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        }

        if (isSafe) {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const outerRadius = cellSize * 0.35;
          const innerRadius = cellSize * 0.15;
          const spikes = 5;

          ctx.shadowBlur = 8;
          ctx.shadowColor = '#fbbf24';
          ctx.fillStyle = '#fcd34d';

          ctx.beginPath();
          let rot = (Math.PI / 2) * 3;
          let step = Math.PI / spikes;

          ctx.moveTo(cx, cy - outerRadius);
          for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
            rot += step;
          }
          ctx.lineTo(cx, cy - outerRadius);
          ctx.closePath();
          ctx.fill();

          ctx.shadowBlur = 0;
        }

        if (arrow) {
          ctx.fillStyle = '#ffffff40';
          ctx.font = `${cellSize * 0.6}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(arrow, x + cellSize/2, y + cellSize/2);
        }
      };

      // Draw Paths
      for(let i=0; i<3; i++) {
        for(let j=0; j<6; j++) {
           // Green (Top)
           drawCell(j, 6+i, i === 1 && j > 0 ? colors.green.main : null, false, i === 1 && j === 0 ? '↓' : null);
           // Blue (Bottom)
           drawCell(9+j, 6+i, i === 1 && j < 5 ? colors.blue.main : null, false, i === 1 && j === 5 ? '↑' : null);
           // Red (Left)
           drawCell(6+i, j, i === 1 && j > 0 ? colors.red.main : null, false, i === 1 && j === 0 ? '→' : null);
           // Yellow (Right)
           drawCell(6+i, 9+j, i === 1 && j < 5 ? colors.yellow.main : null, false, i === 1 && j === 5 ? '←' : null);
        }
      }

      // Safe spots (Stars)
      const safeSpots = [
        { r: 6, c: 1, color: colors.red.main },
        { r: 1, c: 8, color: colors.green.main },
        { r: 8, c: 13, color: colors.yellow.main },
        { r: 13, c: 6, color: colors.blue.main },
        { r: 8, c: 2, color: null },
        { r: 6, c: 12, color: null },
        { r: 2, c: 6, color: null },
        { r: 12, c: 8, color: null }
      ];

      safeSpots.forEach(s => drawCell(s.r, s.c, s.color || '', true));

      // Home Bases
      const bases = [
        { r: 0, c: 0, color: colors.red },
        { r: 0, c: 9, color: colors.green },
        { r: 9, c: 9, color: colors.yellow },
        { r: 9, c: 0, color: colors.blue }
      ];

      bases.forEach(b => {
        const bx = b.c * cellSize;
        const by = b.r * cellSize;
        const bs = 6 * cellSize;

        // Base glow
        const grad = ctx.createLinearGradient(bx, by, bx+bs, by+bs);
        grad.addColorStop(0, b.color.dark);
        grad.addColorStop(1, b.color.main);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(bx, by, bs, bs, 20);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#0f172a80';
        ctx.beginPath();
        ctx.arc(bx + bs/2, by + bs/2, bs/2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Token slots
        const slotPositions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        slotPositions.forEach(pos => {
          ctx.fillStyle = '#ffffff10';
          ctx.beginPath();
          ctx.arc(bx + bs/2 + pos[0]*cellSize*1.4, by + bs/2 + pos[1]*cellSize*1.4, cellSize*0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = b.color.light + '40';
          ctx.stroke();
        });
      });

      // Center Triangle
      const cx = 7.5 * cellSize;
      const cy = 7.5 * cellSize;
      
      const drawTriangle = (p1: any, p2: any, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();
        ctx.fill();
      };

      drawTriangle({x: 6*cellSize, y: 6*cellSize}, {x: 6*cellSize, y: 9*cellSize}, colors.red.main);
      drawTriangle({x: 6*cellSize, y: 6*cellSize}, {x: 9*cellSize, y: 6*cellSize}, colors.green.main);
      drawTriangle({x: 9*cellSize, y: 6*cellSize}, {x: 9*cellSize, y: 9*cellSize}, colors.yellow.main);
      drawTriangle({x: 6*cellSize, y: 9*cellSize}, {x: 9*cellSize, y: 9*cellSize}, colors.blue.main);

      // Draw Tokens
      const currentTokenCoords: any[] = [];
      if (game.tokensPosition) {
        Object.entries(game.tokensPosition).forEach(([tokenId, position]) => {
          const lastUnderscore = tokenId.lastIndexOf('_');
          const pid = tokenId.substring(0, lastUnderscore);
          const tNum = tokenId.substring(lastUnderscore + 1);
          
          const playerIdx = game.players.indexOf(pid);
          if (playerIdx === -1) return;

          const themeColor = [colors.red, colors.green, colors.yellow, colors.blue][playerIdx];
          const tIdx = parseInt(tNum) - 1;

          let px = 0, py = 0;
          let displayPos = position;

          // If this token is animating, override display position
          if (animatingToken && animatingToken.id === tokenId) {
            displayPos = animatingToken.path[animatingToken.currentStep];
          }

          if (displayPos === 'base') {
            const baseMap = [{r:0, c:0}, {r:0, c:9}, {r:9, c:9}, {r:9, c:0}];
            const b = baseMap[playerIdx];
            const slotPositions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
            px = (b.c + 3) * cellSize + slotPositions[tIdx][0]*cellSize*1.4;
            py = (b.r + 3) * cellSize + slotPositions[tIdx][1]*cellSize*1.4;
          } else if (displayPos === 'finished') {
             px = cx;
             py = cy;
          } else {
             const path = getPlayerPath(playerIdx);
             const coord = path[displayPos as number];
             px = coord[1] * cellSize + cellSize / 2;
             py = coord[0] * cellSize + cellSize / 2;

             // Handle overlapping tokens at the same spot
             const othersAtSamePos = Object.entries(game.tokensPosition).filter(([tid, pos]) => 
               tid !== tokenId && 
               pos !== 'base' && pos !== 'finished' &&
               JSON.stringify(path[pos as number]) === JSON.stringify(coord)
             );
             
             if (othersAtSamePos.length > 0) {
               const offsetIdx = othersAtSamePos.findIndex(([tid]) => tid === tokenId) + 1;
               px += (offsetIdx % 2 === 0 ? 1 : -1) * cellSize * 0.15;
               py += (offsetIdx > 2 ? 1 : -1) * cellSize * 0.15;
             }
          }

          if (px && py) {
            currentTokenCoords.push({ id: tokenId, x: px, y: py });
            
            // Animation scale
            const isTargeted = animatingToken && animatingToken.id === tokenId;
            const tokenScale = isTargeted ? 1.2 : 1;

            // Shadow
            ctx.shadowBlur = 15;
            ctx.shadowColor = themeColor.main;
            
            // Outer layer
            const grad = ctx.createRadialGradient(px, py-2, 0, px, py-2, cellSize*0.5 * tokenScale);
            grad.addColorStop(0, themeColor.light);
            grad.addColorStop(0.5, themeColor.main);
            grad.addColorStop(1, themeColor.dark);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py - 4, cellSize*0.45 * tokenScale, 0, Math.PI*2);
            ctx.fill();
            
            // Gloss effect
            ctx.fillStyle = '#ffffff40';
            ctx.beginPath();
            ctx.arc(px - cellSize*0.1, py - cellSize*0.2, cellSize*0.15 * tokenScale, 0, Math.PI*2);
            ctx.fill();

            // Label for AI tokens
            if (pid.startsWith('ai')) {
              ctx.fillStyle = 'rgba(0,0,0,0.3)';
              ctx.font = `bold ${cellSize * 0.4}px Inter`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('A', px, py - 4);
            }

            // Highlight if movable (Only if NOT animating)
            if (!animatingToken && pid === user?.uid && game.currentTurn === user?.uid && game.diceValue) {
               const canMove = position === 'base' ? game.diceValue === 6 : (position + game.diceValue <= getPlayerPath(playerIdx).length);
               
               if (canMove) {
                 ctx.strokeStyle = '#fff';
                 ctx.lineWidth = 3;
                 ctx.setLineDash([5, 5]);
                 ctx.beginPath();
                 ctx.arc(px, py - 4, cellSize * 0.6, 0, Math.PI * 2);
                 ctx.stroke();
                 ctx.setLineDash([]);
               }
            }

            ctx.shadowBlur = 0;
          }
        });
      }
      setTokenCoords(currentTokenCoords);
    };
    
    draw();
  }, [game, user?.uid]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (game.currentTurn !== user?.uid || !game.diceValue) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked token
    const clickedToken = tokenCoords.find(tc => {
      const dist = Math.sqrt((tc.x - x)**2 + (tc.y - y)**2);
      return dist < (canvas.width / 15) * 1.5; // cellSize * 1.5 tolerance
    });

    if (clickedToken && clickedToken.id.startsWith(user?.uid as string)) {
      moveToken(clickedToken.id);
    }
  };

  const handleRollDice = async () => {
    if (!game || game.currentTurn !== user?.uid || game.status !== 'playing' || game.diceValue) {
       return;
    }
    
    try {
      const result = await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'games', gameId as string);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game not found";

        const serverGame = gameDoc.data();
        if (serverGame.currentTurn !== user?.uid || serverGame.status !== 'playing') {
           throw "Not your turn!";
        }
        if (serverGame.diceValue) {
           throw "Already rolled or move pending!";
        }
        
        const val = Math.floor(Math.random() * 6) + 1;
        const pid = user.uid as string;
        
        let consecutive = (serverGame.consecutiveSixes || 0);
        if (val === 6) {
          consecutive++;
        } else {
          consecutive = 0;
        }

        const getNextTurn = (currentIndex: number) => {
          let nextIdx = (currentIndex + 1) % serverGame.players.length;
          while (serverGame.players[nextIdx].startsWith('empty_')) {
            nextIdx = (nextIdx + 1) % serverGame.players.length;
          }
          return nextIdx;
        };

        if (consecutive === 3) {
          const nextIdx = getNextTurn(serverGame.players.indexOf(pid));
          transaction.update(gameRef, {
            diceValue: val,
            consecutiveSixes: 0,
            currentTurn: serverGame.players[nextIdx],
            updatedAt: serverTimestamp()
          });
          return { type: 'triple6', val };
        }
        
        const pIdx = serverGame.players.indexOf(pid);
        const tokens = serverGame.tokensPosition;
        const movableTokens = Object.keys(tokens).filter(tid => {
          const lastIdx = tid.lastIndexOf('_');
          if (tid.substring(0, lastIdx) !== pid) return false;
          const pos = tokens[tid];
          if (pos === 'finished') return false;
          if (pos === 'base') return val === 6;
          const pathLen = getPlayerPath(pIdx).length;
          return (typeof pos === 'number') && (pos + val <= pathLen);
        });

        if (movableTokens.length === 0) {
          const nextIdx = val === 6 ? serverGame.players.indexOf(pid) : getNextTurn(serverGame.players.indexOf(pid));
          transaction.update(gameRef, {
            diceValue: val,
            consecutiveSixes: val === 6 ? consecutive : 0,
            currentTurn: serverGame.players[nextIdx],
            updatedAt: serverTimestamp()
          });
          return { type: 'nomoves', val };
        }
        
        transaction.update(gameRef, {
          diceValue: val,
          consecutiveSixes: consecutive,
          updatedAt: serverTimestamp()
        });
        return { type: 'rolled', val };
      });

      if (result.type === 'triple6') {
         toast.error("Triple 6! Turn passed.");
         setTimeout(() => {
           if (gameId) updateDoc(doc(db, 'games', gameId), { diceValue: null });
         }, 1500);
      } else if (result.type === 'nomoves') {
         toast.error(`Rolled ${result.val}. No moves possible!`);
         setTimeout(() => {
           if (gameId) updateDoc(doc(db, 'games', gameId), { diceValue: null });
         }, 1200);
      }
    } catch (e: any) {
      console.error("Roll error:", e);
      toast.error(typeof e === 'string' ? e : e.message);
    }
  };

  const handleLeave = () => {
    navigate('/');
  };

  const handleSimulateWin = async () => {
    if (game.status !== 'playing') return;
    
    try {
      // Set game to finished
      await updateDoc(doc(db, 'games', gameId as string), {
        status: 'finished',
        winner: user?.uid,
        updatedAt: serverTimestamp()
      });

      // Award 50 coins to winner
      if (profile) {
        await updateDoc(doc(db, 'users', user!.uid), {
          coins: profile.coins + 50,
          wins: profile.wins + 1,
          updatedAt: serverTimestamp()
        });
      }

      // Update room status
      await updateDoc(doc(db, 'rooms', game.roomId), {
        status: 'finished',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `game_win/${gameId}`);
    }
  };

  if (!game) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden flex-1 max-h-screen">
      
      {/* Sidebar Players */}
      <div className="w-full md:w-72 bg-slate-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col pt-6">
        <div className="px-6 mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-black text-xl text-white tracking-tight uppercase">Nexus</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Match</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowRules(true)} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-lg">
              <HelpCircle className="w-5 h-5"/>
            </button>
            <button onClick={handleLeave} className="text-slate-400 hover:text-red-400 transition-colors bg-white/5 p-2 rounded-lg">
              <LogOut className="w-5 h-5"/>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-3">
          {players.filter(p => p && !p.id.startsWith('empty_')).map((p, i) => {
            const isTurn = game.currentTurn === p.id;
            const originalIndex = game.players.indexOf(p.id);
            const colors = ['border-red-500', 'border-green-500', 'border-yellow-500', 'border-blue-500'];
            const glowColors = ['shadow-red-500/20', 'shadow-green-500/20', 'shadow-yellow-500/20', 'shadow-blue-500/20'];
            return (
              <motion.div 
                key={p.id} 
                animate={isTurn ? { x: [0, 5, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                className={`flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border-2 transition-all shadow-lg ${isTurn ? `${colors[originalIndex]} ${glowColors[originalIndex]} bg-slate-800/80` : 'border-white/5 hover:bg-slate-800/60'}`}
              >
                <div className="relative">
                  <img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-xl bg-slate-900 border border-white/10" />
                  {isTurn && (
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${colors[originalIndex].replace('border-', 'bg-')}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{p.name}</p>
                  <p className={`text-[10px] font-black uppercase tracking-tighter ${isTurn ? colors[originalIndex].replace('border-', 'text-') : 'text-slate-500'}`}>
                    {isTurn ? 'COMMANDING' : 'READY'}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
        <div className="p-4 border-t border-white/5">
           <button 
             onClick={handleSimulateWin}
             className="w-full py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-xl text-sm font-medium hover:bg-yellow-500/20 transition-colors"
           >
             Simulate Win (+50 Coins)
           </button>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="aspect-square w-full max-w-[min(85vh,90vw)] bg-slate-900 rounded-[2rem] p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 mx-auto relative cursor-pointer">
          <canvas 
            ref={canvasRef} 
            width={1200} 
            height={1200} 
            onClick={handleCanvasClick}
            className="w-full h-full rounded-2xl"
          />
        </div>
      </div>

      {/* Right Controls & Chat */}
      <div className="w-full md:w-80 bg-slate-900/40 backdrop-blur-md border-l border-white/5 flex flex-col">
        {/* Dice Section */}
        <div className="p-8 border-b border-white/5 flex flex-col items-center bg-white/5">
          <div className="relative group cursor-pointer mb-8" onClick={handleRollDice}>
            <motion.div 
               animate={isRolling ? { 
                 rotate: [0, 90, 180, 270, 360],
                 scale: [1, 1.1, 1],
                 x: [0, -5, 5, -5, 0]
               } : game.currentTurn === user?.uid && !game.diceValue ? { 
                 scale: [1, 1.05, 1],
                 rotate: [0, 5, -5, 0]
               } : {}}
               transition={isRolling ? { duration: 0.4, repeat: 1 } : { duration: 2, repeat: Infinity }}
               className="w-28 h-28 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-white/30 relative z-10"
            >
              <div className="grid grid-cols-3 grid-rows-3 gap-2 w-16 h-16 p-1">
                {visualDice && [
                  [4, 5, 6].includes(visualDice), // row 1, col 1
                  null,
                  [2, 3, 4, 5, 6].includes(visualDice) && visualDice !== 1 ? true : false, // Fixed logic for dots
                ].map((_v, _i) => null)} {/* Placeholder for mapping logic below */}
                
                {/* Genuine Dice Dot Pattern */}
                {(() => {
                  const patterns: Record<number, number[]> = {
                    1: [4],
                    2: [0, 8],
                    3: [0, 4, 8],
                    4: [0, 2, 6, 8],
                    5: [0, 2, 4, 6, 8],
                    6: [0, 2, 3, 5, 6, 8]
                  };
                  const activeDots = visualDice ? patterns[visualDice] : [];
                  return Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className={`flex items-center justify-center`}>
                      {activeDots.includes(i) && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_8px_white]" 
                        />
                      )}
                    </div>
                  ));
                })()}
              </div>
              
              {/* Gloss effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-[2rem]" />
            </motion.div>
            {/* Pulsing ring for active player */}
            {game.currentTurn === user?.uid && !game.diceValue && !isRolling && (
              <div className="absolute inset-0 -m-2 border-2 border-indigo-400/50 rounded-[2.5rem] animate-ping opacity-40" />
            )}
          </div>
          
          <button 
            onClick={handleRollDice}
            disabled={game.currentTurn !== user?.uid || game.status !== 'playing' || isRolling || game.diceValue !== null}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-black text-lg transition-all disabled:opacity-30 disabled:grayscale shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            {isRolling ? "ROLLING..." : game.currentTurn === user?.uid ? (game.diceValue ? "MOVE UNIT" : "ROLL DICE") : "OPPONENT'S TURN"}
          </button>
        </div>

        {/* Chat Section */}
        <div className="flex-1 flex flex-col relative z-20">
          <div className="p-4 border-b border-white/5 font-bold text-white flex items-center gap-2">
            Match Chat
          </div>
          <div className="flex-1 p-4 flex flex-col justify-end bg-slate-950/50 overflow-hidden">
            <div className="space-y-4 mb-4 overflow-y-auto custom-scrollbar flex-1 pb-4 flex flex-col justify-end">
              {(game.chatMessages || []).map((msg: any, i: number) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-500 mb-1 ml-1 font-bold">{msg.senderName}</span>
                    <div className={`text-sm p-3 rounded-xl max-w-[85%] text-white ${isMe ? 'bg-indigo-600 rounded-br-none' : 'bg-slate-800 rounded-bl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="p-4 bg-slate-900 border-t border-white/5 relative">
             <AnimatePresence>
               {showEmoji && (
                  <EmojiPicker 
                    onSelect={(emoji) => setChatMessage(prev => prev + emoji)}
                    onClose={() => setShowEmoji(false)}
                  />
               )}
             </AnimatePresence>
             <form onSubmit={handleSendMessage} className="flex relative">
                <button 
                  type="button"
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="absolute left-1 top-1 bottom-1 w-10 flex items-center justify-center text-slate-400 hover:text-yellow-400 transition-colors z-10"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input 
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Message..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-full py-3 pl-12 pr-12 outline-none text-sm focus:border-indigo-500 transition-colors text-white"
                />
                <button type="submit" disabled={!chatMessage.trim()} className="absolute right-1 top-1 bottom-1 w-10 bg-indigo-500 rounded-full flex items-center justify-center text-white disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
             </form>
          </div>
        </div>
      </div>

      {game.status === 'finished' && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="bg-slate-900 border border-white/10 p-12 rounded-[3rem] max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
              <div className="bg-yellow-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-yellow-500" />
              </div>
              <h2 className="text-4xl font-black text-white mb-2 italic tracking-tighter">VICTORY</h2>
              <p className="text-slate-400 mb-8 font-medium">Champion: <span className="text-white font-bold">{players.find(p => p.id === game.winner)?.name}</span></p>
              <button 
                onClick={() => navigate('/')} 
                className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:bg-slate-200 transition-all active:scale-95"
              >
                RETURN HOME
              </button>
            </motion.div>
        </div>
      )}

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-white italic tracking-tighter">NEXUS RULES</h2>
                <button onClick={() => setShowRules(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
                  <Navigation className="w-6 h-6 rotate-90" />
                </button>
              </div>

              <div className="space-y-6 text-slate-300">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex-shrink-0 flex items-center justify-center font-bold font-mono">01</div>
                  <p className="text-sm leading-relaxed">Roll a <span className="text-white font-bold">6</span> to deploy a combat unit from your home base.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex-shrink-0 flex items-center justify-center font-bold font-mono">02</div>
                  <p className="text-sm leading-relaxed">Land on an opponent's unit to send them back to base. <span className="text-indigo-400 font-bold">Safe zones</span> (stars) prevent this.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex-shrink-0 flex items-center justify-center font-bold font-mono">03</div>
                  <p className="text-sm leading-relaxed">Navigate all 4 units to the <span className="text-white font-bold">Nexus Center</span> to claim absolute victory.</p>
                </div>
              </div>

              <button 
                onClick={() => setShowRules(false)}
                className="w-full mt-10 py-4 bg-indigo-500 text-white rounded-2xl font-black tracking-widest hover:bg-indigo-400 shadow-lg shadow-indigo-500/20 transition-all"
              >
                ACKNOWLEDGED
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
