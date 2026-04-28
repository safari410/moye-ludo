import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🫣','🤭','🫢','🫡','🤫','🤔','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒']
  },
  {
    name: 'Reactions',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💯','💢','💥','💫','💦','💨','🕳️','💬','👁️‍🗨️','🗨️','🗯️','💭','💤']
  },
  {
    name: 'Gaming',
    emojis: ['🎮','🕹️','🎰','🎲','🧩','🧸','🔫','💣','🧨','⚔️','🛡️','🏆','🥇','🥈','🥉','🏅','🎖️','🎯','🎱','🔮','🪄']
  },
  {
    name: 'Funny',
    emojis: ['🤡','💩','👻','👽','👾','🤖','🎃','🫶','👐','🙌','👏','🤝','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🫰','🤟','🤘','👌','🤌','🤏','🫳','🫴','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','🫲','🫱','💪','🦾','🖕']
  },
  {
    name: 'Angry',
    emojis: ['😤','😠','😡','🤬','🤯','🥶','🥵','😱','😨','😰','😥','😓','🫣']
  }
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="absolute bottom-full mb-2 right-0 w-72 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="relative flex-1 mr-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search emojis..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 text-white pl-9 pr-3 py-1.5 rounded-full text-sm outline-none border border-slate-800 focus:border-indigo-500 transition-colors"
          />
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 max-h-64 overflow-y-auto p-3 custom-scrollbar">
        {EMOJI_CATEGORIES.map(category => {
           const filtered = category.emojis.filter(e => e.includes(search) || category.name.toLowerCase().includes(search.toLowerCase()));
           if (filtered.length === 0) return null;
           
           return (
             <div key={category.name} className="mb-4 last:mb-0">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{category.name}</h4>
               <div className="grid grid-cols-6 gap-1">
                 {filtered.map(emoji => (
                   <button 
                     key={emoji}
                     onClick={() => { onSelect(emoji); onClose(); }}
                     className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-800 rounded-lg transition-colors"
                   >
                     {emoji}
                   </button>
                 ))}
               </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}
