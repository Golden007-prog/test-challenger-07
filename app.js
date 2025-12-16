/**
 * MCQ Quiz Application
 * Main application logic for the quiz
 */

class QuizApp {
    constructor() {
        this.pdfParser = new PDFParser();
        this.scoreTracker = new ScoreTracker();
        this.githubAuth = new GitHubAuth();
        this.gistDatabase = new GistDatabase(this.githubAuth);
        this.geminiAnalyzer = new GeminiAnalyzer();

        // Quiz state
        this.questions = [];
        this.currentRound = 1;
        this.currentQuestionIndex = 0;
        this.roundScores = [0, 0, 0];
        this.roundQuestions = [];
        this.usedQuestionIds = [];
        this.selectedAnswer = null;
        this.isAnswered = false;

        // Timer state
        this.questionStartTime = null;
        this.roundStartTime = null;
        this.totalStartTime = null;
        this.questionTimer = null;
        this.totalTimer = null;
        this.roundTimes = [0, 0, 0];
        this.currentQuestionTime = 0;

        // Constants
        this.QUESTIONS_PER_ROUND = 20;
        this.TOTAL_ROUNDS = 3;

        // Initialize
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.bindEvents();
        this.updateStatsDisplay();
        await this.initializeAuth();
        await this.loadQuestionsFromFolder();
    }

    /**
     * Initialize authentication and sync
     */
    async initializeAuth() {
        // Setup gist database for score tracker
        this.scoreTracker.setGistDatabase(this.gistDatabase);

        // Update UI based on auth status
        this.updateAuthUI();
        this.updateGeminiUI();

        // Listen for sync status changes
        window.addEventListener('syncStatusChange', (e) => {
            this.updateSyncIndicator(e.detail);
        });

        // If authenticated, load from cloud
        if (this.githubAuth.isAuthenticated()) {
            await this.scoreTracker.loadFromCloud();
            this.updateStatsDisplay();
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Landing screen
        document.getElementById('startBtn').addEventListener('click', () => this.startQuiz());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshQuestions());

        // Quiz screen
        document.getElementById('skipBtn').addEventListener('click', () => this.skipQuestion());

        // Round complete screen
        document.getElementById('nextRoundBtn').addEventListener('click', () => this.startNextRound());

        // Results screen
        document.getElementById('retryBtn').addEventListener('click', () => this.restartQuiz());
        document.getElementById('homeBtn').addEventListener('click', () => this.goHome());

        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettings());
        document.querySelector('.modal-overlay').addEventListener('click', () => this.closeSettings());

        // GitHub auth
        document.getElementById('githubLoginBtn').addEventListener('click', () => this.handleGitHubLogin());
        document.getElementById('githubLogoutBtn').addEventListener('click', () => this.handleGitHubLogout());

        // Gemini settings
        document.getElementById('geminiSaveBtn').addEventListener('click', () => this.handleGeminiSave());
        document.getElementById('geminiClearBtn').addEventListener('click', () => this.handleGeminiClear());
        document.getElementById('setupGeminiBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('reanalyzeBtn').addEventListener('click', () => this.runAnalysis());
    }

    // ========================================
    // SETTINGS MODAL METHODS
    // ========================================

    /**
     * Open settings modal
     */
    openSettings() {
        document.getElementById('settingsModal').classList.add('active');
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    // ========================================
    // GITHUB AUTH METHODS
    // ========================================

    /**
     * Handle GitHub login
     */
    async handleGitHubLogin() {
        const tokenInput = document.getElementById('githubTokenInput');
        const token = tokenInput.value.trim();
        const loginBtn = document.getElementById('githubLoginBtn');

        if (!token) {
            alert('Please enter a GitHub Personal Access Token');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<div class="spinner"></div><span>Connecting...</span>';

        const result = await this.githubAuth.login(token);

        if (result.success) {
            tokenInput.value = '';
            this.updateAuthUI();
            
            // Initialize gist and sync
            await this.gistDatabase.initializeGist();
            await this.scoreTracker.loadFromCloud();
            this.updateStatsDisplay();
        } else {
            alert('Login failed: ' + result.error);
        }

        loginBtn.disabled = false;
        loginBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
            </svg>
            <span>Connect GitHub</span>
        `;
    }

    /**
     * Handle GitHub logout
     */
    handleGitHubLogout() {
        this.githubAuth.logout();
        this.gistDatabase.clearGistId();
        this.updateAuthUI();
        this.updateSyncIndicator('local');
    }

    /**
     * Update authentication UI
     */
    updateAuthUI() {
        const loggedOut = document.getElementById('githubLoggedOut');
        const loggedIn = document.getElementById('githubLoggedIn');
        const syncIndicator = document.getElementById('syncIndicator');

        if (this.githubAuth.isAuthenticated()) {
            const user = this.githubAuth.getUser();
            loggedOut.style.display = 'none';
            loggedIn.style.display = 'flex';
            syncIndicator.style.display = 'flex';

            document.getElementById('githubAvatar').src = user.avatar_url;
            document.getElementById('githubUsername').textContent = user.login;
        } else {
            loggedOut.style.display = 'flex';
            loggedIn.style.display = 'none';
            syncIndicator.style.display = 'none';
        }
    }

    /**
     * Update sync indicator
     */
    updateSyncIndicator(status) {
        const indicator = document.getElementById('syncIndicator');
        const label = document.getElementById('syncLabel');
        const statusText = document.getElementById('syncStatusText');

        indicator.className = 'sync-indicator';
        
        switch (status) {
            case 'synced':
                indicator.classList.add('synced');
                label.textContent = 'Synced';
                if (statusText) statusText.textContent = '✓ Synced';
                break;
            case 'syncing':
                indicator.classList.add('syncing');
                label.textContent = 'Syncing...';
                if (statusText) statusText.textContent = '⟳ Syncing...';
                break;
            case 'error':
                indicator.classList.add('error');
                label.textContent = 'Sync Error';
                if (statusText) statusText.textContent = '✕ Sync Error';
                break;
            default:
                label.textContent = 'Local';
                if (statusText) statusText.textContent = 'Local only';
        }
    }

    // ========================================
    // GEMINI SETTINGS METHODS
    // ========================================

    /**
     * Handle Gemini API key save
     */
    handleGeminiSave() {
        const keyInput = document.getElementById('geminiKeyInput');
        const key = keyInput.value.trim();

        if (!key) {
            alert('Please enter a Gemini API key');
            return;
        }

        this.geminiAnalyzer.setApiKey(key);
        keyInput.value = '';
        this.updateGeminiUI();
    }

    /**
     * Handle Gemini API key clear
     */
    handleGeminiClear() {
        this.geminiAnalyzer.clearApiKey();
        this.updateGeminiUI();
    }

    /**
     * Update Gemini UI based on configuration
     */
    updateGeminiUI() {
        const notConfigured = document.getElementById('geminiNotConfigured');
        const configured = document.getElementById('geminiConfigured');

        if (this.geminiAnalyzer.isConfigured()) {
            notConfigured.style.display = 'none';
            configured.style.display = 'flex';
        } else {
            notConfigured.style.display = 'flex';
            configured.style.display = 'none';
        }
    }

    /**
     * Update AI analysis section visibility
     */
    updateAnalysisUI() {
        const unavailable = document.getElementById('analysisUnavailable');
        const loading = document.getElementById('analysisLoading');
        const result = document.getElementById('analysisResult');
        const reanalyzeBtn = document.getElementById('reanalyzeBtn');

        if (this.geminiAnalyzer.isConfigured()) {
            unavailable.style.display = 'none';
            reanalyzeBtn.style.display = 'inline-flex';
        } else {
            unavailable.style.display = 'block';
            loading.style.display = 'none';
            result.style.display = 'none';
            reanalyzeBtn.style.display = 'none';
        }
    }

    // ========================================
    // AI ANALYSIS METHODS
    // ========================================

    /**
     * Run AI analysis on quiz results
     */
    async runAnalysis() {
        if (!this.geminiAnalyzer.isConfigured()) {
            return;
        }

        const loading = document.getElementById('analysisLoading');
        const result = document.getElementById('analysisResult');
        const unavailable = document.getElementById('analysisUnavailable');

        loading.style.display = 'flex';
        result.style.display = 'none';
        unavailable.style.display = 'none';

        const quizData = {
            roundScores: this.roundScores,
            totalScore: this.getTotalScore(),
            totalQuestions: this.QUESTIONS_PER_ROUND * this.TOTAL_ROUNDS,
            accuracy: Math.round((this.getTotalScore() / (this.QUESTIONS_PER_ROUND * this.TOTAL_ROUNDS)) * 100),
            roundTimes: this.roundTimes.map(t => this.formatTime(t)),
            previousAttempts: this.scoreTracker.getAllAttempts().slice(1) // Exclude current
        };

        const response = await this.geminiAnalyzer.analyzePerformance(quizData);

        loading.style.display = 'none';

        if (response.success) {
            // Parse markdown and render
            result.innerHTML = marked.parse(response.analysis.rawText);
            result.style.display = 'block';
        } else {
            result.innerHTML = `<p style="color: #ef4444;">Analysis failed: ${response.error}</p>`;
            result.style.display = 'block';
        }
    }

    /**
     * Load questions from PDF files in tech folder
     */
    async loadQuestionsFromFolder() {
        const loadingStatus = document.getElementById('loadingStatus');
        const questionCount = document.getElementById('questionCount');
        const startBtn = document.getElementById('startBtn');

        try {
            // Create file input programmatically for PDF selection
            // Since we can't access files directly, we'll prompt user to select
            loadingStatus.innerHTML = `
                <span>Select PDF files from the tech folder:</span>
            `;

            // Add file input
            const fileInputContainer = document.createElement('div');
            fileInputContainer.style.marginTop = '1.5rem';
            fileInputContainer.innerHTML = `
                <input type="file" id="pdfInput" multiple accept=".pdf" style="display: none;">
                <label for="pdfInput" class="btn btn-outline" style="cursor: pointer;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>Select PDFs from tech folder</span>
                </label>
                <p style="font-size: 0.8rem; color: #737373; margin-top: 0.75rem;">
                    Navigate to: Downloads → Exam fun → tech
                </p>
            `;

            loadingStatus.parentNode.insertBefore(fileInputContainer, loadingStatus.nextSibling);

            // Handle file selection
            document.getElementById('pdfInput').addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                loadingStatus.innerHTML = `
                    <div class="spinner"></div>
                    <span>Parsing ${files.length} PDF files...</span>
                `;
                fileInputContainer.style.display = 'none';

                try {
                    this.questions = await this.pdfParser.loadPDFs(files);

                    if (this.questions.length >= this.QUESTIONS_PER_ROUND) {
                        loadingStatus.style.display = 'none';
                        questionCount.style.display = 'block';
                        document.getElementById('totalQuestions').textContent = this.questions.length;
                        startBtn.disabled = false;
                    } else {
                        loadingStatus.innerHTML = `
                            <span style="color: #a3a3a3;">Only ${this.questions.length} questions found. Need at least ${this.QUESTIONS_PER_ROUND}.</span>
                        `;
                        fileInputContainer.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Error parsing PDFs:', error);
                    loadingStatus.innerHTML = `
                        <span style="color: #ef4444;">Error parsing PDFs. Please try again.</span>
                    `;
                    fileInputContainer.style.display = 'block';
                }
            });

        } catch (error) {
            console.error('Error setting up file input:', error);
            loadingStatus.innerHTML = `
                <span style="color: #ef4444;">Error loading. Please refresh the page.</span>
            `;
        }
    }

    /**
     * Refresh questions (reload PDFs)
     */
    async refreshQuestions() {
        document.getElementById('pdfInput').click();
    }

    /**
     * Update stats display on landing screen
     */
    updateStatsDisplay() {
        const stats = this.scoreTracker.getStats();

        document.getElementById('lastAccuracy').textContent =
            stats.lastAccuracy !== null ? `${stats.lastAccuracy}%` : '--';
        document.getElementById('bestScore').textContent =
            stats.bestScore > 0 ? `${stats.bestScore}/${this.QUESTIONS_PER_ROUND * this.TOTAL_ROUNDS}` : '--';
        document.getElementById('totalAttempts').textContent =
            stats.totalAttempts.toString();
    }

    /**
     * Start the quiz
     */
    startQuiz() {
        this.currentRound = 1;
        this.roundScores = [0, 0, 0];
        this.roundTimes = [0, 0, 0];
        this.usedQuestionIds = [];
        
        // Start total timer
        this.totalStartTime = Date.now();
        this.startTotalTimer();

        this.startRound();
        this.showScreen('quiz');
    }

    /**
     * Start a new round
     */
    startRound() {
        this.currentQuestionIndex = 0;
        this.roundStartTime = Date.now();
        this.roundQuestions = this.pdfParser.getRandomQuestions(
            this.QUESTIONS_PER_ROUND,
            this.usedQuestionIds
        );

        // Mark these questions as used
        this.roundQuestions.forEach(q => this.usedQuestionIds.push(q.id));

        // Update UI
        document.getElementById('currentRound').textContent = this.currentRound;
        document.getElementById('currentScore').textContent = this.getTotalScore();

        // Update previous accuracy display
        const stats = this.scoreTracker.getStats();
        document.getElementById('prevAccuracy').textContent =
            stats.lastAccuracy !== null ? `${stats.lastAccuracy}%` : '--';

        this.showQuestion();
    }

    /**
     * Get total score across all rounds
     */
    getTotalScore() {
        return this.roundScores.reduce((a, b) => a + b, 0);
    }

    /**
     * Show current question
     */
    showQuestion() {
        const question = this.roundQuestions[this.currentQuestionIndex];
        if (!question) return;

        this.selectedAnswer = null;
        this.isAnswered = false;
        
        // Start question timer
        this.questionStartTime = Date.now();
        this.currentQuestionTime = 0;
        this.startQuestionTimer();

        // Update question display
        const questionNum = this.currentQuestionIndex + 1;
        const roundOffset = (this.currentRound - 1) * this.QUESTIONS_PER_ROUND;

        document.getElementById('questionNumber').textContent = `Q${questionNum}`;
        document.getElementById('questionText').textContent = question.question;
        document.getElementById('questionTime').textContent = '0s';

        // Update progress
        const progress = (questionNum / this.QUESTIONS_PER_ROUND) * 100;
        document.getElementById('progressBar').style.setProperty('--progress', `${progress}%`);
        document.getElementById('progressText').textContent = `${questionNum} / ${this.QUESTIONS_PER_ROUND}`;

        // Update current accuracy
        const totalAnswered = roundOffset + this.currentQuestionIndex;
        const totalCorrect = this.getTotalScore();
        const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
        document.getElementById('currAccuracy').textContent = `${accuracy}%`;

        // Render options
        this.renderOptions(question);
    }

    /**
     * Render answer options
     */
    renderOptions(question) {
        const container = document.getElementById('optionsContainer');
        container.innerHTML = '';

        const letters = ['A', 'B', 'C', 'D'];

        letters.forEach(letter => {
            const option = document.createElement('div');
            option.className = 'option';
            option.dataset.letter = letter;
            option.innerHTML = `
                <span class="option-letter">${letter}</span>
                <span class="option-text">${question.options[letter]}</span>
            `;

            option.addEventListener('click', () => this.selectOption(letter, question));
            container.appendChild(option);
        });
    }

    /**
     * Handle option selection
     */
    selectOption(letter, question) {
        if (this.isAnswered) return;

        this.isAnswered = true;
        this.selectedAnswer = letter;

        const options = document.querySelectorAll('.option');
        options.forEach(opt => {
            const optLetter = opt.dataset.letter;
            opt.style.pointerEvents = 'none';

            if (optLetter === question.answer) {
                opt.classList.add('correct');
            } else if (optLetter === letter && letter !== question.answer) {
                opt.classList.add('incorrect');
            }
        });

        // Update score if correct
        if (letter === question.answer) {
            this.roundScores[this.currentRound - 1]++;
            document.getElementById('currentScore').textContent = this.getTotalScore();
        }
        
        // Stop question timer
        this.stopQuestionTimer();

        // Move to next question after delay
        setTimeout(() => this.nextQuestion(), 800);
    }

    /**
     * Skip current question
     */
    skipQuestion() {
        if (this.isAnswered) return;
        this.stopQuestionTimer();
        this.nextQuestion();
    }

    /**
     * Move to next question
     */
    nextQuestion() {
        this.currentQuestionIndex++;

        if (this.currentQuestionIndex >= this.QUESTIONS_PER_ROUND) {
            this.endRound();
        } else {
            this.showQuestion();
        }
    }

    /**
     * End current round
     */
    endRound() {
        // Calculate and store round time
        this.roundTimes[this.currentRound - 1] = Date.now() - this.roundStartTime;
        
        const roundScore = this.roundScores[this.currentRound - 1];
        const roundAccuracy = Math.round((roundScore / this.QUESTIONS_PER_ROUND) * 100);
        const roundTime = this.formatTime(this.roundTimes[this.currentRound - 1]);

        document.getElementById('completedRound').textContent = this.currentRound;
        document.getElementById('roundScore').textContent = `${roundScore}/${this.QUESTIONS_PER_ROUND}`;
        document.getElementById('roundAccuracy').textContent = `${roundAccuracy}%`;
        document.getElementById('roundTime').textContent = roundTime;

        if (this.currentRound < this.TOTAL_ROUNDS) {
            document.getElementById('nextRoundNum').textContent = this.currentRound + 1;
            document.getElementById('nextRoundBtn').style.display = 'inline-flex';
        } else {
            document.getElementById('nextRoundBtn').style.display = 'none';
            // Add finish button
            const container = document.querySelector('#roundComplete .container');
            const finishBtn = document.createElement('button');
            finishBtn.className = 'btn btn-primary';
            finishBtn.innerHTML = `
                <span>View Results</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            `;
            finishBtn.addEventListener('click', () => this.showResults());
            container.appendChild(finishBtn);
        }

        this.showScreen('roundComplete');
    }

    /**
     * Start next round
     */
    startNextRound() {
        // Remove any finish button from previous
        const finishBtn = document.querySelector('#roundComplete .btn-primary:not(#nextRoundBtn)');
        if (finishBtn) finishBtn.remove();

        this.currentRound++;
        this.startRound();
        this.showScreen('quiz');
    }

    /**
     * Show final results
     */
    async showResults() {
        // Stop timers
        this.stopTotalTimer();
        
        const totalScore = this.getTotalScore();
        const totalQuestions = this.QUESTIONS_PER_ROUND * this.TOTAL_ROUNDS;
        const accuracy = Math.round((totalScore / totalQuestions) * 100);
        const totalTime = Date.now() - this.totalStartTime;

        // Record attempt
        await this.scoreTracker.recordAttempt(this.roundScores, totalScore, totalQuestions);

        // Update results display
        document.getElementById('finalScore').textContent = totalScore;
        document.getElementById('totalPossible').textContent = totalQuestions;
        document.getElementById('finalAccuracy').textContent = `${accuracy}% Accuracy`;
        document.getElementById('finalTime').textContent = this.formatTime(totalTime);

        // Render breakdown with times
        const breakdownList = document.getElementById('breakdownList');
        breakdownList.innerHTML = '';

        for (let i = 0; i < this.TOTAL_ROUNDS; i++) {
            const roundAcc = Math.round((this.roundScores[i] / this.QUESTIONS_PER_ROUND) * 100);
            const roundTime = this.formatTime(this.roundTimes[i]);
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.innerHTML = `
                <span class="breakdown-round">Round ${i + 1}</span>
                <span class="breakdown-score">${this.roundScores[i]}/${this.QUESTIONS_PER_ROUND} (${roundAcc}%) • ${roundTime}</span>
            `;
            breakdownList.appendChild(item);
        }

        // Previous vs current
        const stats = this.scoreTracker.getStats();
        document.getElementById('previousBest').textContent =
            stats.previousAccuracy !== null ? `${stats.previousAccuracy}%` : '--';
        document.getElementById('thisAttempt').textContent = `${accuracy}%`;

        // Update analysis UI and run if configured
        this.updateAnalysisUI();
        if (this.geminiAnalyzer.isConfigured()) {
            this.runAnalysis();
        }

        this.showScreen('results');
    }

    /**
     * Restart quiz
     */
    restartQuiz() {
        // Stop timers
        this.stopTotalTimer();
        this.stopQuestionTimer();
        
        // Remove any added finish buttons
        const finishBtn = document.querySelector('#roundComplete .btn-primary:not(#nextRoundBtn)');
        if (finishBtn) finishBtn.remove();

        // Reset and show next round button
        document.getElementById('nextRoundBtn').style.display = 'inline-flex';

        this.startQuiz();
    }

    /**
     * Go back to home screen
     */
    goHome() {
        // Stop timers
        this.stopTotalTimer();
        this.stopQuestionTimer();
        
        // Remove any added finish buttons
        const finishBtn = document.querySelector('#roundComplete .btn-primary:not(#nextRoundBtn)');
        if (finishBtn) finishBtn.remove();

        // Reset and show next round button
        document.getElementById('nextRoundBtn').style.display = 'inline-flex';

        this.updateStatsDisplay();
        this.showScreen('landing');
    }

    /**
     * Show a specific screen
     */
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    // ========================================
    // TIMER METHODS
    // ========================================
    
    /**
     * Start the question timer
     */
    startQuestionTimer() {
        this.stopQuestionTimer();
        const timerEl = document.getElementById('questionTimer');
        
        this.questionTimer = setInterval(() => {
            this.currentQuestionTime = Math.floor((Date.now() - this.questionStartTime) / 1000);
            document.getElementById('questionTime').textContent = `${this.currentQuestionTime}s`;
            
            // Add visual warning for slow answers
            if (this.currentQuestionTime >= 30) {
                timerEl.classList.add('danger');
                timerEl.classList.remove('warning');
            } else if (this.currentQuestionTime >= 15) {
                timerEl.classList.add('warning');
                timerEl.classList.remove('danger');
            } else {
                timerEl.classList.remove('warning', 'danger');
            }
        }, 1000);
    }
    
    /**
     * Stop the question timer
     */
    stopQuestionTimer() {
        if (this.questionTimer) {
            clearInterval(this.questionTimer);
            this.questionTimer = null;
        }
    }
    
    /**
     * Start the total timer
     */
    startTotalTimer() {
        this.stopTotalTimer();
        
        this.totalTimer = setInterval(() => {
            const elapsed = Date.now() - this.totalStartTime;
            document.getElementById('totalTimer').textContent = this.formatTime(elapsed);
        }, 1000);
    }
    
    /**
     * Stop the total timer
     */
    stopTotalTimer() {
        if (this.totalTimer) {
            clearInterval(this.totalTimer);
            this.totalTimer = null;
        }
    }
    
    /**
     * Format milliseconds to MM:SS or H:MM:SS
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizApp();
});
