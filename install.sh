#!/bin/bash

# Aether Ludo Installation Script

echo "Welcome to Aether Ludo Setup!"
echo "Installing frontend dependencies..."
npm install

echo "Installing backend dependencies..."
cd functions
npm install
cd ..

echo "Creating .env placeholder..."
cp .env.example .env

echo "Setup complete!"
echo "To start the development server :"
echo "npm run dev"
