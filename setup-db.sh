#!/bin/bash
# Database setup script for the unblocked game website

set -e # Exit on error

# Print a message with color
print_message() {
  local color=$1
  local message=$2
  
  case $color in
    "green") echo -e "\e[32m$message\e[0m" ;;
    "red") echo -e "\e[31m$message\e[0m" ;;
    "blue") echo -e "\e[34m$message\e[0m" ;;
    "yellow") echo -e "\e[33m$message\e[0m" ;;
    *) echo "$message" ;;
  esac
}

# Check for prerequisites
check_prerequisites() {
  print_message "blue" "Checking prerequisites..."
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    print_message "red" "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
  fi
  
  # Check for NPM
  if ! command -v npm &> /dev/null; then
    print_message "red" "❌ npm is not installed. Please install npm."
    exit 1
  fi
  
  # Check for PostgreSQL
  if ! command -v psql &> /dev/null; then
    print_message "yellow" "⚠️ PostgreSQL CLI (psql) not found. You might need to install it or add it to your PATH."
    print_message "yellow" "⚠️ If you're using a remote PostgreSQL service, you can ignore this warning."
  fi
  
  print_message "green" "✅ Prerequisites check completed."
}

# Install dependencies
install_dependencies() {
  print_message "blue" "Installing dependencies..."
  npm install
  print_message "green" "✅ Dependencies installed."
}

# Setup Prisma and the database
setup_database() {
  print_message "blue" "Setting up the database..."
  
  # Check if .env file exists
  if [ ! -f ".env" ]; then
    print_message "yellow" "⚠️ .env file not found. Creating a default one..."
    cat > .env << EOF
DATABASE_URL="postgresql://postgres:password@localhost:5432/game_proxy_db?schema=public"
JWT_SECRET="your-super-secret-key-change-this-in-production"
PORT=8080
NODE_ENV="development"
EOF
    print_message "yellow" "⚠️ Default .env file created. Please update the DATABASE_URL with your actual database credentials."
  fi
  
  # Generate Prisma client
  print_message "blue" "Generating Prisma client..."
  npx prisma generate
  
  # Ask if user wants to run migrations
  read -p "Do you want to run database migrations? This will create the database tables. (y/n): " run_migrations
  
  if [ "$run_migrations" = "y" ] || [ "$run_migrations" = "Y" ]; then
    print_message "blue" "Running database migrations..."
    npx prisma migrate dev --name init
    print_message "green" "✅ Database migrations completed."
  else
    print_message "yellow" "⚠️ Skipping database migrations. You'll need to run them manually with 'npx prisma migrate dev'."
  fi
}

# Open Prisma Studio to verify setup
open_prisma_studio() {
  read -p "Do you want to open Prisma Studio to verify the database setup? (y/n): " open_studio
  
  if [ "$open_studio" = "y" ] || [ "$open_studio" = "Y" ]; then
    print_message "blue" "Opening Prisma Studio..."
    npx prisma studio
  else
    print_message "yellow" "⚠️ Skipping Prisma Studio. You can open it anytime with 'npx prisma studio'."
  fi
}

# Main function
main() {
  print_message "blue" "========================================"
  print_message "blue" "  Unblocked Game Website DB Setup Tool  "
  print_message "blue" "========================================"
  echo ""
  
  check_prerequisites
  echo ""
  
  install_dependencies
  echo ""
  
  setup_database
  echo ""
  
  open_prisma_studio
  echo ""
  
  print_message "green" "✅ Setup completed!"
  print_message "green" "You can now start the server with 'npm start'"
}

# Run the main function
main 