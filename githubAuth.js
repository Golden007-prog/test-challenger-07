/**
 * GitHub Authentication & Gist Database Module
 * Handles GitHub Personal Access Token authentication and Gist-based data storage
 */

class GitHubAuth {
    constructor() {
        this.tokenKey = 'github_pat_token';
        this.userKey = 'github_user_data';
        this.token = localStorage.getItem(this.tokenKey);
        this.user = JSON.parse(localStorage.getItem(this.userKey) || 'null');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    /**
     * Get current user info
     */
    getUser() {
        return this.user;
    }

    /**
     * Validate and save GitHub token
     */
    async login(token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            this.user = await response.json();
            this.token = token;
            
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(this.user));

            return { success: true, user: this.user };
        } catch (error) {
            console.error('GitHub login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Logout and clear stored credentials
     */
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    /**
     * Get the stored token
     */
    getToken() {
        return this.token;
    }
}

class GistDatabase {
    constructor(githubAuth) {
        this.auth = githubAuth;
        this.gistId = localStorage.getItem('mcq_gist_id');
        this.gistFilename = 'mcq-quiz-data.json';
        this.gistDescription = 'MCQ Quiz App - Score Data (Private)';
    }

    /**
     * Check if database is available
     */
    isAvailable() {
        return this.auth.isAuthenticated();
    }

    /**
     * Find existing gist or create new one
     */
    async initializeGist() {
        if (!this.isAvailable()) return null;

        try {
            // Try to find existing gist
            if (this.gistId) {
                const existing = await this.getGist();
                if (existing) return this.gistId;
            }

            // Search for existing gist with our description
            const gists = await this.listGists();
            const found = gists.find(g => g.description === this.gistDescription);
            
            if (found) {
                this.gistId = found.id;
                localStorage.setItem('mcq_gist_id', found.id);
                return found.id;
            }

            // Create new gist
            return await this.createGist();
        } catch (error) {
            console.error('Error initializing gist:', error);
            return null;
        }
    }

    /**
     * List user's gists
     */
    async listGists() {
        const response = await fetch('https://api.github.com/gists', {
            headers: {
                'Authorization': `token ${this.auth.getToken()}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return response.ok ? await response.json() : [];
    }

    /**
     * Get a specific gist
     */
    async getGist() {
        if (!this.gistId) return null;

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.auth.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            return response.ok ? await response.json() : null;
        } catch {
            return null;
        }
    }

    /**
     * Create a new private gist
     */
    async createGist() {
        const defaultData = {
            attempts: [],
            lastAttempt: null,
            bestScore: 0,
            bestAccuracy: 0,
            totalAttempts: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.auth.getToken()}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: this.gistDescription,
                public: false,
                files: {
                    [this.gistFilename]: {
                        content: JSON.stringify(defaultData, null, 2)
                    }
                }
            })
        });

        if (response.ok) {
            const gist = await response.json();
            this.gistId = gist.id;
            localStorage.setItem('mcq_gist_id', gist.id);
            return gist.id;
        }
        return null;
    }

    /**
     * Load data from gist
     */
    async loadData() {
        if (!this.isAvailable()) return null;

        try {
            await this.initializeGist();
            const gist = await this.getGist();
            
            if (gist && gist.files && gist.files[this.gistFilename]) {
                return JSON.parse(gist.files[this.gistFilename].content);
            }
            return null;
        } catch (error) {
            console.error('Error loading data from gist:', error);
            return null;
        }
    }

    /**
     * Save data to gist
     */
    async saveData(data) {
        if (!this.isAvailable() || !this.gistId) return false;

        try {
            data.updatedAt = new Date().toISOString();

            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.auth.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        [this.gistFilename]: {
                            content: JSON.stringify(data, null, 2)
                        }
                    }
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Error saving data to gist:', error);
            return false;
        }
    }

    /**
     * Clear gist ID on logout
     */
    clearGistId() {
        this.gistId = null;
        localStorage.removeItem('mcq_gist_id');
    }
}

// Export for use in other modules
window.GitHubAuth = GitHubAuth;
window.GistDatabase = GistDatabase;
