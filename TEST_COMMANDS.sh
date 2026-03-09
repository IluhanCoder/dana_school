#!/bin/bash
# 🚀 Student Excel Import Feature - Test Commands
# Copy and paste these commands in your terminal

# ============================================
# STEP 1: Verify Build (1 minute)
# ============================================
cd /Users/Elijah/Documents/school_project/server
npm run build
# Expected: No errors, "tsc" completes silently

# ============================================
# STEP 2: Start Server (Terminal 1)
# ============================================
cd /Users/Elijah/Documents/school_project/server
npm run dev
# Expected: "Server running on port XXX" message

# ============================================
# STEP 3: Start Client (Terminal 2, NEW TERMINAL)
# ============================================
cd /Users/Elijah/Documents/school_project/client
npm run dev
# Expected: "Local: http://localhost:5173" message

# ============================================
# STEP 4: Open in Browser
# ============================================
# Go to: http://localhost:5173
# Login with admin credentials

# ============================================
# STEP 5: Test Import
# ============================================
# 1. Navigate to Dashboard
# 2. Look for "Імпортувати учнів" button in header
# 3. Click the button
# 4. Select test Excel file (.xlsx)
# 5. Watch results display
# 6. Verify students in dashboard list

# ============================================
# ADDITIONAL COMMANDS (if needed)
# ============================================

# Install dependencies again (if needed)
cd /Users/Elijah/Documents/school_project/server
npm install

# Install TypeScript types for multer
cd /Users/Elijah/Documents/school_project/server
npm install --save-dev @types/multer

# Check if xlsx is available
cd /Users/Elijah/Documents/school_project/server
npm list xlsx

# Check if multer is available
cd /Users/Elijah/Documents/school_project/server
npm list multer

# Stop server (if running)
# Press Ctrl+C in the terminal

# ============================================
# QUICK VERIFICATION
# ============================================

# Check server build status
cd /Users/Elijah/Documents/school_project/server && npm run build

# Verify key files exist
test -f /Users/Elijah/Documents/school_project/server/src/user/user-import.service.ts && echo "✅ Backend service exists"
test -f /Users/Elijah/Documents/school_project/client/src/components/StudentImportModal.tsx && echo "✅ Frontend modal exists"

# ============================================
# TROUBLESHOOTING COMMANDS
# ============================================

# Clear node_modules and reinstall (if having issues)
cd /Users/Elijah/Documents/school_project/server
rm -rf node_modules
npm install

# Check npm version
npm --version

# Check node version
node --version

# List installed packages in server
cd /Users/Elijah/Documents/school_project/server
npm list

# View server logs (while running)
# Terminal 1 shows logs automatically

# Test API endpoint (after server is running, in new terminal)
curl -X POST http://localhost:5000/users/import/excel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/test.xlsx"

# ============================================
# DOCUMENTATION COMMANDS
# ============================================

# View documentation
open /Users/Elijah/Documents/school_project/STATUS_REPORT.md
open /Users/Elijah/Documents/school_project/QUICK_REFERENCE.md
open /Users/Elijah/Documents/school_project/NEXT_STEPS.md

# ============================================
# SUCCESS INDICATORS
# ============================================

# When server starts successfully, you'll see:
# Server running on port 5000
# Connected to MongoDB

# When client starts successfully, you'll see:
# Local:   http://localhost:5173

# When import works, modal shows:
# "Successfully imported X students"
# Created: X
# Skipped: 0

# ============================================
# THAT'S IT!
# ============================================

# Your feature is complete and ready to test!
# Follow the steps above to start testing.
