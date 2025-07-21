#!/bin/bash

# 🚀 InstaScrape API Deployment Script
# This script helps deploy the API to various platforms

set -e

echo "🚀 InstaScrape API Deployment Script"
echo "====================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Please copy env.example to .env and configure your Stripe keys:"
    echo "   cp env.example .env"
    echo "   # Then edit .env with your Stripe keys"
    echo ""
fi

# Function to deploy to Vercel
deploy_vercel() {
    echo "🌐 Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Deploy
    vercel --prod
}

# Function to deploy to Heroku
deploy_heroku() {
    echo "🌐 Deploying to Heroku..."
    
    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        echo "❌ Heroku CLI not found. Please install it first:"
        echo "   https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    # Get app name from user
    read -p "Enter Heroku app name (or press Enter to create one): " app_name
    
    if [ -z "$app_name" ]; then
        echo "Creating new Heroku app..."
        heroku create
    else
        echo "Using existing Heroku app: $app_name"
        heroku git:remote -a $app_name
    fi
    
    # Set environment variables
    echo "🔧 Setting environment variables..."
    heroku config:set NODE_ENV=production
    
    if [ -f .env ]; then
        echo "📝 Setting Stripe keys from .env file..."
        source .env
        heroku config:set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
        heroku config:set STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLISHABLE_KEY"
    else
        echo "⚠️  No .env file found. Please set Stripe keys manually:"
        echo "   heroku config:set STRIPE_SECRET_KEY=your_key"
        echo "   heroku config:set STRIPE_PUBLISHABLE_KEY=your_key"
    fi
    
    # Deploy
    echo "🚀 Deploying to Heroku..."
    git push heroku main
}

# Function to run locally with Docker
run_docker() {
    echo "🐳 Running with Docker..."
    
    # Build and run with docker-compose
    docker-compose up --build
}

# Function to run locally with Node.js
run_local() {
    echo "💻 Running locally with Node.js..."
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install
    
    # Check if .env exists
    if [ ! -f .env ]; then
        echo "⚠️  No .env file found. Creating from example..."
        cp env.example .env
        echo "📝 Please edit .env file with your Stripe keys!"
    fi
    
    # Start the application
    echo "🚀 Starting InstaScrape API..."
    npm run dev
}

# Main menu
echo "Choose deployment option:"
echo "1) Deploy to Vercel"
echo "2) Deploy to Heroku"
echo "3) Run locally with Docker"
echo "4) Run locally with Node.js"
echo "5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        deploy_vercel
        ;;
    2)
        deploy_heroku
        ;;
    3)
        run_docker
        ;;
    4)
        run_local
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your API should now be running!"
echo "📖 Check the README.md for API documentation." 