import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// 1. Roll Dice
export const rollDice = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  
  const { gameId } = data;
  if (!gameId) throw new functions.https.HttpsError("invalid-argument", "Missing gameId.");

  const gameRef = db.collection("games").doc(gameId);
  
  return db.runTransaction(async (transaction) => {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists) throw new functions.https.HttpsError("not-found", "Game not found");
    
    const game = gameSnap.data();
    if (game?.status !== "playing") throw new functions.https.HttpsError("failed-precondition", "Game is not active");
    if (game?.currentTurn !== context.auth?.uid) throw new functions.https.HttpsError("permission-denied", "Not your turn");
    if (game?.diceValue > 0) throw new functions.https.HttpsError("failed-precondition", "Dice already rolled");

    const diceValue = Math.floor(Math.random() * 6) + 1;
    
    // Simplification for the example: If player has no valid moves, skip turn automatically
    // But usually we wait for user to select a token, or skip if impossible.
    let nextTurn = game.currentTurn;
    
    transaction.update(gameRef, {
      diceValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { diceValue };
  });
});

// 2. Move Token
export const moveToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  
  const { gameId, tokenId } = data;
  
  const gameRef = db.collection("games").doc(gameId);
  return db.runTransaction(async (transaction) => {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists) throw new functions.https.HttpsError("not-found", "Game not found");
    
    const game = gameSnap.data();
    if (game?.status !== "playing") throw new functions.https.HttpsError("failed-precondition", "Game is not active");
    if (game?.currentTurn !== context.auth?.uid) throw new functions.https.HttpsError("permission-denied", "Not your turn");
    if (game?.diceValue === 0) throw new functions.https.HttpsError("failed-precondition", "Must roll dice first");

    // Ludo Engine Logic (Simplified for demonstration)
    const tokensPosition = game.tokensPosition || {};
    const currentPosition = tokensPosition[tokenId];
    
    let newPosition = currentPosition;
    
    if (currentPosition === 'base') {
      if (game.diceValue === 6) {
        newPosition = 'start'; // move to start square
      } else {
        throw new functions.https.HttpsError("failed-precondition", "Need 6 to unlock token");
      }
    } else {
       // Logic to advance token by diceValue on path and check for kills...
       // If kill, award 6. If home, check win.
       newPosition = 'advanced'; // placeholder for mathematical path addition
    }

    // Determine next turn
    let nextTurn = game.currentTurn;
    if (game.diceValue !== 6) {
       const players = game.players;
       const nextIdx = (players.indexOf(game.currentTurn) + 1) % players.length;
       nextTurn = players[nextIdx];
    }

    transaction.update(gameRef, {
      [`tokensPosition.${tokenId}`]: newPosition,
      diceValue: 0, // Reset dice
      currentTurn: nextTurn,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  });
});
