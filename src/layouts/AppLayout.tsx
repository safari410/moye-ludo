import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { LayoutDashboard, Swords, User as UserIcon, LogOut, Coins, Trophy } from 'lucide-react';

export default function AppLayout() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Active Rooms', icon: Swords, path: '/rooms' },
    { label: 'Profile', icon: UserIcon, path: '/profile' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar Navigation */}
      <div className="w-20 lg:w-64 border-r border-white/5 bg-slate-900/50 flex flex-col items-center lg:items-stretch py-8">
        
        <div className="hidden lg:flex items-center gap-3 px-6 mb-12">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Swords className="w-5 h-5 text-white" />
           </div>
           <h1 className="text-xl font-bold text-white">Aether Ludo</h1>
        </div>
        <div className="lg:hidden mb-12">
           <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Swords className="w-6 h-6 text-white" />
           </div>
        </div>

        <nav className="flex-1 flex flex-col gap-2 px-4 w-full">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full py-3 px-3 lg:px-4 rounded-xl transition-all ${
                  active 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="w-6 h-6 shrink-0" />
                <span className="hidden lg:block font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Mini Profile Display */}
        <div className="mt-auto px-4 w-full">
           <div className="hidden lg:block bg-slate-900 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                 <img src={profile?.avatar} alt="Avatar" className="w-10 h-10 rounded-lg bg-slate-800" />
                 <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{profile?.name}</p>
                    <p className="text-slate-400 text-xs">Level {profile?.level}</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                 <span className="flex items-center gap-1 text-yellow-500"><Coins className="w-3 h-3"/> {profile?.coins}</span>
                 <span className="flex items-center gap-1 text-indigo-400"><Trophy className="w-3 h-3"/> {profile?.wins}</span>
              </div>
           </div>

           <button 
             onClick={() => auth.signOut()} 
             className="w-full mt-4 flex items-center justify-center lg:justify-start gap-3 py-3 px-3 lg:px-4 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <LogOut className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block font-medium">Sign Out</span>
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto h-screen relative">
         <Outlet />
      </div>
    </div>
  );
}
