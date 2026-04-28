# Aether Ludo

A production-ready, real-time multiplayer Ludo platform with dark-themed glassmorphism UI, built with modern web technologies.

## 🚀 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS (Glassmorphism), Zustand, Framer Motion
- **Backend:** Firebase (Auth, Firestore, Cloud Functions)
- **Game Engine:** HTML5 Canvas + Firestore sync
- **Deployment:** Vercel (Front) + Firebase (Back)

## 📁 Architecture

- `/src/pages`: Main application views (Dashboard, Lobby, Game).
- `/src/store`: Zustand state management for Auth and local UI state.
- `/src/lib/firebase.ts`: Firebase configuration and client initialization.
- `/functions`: Firebase Cloud Functions for authoritative game state validation (anti-cheat).
- `firestore.rules`: Strict security rules protecting Game and Room documents.

## 🛠 Setup & Installation

1. Make install script executable:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

2. Configure Firebase:
   - Ensure your Firebase project credentials are in `firebase-applet-config.json` (for the preview).
   - If deploying properly, create `.env` from `.env.example` and set `VITE_FIREBASE_API_KEY`, etc.

3. Start Dev Server:
   ```bash
   npm run dev
   ```

## 🎮 Deployment

### Frontend (Vercel)
1. Push codebase to GitHub.
2. Sign in to Vercel, import the repository.
3. Configure Framework Preset to `Vite`.
4. Deploy!

### Backend (Firebase Functions & Rules)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize (if needed): `firebase init`
4. Deploy Firestore rules and Functions:
   ```bash
   firebase deploy --only firestore:rules,functions
   ```

## 🛡 Anti-Cheat System
All core game logic (Rolling dice, moving tokens, winning) is secured behind Firebase Cloud Functions. The client strictly renders state synced from Firestore and cannot brute-force token positions. (Note: A local UI fallback is present when Functions aren't deployed, prioritizing development experience and testing).
