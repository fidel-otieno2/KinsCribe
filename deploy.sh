#!/bin/bash
echo "🚀 Deploying KinsCribe to Render..."
echo ""
echo "📝 Checking git status..."
git status

echo ""
echo "🔄 Pushing to main branch..."
git push origin main

echo ""
echo "✅ Push complete!"
echo ""
echo "📌 Next steps:"
echo "   1. Go to https://dashboard.render.com"
echo "   2. Select your KinsCribe service"
echo "   3. Wait for automatic deployment to complete"
echo "   4. Or click 'Manual Deploy' → 'Deploy latest commit'"
echo ""
echo "🔧 The migration will run automatically during deployment"
echo "   and add the missing columns: is_archived, is_highlighted, archived_at, highlighted_at"
