/**
 * ERROR ELIMINATOR - MCQ ROUND
 * Engine & Mobile-Optimized Proctoring System
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==================== STATE MANAGEMENT ====================
    const ROUND_STATES = {
        READY: 'READY',
        ACTIVE: 'ACTIVE',
        TERMINATED: 'TERMINATED',
        COMPLETED: 'COMPLETED'
    };

    let currentState = ROUND_STATES.READY;
    let selectedSetData = null;
    let roundStartTime = null;
    let timerInterval = null;
    let devToolsCheckInterval = null;
    const TOTAL_ROUND_SECONDS = 30 * 60; // 30 Minutes
    let remainingSeconds = TOTAL_ROUND_SECONDS;

    // DOM References
    const dashboardView = document.getElementById('dashboard-view');
    const roundView = document.getElementById('round-view');
    const terminationView = document.getElementById('termination-view');
    const completionView = document.getElementById('completion-view');

    const activeSetTitle = document.getElementById('active-set-title');
    const timerDisplay = document.getElementById('timer-display');
    const timerBox = document.getElementById('timer-box');
    const timerProgressBar = document.getElementById('timer-progress-bar');
    const timerWarningBanner = document.getElementById('timer-warning-banner');
    const timerWarningText = document.getElementById('timer-warning-text');

    const formWrapper = document.getElementById('form-wrapper');
    const formLoader = document.getElementById('form-loader');
    const roundExitBtn = document.getElementById('round-exit-btn');

    // Exit Modal
    const exitModal = document.getElementById('exit-modal');
    const confirmExitBtn = document.getElementById('confirm-exit-btn');
    const cancelExitBtn = document.getElementById('cancel-exit-btn');

    // Result Overlay References
    const terminationReason = document.getElementById('termination-reason');
    const termSetName = document.getElementById('term-set-name');
    const termTimeTaken = document.getElementById('term-time-taken');
    const termNextBtn = document.getElementById('term-next-btn');

    const compSetName = document.getElementById('comp-set-name');
    const compTimeTaken = document.getElementById('comp-time-taken');
    const compNextBtn = document.getElementById('comp-next-btn');


    // ==================== EVENT BINDINGS ====================

    // Attach click listeners to all START buttons
    const startButtons = document.querySelectorAll('.start-btn');
    startButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.set-card');
            if (!card) return;

            const category = card.dataset.category;
            const set = card.dataset.set;
            const url = card.dataset.url;

            startRound({ category, name: set, url });
        });
    });

    // Exit Button
    roundExitBtn.addEventListener('click', () => {
        if (currentState === ROUND_STATES.ACTIVE) {
            exitModal.classList.remove('hidden');
        }
    });

    // Modal Actions
    cancelExitBtn.addEventListener('click', () => {
        exitModal.classList.add('hidden');
    });

    confirmExitBtn.addEventListener('click', () => {
        exitModal.classList.add('hidden');
        handleManualExit();
    });

    // Reset Buttons
    termNextBtn.addEventListener('click', resetForNextParticipant);
    compNextBtn.addEventListener('click', resetForNextParticipant);


    // ==================== ROUND START FLOW ====================

    function startRound(setData) {
        if (currentState !== ROUND_STATES.READY) return;

        selectedSetData = setData;
        roundStartTime = Date.now();
        currentState = ROUND_STATES.ACTIVE;
        remainingSeconds = TOTAL_ROUND_SECONDS;

        sessionStorage.setItem('error_eliminator_active_round', JSON.stringify({
            set: setData.name,
            startTime: roundStartTime
        }));

        // Request Fullscreen
        requestFullscreen();

        // Update UI
        activeSetTitle.textContent = setData.name;
        dashboardView.classList.remove('active');
        roundView.classList.add('active');

        // Load Iframe
        loadGoogleForm(setData.url);

        // Start Countdown Timer
        startTimer();

        // Activate Mobile & Browser Monitors
        activateProctoringMonitors();
    }

    function requestFullscreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    }

    function exitFullscreen() {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    function loadGoogleForm(url) {
        formLoader.style.display = 'flex';
        formWrapper.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.setAttribute('title', 'Question Set');
        iframe.setAttribute('allow', 'fullscreen');
        
        iframe.onload = () => {
            formLoader.style.display = 'none';
        };

        formWrapper.appendChild(iframe);
    }


    // ==================== TIMER ENGINE ====================

    function startTimer() {
        updateTimerDisplay();
        
        timerInterval = setInterval(() => {
            if (currentState !== ROUND_STATES.ACTIVE) {
                clearInterval(timerInterval);
                return;
            }

            remainingSeconds--;
            updateTimerDisplay();

            if (remainingSeconds <= 0) {
                clearInterval(timerInterval);
                handleTimeOver();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        timerDisplay.textContent = formattedTime;

        // Progress line percentage
        const percent = (remainingSeconds / TOTAL_ROUND_SECONDS) * 100;
        timerProgressBar.style.width = `${percent}%`;

        // Warning & Critical States
        if (remainingSeconds <= 60) {
            timerBox.className = 'stylish-timer-box timer-critical';
            timerProgressBar.className = 'timer-progress-bar critical';
            if (timerWarningBanner) {
                timerWarningBanner.classList.remove('hidden');
                timerWarningText.textContent = 'CRITICAL: 1 minute remaining! Finalize and submit your answers.';
            }
        } else if (remainingSeconds <= 300) {
            timerBox.className = 'stylish-timer-box timer-warning';
            timerProgressBar.className = 'timer-progress-bar warning';
            if (timerWarningBanner) {
                timerWarningBanner.classList.remove('hidden');
                timerWarningText.textContent = 'Attention: Less than 5 minutes remaining! Ensure all responses are submitted.';
            }
        } else {
            timerBox.className = 'stylish-timer-box';
            timerProgressBar.className = 'timer-progress-bar';
            if (timerWarningBanner) {
                timerWarningBanner.classList.add('hidden');
            }
        }
    }

    function handleTimeOver() {
        timerDisplay.textContent = 'TIME OVER';
        triggerRoundCompletion();
    }


    // ==================== MOBILE & BROWSER PROCTORING MONITORS ====================

    function activateProctoringMonitors() {
        // 1. Fullscreen Exits
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        // 2. Mobile App Switching, Tab Switch & Page Backgrounding
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('pagehide', handlePageHide);

        // 3. Prevent Long-Press Context Menu & Text Selection
        window.addEventListener('contextmenu', handleProhibitedEvent, true);
        window.addEventListener('selectstart', handleProhibitedEvent, true);
        window.addEventListener('dragstart', handleProhibitedEvent, true);

        // 4. Prohibit Copy, Paste, Cut
        window.addEventListener('copy', handleProhibitedEvent, true);
        window.addEventListener('paste', handleProhibitedEvent, true);
        window.addEventListener('cut', handleProhibitedEvent, true);

        // 5. Keyboard Restrictions
        window.addEventListener('keydown', handleKeyDown, true);

        // 6. DevTools Dimension Checks
        devToolsCheckInterval = setInterval(checkDevTools, 1500);

        // 7. Navigation Protection
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    function deactivateProctoringMonitors() {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);

        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('pagehide', handlePageHide);

        window.removeEventListener('contextmenu', handleProhibitedEvent, true);
        window.removeEventListener('selectstart', handleProhibitedEvent, true);
        window.removeEventListener('dragstart', handleProhibitedEvent, true);

        window.removeEventListener('copy', handleProhibitedEvent, true);
        window.removeEventListener('paste', handleProhibitedEvent, true);
        window.removeEventListener('cut', handleProhibitedEvent, true);

        window.removeEventListener('keydown', handleKeyDown, true);

        if (devToolsCheckInterval) {
            clearInterval(devToolsCheckInterval);
        }

        window.removeEventListener('beforeunload', handleBeforeUnload);
    }

    // Handlers
    function handleFullscreenChange() {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        if (!isFullscreen) {
            triggerViolationTermination('Fullscreen mode was exited.');
        }
    }

    function handleVisibilityChange() {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        if (document.hidden || document.visibilityState === 'hidden') {
            triggerViolationTermination('Tab or app switching detected.');
        }
    }

    function handleWindowBlur() {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        setTimeout(() => {
            if (currentState === ROUND_STATES.ACTIVE && document.activeElement && document.activeElement.tagName !== 'IFRAME' && !document.hasFocus()) {
                triggerViolationTermination('App switched or focus lost from the round window.');
            }
        }, 300);
    }

    function handlePageHide() {
        if (currentState !== ROUND_STATES.ACTIVE) return;
        triggerViolationTermination('Page was sent to background.');
    }

    function handleProhibitedEvent(e) {
        if (currentState !== ROUND_STATES.ACTIVE) return;
        e.preventDefault();
        e.stopPropagation();
    }

    function handleKeyDown(e) {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        const ctrlOrCmd = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        if (ctrlOrCmd && ['c', 'v', 'x', 'a', 'u', 's', 'p'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            triggerViolationTermination('Restricted keyboard shortcut detected.');
        } else if (e.key === 'F12' || (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
            e.preventDefault();
            e.stopPropagation();
            triggerViolationTermination('Developer tools shortcut detected.');
        } else if (e.altKey && e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            triggerViolationTermination('Tab switching shortcut detected.');
        }
    }

    function checkDevTools() {
        if (currentState !== ROUND_STATES.ACTIVE) return;
        if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
            triggerViolationTermination('Developer tools window detected.');
        }
    }

    function handleBeforeUnload(e) {
        if (currentState === ROUND_STATES.ACTIVE) {
            e.preventDefault();
            e.returnValue = 'Leaving this round will terminate your participation.';
            return e.returnValue;
        }
    }


    // ==================== TERMINATION & COMPLETION ====================

    function triggerViolationTermination(reason) {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        currentState = ROUND_STATES.TERMINATED;

        const timeTakenSec = Math.max(0, TOTAL_ROUND_SECONDS - remainingSeconds);
        const minutesTaken = Math.floor(timeTakenSec / 60);
        const secondsTaken = timeTakenSec % 60;
        const formattedTime = `${minutesTaken}m ${secondsTaken}s`;

        // Stop Monitoring & Timer
        clearInterval(timerInterval);
        deactivateProctoringMonitors();
        exitFullscreen();

        // Clear Form
        formWrapper.innerHTML = '';

        // Update Termination UI
        terminationReason.textContent = reason;
        termSetName.textContent = selectedSetData ? selectedSetData.name : '-';
        termTimeTaken.textContent = formattedTime;

        // Display Termination Overlay
        roundView.classList.remove('active');
        terminationView.classList.add('active');
    }

    function handleManualExit() {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        currentState = ROUND_STATES.TERMINATED;

        const timeTakenSec = Math.max(0, TOTAL_ROUND_SECONDS - remainingSeconds);
        const minutesTaken = Math.floor(timeTakenSec / 60);
        const secondsTaken = timeTakenSec % 60;
        const formattedTime = `${minutesTaken}m ${secondsTaken}s`;

        clearInterval(timerInterval);
        deactivateProctoringMonitors();
        exitFullscreen();
        formWrapper.innerHTML = '';

        terminationReason.textContent = 'Participant voluntarily exited the round.';
        termSetName.textContent = selectedSetData ? selectedSetData.name : '-';
        termTimeTaken.textContent = formattedTime;

        roundView.classList.remove('active');
        terminationView.classList.add('active');
    }

    function triggerRoundCompletion() {
        if (currentState !== ROUND_STATES.ACTIVE) return;

        currentState = ROUND_STATES.COMPLETED;

        const timeTakenSec = Math.max(0, TOTAL_ROUND_SECONDS - remainingSeconds);
        const minutesTaken = Math.floor(timeTakenSec / 60);
        const secondsTaken = timeTakenSec % 60;
        const formattedTime = `${minutesTaken}m ${secondsTaken}s`;

        clearInterval(timerInterval);
        deactivateProctoringMonitors();
        exitFullscreen();
        formWrapper.innerHTML = '';

        compSetName.textContent = selectedSetData ? selectedSetData.name : '-';
        compTimeTaken.textContent = formattedTime;

        roundView.classList.remove('active');
        completionView.classList.add('active');
    }


    // ==================== NEXT PARTICIPANT RESET ====================

    function resetForNextParticipant() {
        currentState = ROUND_STATES.READY;
        selectedSetData = null;
        roundStartTime = null;
        remainingSeconds = TOTAL_ROUND_SECONDS;

        sessionStorage.removeItem('error_eliminator_active_round');

        if (timerInterval) clearInterval(timerInterval);
        if (devToolsCheckInterval) clearInterval(devToolsCheckInterval);

        timerDisplay.textContent = '30:00';
        timerProgressBar.style.width = '100%';
        timerBox.className = 'stylish-timer-box';
        timerProgressBar.className = 'timer-progress-bar';
        if (timerWarningBanner) timerWarningBanner.classList.add('hidden');
        formWrapper.innerHTML = '';

        terminationView.classList.remove('active');
        completionView.classList.remove('active');
        roundView.classList.remove('active');
        exitModal.classList.add('hidden');

        dashboardView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

});
