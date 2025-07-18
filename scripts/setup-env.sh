#!/bin/bash

# Setup script for environment files

echo "Setting up environment files..."

# Backend .env
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "✓ Created backend/.env - Please update with your OpenAI API key"
else
  echo "✓ backend/.env already exists"
fi

# Frontend .env
if [ ! -f frontend/.env ]; then
  cp frontend/.env.example frontend/.env
  echo "✓ Created frontend/.env"
else
  echo "✓ frontend/.env already exists"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env and add your OpenAI API key"
echo "2. Run 'pnpm dev' to start both frontend and backend"
echo "3. Open http://localhost:5173 in your browser"
echo "4. Go to Settings to configure your OpenAI API key if you haven't already"