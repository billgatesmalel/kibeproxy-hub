#!/usr/bin/env bash
# KibeProxy Hub - Backend Startup Script
# This file helps you manage the backend server

echo "╔════════════════════════════════════════════════════════╗"
echo "║       KibeProxy Hub - M-Pesa Backend Manager            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

case "$1" in
  start)
    echo "🚀 Starting M-Pesa Backend Server..."
    cd "c:\Users\Administrator\myproxy.html\js"
    npm start
    ;;
  
  dev)
    echo "🔧 Starting in Development Mode (auto-reload)..."
    cd "c:\Users\Administrator\myproxy.html\js"
    npm run dev
    ;;
  
  install)
    echo "📦 Installing Dependencies..."
    cd "c:\Users\Administrator\myproxy.html\js"
    npm install
    echo "✅ Dependencies installed!"
    ;;
  
  test)
    echo "🧪 Testing Backend..."
    echo ""
    echo "Testing health endpoint..."
    powershell -Command "Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -Method Get | ConvertTo-Json"
    ;;
  
  logs)
    echo "📋 Backend is running in terminal ID: 5c9e9dc1-20af-47aa-8411-2ae39a13a207"
    echo ""
    echo "To view logs, use: vercel logs"
    ;;
  
  *)
    echo "Usage: $0 {start|dev|install|test|logs}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the production backend"
    echo "  dev     - Start in development mode (with auto-reload)"
    echo "  install - Install dependencies"
    echo "  test    - Test if backend is running"
    echo "  logs    - View backend logs"
    ;;
esac
