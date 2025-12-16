/**
 * PDF Parser Module
 * Handles loading and extracting questions from PDF files in the tech folder
 */

class PDFParser {
    constructor() {
        this.pdfjsLib = window.pdfjsLib;
        if (this.pdfjsLib) {
            this.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        this.questions = [];
    }

    /**
     * Load all PDFs from the tech folder
     */
    async loadPDFs(pdfFiles) {
        this.questions = [];

        for (const file of pdfFiles) {
            try {
                const questions = await this.extractQuestionsFromPDF(file);
                this.questions.push(...questions);
            } catch (error) {
                console.error(`Error loading ${file.name}:`, error);
            }
        }

        return this.questions;
    }

    /**
     * Extract text from a PDF file
     */
    async extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    }

    /**
     * Extract questions from PDF text
     */
    async extractQuestionsFromPDF(file) {
        const text = await this.extractTextFromPDF(file);
        const questions = this.parseQuestions(text, file.name);
        return questions;
    }

    /**
     * Parse questions from text using multiple patterns
     */
    parseQuestions(text, sourcePdf) {
        const questions = [];

        // First fix ligatures in the entire text
        let cleanText = this.fixLigatures(text)
            .replace(/\s+/g, ' ')
            .replace(/\r\n/g, '\n')
            .trim();

        // Pattern 1: Q1. or Q.1 or 1. or 1) followed by question
        // Important: Option markers must be preceded by whitespace to avoid matching inside expressions like "(A + B)"
        const patterns = [
            // Pattern: Q1. Question text A) option B) option C) option D) option Answer: A
            // Note: (?:\s|^) ensures option letter is at start or after whitespace
            /(?:Q\.?\s*)?(\d+)[.\)]\s*(.+?)\s+A[.\)]\s*(.+?)\s+B[.\)]\s*(.+?)\s+C[.\)]\s*(.+?)\s+D[.\)]\s*(.+?)\s*(?:Answer|Ans|ANS|Correct)[:\s]*([A-Da-d])/gi,

            // Pattern: 1. Question (A) option (B) option (C) option (D) option Ans: A
            /(\d+)[.\)]\s*(.+?)\s+\(A\)\s*(.+?)\s+\(B\)\s*(.+?)\s+\(C\)\s*(.+?)\s+\(D\)\s*(.+?)\s*(?:Answer|Ans|ANS|Correct)[:\s]*([A-Da-d])/gi,
        ];

        // Try each pattern
        for (const pattern of patterns) {
            let match;
            const tempText = cleanText;
            pattern.lastIndex = 0;

            while ((match = pattern.exec(tempText)) !== null) {
                const [_, num, questionText, optA, optB, optC, optD, answer] = match;

                if (questionText && optA && optB && optC && optD && answer) {
                    questions.push({
                        id: `${sourcePdf}-${num}`,
                        number: parseInt(num),
                        question: this.cleanText(questionText),
                        options: {
                            A: this.cleanText(optA),
                            B: this.cleanText(optB),
                            C: this.cleanText(optC),
                            D: this.cleanText(optD)
                        },
                        answer: answer.toUpperCase(),
                        source: sourcePdf
                    });
                }
            }
        }

        // If patterns didn't work well, try a more flexible approach
        if (questions.length < 5) {
            return this.parseQuestionsFlexible(cleanText, sourcePdf);
        }

        return questions;
    }

    /**
     * More flexible question parsing for varied formats
     */
    parseQuestionsFlexible(text, sourcePdf) {
        const questions = [];

        // Split by question numbers
        const questionBlocks = text.split(/(?=(?:Q\.?\s*)?\d{1,3}[.\)])/);

        for (const block of questionBlocks) {
            if (block.trim().length < 20) continue;

            try {
                // Extract question number
                const numMatch = block.match(/^(?:Q\.?\s*)?(\d{1,3})[.\)]/);
                if (!numMatch) continue;

                const num = parseInt(numMatch[1]);
                let remaining = block.substring(numMatch[0].length).trim();

                // Find options - require whitespace before option markers
                // This prevents matching "B)" inside "(A + B)'" as an option
                const optionPatterns = [
                    // Pattern with whitespace requirement before each option
                    /^(.+?)\s+A[.\)]\s*(.+?)\s+B[.\)]\s*(.+?)\s+C[.\)]\s*(.+?)\s+D[.\)]\s*(.+?)(?:\s*(?:Answer|Ans|ANS|Correct)[:\s]*([A-Da-d]))?/i,
                    /^(.+?)\s+\(A\)\s*(.+?)\s+\(B\)\s*(.+?)\s+\(C\)\s*(.+?)\s+\(D\)\s*(.+?)(?:\s*(?:Answer|Ans|ANS|Correct)[:\s]*([A-Da-d]))?/i,
                ];

                for (const optPattern of optionPatterns) {
                    const optMatch = remaining.match(optPattern);
                    if (optMatch) {
                        // optMatch[1] = question text
                        // optMatch[2-5] = options A-D
                        // optMatch[6] = answer
                        const questionText = optMatch[1] ? optMatch[1].trim() : '';

                        if (questionText.length > 10) {
                            questions.push({
                                id: `${sourcePdf}-${num}`,
                                number: num,
                                question: this.cleanText(questionText),
                                options: {
                                    A: this.cleanText(optMatch[2] || ''),
                                    B: this.cleanText(optMatch[3] || ''),
                                    C: this.cleanText(optMatch[4] || ''),
                                    D: this.cleanText(optMatch[5] || '')
                                },
                                answer: optMatch[6] ? optMatch[6].toUpperCase() : 'A',
                                source: sourcePdf
                            });
                        }
                        break;
                    }
                }
            } catch (e) {
                console.error('Error parsing block:', e);
            }
        }

        return questions;
    }

    /**
     * Fix common ligature and character extraction issues from PDFs
     */
    fixLigatures(text) {
        if (!text) return '';

        let result = text;

        // Replace Greek theta (commonly misread for 'ti' ligature) 
        result = result.replace(/\u0398/g, 'ti');  // Θ Capital Theta
        result = result.replace(/\u03B8/g, 'ti');  // θ Small Theta
        result = result.replace(/\u019F/g, 'ti');  // Ɵ
        result = result.replace(/\u0275/g, 'ti');  // ɵ

        // Replace Greek sigma (commonly misread for 'tt' ligature)
        result = result.replace(/\u03A3/g, 'tt');  // Σ Capital Sigma
        result = result.replace(/\u03C3/g, 'tt');  // σ Small Sigma
        result = result.replace(/\u03C2/g, 'tt');  // ς Final Sigma
        
        // Replace O with tilde (commonly misread for 'ft' ligature)
        result = result.replace(/\u00D5/g, 'ft');  // Õ Capital O with Tilde
        result = result.replace(/\u00F5/g, 'ft');  // õ Small O with Tilde

        // Replace other common misread characters
        result = result.replace(/\u0192/g, 'f');   // ƒ function symbol
        result = result.replace(/\u00B5/g, 'u');   // µ micro sign
        
        // Fix common 'ft' words before ligature replacement
        result = result.replace(/so\s*ft\s*ware/gi, 'software');
        result = result.replace(/so\s*Õ\s*ware/gi, 'software');
        result = result.replace(/hard\s*ware/gi, 'hardware');
        result = result.replace(/a\s*ft\s*er/gi, 'after');
        result = result.replace(/le\s*ft/gi, 'left');
        result = result.replace(/shi\s*ft/gi, 'shift');
        result = result.replace(/dra\s*ft/gi, 'draft');
        result = result.replace(/cra\s*ft/gi, 'craft');
        result = result.replace(/swi\s*ft/gi, 'swift');
        result = result.replace(/li\s*ft/gi, 'lift');
        result = result.replace(/gi\s*ft/gi, 'gift');

        // Standard ligatures
        result = result.replace(/\ufb01/g, 'fi');
        result = result.replace(/\ufb02/g, 'fl');
        result = result.replace(/\ufb03/g, 'ffi');
        result = result.replace(/\ufb04/g, 'ffl');
        result = result.replace(/\ufb05/g, 'st');
        result = result.replace(/\ufb06/g, 'st');

        // Curly quotes to straight quotes
        result = result.replace(/\u2018/g, "'");
        result = result.replace(/\u2019/g, "'");
        result = result.replace(/\u201C/g, '"');
        result = result.replace(/\u201D/g, '"');

        // Dashes and special chars
        result = result.replace(/\u2013/g, '-');
        result = result.replace(/\u2014/g, '-');
        result = result.replace(/\u2026/g, '...');

        // Various space characters
        result = result.replace(/\u00A0/g, ' ');
        result = result.replace(/\u2003/g, ' ');
        result = result.replace(/\u2002/g, ' ');
        result = result.replace(/\u2009/g, ' ');
        result = result.replace(/\u200B/g, '');
        result = result.replace(/\u00AD/g, '');
        result = result.replace(/\uFEFF/g, '');

        // Fix words with 'tt' (from Sigma replacement)
        // Note: Sigma Σ was already replaced with 'tt' above
        result = result.replace(/a\s*tt\s*ributes/gi, 'attributes');
        result = result.replace(/a\s*tt\s*ribute/gi, 'attribute');
        result = result.replace(/a\s*tt\s*ribut/gi, 'attribut');
        result = result.replace(/a\s*tt\s*ack/gi, 'attack');
        result = result.replace(/a\s*tt\s*acker/gi, 'attacker');
        result = result.replace(/a\s*tt\s*ach/gi, 'attach');
        result = result.replace(/a\s*tt\s*ached/gi, 'attached');
        result = result.replace(/a\s*tt\s*achment/gi, 'attachment');
        result = result.replace(/a\s*tt\s*empt/gi, 'attempt');
        result = result.replace(/a\s*tt\s*en/gi, 'atten');
        result = result.replace(/be\s*tt\s*er/gi, 'better');
        result = result.replace(/bu\s*tt\s*on/gi, 'button');
        result = result.replace(/le\s*tt\s*er/gi, 'letter');
        result = result.replace(/pa\s*tt\s*ern/gi, 'pattern');
        result = result.replace(/ma\s*tt\s*er/gi, 'matter');
        result = result.replace(/se\s*tt\s*ing/gi, 'setting');
        result = result.replace(/ge\s*tt\s*ing/gi, 'getting');
        result = result.replace(/pu\s*tt\s*ing/gi, 'putting');
        result = result.replace(/wri\s*tt\s*en/gi, 'written');
        result = result.replace(/permi\s*tt\s*ed/gi, 'permitted');
        result = result.replace(/transmi\s*tt\s*ed/gi, 'transmitted');
        result = result.replace(/emi\s*tt\s*ed/gi, 'emitted');
        result = result.replace(/submi\s*tt\s*ed/gi, 'submitted');
        result = result.replace(/commi\s*tt\s*ed/gi, 'committed');
        result = result.replace(/forma\s*tt\s*ed/gi, 'formatted');
        result = result.replace(/forma\s*tt\s*ing/gi, 'formatting');
        result = result.replace(/bo\s*tt\s*om/gi, 'bottom');
        result = result.replace(/bo\s*tt\s*le/gi, 'bottle');
        result = result.replace(/sca\s*tt\s*er/gi, 'scatter');
        result = result.replace(/bi\s*tt\s*er/gi, 'bitter');
        result = result.replace(/li\s*tt\s*le/gi, 'little');
        result = result.replace(/ba\s*tt\s*le/gi, 'battle');
        result = result.replace(/ne\s*tt\s*work/gi, 'nettwork');
        result = result.replace(/co\s*tt\s*on/gi, 'cotton');
        result = result.replace(/ki\s*tt\s*en/gi, 'kitten');
        result = result.replace(/bi\s*tt\s*en/gi, 'bitten');
        result = result.replace(/hi\s*tt\s*ing/gi, 'hitting');
        result = result.replace(/si\s*tt\s*ing/gi, 'sitting');
        result = result.replace(/cu\s*tt\s*ing/gi, 'cutting');
        result = result.replace(/spi\s*tt\s*ing/gi, 'spitting');
        result = result.replace(/spli\s*tt\s*ing/gi, 'splitting');
        result = result.replace(/omi\s*tt\s*ing/gi, 'omitting');
        result = result.replace(/admi\s*tt\s*ing/gi, 'admitting');
        result = result.replace(/permi\s*tt\s*ing/gi, 'permitting');

        // Fix common broken words (ligature artifacts create spaces)
        // Words with 'ti'
        result = result.replace(/inser\s*ti\s*on/gi, 'insertion');
        result = result.replace(/dele\s*ti\s*on/gi, 'deletion');
        result = result.replace(/alloca\s*ti\s*on/gi, 'allocation');
        result = result.replace(/selec\s*ti\s*on/gi, 'selection');
        result = result.replace(/collec\s*ti\s*on/gi, 'collection');
        result = result.replace(/connec\s*ti\s*on/gi, 'connection');
        result = result.replace(/protec\s*ti\s*on/gi, 'protection');
        result = result.replace(/detec\s*ti\s*on/gi, 'detection');
        result = result.replace(/direc\s*ti\s*on/gi, 'direction');
        result = result.replace(/correc\s*ti\s*on/gi, 'correction');
        result = result.replace(/restric\s*ti\s*on/gi, 'restriction');
        result = result.replace(/abstrac\s*ti\s*on/gi, 'abstraction');
        result = result.replace(/transac\s*ti\s*on/gi, 'transaction');
        result = result.replace(/interac\s*ti\s*on/gi, 'interaction');
        result = result.replace(/subtrac\s*ti\s*on/gi, 'subtraction');
        result = result.replace(/extrac\s*ti\s*on/gi, 'extraction');
        result = result.replace(/produc\s*ti\s*on/gi, 'production');
        result = result.replace(/reduc\s*ti\s*on/gi, 'reduction');
        result = result.replace(/induc\s*ti\s*on/gi, 'induction');
        result = result.replace(/deduc\s*ti\s*on/gi, 'deduction');
        result = result.replace(/introduc\s*ti\s*on/gi, 'introduction');
        result = result.replace(/loca\s*ti\s*ng/gi, 'locating');
        result = result.replace(/correc\s*ti\s*ng/gi, 'correcting');
        result = result.replace(/tes\s*ti\s*ng/gi, 'testing');
        result = result.replace(/valida\s*ti\s*on/gi, 'validation');
        result = result.replace(/execu\s*ti\s*on/gi, 'execution');
        result = result.replace(/func\s*ti\s*on/gi, 'function');
        result = result.replace(/op\s*ti\s*on/gi, 'option');
        result = result.replace(/sec\s*ti\s*on/gi, 'section');
        result = result.replace(/ac\s*ti\s*on/gi, 'action');
        result = result.replace(/condi\s*ti\s*on/gi, 'condition');
        result = result.replace(/itera\s*ti\s*on/gi, 'iteration');
        result = result.replace(/opera\s*ti\s*on/gi, 'operation');
        result = result.replace(/applica\s*ti\s*on/gi, 'application');
        result = result.replace(/declara\s*ti\s*on/gi, 'declaration');
        result = result.replace(/defini\s*ti\s*on/gi, 'definition');
        result = result.replace(/instruc\s*ti\s*on/gi, 'instruction');
        result = result.replace(/no\s*ti\s*fica\s*ti\s*on/gi, 'notification');
        result = result.replace(/authen\s*ti\s*ca\s*ti\s*on/gi, 'authentication');
        result = result.replace(/iden\s*ti\s*fica\s*ti\s*on/gi, 'identification');
        result = result.replace(/ini\s*ti\s*aliza\s*ti\s*on/gi, 'initialization');
        result = result.replace(/iden\s*ti\s*fy/gi, 'identify');
        result = result.replace(/iden\s*ti\s*fied/gi, 'identified');
        result = result.replace(/iden\s*ti\s*fier/gi, 'identifier');
        result = result.replace(/iden\s*ti\s*fies/gi, 'identifies');
        result = result.replace(/iden\s*ti\s*ty/gi, 'identity');
        result = result.replace(/quan\s*ti\s*ty/gi, 'quantity');
        result = result.replace(/en\s*ti\s*ty/gi, 'entity');
        result = result.replace(/en\s*ti\s*ties/gi, 'entities');
        result = result.replace(/uniqu/gi, 'uniqu');
        result = result.replace(/uni\s*que\s*ly/gi, 'uniquely');
        result = result.replace(/prac\s*ti\s*ce/gi, 'practice');
        result = result.replace(/prac\s*ti\s*cal/gi, 'practical');
        result = result.replace(/par\s*ti\s*al/gi, 'partial');
        result = result.replace(/ini\s*ti\s*al/gi, 'initial');
        result = result.replace(/essen\s*ti\s*al/gi, 'essential');
        result = result.replace(/poten\s*ti\s*al/gi, 'potential');
        result = result.replace(/sequen\s*ti\s*al/gi, 'sequential');
        result = result.replace(/mul\s*ti\s*ple/gi, 'multiple');
        result = result.replace(/posi\s*ti\s*ve/gi, 'positive');
        result = result.replace(/nega\s*ti\s*ve/gi, 'negative');
        result = result.replace(/rela\s*ti\s*ve/gi, 'relative');
        result = result.replace(/primi\s*ti\s*ve/gi, 'primitive');
        result = result.replace(/execu\s*ti\s*ve/gi, 'executive');
        result = result.replace(/itera\s*ti\s*ve/gi, 'iterative');
        result = result.replace(/transi\s*ti\s*ve/gi, 'transitive');
        result = result.replace(/sensi\s*ti\s*ve/gi, 'sensitive');
        result = result.replace(/effec\s*ti\s*ve/gi, 'effective');
        result = result.replace(/selec\s*ti\s*ve/gi, 'selective');
        result = result.replace(/objec\s*ti\s*ve/gi, 'objective');
        result = result.replace(/subjec\s*ti\s*ve/gi, 'subjective');
        result = result.replace(/addic\s*ti\s*ve/gi, 'addictive');
        result = result.replace(/predic\s*ti\s*ve/gi, 'predictive');
        result = result.replace(/restric\s*ti\s*ve/gi, 'restrictive');
        result = result.replace(/descrip\s*ti\s*ve/gi, 'descriptive');
        result = result.replace(/produc\s*ti\s*ve/gi, 'productive');
        result = result.replace(/destruc\s*ti\s*ve/gi, 'destructive');
        result = result.replace(/instruc\s*ti\s*ve/gi, 'instructive');
        result = result.replace(/construc\s*ti\s*ve/gi, 'constructive');
        result = result.replace(/alterna\s*ti\s*ve/gi, 'alternative');
        result = result.replace(/quan\s*ti\s*ta\s*ti\s*ve/gi, 'quantitative');
        result = result.replace(/quali\s*ta\s*ti\s*ve/gi, 'qualitative');
        result = result.replace(/coopera\s*ti\s*ve/gi, 'cooperative');
        result = result.replace(/repre\s*sen\s*ta\s*ti\s*ve/gi, 'representative');
        result = result.replace(/automa\s*ti\s*c/gi, 'automatic');
        result = result.replace(/pragma\s*ti\s*c/gi, 'pragmatic');
        result = result.replace(/sta\s*ti\s*c/gi, 'static');
        result = result.replace(/compe\s*ti\s*ti\s*ve/gi, 'competitive');
        result = result.replace(/sor\s*ti\s*ng/gi, 'sorting');
        result = result.replace(/prin\s*ti\s*ng/gi, 'printing');
        result = result.replace(/wri\s*ti\s*ng/gi, 'writing');
        result = result.replace(/edi\s*ti\s*ng/gi, 'editing');
        result = result.replace(/compu\s*ti\s*ng/gi, 'computing');
        result = result.replace(/coun\s*ti\s*ng/gi, 'counting');
        result = result.replace(/poin\s*ti\s*ng/gi, 'pointing');
        result = result.replace(/selec\s*ti\s*ng/gi, 'selecting');
        result = result.replace(/crea\s*ti\s*ng/gi, 'creating');
        result = result.replace(/dele\s*ti\s*ng/gi, 'deleting');
        result = result.replace(/upda\s*ti\s*ng/gi, 'updating');
        result = result.replace(/forma\s*tti\s*ng/gi, 'formatting');
        result = result.replace(/connec\s*ti\s*ng/gi, 'connecting');
        result = result.replace(/conver\s*ti\s*ng/gi, 'converting');
        result = result.replace(/represen\s*ti\s*ng/gi, 'representing');
        result = result.replace(/itera\s*ti\s*ng/gi, 'iterating');
        result = result.replace(/opera\s*ti\s*ng/gi, 'operating');
        result = result.replace(/genera\s*ti\s*ng/gi, 'generating');
        result = result.replace(/naviga\s*ti\s*ng/gi, 'navigating');
        result = result.replace(/calcula\s*ti\s*ng/gi, 'calculating');
        result = result.replace(/simula\s*ti\s*ng/gi, 'simulating');
        result = result.replace(/evalua\s*ti\s*ng/gi, 'evaluating');
        result = result.replace(/valida\s*ti\s*ng/gi, 'validating');
        result = result.replace(/communica\s*ti\s*ng/gi, 'communicating');
        result = result.replace(/demonstra\s*ti\s*ng/gi, 'demonstrating');
        result = result.replace(/termina\s*ti\s*ng/gi, 'terminating');
        result = result.replace(/origina\s*ti\s*ng/gi, 'originating');
        result = result.replace(/redirec\s*ti\s*ng/gi, 'redirecting');
        result = result.replace(/predic\s*ti\s*ng/gi, 'predicting');
        result = result.replace(/restar\s*ti\s*ng/gi, 'restarting');
        result = result.replace(/star\s*ti\s*ng/gi, 'starting');
        result = result.replace(/expor\s*ti\s*ng/gi, 'exporting');
        result = result.replace(/impor\s*ti\s*ng/gi, 'importing');
        result = result.replace(/suppor\s*ti\s*ng/gi, 'supporting');
        result = result.replace(/repor\s*ti\s*ng/gi, 'reporting');
        result = result.replace(/asser\s*ti\s*ng/gi, 'asserting');
        result = result.replace(/inser\s*ti\s*ng/gi, 'inserting');
        result = result.replace(/conver\s*ti\s*ng/gi, 'converting');
        result = result.replace(/inver\s*ti\s*ng/gi, 'inverting');
        result = result.replace(/rever\s*ti\s*ng/gi, 'reverting');
        result = result.replace(/diver\s*ti\s*ng/gi, 'diverting');
        result = result.replace(/adver\s*ti\s*sing/gi, 'advertising');
        result = result.replace(/par\s*ti\s*ti\s*oning/gi, 'partitioning');
        result = result.replace(/alterna\s*ti\s*ng/gi, 'alternating');
        result = result.replace(/repor\s*ti\s*ng/gi, 'reporting');
        result = result.replace(/implemen\s*ti\s*ng/gi, 'implementing');
        result = result.replace(/documen\s*ti\s*ng/gi, 'documenting');

        // Words with 'fi'
        result = result.replace(/de\s*fi\s*ne/gi, 'define');
        result = result.replace(/de\s*fi\s*ned/gi, 'defined');
        result = result.replace(/de\s*fi\s*ni\s*ti\s*on/gi, 'definition');
        result = result.replace(/fi\s*le/gi, 'file');
        result = result.replace(/fi\s*les/gi, 'files');
        result = result.replace(/fi\s*nd/gi, 'find');
        result = result.replace(/fi\s*rst/gi, 'first');
        result = result.replace(/speci\s*fi\s*c/gi, 'specific');
        result = result.replace(/speci\s*fi\s*ca\s*ti\s*on/gi, 'specification');
        result = result.replace(/modi\s*fi\s*er/gi, 'modifier');
        result = result.replace(/modi\s*fi\s*ca\s*ti\s*on/gi, 'modification');
        result = result.replace(/identi\s*fi\s*er/gi, 'identifier');
        result = result.replace(/classi\s*fi\s*ca\s*ti\s*on/gi, 'classification');
        result = result.replace(/encryp\s*ti\s*on/gi, 'encryption');
        result = result.replace(/decryp\s*ti\s*on/gi, 'decryption');

        // Words with 'fl'
        result = result.replace(/\bfl\s+ow\b/gi, 'flow');
        result = result.replace(/\bfl\s+oat\b/gi, 'float');
        result = result.replace(/\bfl\s+ag\b/gi, 'flag');

        // Additional specific words
        result = result.replace(/exis\s*ti\s*ng/gi, 'existing');
        result = result.replace(/run\s*ti\s*me/gi, 'runtime');
        result = result.replace(/life\s*ti\s*me/gi, 'lifetime');
        result = result.replace(/some\s*ti\s*me/gi, 'sometime');
        result = result.replace(/mean\s*ti\s*me/gi, 'meantime');
        result = result.replace(/over\s*ti\s*me/gi, 'overtime');
        result = result.replace(/par\s*ti\s*ti\s*on/gi, 'partition');
        result = result.replace(/repe\s*ti\s*ti\s*on/gi, 'repetition');
        result = result.replace(/compe\s*ti\s*ti\s*on/gi, 'competition');
        result = result.replace(/addi\s*ti\s*on/gi, 'addition');
        result = result.replace(/edi\s*ti\s*on/gi, 'edition');
        result = result.replace(/posi\s*ti\s*on/gi, 'position');
        result = result.replace(/transi\s*ti\s*on/gi, 'transition');
        result = result.replace(/acquisi\s*ti\s*on/gi, 'acquisition');
        result = result.replace(/propor\s*ti\s*on/gi, 'proportion');
        result = result.replace(/solu\s*ti\s*on/gi, 'solution');
        result = result.replace(/resolu\s*ti\s*on/gi, 'resolution');
        result = result.replace(/evolu\s*ti\s*on/gi, 'evolution');
        result = result.replace(/revolu\s*ti\s*on/gi, 'revolution');
        result = result.replace(/distribu\s*ti\s*on/gi, 'distribution');
        result = result.replace(/contribu\s*ti\s*on/gi, 'contribution');
        result = result.replace(/substitu\s*ti\s*on/gi, 'substitution');
        result = result.replace(/constitu\s*ti\s*on/gi, 'constitution');
        result = result.replace(/institu\s*ti\s*on/gi, 'institution');
        result = result.replace(/prosecu\s*ti\s*on/gi, 'prosecution');
        result = result.replace(/descrip\s*ti\s*on/gi, 'description');
        result = result.replace(/prescrip\s*ti\s*on/gi, 'prescription');
        result = result.replace(/subscrip\s*ti\s*on/gi, 'subscription');
        result = result.replace(/op\s*ti\s*miza\s*ti\s*on/gi, 'optimization');
        result = result.replace(/realiza\s*ti\s*on/gi, 'realization');
        result = result.replace(/organiza\s*ti\s*on/gi, 'organization');
        result = result.replace(/authoriza\s*ti\s*on/gi, 'authorization');
        result = result.replace(/visualiza\s*ti\s*on/gi, 'visualization');
        result = result.replace(/normaliza\s*ti\s*on/gi, 'normalization');
        result = result.replace(/synchroniza\s*ti\s*on/gi, 'synchronization');
        result = result.replace(/serializa\s*ti\s*on/gi, 'serialization');
        result = result.replace(/virtualiza\s*ti\s*on/gi, 'virtualization');
        result = result.replace(/localiza\s*ti\s*on/gi, 'localization');
        result = result.replace(/globaliza\s*ti\s*on/gi, 'globalization');
        result = result.replace(/customiza\s*ti\s*on/gi, 'customization');
        result = result.replace(/veri\s*fi\s*ca\s*ti\s*on/gi, 'verification');
        result = result.replace(/no\s*ti\s*ce/gi, 'notice');
        result = result.replace(/prac\s*ti\s*se/gi, 'practise');
        result = result.replace(/ar\s*ti\s*cle/gi, 'article');
        result = result.replace(/par\s*ti\s*cle/gi, 'particle');
        result = result.replace(/ver\s*ti\s*cal/gi, 'vertical');
        result = result.replace(/ar\s*ti\s*fi\s*cial/gi, 'artificial');
        result = result.replace(/iden\s*ti\s*cal/gi, 'identical');
        result = result.replace(/cri\s*ti\s*cal/gi, 'critical');
        result = result.replace(/analy\s*ti\s*cal/gi, 'analytical');
        result = result.replace(/poli\s*ti\s*cal/gi, 'political');
        result = result.replace(/theore\s*ti\s*cal/gi, 'theoretical');
        result = result.replace(/alphabe\s*ti\s*cal/gi, 'alphabetical');
        result = result.replace(/gramma\s*ti\s*cal/gi, 'grammatical');
        result = result.replace(/mathema\s*ti\s*cal/gi, 'mathematical');
        result = result.replace(/statis\s*ti\s*cal/gi, 'statistical');
        result = result.replace(/systema\s*ti\s*c/gi, 'systematic');
        result = result.replace(/problema\s*ti\s*c/gi, 'problematic');
        result = result.replace(/schema\s*ti\s*c/gi, 'schematic');
        result = result.replace(/diagramma\s*ti\s*c/gi, 'diagrammatic');
        result = result.replace(/chroma\s*ti\s*c/gi, 'chromatic');
        result = result.replace(/aroma\s*ti\s*c/gi, 'aromatic');
        result = result.replace(/diploma\s*ti\s*c/gi, 'diplomatic');
        result = result.replace(/characteris\s*ti\s*c/gi, 'characteristic');
        result = result.replace(/heuris\s*ti\s*c/gi, 'heuristic');
        result = result.replace(/determinis\s*ti\s*c/gi, 'deterministic');
        result = result.replace(/probabilis\s*ti\s*c/gi, 'probabilistic');
        result = result.replace(/linguis\s*ti\s*c/gi, 'linguistic');
        result = result.replace(/realis\s*ti\s*c/gi, 'realistic');
        result = result.replace(/op\s*ti\s*mis\s*ti\s*c/gi, 'optimistic');
        result = result.replace(/pessimis\s*ti\s*c/gi, 'pessimistic');
        result = result.replace(/stochas\s*ti\s*c/gi, 'stochastic');
        
        // More specific words
        result = result.replace(/rec\s*ti\s*fi/gi, 'rectifi');
        result = result.replace(/cer\s*ti\s*fi/gi, 'certifi');
        result = result.replace(/jus\s*ti\s*fi/gi, 'justifi');
        result = result.replace(/ra\s*ti\s*o/gi, 'ratio');
        result = result.replace(/pa\s*ti\s*ent/gi, 'patient');
        result = result.replace(/quo\s*ti\s*ent/gi, 'quotient');
        result = result.replace(/ingredi\s*ent/gi, 'ingredient');
        result = result.replace(/parti\s*cular/gi, 'particular');
        result = result.replace(/ar\s*ti\s*fact/gi, 'artifact');
        result = result.replace(/mul\s*ti\s*pli/gi, 'multipli');
        result = result.replace(/op\s*ti\s*m/gi, 'optim');
        result = result.replace(/ac\s*ti\s*v/gi, 'activ');
        result = result.replace(/reac\s*ti\s*v/gi, 'reactiv');
        result = result.replace(/proac\s*ti\s*v/gi, 'proactiv');
        result = result.replace(/interac\s*ti\s*v/gi, 'interactiv');
        result = result.replace(/cap\s*ti\s*v/gi, 'captiv');
        result = result.replace(/na\s*ti\s*v/gi, 'nativ');
        result = result.replace(/mo\s*ti\s*v/gi, 'motiv');
        result = result.replace(/ini\s*ti\s*at/gi, 'initiat');
        result = result.replace(/ne\s*go\s*ti\s*at/gi, 'negotiat');
        result = result.replace(/differen\s*ti\s*at/gi, 'differentiat');
        result = result.replace(/authen\s*ti\s*cat/gi, 'authenticat');
        result = result.replace(/domes\s*ti\s*c/gi, 'domestic');
        result = result.replace(/elas\s*ti\s*c/gi, 'elastic');
        result = result.replace(/fantas\s*ti\s*c/gi, 'fantastic');
        result = result.replace(/dras\s*ti\s*c/gi, 'drastic');
        result = result.replace(/plas\s*ti\s*c/gi, 'plastic');
        result = result.replace(/tac\s*ti\s*c/gi, 'tactic');
        result = result.replace(/synthe\s*ti\s*c/gi, 'synthetic');
        result = result.replace(/gene\s*ti\s*c/gi, 'genetic');
        result = result.replace(/magne\s*ti\s*c/gi, 'magnetic');
        result = result.replace(/aesthe\s*ti\s*c/gi, 'aesthetic');
        result = result.replace(/seman\s*ti\s*c/gi, 'semantic');
        result = result.replace(/authen\s*ti\s*c/gi, 'authentic');
        result = result.replace(/iden\s*ti\s*c/gi, 'identic');
        
        // ========================================
        // FINAL CATCH-ALL: Fix any remaining orphaned ti/tt in middle of words
        // Pattern: wordpart + space + ti/tt + space + wordpart
        // Only matches when ti/tt is clearly orphaned between word parts
        // ========================================
        
        // Fix orphaned "ti" between word parts (e.g., "recti fier" -> "rectifier")
        result = result.replace(/([a-zA-Z]{2,})\s+ti\s+([a-zA-Z]{2,})/g, '$1ti$2');
        
        // Fix orphaned "tt" between word parts (e.g., "a tt ack" remaining)
        result = result.replace(/([a-zA-Z]{1,})\s+tt\s+([a-zA-Z]{2,})/g, '$1tt$2');
        
        // Fix "ti" at start of suffix with space (e.g., "recti fier")
        result = result.replace(/([a-zA-Z]{3,})ti\s+([a-zA-Z]{2,})/g, '$1ti$2');
        
        // Fix "ti" at end of prefix with space (e.g., "rec tifier")
        result = result.replace(/([a-zA-Z]{2,})\s+ti([a-zA-Z]{2,})/g, '$1ti$2');
        
        // Fix "tt" at start of suffix with space
        result = result.replace(/([a-zA-Z]{1,})tt\s+([a-zA-Z]{2,})/g, '$1tt$2');
        
        // Fix "tt" at end of prefix with space
        result = result.replace(/([a-zA-Z]{1,})\s+tt([a-zA-Z]{2,})/g, '$1tt$2');

        return result;
    }

    /**
     * Clean text by removing extra whitespace, watermarks, and trimming
     */
    cleanText(text) {
        if (!text) return '';

        let result = this.fixLigatures(text);

        // Remove common watermarks and page markers
        result = result.replace(/The\s*Mann\s*Maker\s*\|\s*RANJAN\s*KALINDI\s*\d*/gi, '');
        result = result.replace(/RANJAN\s*KALINDI\s*\d*/gi, '');
        result = result.replace(/The\s*Mann\s*Maker/gi, '');
        result = result.replace(/Page\s*\d+\s*of\s*\d+/gi, '');
        result = result.replace(/www\.[a-zA-Z0-9.-]+\.(com|org|net|in)/gi, '');

        // Clean whitespace
        result = result
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '')
            .trim();

        return result;
    }

    /**
     * Get all loaded questions
     */
    getQuestions() {
        return this.questions;
    }

    /**
     * Get random questions for a round
     */
    getRandomQuestions(count, excludeIds = []) {
        const available = this.questions.filter(q => !excludeIds.includes(q.id));
        const shuffled = this.shuffleArray([...available]);
        return shuffled.slice(0, count);
    }

    /**
     * Fisher-Yates shuffle
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

// Export for use in app.js
window.PDFParser = PDFParser;
