/**
 * Gemini AI Analyzer Module
 * Uses Google's Gemini API to analyze quiz performance and provide insights
 */

class GeminiAnalyzer {
    constructor() {
        this.apiKeyStorage = 'gemini_api_key';
        this.apiKey = localStorage.getItem(this.apiKeyStorage);
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    }

    /**
     * Check if API key is configured
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Set API key
     */
    setApiKey(key) {
        this.apiKey = key;
        if (key) {
            localStorage.setItem(this.apiKeyStorage, key);
        } else {
            localStorage.removeItem(this.apiKeyStorage);
        }
    }

    /**
     * Get stored API key
     */
    getApiKey() {
        return this.apiKey;
    }

    /**
     * Clear API key
     */
    clearApiKey() {
        this.apiKey = null;
        localStorage.removeItem(this.apiKeyStorage);
    }

    /**
     * Analyze quiz performance
     */
    async analyzePerformance(quizData) {
        if (!this.isConfigured()) {
            return { success: false, error: 'API key not configured' };
        }

        const prompt = this.buildAnalysisPrompt(quizData);

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();
            const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!analysisText) {
                throw new Error('No analysis generated');
            }

            return {
                success: true,
                analysis: this.parseAnalysis(analysisText)
            };
        } catch (error) {
            console.error('Gemini analysis error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build analysis prompt from quiz data
     */
    buildAnalysisPrompt(data) {
        const { roundScores, totalScore, totalQuestions, accuracy, roundTimes, previousAttempts } = data;

        let prompt = `You are an expert educational coach analyzing a student's MCQ quiz performance. Provide actionable insights.

## Current Quiz Results
- Total Score: ${totalScore}/${totalQuestions} (${accuracy}% accuracy)
- Round 1: ${roundScores[0]}/50 questions correct
- Round 2: ${roundScores[1]}/50 questions correct  
- Round 3: ${roundScores[2]}/50 questions correct
- Round Times: R1: ${roundTimes[0]}, R2: ${roundTimes[1]}, R3: ${roundTimes[2]}
`;

        if (previousAttempts && previousAttempts.length > 0) {
            prompt += `\n## Previous Attempts (last ${Math.min(5, previousAttempts.length)})\n`;
            previousAttempts.slice(0, 5).forEach((attempt, i) => {
                prompt += `- Attempt ${i + 1}: ${attempt.accuracy}% (${attempt.totalScore}/${attempt.totalQuestions})\n`;
            });
        }

        prompt += `
## Your Task
Analyze this performance and provide:

1. **Performance Summary** (2-3 sentences on overall performance)
2. **Strengths** (what they did well, be specific)
3. **Areas to Improve** (specific weaknesses identified from the patterns)
4. **Study Recommendations** (3-4 actionable tips based on the data)
5. **Motivation** (encouraging closing message)

Keep the response concise but insightful. Use emojis sparingly to make it engaging.
Format your response in a structured way using markdown with headers.`;

        return prompt;
    }

    /**
     * Parse and structure the analysis response
     */
    parseAnalysis(text) {
        // Return the raw markdown text - will be rendered in UI
        return {
            rawText: text,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Quick performance grade
     */
    getPerformanceGrade(accuracy) {
        if (accuracy >= 90) return { grade: 'A+', emoji: '🌟', label: 'Outstanding!' };
        if (accuracy >= 80) return { grade: 'A', emoji: '🎯', label: 'Excellent!' };
        if (accuracy >= 70) return { grade: 'B', emoji: '👍', label: 'Good Job!' };
        if (accuracy >= 60) return { grade: 'C', emoji: '📚', label: 'Keep Learning!' };
        if (accuracy >= 50) return { grade: 'D', emoji: '💪', label: 'You Can Do Better!' };
        return { grade: 'F', emoji: '🔥', label: 'Time to Study Hard!' };
    }
}

// Export for use in other modules
window.GeminiAnalyzer = GeminiAnalyzer;
