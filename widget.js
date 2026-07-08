/**
 * AITD AI Chatbot — Frontend Widget
 *
 * Embeddable chat widget for the AITD website.
 * Communicates with the FastAPI backend via /api/chat.
 *
 * Usage: Include widget.css and widget.js on any page.
 */

(function () {
    "use strict";

    // ─── Configuration ──────────────────────────────────────
    const CONFIG = {
        version: "1.1.5",              // <--- Increment this version when you update the JS/CSS to force users to get the fresh version
        headerLogoName: "logo.png",    // <--- Change header and bot avatar logo here
        copyrightLogoName: "logo.png", // <--- Change copyright page logo here (currently kept separate)
        botName: "AITD AI",
        welcomeMessage:
            "Hello! 👋 I'm AITD AI, a professional AI assistant. I can help you with information about admissions, fees, departments, and more. How can I assist you today?",
        suggestions: [
            "What are the admission fees?",
            "Tell me about hostel facilities",
            "AITD contact details?",
            "List all departments",
        ],
        maxRetries: 2,
        retryDelay: 1000,
        apiUrl: "/api/chat" // Fallback, will be updated dynamically below
    };

    // ─── Resolve script location & configuration ─────────────────
    const currentScript = document.currentScript || document.querySelector('script[src*="widget.js"]');

    let apiUrl = "/api/chat";
    let cssUrl = "";
    let headerLogoUrl = CONFIG.headerLogoName;
    let copyrightLogoUrl = CONFIG.copyrightLogoName;

    if (currentScript) {
        // Read data-api attribute from the script tag
        if (currentScript.dataset.api) {
            apiUrl = currentScript.dataset.api;
        } else if (window.AITD_CHAT_API_URL) {
            apiUrl = window.AITD_CHAT_API_URL;
        }

        // Find the folder where widget.js is loaded from
        const scriptSrc = currentScript.src;
        if (scriptSrc) {
            const lastSlash = scriptSrc.lastIndexOf('/');
            const scriptDir = lastSlash !== -1 ? scriptSrc.substring(0, lastSlash) : ".";
            cssUrl = `${scriptDir}/widget.css?v=${CONFIG.version}`;
            headerLogoUrl = `${scriptDir}/${CONFIG.headerLogoName}?v=${CONFIG.version}`;
            copyrightLogoUrl = `${scriptDir}/${CONFIG.copyrightLogoName}?v=${CONFIG.version}`;
        }
    } else if (window.AITD_CHAT_API_URL) {
        apiUrl = window.AITD_CHAT_API_URL;
    }

    CONFIG.apiUrl = apiUrl;

    // ─── Dynamic CSS Injection ───────────────────────────────────
    const isCssLinked = !!document.querySelector('link[href*="widget.css"]');
    const isCssLoaded = getComputedStyle(document.documentElement).getPropertyValue('--widget-primary').trim() !== "";

    if (!isCssLinked && !isCssLoaded && cssUrl) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssUrl;
        document.head.appendChild(link);
    }

    // ─── State ──────────────────────────────────────────────
    let isOpen = false;
    let isLoading = false;
    let clientId = getOrCreateClientId();

    function getOrCreateClientId() {
        let id = localStorage.getItem("aitd_chat_client_id");
        if (!id) {
            id = "client_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
            localStorage.setItem("aitd_chat_client_id", id);
        }
        return id;
    }
    // ─── DOM Creation ───────────────────────────────────────
    function createWidget() {
        // Toggle Button Wrapper (holds ripples, bloom, aurora, particles)
        const toggleWrapper = document.createElement("div");
        toggleWrapper.id = "aitd-toggle-wrapper";

        toggleWrapper.innerHTML = `
            <span class="aitd-ripple aitd-ripple1"></span>
            <span class="aitd-ripple aitd-ripple2"></span>
            <span class="aitd-ripple aitd-ripple3"></span>
            <span class="aitd-aurora-ring"></span>
            <span class="aitd-bloom"></span>
            <span class="aitd-particles"></span>
        `;

        // Toggle Button
        const toggle = document.createElement("button");
        toggle.id = "aitd-chat-toggle";
        toggle.setAttribute("aria-label", "Open AITD Chatbot");
        toggle.innerHTML = `
            <svg class="aitd-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <svg class="aitd-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        `;
        toggle.addEventListener("click", toggleChat);
        toggle.addEventListener("touchstart", () => {
            toggleWrapper.classList.add("aitd-touched");
            setTimeout(() => {
                toggleWrapper.classList.remove("aitd-touched");
            }, 1200);
        }, { passive: true });
        toggleWrapper.appendChild(toggle);

        // Chat Container
        const container = document.createElement("div");
        container.id = "aitd-chat-container";
        container.innerHTML = `
            <div id="aitd-chat-header">
                <div class="aitd-avatar"><img src="${headerLogoUrl}" alt="AITD AI Logo" class="aitd-logo-img" /></div>
                <div class="aitd-header-info">
                    <p class="aitd-header-title">
                        ${CONFIG.botName}
                    </p>
                    <p class="aitd-header-subtitle">
                        <span class="aitd-status-dot"></span>
                        Online   
                    </p>
                </div>
                <div id="aitd-header-controls">
                    <button id="aitd-info-trigger" class="aitd-info-btn" aria-label="System Info" title="System Information">ⓘ</button>
                    <button id="aitd-chat-close" aria-label="Close Chat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div id="aitd-chat-messages"></div>
            <div class="aitd-suggestions" id="aitd-suggestions"></div>
            <div id="aitd-chat-input-area">
                <input
                    id="aitd-chat-input"
                    type="text"
                    placeholder="Ask about admissions, fees, hostel..."
                    autocomplete="off"
                    maxlength="500"
                />
                <button id="aitd-chat-send" aria-label="Send message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                </button>
            </div>
            <div class="aitd-powered-by">Powered by AITD AI • aitd.ac.in</div>
            
            <!-- Copyright / Info Modal inside Chat Panel Size -->
            <div id="aitd-copyright-modal" class="aitd-copyright-modal">
                <div class="aitd-copyright-header">
                    <span class="aitd-copyright-header-title">System Information</span>
                    <button id="aitd-copyright-close" aria-label="Close Info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="aitd-copyright-content">
                    <div class="aitd-copyright-icon"><img src="${copyrightLogoUrl}" alt="AITD AI Logo" class="aitd-logo-img" /></div>
                    
                    <div class="aitd-info-tabs">
                        <button class="aitd-info-tab-btn active" data-tab="specs">Software Specs</button>
                        <button class="aitd-info-tab-btn" data-tab="copyright">Copyrights</button>
                        <button class="aitd-info-tab-btn" data-tab="team">Developers</button>
                    </div>
                    
                    <div class="aitd-info-tab-content">
                        <!-- Content injected dynamically by JS -->
                    </div>

                    <div class="aitd-copyright-footer">
                        <p>Copyright © 2026 • All Rights Reserved</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(toggleWrapper);
        document.body.appendChild(container);

        // Event Listeners
        const input = document.getElementById("aitd-chat-input");
        const sendBtn = document.getElementById("aitd-chat-send");
        const closeBtn = document.getElementById("aitd-chat-close");
        const infoTrigger = document.getElementById("aitd-info-trigger");
        const copyrightModal = document.getElementById("aitd-copyright-modal");
        const copyrightClose = document.getElementById("aitd-copyright-close");

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener("click", sendMessage);
        closeBtn.addEventListener("click", toggleChat);

        if (infoTrigger && copyrightModal && copyrightClose) {
            infoTrigger.addEventListener("click", (e) => {
                e.stopPropagation();
                copyrightModal.classList.add("aitd-modal-visible");
            });
            copyrightClose.addEventListener("click", (e) => {
                e.stopPropagation();
                copyrightModal.classList.remove("aitd-modal-visible");
            });

            // Tab content data matching requested simple structures and bullets
            const tabContentEl = copyrightModal.querySelector(".aitd-info-tab-content");
            const tabData = {
                specs: `
                    <div class="aitd-tab-pane">
                        <h3>1. SOFTWARE SPECIFICATION</h3>
                        <ul>
                            <li><strong>1.1 SYSTEM ARCHITECTURE & ENGINE</strong>
                                <ul>
                                    <li>Framework: FastAPI web backend serving local asynchronous REST endpoints.</li>
                                    <li>Environment: Python 3.11 run environment.</li>
                                    <li>Database: SQLite storage system for multi-turn session tracking and feedback caching.</li>
                                </ul>
                            </li>
                            <li><strong>1.2 POWERS</strong>
                                <ul>
                                    <li>Text normalization, spelling corrections, automated candidate page selection, hybrid keyword and vector search, dynamic result merging, and relevance-based ranking.</li>
                                </ul>
                            </li>
                            <li><strong>1.3 ABILITIES</strong>
                                <ul>
                                    <li>Heuristics-based coreference resolution (contextual pronoun carryover) for multi-turn conversations, spell correction, semantic cache handling, and intelligent question answering from local index sources.</li>
                                </ul>
                            </li>
                            <li><strong>1.4 ALL SECURITIES SYSTEM</strong>
                                <ul>
                                    <li>High-security validators, real-time prompt injection detection filters utilizing 30+ custom regex matchers, client IP-based rate limiting, and strict context isolation for safe LLM generations.</li>
                                </ul>
                            </li>
                            <li><strong>1.5 COMPONENT USAGE</strong>
                                <ul>
                                    <li><strong>CPU:</strong> Local query preprocessing, text parsing, spelling correction, TF-IDF parsing, and re-ranking computations.</li>
                                    <li><strong>LOCAL GPU:</strong> Generates high-dimension dense vectors utilizing the local nomic-embed-text-v1.5 embedding model.</li>
                                    <li><strong>LOCAL SERVER:</strong> Hosts the FastAPI endpoint services, coordinates database updates, and runs logging operations.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                `,
                copyright: `
                    <div class="aitd-tab-pane">
                        <h3>2. USER INSTRUCTIONS & GUIDELINES</h3>
                        <ul>
                            <li><strong>2.1 STANDARD OPERATING STEPS</strong>
                                <ol>
                                    <li>Input a complete question regarding college admissions, hostels, placements, libraries, or faculty into the text input area.</li>
                                    <li>Wait for retrieval: The system will scan indexed documents and retrieve relevant content segments.</li>
                                    <li>Read the generated response. It may contain structured lists, tables, and paragraphs.</li>
                                    <li>Click recommended follow-up chips at the bottom of the response block to ask related queries instantly.</li>
                                    <li>Rate responses using the thumbs-up (👍) or thumbs-down (👎) buttons to help optimize future results.</li>
                                </ol>
                            </li>
                            <li><strong>2.2 DETAILED INSTRUCTIONS & USER GUIDELINES</strong>
                                <ul>
                                    <li>Provide specific keywords (such as specific departments, years, or course names) to improve search matching.</li>
                                    <li>Check Sources: Review the list of document sources displayed at the bottom of responses to verify origin files.</li>
                                    <li>Coreference Context: Follow-up queries automatically resolve pronouns using context-matching heuristics.</li>
                                    <li>Clear Session: To start a new conversation session, close and reopen the chat panel.</li>
                                </ul>
                            </li>
                            <li><strong>2.3 AI ACCURACY & ERROR DISCLAIMER</strong>
                                <ul>
                                    <li><strong>AI Limitations:</strong> This system uses artificial intelligence to compile answers. AI can make mistakes, misinterpret queries, or omit context.</li>
                                    <li><strong>No Legal Binding:</strong> Answers are for guidance only. All critical facts (such as dates, fee structures, admissions) must be verified with official administrative offices.</li>
                                </ul>
                            </li>
                            <li><strong>2.4 COPYRIGHTS & USAGE RIGHTS</strong>
                                <ul>
                                    <li>All software design, retrieval pipelines, indexing scripts, source code, and assets are copyrighted.</li>
                                    <li>Dr. Ambedkar Institute of Technology for Divyangjan (Kanpur) holds usage rights to host this chatbot widget on their official domain for student and administrative support.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                `,
                team: `
                    <div class="aitd-tab-pane">
                        <h3>3. DEVELOPERS TEAM DETAILS</h3>
                        <ul>
                            <li><strong>TEAM NAME:</strong> AI INNOVATERS</li>
                            <li><strong>MEMBERS:</strong>
                                <ol>
                                    <li>Vishal Kumar (Frontend widget design, chat UI integrations, and client event-handling logic)</li>
                                    <li>Awadhesh Pratap Chaudhary (Security filters, prompt injection regex matching, and input validators)</li>
                                    <li>Vishakhdutt Mishra (Crawler pipeline, text extractor, page builder, and ChromaDB storage integration)</li>
                                    <li>Indrakesh Kumar Goyal (Backend server routing, retrieval pipeline orchestrator, and semantic cache implementation)</li>
                                </ol>
                            </li>
                            <li><strong>PROJECT HEADS:</strong>
                                <ol>
                                    <li>SRI NATH DWIVEDI SIR</li>
                                    <li>S.K. DUBEY SIR</li>
                                </ol>
                            </li>
                        </ul>
                    </div>
                `
            };

            // Render default tab
            if (tabContentEl) {
                tabContentEl.innerHTML = tabData.specs;
            }

            // Tab button click listeners
            const tabButtons = copyrightModal.querySelectorAll(".aitd-info-tab-btn");
            tabButtons.forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    tabButtons.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    const tabKey = btn.getAttribute("data-tab");
                    if (tabContentEl && tabData[tabKey]) {
                        // Reset scroll position to top instantly to prevent layout snapping and vibration
                        const scrollContainer = copyrightModal.querySelector(".aitd-copyright-content");
                        if (scrollContainer) {
                            scrollContainer.scrollTop = 0;
                        }
                        tabContentEl.innerHTML = tabData[tabKey];
                    }
                });
            });
        }

        // Render suggestions
        renderSuggestions();

        // Show welcome message
        addBotMessage(CONFIG.welcomeMessage);
    }

    // ─── Toggle Chat ────────────────────────────────────────
    function toggleChat() {
        isOpen = !isOpen;
        const container = document.getElementById("aitd-chat-container");
        const toggle = document.getElementById("aitd-chat-toggle");
        const wrapper = document.getElementById("aitd-toggle-wrapper");

        if (isOpen) {
            container.classList.add("aitd-visible");
            toggle.classList.add("aitd-open");
            if (wrapper) wrapper.classList.add("aitd-open");
            toggle.setAttribute("aria-label", "Close AITD Chatbot");
            // Focus input
            setTimeout(() => {
                document.getElementById("aitd-chat-input").focus();
            }, 350);
        } else {
            container.classList.remove("aitd-visible");
            toggle.classList.remove("aitd-open");
            if (wrapper) wrapper.classList.remove("aitd-open");
            toggle.setAttribute("aria-label", "Open AITD Chatbot");
            // Reset copyright modal visibility when closing the chat panel
            const copyrightModal = document.getElementById("aitd-copyright-modal");
            if (copyrightModal) {
                copyrightModal.classList.remove("aitd-modal-visible");
            }
        }
    }

    // ─── Send Message ───────────────────────────────────────
    async function sendMessage() {
        const input = document.getElementById("aitd-chat-input");
        const text = input.value.trim();

        if (!text || isLoading) return;

        // Clear input
        input.value = "";

        // Hide suggestions after first message
        const suggestionsEl = document.getElementById("aitd-suggestions");
        if (suggestionsEl) suggestionsEl.style.display = "none";

        // Add user message
        addUserMessage(text);

        // Show typing indicator
        showTyping();
        isLoading = true;
        disableSend(true);

        try {
            const response = await callAPI(text);
            hideTyping();
            addBotMessage(response.answer, response.chunk_ids, text, response.suggested_chips, response.is_instant);
        } catch (error) {
            hideTyping();
            addBotMessage(
                "I'm sorry, I'm having trouble connecting right now. Please try again in a moment."
            );
            console.error("AITD Chat Error:", error);
        } finally {
            isLoading = false;
            disableSend(false);
        }
    }

    // ─── API Call ────────────────────────────────────────────
    async function callAPI(question, retryCount = 0) {
        try {
            const response = await fetch(CONFIG.apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: question,
                    client_id: clientId,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (retryCount < CONFIG.maxRetries) {
                await new Promise((r) => setTimeout(r, CONFIG.retryDelay));
                return callAPI(question, retryCount + 1);
            }
            throw error;
        }
    }

    // ─── Message Rendering ──────────────────────────────────
    function addBotMessage(text, chunkIds, queryText, suggestedChips, isInstant) {
        const messages = document.getElementById("aitd-chat-messages");
        const msg = document.createElement("div");
        msg.className = "aitd-message aitd-bot";

        let feedbackHtml = "";
        if (chunkIds && chunkIds.length > 0) {
            feedbackHtml = `
                <div class="aitd-feedback-container">
                    <button class="aitd-feedback-btn aitd-like-btn" title="This answer was helpful" aria-label="Thumbs up">👍</button>
                    <button class="aitd-feedback-btn aitd-dislike-btn" title="This answer was not helpful" aria-label="Thumbs down">👎</button>
                </div>
            `;
        }

        // Build suggested chips HTML if available
        let chipsHtml = "";
        if (suggestedChips && suggestedChips.length > 0) {
            const chipButtons = suggestedChips
                .map(chip => `<button class="aitd-chip-btn" type="button">${escapeHtml(chip)}</button>`)
                .join("");
            chipsHtml = `<div class="aitd-suggested-chips-container">${chipButtons}</div>`;
        }

        let instantHtml = "";
        if (isInstant) {
            instantHtml = `
                <div style="font-size: 10.5px; color: #e65100; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.8px; text-decoration: underline; text-decoration-color: #ff9800; text-shadow: 0 0 2px rgba(255, 152, 0, 0.3); display: inline-block;">
                    Instant Answer
                </div>
            `;
        }

        msg.innerHTML = `
            <div class="aitd-msg-bubble">
                ${instantHtml}
                ${formatMessage(text)}
                ${feedbackHtml}
                ${chipsHtml}
            </div>
        `;
        messages.appendChild(msg);

        // Bind event listeners for feedback buttons
        if (chunkIds && chunkIds.length > 0) {
            const likeBtn = msg.querySelector(".aitd-like-btn");
            const dislikeBtn = msg.querySelector(".aitd-dislike-btn");

            likeBtn.addEventListener("click", () => handleFeedback(chunkIds, "like", likeBtn, dislikeBtn, queryText, text));
            dislikeBtn.addEventListener("click", () => handleFeedback(chunkIds, "dislike", likeBtn, dislikeBtn, queryText, text));
        }

        // Bind click events for suggested chips
        if (suggestedChips && suggestedChips.length > 0) {
            const chipBtns = msg.querySelectorAll(".aitd-chip-btn");
            chipBtns.forEach(btn => {
                btn.addEventListener("click", () => {
                    if (isLoading) return;
                    const chipText = btn.textContent.trim();
                    document.getElementById("aitd-chat-input").value = chipText;
                    // Remove the chips container after click to avoid re-click
                    const container = btn.closest(".aitd-suggested-chips-container");
                    if (container) container.remove();
                    sendMessage();
                });
            });
        }

        scrollToBottom();
    }

    async function handleFeedback(chunkIds, type, likeBtn, dislikeBtn, query, answer) {
        // Apply active feedback class
        if (type === "like") {
            likeBtn.classList.add("liked");
            dislikeBtn.classList.remove("disliked");
        } else {
            dislikeBtn.classList.add("disliked");
            likeBtn.classList.remove("liked");
        }

        // Disable to prevent duplicate submissions
        likeBtn.disabled = true;
        dislikeBtn.disabled = true;

        try {
            await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chunk_ids: chunkIds,
                    feedback_type: type,
                    client_id: clientId,
                    query: query || "",
                    answer: answer || ""
                })
            });
        } catch (error) {
            console.error("Failed to submit feedback:", error);
        }
    }

    function addUserMessage(text) {
        const messages = document.getElementById("aitd-chat-messages");
        const msg = document.createElement("div");
        msg.className = "aitd-message aitd-user";
        msg.innerHTML = `
            <div class="aitd-msg-bubble">${escapeHtml(text)}</div>
        `;
        messages.appendChild(msg);
        scrollToBottom();
    }

    function formatMessage(text) {
        if (!text) return "";

        let lines = text.split("\n");
        let result = [];
        let inList = false;
        let inTable = false;
        let tableHeaderDone = false;
        let currentParagraph = [];

        function flushParagraph() {
            if (currentParagraph.length > 0) {
                let paragraphText = currentParagraph.join("<br>");
                result.push(`<p style="margin: 4px 0 8px 0; line-height: 1.5; color: var(--widget-text-primary);">${paragraphText}</p>`);
                currentParagraph = [];
            }
        }

        function processInlineMarkdown(str) {
            let escaped = escapeHtml(str);
            // Replace **bold** with <strong>bold</strong>
            let bolded = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
            // Replace *italic* with <em>italic</em>
            let italicized = bolded.replace(/\*(.*?)\*/g, "<em>$1</em>");
            // Replace [link text](url) with clickable anchor tags
            let linked = italicized.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: var(--widget-primary); text-decoration: underline; font-weight: 500;">$1</a>');
            return linked;
        }

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Check if this line is part of a Markdown table (starts and ends with |)
            if (line.startsWith("|") && line.endsWith("|")) {
                if (inList) {
                    result.push("</ul>");
                    inList = false;
                }
                flushParagraph();

                if (!inTable) {
                    result.push('<div class="aitd-table-wrapper"><table class="aitd-table">');
                    inTable = true;
                    tableHeaderDone = false;
                }

                // Split table cells by pipe symbol
                let cells = line.split("|").map(c => c.trim());
                // Remove the first and last elements since they are empty strings due to starting and ending |
                if (cells.length > 1 && cells[0] === "") cells.shift();
                if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();

                // Check if this is a separator line (e.g. |:---|:---| or |---|---|)
                let isSeparator = cells.every(cell => /^:?-+:?$/.test(cell));
                if (isSeparator) {
                    // Skip separator row
                    tableHeaderDone = true;
                    continue;
                }

                result.push("<tr>");
                for (let j = 0; j < cells.length; j++) {
                    let cellContent = processInlineMarkdown(cells[j]);
                    if (!tableHeaderDone) {
                        result.push(`<th>${cellContent}</th>`);
                    } else {
                        result.push(`<td>${cellContent}</td>`);
                    }
                }
                result.push("</tr>");
                continue;
            }

            // If we were in a table and this line is not a table row, close the table
            if (inTable) {
                result.push('</table></div>');
                inTable = false;
                tableHeaderDone = false;
            }

            if (!line) {
                if (inList) {
                    result.push("</ul>");
                    inList = false;
                }
                flushParagraph();
                result.push("<div style='height: 8px;'></div>");
                continue;
            }

            // Check for H4 heading: #### **Text** or #### Text
            if (line.startsWith("####")) {
                if (inList) {
                    result.push("</ul>");
                    inList = false;
                }
                flushParagraph();
                let cleanHeading = line.replace(/^####\s*/, "").replace(/\*\*/g, "").trim();
                result.push(`<h4 class="aitd-heading-h4" style="margin: 14px 0 6px 0; font-size: 1.05em; font-weight: bold; color: var(--widget-primary);">${escapeHtml(cleanHeading)}</h4>`);
                continue;
            }

            // Check for H3 heading: ### **Text** or ### Text
            if (line.startsWith("###")) {
                if (inList) {
                    result.push("</ul>");
                    inList = false;
                }
                flushParagraph();
                let cleanHeading = line.replace(/^###\s*/, "").replace(/\*\*/g, "").trim();
                result.push(`<h3 class="aitd-heading-h3" style="margin: 18px 0 8px 0; font-size: 1.15em; font-weight: bold; color: var(--widget-primary); border-bottom: 1px solid #E5E7EB; padding-bottom: 4px;">${escapeHtml(cleanHeading)}</h3>`);
                continue;
            }

            // Check for list items: starts with *, -, •
            let listMatch = line.match(/^[*•-]\s*(.*)/);
            if (listMatch) {
                flushParagraph();
                if (!inList) {
                    result.push("<ul class='aitd-list' style='margin: 6px 0; padding-left: 20px; list-style-type: disc;'>");
                    inList = true;
                }
                let content = processInlineMarkdown(listMatch[1]);
                result.push(`<li style='margin-bottom: 6px; line-height: 1.4; color: var(--widget-text-primary);'>${content}</li>`);
                continue;
            }

            // If it was a list and this line is not, close list
            if (inList) {
                result.push("</ul>");
                inList = false;
            }

            // Normal text line
            let processedLine = processInlineMarkdown(line);
            currentParagraph.push(processedLine);
        }

        if (inTable) {
            result.push('</table></div>');
        }
        if (inList) {
            result.push("</ul>");
        }
        flushParagraph();

        return result.join("\n");
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── Typing Indicator ───────────────────────────────────
    function showTyping() {
        const messages = document.getElementById("aitd-chat-messages");
        const typing = document.createElement("div");
        typing.className = "aitd-message aitd-bot";
        typing.id = "aitd-typing";
        typing.innerHTML = `
            <div class="aitd-msg-avatar"><img src="${headerLogoUrl}" alt="AITD AI Logo" class="aitd-logo-img" /></div>
            <div class="aitd-msg-bubble aitd-typing">
                <div class="aitd-typing-dot"></div>
                <div class="aitd-typing-dot"></div>
                <div class="aitd-typing-dot"></div>
            </div>
        `;
        messages.appendChild(typing);
        scrollToBottom();
    }

    function hideTyping() {
        const typing = document.getElementById("aitd-typing");
        if (typing) typing.remove();
    }

    // ─── Suggestions ────────────────────────────────────────
    function renderSuggestions() {
        const container = document.getElementById("aitd-suggestions");
        CONFIG.suggestions.forEach((text) => {
            const btn = document.createElement("button");
            btn.className = "aitd-suggestion-btn";
            btn.textContent = text;
            btn.addEventListener("click", () => {
                document.getElementById("aitd-chat-input").value = text;
                sendMessage();
            });
            container.appendChild(btn);
        });
    }

    // ─── Helpers ────────────────────────────────────────────
    function scrollToBottom() {
        const messages = document.getElementById("aitd-chat-messages");
        setTimeout(() => {
            messages.scrollTop = messages.scrollHeight;
        }, 50);
    }

    function disableSend(disabled) {
        document.getElementById("aitd-chat-send").disabled = disabled;
    }

    // ─── Initialize ─────────────────────────────────────────
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createWidget);
    } else {
        createWidget();
    }
})();
