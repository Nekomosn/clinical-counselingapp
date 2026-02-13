// js/main.js

// ★ローカル環境（Python）と通信するための絶対パス
const API_URL = "http://127.0.0.1:8000/v1/chat"; 

document.addEventListener('DOMContentLoaded', () => {

    // === 1. UI Elements ===
    const inputField = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');
    const processingIndicator = document.getElementById('processing-indicator');

    // Theme Toggle Elements
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    // Mode Toggle Elements
    const modeAcceptanceBtn = document.getElementById('mode-acceptance');
    const modeStrategyBtn = document.getElementById('mode-strategy');

    // Analysis Panels
    const emotionDot = document.getElementById('emotion-dot-container');
    const emotionTooltip = document.getElementById('emotion-tooltip');
    const distortionList = document.getElementById('distortion-list');

    // Export/Import Buttons
    const btnExportJson = document.getElementById('btn-export-json');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const fileInputImport = document.getElementById('file-input-import');

    // === 2. State Management ===
    let currentMode = "Acceptance";
    let chatHistory = []; 

    // Active/Inactive Styles
    const ACTIVE_CLASSES = ['bg-white', 'dark:bg-slate-700', 'text-primary', 'shadow-sm', 'border', 'border-slate-200', 'dark:border-slate-600'];
    const INACTIVE_CLASSES = ['text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400', 'dark:hover:text-slate-200'];

    // === 3. Theme Toggle Logic (Light/Dark) ===
    function initTheme() {
        if (localStorage.getItem('color-theme') === 'dark' || 
            (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            if(themeToggleLightIcon) themeToggleLightIcon.classList.remove('hidden');
            if(themeToggleDarkIcon) themeToggleDarkIcon.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            if(themeToggleLightIcon) themeToggleLightIcon.classList.add('hidden');
            if(themeToggleDarkIcon) themeToggleDarkIcon.classList.remove('hidden');
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            themeToggleDarkIcon.classList.toggle('hidden');
            themeToggleLightIcon.classList.toggle('hidden');

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

    // === 4. Mode Toggle Logic ===
    function setMode(mode) {
        currentMode = mode;
        if (modeAcceptanceBtn && modeStrategyBtn) {
            if (mode === "Acceptance") {
                INACTIVE_CLASSES.forEach(c => modeAcceptanceBtn.classList.remove(c));
                ACTIVE_CLASSES.forEach(c => modeAcceptanceBtn.classList.add(c));
                ACTIVE_CLASSES.forEach(c => modeStrategyBtn.classList.remove(c));
                INACTIVE_CLASSES.forEach(c => modeStrategyBtn.classList.add(c));
            } else {
                INACTIVE_CLASSES.forEach(c => modeStrategyBtn.classList.remove(c));
                ACTIVE_CLASSES.forEach(c => modeStrategyBtn.classList.add(c));
                ACTIVE_CLASSES.forEach(c => modeAcceptanceBtn.classList.remove(c));
                INACTIVE_CLASSES.forEach(c => modeAcceptanceBtn.classList.add(c));
            }
        }
    }

    if(modeAcceptanceBtn) modeAcceptanceBtn.addEventListener('click', () => setMode("Acceptance"));
    if(modeStrategyBtn) modeStrategyBtn.addEventListener('click', () => setMode("Strategy"));

    // === 5. Core Logic: Send Message & Input Lock ===
    async function handleSendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        // ★ Lock Input
        toggleInputState(false);

        // Render User Message
        appendUserMessage(text);
        chatHistory.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
        
        inputField.value = '';
        scrollToBottom();
        processingIndicator.classList.remove('hidden');

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_input: text,
                    mode: currentMode
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `API Error (${response.status})`);
            }

            const data = await response.json();

            // Update History & Render
            chatHistory.push({ 
                role: 'assistant', 
                content: data.response, 
                meta: data,
                timestamp: new Date().toISOString() 
            });

            appendAIMessage(data);
            updateEmotionMap(data.valence, data.arousal, data.primary_emotion);
            updateDistortionPanel(data.distortions);

        } catch (error) {
            console.error("Error:", error);
            appendErrorMessage(`Neural Link Error: ${error.message}`);
        } finally {
            // ★ Unlock Input
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
            inputField.classList.add('opacity-50', 'bg-slate-100', 'dark:bg-slate-800');
            inputField.placeholder = "Integrating somatic signals... (Please wait)";
        } else {
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            inputField.classList.remove('opacity-50', 'bg-slate-100', 'dark:bg-slate-800');
            inputField.placeholder = "Type your thoughts here...";
        }
    }

    // === 6. Export / Import Features ===
    if(btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            const exportData = {
                version: "1.0",
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

    if(btnExportPdf) {
        btnExportPdf.addEventListener('click', () => {
            window.print();
        });
    }

    if(fileInputImport) {
        fileInputImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(!file) return;
            
            const reader = new FileReader();
            // ★ここから復旧ロジック
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    chatHistory = data.history || [];
                    
                    chatContainer.innerHTML = ''; 
                    chatContainer.innerHTML += `<div class="flex justify-center my-4"><span class="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">Session Restored</span></div>`;
                    
                    chatHistory.forEach(msg => {
                        if(msg.role === 'user') {
                            appendUserMessage(msg.content);
                        } else {
                            const meta = msg.meta || {};
                            appendAIMessage({ ...meta, response: msg.content });
                        }
                    });
                    
                    const lastAI = chatHistory.filter(m => m.role === 'assistant').pop();
                    if(lastAI && lastAI.meta) {
                        updateEmotionMap(lastAI.meta.valence, lastAI.meta.arousal, lastAI.meta.primary_emotion);
                        updateDistortionPanel(lastAI.meta.distortions);
                    }
                    alert("Session loaded successfully.");
                } catch(err) {
                    console.error(err);
                    alert("Failed to parse session file.");
                }
            };
            reader.readAsText(file);
        });
    }

    // === 7. Helper Functions ===
    function generateSessionSummary() {
        if(chatHistory.length === 0) return null;
        const aiMsgs = chatHistory.filter(m => m.role === 'assistant' && m.meta);
        if(aiMsgs.length === 0) return null;
        const avgValence = aiMsgs.reduce((sum, m) => sum + m.meta.valence, 0) / aiMsgs.length;
        const avgArousal = aiMsgs.reduce((sum, m) => sum + m.meta.arousal, 0) / aiMsgs.length;
        return { message_count: chatHistory.length, avg_valence: avgValence.toFixed(2), avg_arousal: avgArousal.toFixed(2) };
    }

    function updateEmotionMap(valence, arousal, emotion) {
        const leftPct = ((valence + 1) / 2) * 100;
        const topPct = ((1 - arousal) / 2) * 100;
        if(emotionDot) {
            emotionDot.style.left = `${Math.max(5, Math.min(95, leftPct))}%`;
            emotionDot.style.top = `${Math.max(5, Math.min(95, topPct))}%`;
        }
        if(emotionTooltip) emotionTooltip.textContent = `Current: ${emotion}`;
    }

    function updateDistortionPanel(distortions) {
        if(!distortionList) return;
        if (!distortions || distortions.length === 0) {
            distortionList.innerHTML = '<div class="text-xs text-slate-400 italic">No distortions detected</div>';
            return;
        }
        const colors = ['#13daec', '#f97316', '#ef4444', '#8b5cf6', '#22c55e'];
        const html = distortions.map((name, i) => {
            const color = colors[i % colors.length];
            return `
                <div class="space-y-1 fade-in" style="animation-delay: ${i * 0.1}s">
                    <div class="flex justify-between text-xs">
                        <span class="text-slate-600 dark:text-slate-300 font-medium">${escapeHtml(name)}</span>
                        <span style="color: ${color}" class="font-bold">Detected</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-700 ease-out" style="width: ${Math.max(30, 90 - (i * 12))}%; background-color: ${color}"></div>
                    </div>
                </div>`;
        }).join('');
        distortionList.innerHTML = html;
    }

    function appendUserMessage(text) {
        const html = `
        <div class="flex justify-end group fade-in">
            <div class="max-w-[80%]">
                <div class="flex items-center justify-end gap-2 mb-1"><span class="text-xs text-slate-400">User</span></div>
                <div class="bg-primary/10 dark:bg-primary/20 text-slate-800 dark:text-slate-100 p-4 rounded-2xl rounded-tr-sm">
                    <p class="leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</p>
                </div>
            </div>
        </div>`;
        chatContainer.insertAdjacentHTML('beforeend', html);
    }

    function appendAIMessage(data) {
        const modeBadge = `<span class="text-[10px] uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded">Mode: ${currentMode}</span>`;
        const emotionBadge = `<span class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 rounded text-[10px] uppercase tracking-wider">${escapeHtml(data.primary_emotion || 'neutral')}</span>`;

        const thinkingLog = data.internal_thinking ? `
            <details class="mb-3 group">
                <summary class="cursor-pointer text-xs text-slate-400 hover:text-primary transition-colors list-none flex items-center gap-1">
                    <span class="material-icons text-[10px]">psychology</span>
                    View Neural Process
                </summary>
                <div class="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-black/30 p-3 rounded border-l-2 border-primary overflow-x-auto whitespace-pre-wrap">${escapeHtml(data.internal_thinking)}</div>
            </details>` : '';

        const verificationBlock = data.verification_data ? `
            <details class="mt-3 group">
                <summary class="cursor-pointer text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors list-none flex items-center gap-1">
                    <span class="material-icons text-[12px]">search</span>
                    Evidence
                </summary>
                <div class="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded border-l-2 border-amber-400 overflow-x-auto whitespace-pre-wrap">${escapeHtml(data.verification_data)}</div>
            </details>` : '';

        const html = `
        <div class="flex justify-start fade-in">
            <div class="max-w-[85%]">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">AI</div>
                    <span class="text-xs text-slate-400">MindSight</span> ${emotionBadge} ${modeBadge}
                </div>
                <div class="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-4 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 shadow-sm">
                    ${thinkingLog}
                    <p class="leading-relaxed">${markdownToHtml(data.response)}</p>
                    ${verificationBlock}
                </div>
            </div>
        </div>`;
        processingIndicator.insertAdjacentHTML('beforebegin', html);
    }

    function appendErrorMessage(msg) {
        chatContainer.insertAdjacentHTML('beforeend', `<div class="flex justify-center my-4"><span class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-800">⚠ ${escapeHtml(msg)}</span></div>`);
    }

    function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }
    function escapeHtml(text) { if (!text) return ""; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
    function markdownToHtml(text) { if (!text) return ""; return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>'); }

    // Events
    sendBtn.addEventListener('click', handleSendMessage);
    inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
});