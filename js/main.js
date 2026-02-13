// js/main.js — MindSight Clinical AI v2.0

const API_URL = "/v1/chat";

document.addEventListener('DOMContentLoaded', () => {

    // ========================================
    // 1. DOM Elements
    // ========================================
    const inputField = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');
    const processingIndicator = document.getElementById('processing-indicator');
    const welcomeScreen = document.getElementById('welcome-screen');
    const charCount = document.getElementById('char-count');

    // Theme
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    // Mode
    const modeAcceptanceBtn = document.getElementById('mode-acceptance');
    const modeStrategyBtn = document.getElementById('mode-strategy');

    // Analysis Panels
    const emotionDot = document.getElementById('emotion-dot-container');
    const emotionTooltip = document.getElementById('emotion-tooltip');
    const emotionBadge = document.getElementById('emotion-badge');
    const valenceArousalText = document.getElementById('valence-arousal-text');
    const emotionTrail = document.getElementById('emotion-trail');
    const distortionList = document.getElementById('distortion-list');
    const distortionCount = document.getElementById('distortion-count');

    // Session Stats
    const sessionTimerEl = document.getElementById('session-timer');
    const msgCounterEl = document.getElementById('message-counter');
    const statMessages = document.getElementById('stat-messages');
    const statAvgValence = document.getElementById('stat-avg-valence');
    const statAvgArousal = document.getElementById('stat-avg-arousal');
    const statDominantEmotion = document.getElementById('stat-dominant-emotion');

    // Export/Import
    const btnExportJson = document.getElementById('btn-export-json');
    const fileInputImport = document.getElementById('file-input-import');

    // ========================================
    // 2. State
    // ========================================
    let currentMode = "Acceptance";
    let chatHistory = [];
    let emotionTrailHistory = []; // {left%, top%, emotion}
    let sessionStartTime = Date.now();
    let firstMessageSent = false;

    const ACTIVE_CLASSES = ['bg-surface-light', 'dark:bg-surface-dark', 'text-primary', 'shadow-sm', 'border', 'border-bdr', 'dark:border-bdr-dark'];
    const INACTIVE_CLASSES = ['text-txt-sub', 'dark:text-txt-sub-dark', 'hover:text-txt', 'dark:hover:text-txt-dark'];

    // ========================================
    // 3. Session Timer
    // ========================================
    function updateTimer() {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        if (sessionTimerEl) sessionTimerEl.textContent = `${mins}:${secs}`;
    }
    setInterval(updateTimer, 1000);

    // ========================================
    // 4. Theme Toggle
    // ========================================
    function initTheme() {
        const isDark = localStorage.getItem('color-theme') === 'dark' ||
            (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
            if (themeToggleLightIcon) themeToggleLightIcon.classList.remove('hidden');
            if (themeToggleDarkIcon) themeToggleDarkIcon.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            if (themeToggleLightIcon) themeToggleLightIcon.classList.add('hidden');
            if (themeToggleDarkIcon) themeToggleDarkIcon.classList.remove('hidden');
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            if (themeToggleDarkIcon) themeToggleDarkIcon.classList.toggle('hidden');
            if (themeToggleLightIcon) themeToggleLightIcon.classList.toggle('hidden');
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            }
        });
    }
    initTheme();

    // ========================================
    // 5. Mode Toggle
    // ========================================
    function setMode(mode) {
        currentMode = mode;
        if (!modeAcceptanceBtn || !modeStrategyBtn) return;

        const [activeBtn, inactiveBtn] = mode === "Acceptance"
            ? [modeAcceptanceBtn, modeStrategyBtn]
            : [modeStrategyBtn, modeAcceptanceBtn];

        INACTIVE_CLASSES.forEach(c => activeBtn.classList.remove(c));
        ACTIVE_CLASSES.forEach(c => activeBtn.classList.add(c));
        ACTIVE_CLASSES.forEach(c => inactiveBtn.classList.remove(c));
        INACTIVE_CLASSES.forEach(c => inactiveBtn.classList.add(c));
    }

    if (modeAcceptanceBtn) modeAcceptanceBtn.addEventListener('click', () => setMode("Acceptance"));
    if (modeStrategyBtn) modeStrategyBtn.addEventListener('click', () => setMode("Strategy"));

    // ========================================
    // 6. Character Count
    // ========================================
    if (inputField && charCount) {
        inputField.addEventListener('input', () => {
            charCount.textContent = inputField.value.length;
        });
    }

    // ========================================
    // 7. Core: Send Message
    // ========================================
    async function handleSendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        // Hide welcome screen on first message
        if (!firstMessageSent && welcomeScreen) {
            welcomeScreen.style.opacity = '0';
            welcomeScreen.style.transform = 'translateY(-20px)';
            welcomeScreen.style.transition = 'all 0.3s ease';
            setTimeout(() => welcomeScreen.remove(), 300);
            firstMessageSent = true;
        }

        toggleInputState(false);
        appendUserMessage(text);
        chatHistory.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
        updateMessageCounter();

        inputField.value = '';
        if (charCount) charCount.textContent = '0';
        scrollToBottom();
        processingIndicator.classList.remove('hidden');
        scrollToBottom();

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_input: text, mode: currentMode })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `API Error (${response.status})`);
            }

            const data = await response.json();

            chatHistory.push({
                role: 'assistant',
                content: data.response,
                meta: data,
                timestamp: new Date().toISOString()
            });

            appendAIMessage(data);
            updateEmotionMap(data.valence, data.arousal, data.primary_emotion);
            updateDistortionPanel(data.distortions);
            updateSessionStats();

        } catch (error) {
            console.error("Error:", error);
            appendErrorMessage(`Connection error: ${error.message}`);
        } finally {
            processingIndicator.classList.add('hidden');
            toggleInputState(true);
            scrollToBottom();
            inputField.focus();
        }
    }

    function toggleInputState(enabled) {
        inputField.disabled = !enabled;
        sendBtn.disabled = !enabled;
        if (!enabled) {
            sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            inputField.classList.add('opacity-60');
            inputField.placeholder = "Analyzing cognitive patterns...";
        } else {
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            inputField.classList.remove('opacity-60');
            inputField.placeholder = "Type your thoughts here... (Shift+Enter for new line)";
        }
    }

    // ========================================
    // 8. Emotion Map + Trail
    // ========================================
    function updateEmotionMap(valence, arousal, emotion) {
        const leftPct = ((valence + 1) / 2) * 100;
        const topPct = ((1 - arousal) / 2) * 100;
        const clampedLeft = Math.max(5, Math.min(95, leftPct));
        const clampedTop = Math.max(5, Math.min(95, topPct));

        // Add ghost dot for trail (previous position)
        if (emotionTrail && emotionTrailHistory.length > 0) {
            const prev = emotionTrailHistory[emotionTrailHistory.length - 1];
            const ghost = document.createElement('div');
            ghost.className = 'ghost-dot';
            ghost.style.left = prev.left;
            ghost.style.top = prev.top;
            // Older dots fade more
            const age = emotionTrailHistory.length;
            ghost.style.opacity = Math.max(0.1, 0.5 - (age * 0.05));
            ghost.style.width = `${Math.max(3, 6 - age)}px`;
            ghost.style.height = ghost.style.width;
            emotionTrail.appendChild(ghost);
        }

        // Move active dot
        if (emotionDot) {
            emotionDot.style.left = `${clampedLeft}%`;
            emotionDot.style.top = `${clampedTop}%`;
        }
        if (emotionTooltip) emotionTooltip.textContent = `${emotion} (V:${valence.toFixed(1)}, A:${arousal.toFixed(1)})`;
        if (emotionBadge) emotionBadge.textContent = emotion || 'Neutral';
        if (valenceArousalText) valenceArousalText.textContent = `V: ${valence.toFixed(2)} · A: ${arousal.toFixed(2)}`;

        emotionTrailHistory.push({ left: `${clampedLeft}%`, top: `${clampedTop}%`, emotion });
    }

    // ========================================
    // 9. Distortion Panel
    // ========================================
    function updateDistortionPanel(distortions) {
        if (!distortionList) return;
        if (!distortions || distortions.length === 0) {
            distortionList.innerHTML = `
                <div class="text-[11px] text-txt-muted dark:text-txt-muted-dark italic flex items-center gap-1.5">
                    <span class="material-icons text-[13px]">check_circle</span>
                    No distortions detected
                </div>`;
            if (distortionCount) distortionCount.textContent = '0';
            return;
        }

        const colors = ['#13daec', '#f97316', '#ef4444', '#8b5cf6', '#22c55e', '#ec4899', '#eab308'];
        if (distortionCount) distortionCount.textContent = `${distortions.length} found`;

        const html = distortions.map((name, i) => {
            const color = colors[i % colors.length];
            const widthPct = Math.max(25, 95 - (i * 14));
            return `
                <div class="space-y-1 fade-in" style="animation-delay: ${i * 0.08}s">
                    <div class="flex justify-between text-[11px]">
                        <span class="text-txt dark:text-txt-dark font-medium">${escapeHtml(name)}</span>
                        <span style="color: ${color}" class="font-bold text-[10px]">●</span>
                    </div>
                    <div class="w-full bg-panel-light dark:bg-panel-dark h-1 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bar-shine" style="width: ${widthPct}%; background-color: ${color}; transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s"></div>
                    </div>
                </div>`;
        }).join('');
        distortionList.innerHTML = html;
    }

    // ========================================
    // 10. Session Stats
    // ========================================
    function updateSessionStats() {
        const aiMsgs = chatHistory.filter(m => m.role === 'assistant' && m.meta);
        const totalMsgs = chatHistory.length;

        if (statMessages) statMessages.textContent = totalMsgs;

        if (aiMsgs.length > 0) {
            const avgV = aiMsgs.reduce((s, m) => s + (m.meta.valence || 0), 0) / aiMsgs.length;
            const avgA = aiMsgs.reduce((s, m) => s + (m.meta.arousal || 0), 0) / aiMsgs.length;
            if (statAvgValence) statAvgValence.textContent = avgV.toFixed(2);
            if (statAvgArousal) statAvgArousal.textContent = avgA.toFixed(2);

            // Dominant emotion (most frequent)
            const emotionFreq = {};
            aiMsgs.forEach(m => {
                const e = m.meta.primary_emotion || 'neutral';
                emotionFreq[e] = (emotionFreq[e] || 0) + 1;
            });
            const dominant = Object.entries(emotionFreq).sort((a, b) => b[1] - a[1])[0];
            if (statDominantEmotion && dominant) {
                statDominantEmotion.textContent = dominant[0];
            }
        }
    }

    function updateMessageCounter() {
        if (msgCounterEl) msgCounterEl.textContent = `${chatHistory.length} msgs`;
    }

    // ========================================
    // 11. Message Renderers
    // ========================================
    function appendUserMessage(text) {
        const html = `
        <div class="flex justify-end group fade-in">
            <div class="max-w-[80%]">
                <div class="flex items-center justify-end gap-2 mb-1">
                    <span class="text-[10px] text-txt-muted dark:text-txt-muted-dark">${getTimeStr()}</span>
                </div>
                <div class="bg-primary/10 dark:bg-primary/15 text-txt dark:text-txt-dark px-4 py-3 rounded-2xl rounded-tr-sm">
                    <p class="leading-relaxed text-[13px] whitespace-pre-wrap">${escapeHtml(text)}</p>
                </div>
            </div>
        </div>`;
        chatContainer.insertAdjacentHTML('beforeend', html);
    }

    function appendAIMessage(data) {
        const emotionTag = escapeHtml(data.primary_emotion || 'neutral');
        const modeLabelIcon = currentMode === 'Acceptance' ? 'favorite' : 'bolt';

        const thinkingLog = data.internal_thinking ? `
            <details class="mb-2.5">
                <summary class="cursor-pointer text-[10px] text-txt-muted dark:text-txt-muted-dark hover:text-primary transition-colors list-none flex items-center gap-1">
                    <span class="material-icons text-[11px]">psychology</span>
                    View reasoning process
                </summary>
                <div class="mt-2 text-[11px] font-mono text-txt-sub dark:text-txt-sub-dark bg-panel-light dark:bg-panel-dark p-3 rounded-lg border-l-2 border-primary/40 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">${escapeHtml(data.internal_thinking)}</div>
            </details>` : '';

        const verificationBlock = data.verification_data ? `
            <details class="mt-2.5">
                <summary class="cursor-pointer text-[10px] text-amber-500 dark:text-amber-400 hover:text-amber-600 transition-colors list-none flex items-center gap-1">
                    <span class="material-icons text-[11px]">manage_search</span>
                    Evidence & sources
                </summary>
                <div class="mt-2 text-[11px] text-txt-sub dark:text-txt-sub-dark bg-amber-50 dark:bg-amber-900/15 p-3 rounded-lg border-l-2 border-amber-400/60 whitespace-pre-wrap">${escapeHtml(data.verification_data)}</div>
            </details>` : '';

        const html = `
        <div class="flex justify-start fade-in">
            <div class="max-w-[85%]">
                <div class="flex items-center gap-1.5 mb-1">
                    <div class="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-[9px] font-bold shadow-sm">AI</div>
                    <span class="text-[10px] text-txt-muted dark:text-txt-muted-dark">${getTimeStr()}</span>
                    <span class="text-[9px] font-medium text-primary/80 bg-primary/8 dark:bg-primary/12 px-1.5 py-0.5 rounded">${emotionTag}</span>
                    <span class="text-[9px] text-txt-muted dark:text-txt-muted-dark flex items-center gap-0.5"><span class="material-icons text-[9px]">${modeLabelIcon}</span>${currentMode}</span>
                </div>
                <div class="bg-panel-light dark:bg-surface-dark text-txt dark:text-txt-dark px-4 py-3 rounded-2xl rounded-tl-sm border border-bdr/60 dark:border-bdr-dark/60 shadow-card dark:shadow-dark-card">
                    ${thinkingLog}
                    <p class="leading-relaxed text-[13px]">${markdownToHtml(data.response)}</p>
                    ${verificationBlock}
                </div>
            </div>
        </div>`;

        processingIndicator.insertAdjacentHTML('beforebegin', html);
    }

    function appendErrorMessage(msg) {
        const html = `
        <div class="flex justify-center my-3 fade-in">
            <span class="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/15 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-800/60 flex items-center gap-1">
                <span class="material-icons text-[12px]">error_outline</span>
                ${escapeHtml(msg)}
            </span>
        </div>`;
        chatContainer.insertAdjacentHTML('beforeend', html);
    }

    // ========================================
    // 12. Export / Import
    // ========================================
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            const exportData = {
                version: "2.0",
                exported_at: new Date().toISOString(),
                summary: generateSessionSummary(),
                history: chatHistory
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `mindsight_session_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (fileInputImport) {
        fileInputImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    chatHistory = data.history || [];

                    // Remove welcome screen
                    if (welcomeScreen) welcomeScreen.remove();
                    firstMessageSent = true;

                    // Clear and rebuild chat
                    chatContainer.innerHTML = '';
                    chatContainer.innerHTML = `<div class="flex justify-center my-3"><span class="text-[10px] text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/60 flex items-center gap-1"><span class="material-icons text-[11px]">restore</span>Session restored</span></div>`;
                    // Re-append processing indicator
                    chatContainer.appendChild(processingIndicator);

                    chatHistory.forEach(msg => {
                        if (msg.role === 'user') {
                            appendUserMessage(msg.content);
                        } else {
                            const meta = msg.meta || {};
                            appendAIMessage({ ...meta, response: msg.content });
                        }
                    });

                    // Restore last state
                    const lastAI = chatHistory.filter(m => m.role === 'assistant').pop();
                    if (lastAI && lastAI.meta) {
                        updateEmotionMap(lastAI.meta.valence, lastAI.meta.arousal, lastAI.meta.primary_emotion);
                        updateDistortionPanel(lastAI.meta.distortions);
                    }
                    updateSessionStats();
                    updateMessageCounter();
                    scrollToBottom();
                } catch (err) {
                    console.error(err);
                    appendErrorMessage("Failed to parse session file.");
                }
            };
            reader.readAsText(file);
        });
    }

    // ========================================
    // 13. Utilities
    // ========================================
    function generateSessionSummary() {
        const aiMsgs = chatHistory.filter(m => m.role === 'assistant' && m.meta);
        if (aiMsgs.length === 0) return null;
        const avgV = aiMsgs.reduce((s, m) => s + m.meta.valence, 0) / aiMsgs.length;
        const avgA = aiMsgs.reduce((s, m) => s + m.meta.arousal, 0) / aiMsgs.length;
        return { message_count: chatHistory.length, avg_valence: avgV.toFixed(2), avg_arousal: avgA.toFixed(2) };
    }

    function scrollToBottom() {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    }

    function getTimeStr() {
        return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function escapeHtml(text) {
        if (!text) return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function markdownToHtml(text) {
        if (!text) return "";
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // ========================================
    // 14. Event Listeners
    // ========================================
    sendBtn.addEventListener('click', handleSendMessage);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
});