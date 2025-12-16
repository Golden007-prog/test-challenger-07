# MCQ Tech Challenge Quiz

A modern, responsive MCQ quiz application built with vanilla JavaScript. Features GitHub cloud sync, AI-powered performance analysis, and beautiful dark-mode UI.

## ✨ Features

- **📱 Cross-Platform**: Works on desktop, tablet, and mobile browsers
- **☁️ Cloud Sync**: Sync your scores across devices using GitHub
- **🤖 AI Analysis**: Get performance insights powered by Google Gemini
- **📊 Score Tracking**: Track your progress, best scores, and accuracy
- **⏱️ Timer**: Per-question and total time tracking
- **📄 PDF Support**: Load questions from PDF files

## 🚀 Quick Start

### Option 1: GitHub Pages (Recommended)

Visit: `https://golden007-prog.github.io/test-challenger-07/`

### Option 2: Local

1. Clone the repository
2. Open `index.html` in your browser
3. Select PDF files with questions from the `tech` folder

## ⚙️ Setup (Optional Features)

### GitHub Cloud Sync

Sync your scores across devices:

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens/new?scopes=gist&description=MCQ%20Quiz%20App)
2. Create a token with only **"gist"** scope
3. Click ⚙️ Settings in the app
4. Paste your token and click "Connect GitHub"

Your scores are stored in a **private Gist** only you can access.

### AI Performance Analysis

Get AI-powered insights on your quiz results:

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Click ⚙️ Settings in the app
4. Paste your key and save

## 📁 Project Structure

```
├── index.html          # Main HTML
├── styles.css          # All styles
├── app.js              # Main app logic
├── pdfParser.js        # PDF parsing
├── scoreTracker.js     # Score persistence & sync
├── githubAuth.js       # GitHub auth & Gist database
├── geminiAnalyzer.js   # AI analysis
├── tech/               # PDF question files
└── README.md
```

## 🔒 Privacy

- GitHub tokens and API keys are stored **locally in your browser**
- Quiz data is stored in a **private GitHub Gist** (only you can access)
- No data is collected or shared with third parties

## 📝 License

MIT License - Feel free to use and modify!
