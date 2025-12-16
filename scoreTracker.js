/**
 * Score Tracker Module
 * Handles persistence and tracking of quiz scores using localStorage and optional GitHub Gist sync
 */

class ScoreTracker {
    constructor() {
        this.storageKey = 'mcq_quiz_scores';
        this.gistDatabase = null;
        this.syncStatus = 'local'; // 'local', 'syncing', 'synced', 'error'
        this.loadScores();
    }

    /**
     * Set the Gist database for cloud sync
     */
    setGistDatabase(gistDb) {
        this.gistDatabase = gistDb;
    }

    /**
     * Load scores from localStorage
     */
    loadScores() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.data = stored ? JSON.parse(stored) : this.getDefaultData();
        } catch (e) {
            console.error('Error loading scores:', e);
            this.data = this.getDefaultData();
        }
    }

    /**
     * Load scores from cloud (Gist)
     */
    async loadFromCloud() {
        if (!this.gistDatabase || !this.gistDatabase.isAvailable()) {
            return false;
        }

        try {
            this.syncStatus = 'syncing';
            this.notifySyncStatus();

            const cloudData = await this.gistDatabase.loadData();
            
            if (cloudData) {
                // Merge cloud data with local data (cloud takes priority)
                this.data = this.mergeData(cloudData, this.data);
                this.saveScoresLocal();
                this.syncStatus = 'synced';
            } else {
                // No cloud data, upload local data
                await this.saveToCloud();
            }

            this.notifySyncStatus();
            return true;
        } catch (error) {
            console.error('Error loading from cloud:', error);
            this.syncStatus = 'error';
            this.notifySyncStatus();
            return false;
        }
    }

    /**
     * Merge cloud and local data
     */
    mergeData(cloudData, localData) {
        // Use cloud data as base, but take higher values for best scores
        return {
            attempts: cloudData.attempts || localData.attempts || [],
            lastAttempt: cloudData.lastAttempt || localData.lastAttempt,
            bestScore: Math.max(cloudData.bestScore || 0, localData.bestScore || 0),
            bestAccuracy: Math.max(cloudData.bestAccuracy || 0, localData.bestAccuracy || 0),
            totalAttempts: Math.max(cloudData.totalAttempts || 0, localData.totalAttempts || 0),
            createdAt: cloudData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Save scores to cloud (Gist)
     */
    async saveToCloud() {
        if (!this.gistDatabase || !this.gistDatabase.isAvailable()) {
            this.syncStatus = 'local';
            this.notifySyncStatus();
            return false;
        }

        try {
            this.syncStatus = 'syncing';
            this.notifySyncStatus();

            const success = await this.gistDatabase.saveData(this.data);
            this.syncStatus = success ? 'synced' : 'error';
            this.notifySyncStatus();
            return success;
        } catch (error) {
            console.error('Error saving to cloud:', error);
            this.syncStatus = 'error';
            this.notifySyncStatus();
            return false;
        }
    }

    /**
     * Notify sync status change
     */
    notifySyncStatus() {
        const event = new CustomEvent('syncStatusChange', { detail: this.syncStatus });
        window.dispatchEvent(event);
    }

    /**
     * Get sync status
     */
    getSyncStatus() {
        return this.syncStatus;
    }

    /**
     * Get default data structure
     */
    getDefaultData() {
        return {
            attempts: [],
            lastAttempt: null,
            bestScore: 0,
            bestAccuracy: 0,
            totalAttempts: 0
        };
    }

    /**
     * Save scores to localStorage only
     */
    saveScoresLocal() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (e) {
            console.error('Error saving scores locally:', e);
        }
    }

    /**
     * Save scores to localStorage and optionally cloud
     */
    async saveScores() {
        this.saveScoresLocal();
        
        // Also save to cloud if available
        if (this.gistDatabase && this.gistDatabase.isAvailable()) {
            await this.saveToCloud();
        }
    }

    /**
     * Record a new attempt
     */
    async recordAttempt(roundScores, totalScore, totalQuestions) {
        const accuracy = Math.round((totalScore / totalQuestions) * 100);

        const attempt = {
            date: new Date().toISOString(),
            rounds: roundScores,
            totalScore: totalScore,
            totalQuestions: totalQuestions,
            accuracy: accuracy
        };

        this.data.attempts.unshift(attempt);

        // Keep only last 50 attempts
        if (this.data.attempts.length > 50) {
            this.data.attempts = this.data.attempts.slice(0, 50);
        }

        this.data.lastAttempt = attempt;
        this.data.totalAttempts++;

        if (totalScore > this.data.bestScore) {
            this.data.bestScore = totalScore;
        }

        if (accuracy > this.data.bestAccuracy) {
            this.data.bestAccuracy = accuracy;
        }

        await this.saveScores();
        return attempt;
    }

    /**
     * Get the last attempt's accuracy
     */
    getLastAccuracy() {
        if (this.data.attempts.length < 2) {
            return null;
        }
        return this.data.attempts[1]?.accuracy || null;
    }

    /**
     * Get previous accuracy (before current session)
     */
    getPreviousAccuracy() {
        if (!this.data.lastAttempt) {
            return null;
        }
        return this.data.lastAttempt.accuracy;
    }

    /**
     * Get best score
     */
    getBestScore() {
        return this.data.bestScore;
    }

    /**
     * Get best accuracy
     */
    getBestAccuracy() {
        return this.data.bestAccuracy;
    }

    /**
     * Get total attempts
     */
    getTotalAttempts() {
        return this.data.totalAttempts;
    }

    /**
     * Get all attempts
     */
    getAllAttempts() {
        return this.data.attempts;
    }

    /**
     * Get statistics
     */
    getStats() {
        const attempts = this.data.attempts;

        if (attempts.length === 0) {
            return {
                lastAccuracy: null,
                bestScore: 0,
                bestAccuracy: 0,
                totalAttempts: 0,
                averageAccuracy: 0
            };
        }

        const averageAccuracy = Math.round(
            attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length
        );

        return {
            lastAccuracy: attempts[0]?.accuracy || null,
            previousAccuracy: attempts[1]?.accuracy || null,
            bestScore: this.data.bestScore,
            bestAccuracy: this.data.bestAccuracy,
            totalAttempts: this.data.totalAttempts,
            averageAccuracy: averageAccuracy
        };
    }

    /**
     * Clear all scores
     */
    async clearScores() {
        this.data = this.getDefaultData();
        await this.saveScores();
    }
}

// Export for use in app.js
window.ScoreTracker = ScoreTracker;
