// Get elements from HTML
const startButton = document.getElementById('startBtn');
const stopButton = document.getElementById('stopBtn');
const clearButton = document.getElementById('clearBtn');
const textDisplay = document.getElementById('text');
const statusDisplay = document.getElementById('status');
const languageSelect = document.getElementById('languageSelect');
const copyButton = document.getElementById('copyBtn');
const downloadButton = document.getElementById('downloadBtn');

// Create speech recognition object
let recognition;
let accumulatedFinalTranscript = '';

// Feature detect SpeechRecognition
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

try {
    if (SpeechRecognitionCtor) {
        recognition = new SpeechRecognitionCtor();
    } else {
        throw new Error('SpeechRecognition not supported');
    }
} catch (error) {
    statusDisplay.textContent = "Speech recognition is not supported in this browser";
    if (startButton) startButton.disabled = true;
    if (stopButton) stopButton.disabled = true;
    if (languageSelect) languageSelect.disabled = true;
}

const STORAGE_KEY = 'speech_recognition_transcript_v1';

function persistTranscript(text) {
    try {
        localStorage.setItem(STORAGE_KEY, text || '');
    } catch (_) {}
}

function restoreTranscript() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && saved.trim() !== '') {
            textDisplay.textContent = saved;
            accumulatedFinalTranscript = saved + ' ';
        }
    } catch (_) {}
}

function updateActionButtonsState() {
    const hasText = textDisplay.textContent && textDisplay.textContent.trim() !== '' && textDisplay.textContent !== 'Your speech will appear here...';
    if (downloadButton) downloadButton.disabled = !hasText;
    if (copyButton) copyButton.disabled = !hasText;
}

// Configure speech recognition
if (recognition) {
    recognition.continuous = true;  // Keep listening even if user pauses
    recognition.interimResults = true;  // Get results while speaking
    recognition.lang = languageSelect ? languageSelect.value : 'en-US';  // Set initial language

    // Update language when user changes selection
    if (languageSelect) {
        languageSelect.addEventListener('change', () => {
            recognition.lang = languageSelect.value;
            if (!stopButton.disabled) {
                statusDisplay.textContent = `Language set to ${languageSelect.options[languageSelect.selectedIndex].text}`;
            }
        });
    }

    // Emit better lifecycle feedback
    recognition.onstart = () => {
        document.body.classList.add('recording');
        statusDisplay.textContent = `Listening... (${languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : 'English (US)'})`;
    };

    // What to do when we get results
    recognition.onresult = (event) => {
        let interimTranscript = '';

        // Loop through results from the event's resultIndex
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            if (result.isFinal) {
                accumulatedFinalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        // Show final + interim live
        const fullDisplay = (accumulatedFinalTranscript + interimTranscript).trim();
        textDisplay.textContent = fullDisplay || 'Your speech will appear here...';
        persistTranscript(fullDisplay);
        updateActionButtonsState();
    };

    // Reset interim when end occurs but keep accumulated text
    recognition.onend = () => {
        document.body.classList.remove('recording');
        statusDisplay.textContent = "Recognition stopped";
    };
}

// Button click handlers
startButton.addEventListener('click', () => {
    if (!recognition) return;
    accumulatedFinalTranscript = textDisplay.textContent === 'Your speech will appear here...' ? '' : (textDisplay.textContent + ' ');
    recognition.lang = languageSelect ? languageSelect.value : 'en-US';
    try {
        recognition.start();
        startButton.disabled = true;
        stopButton.disabled = false;
    } catch (_) {}
});

stopButton.addEventListener('click', () => {
    if (!recognition) return;
    recognition.stop();
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDisplay.textContent = "Click 'Start Recording' to begin";
});

clearButton.addEventListener('click', () => {
    accumulatedFinalTranscript = '';
    textDisplay.textContent = "Your speech will appear here...";
    persistTranscript('');
    updateActionButtonsState();
});

// Error handling
if (typeof recognition !== 'undefined' && recognition) {
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        document.body.classList.remove('recording');
        if (event.error === 'not-allowed') {
            statusDisplay.textContent = 'Microphone permission denied. Allow access in browser settings.';
        } else if (event.error === 'no-speech') {
            statusDisplay.textContent = 'No speech detected. Try again.';
        } else if (event.error === 'audio-capture') {
            statusDisplay.textContent = 'No microphone found. Check your device.';
        } else if (event.error === 'aborted') {
            statusDisplay.textContent = 'Recognition aborted.';
        } else if (event.error === 'language-not-supported') {
            statusDisplay.textContent = 'Selected language not supported.';
        } else {
            statusDisplay.textContent = 'Error occurred. Please try again.';
        }
        startButton.disabled = false;
        stopButton.disabled = true;
    };
}

function downloadTranscript() {
    // Get the text content from the transcript box
    const text = document.getElementById('text').textContent;
    if (!text || text.trim() === '' || text === 'Your speech will appear here...') return;

    // Create a Blob containing the text
    const blob = new Blob([text], { type: 'text/plain' });

    // Create a temporary URL for the Blob
    const url = window.URL.createObjectURL(blob);

    // Create a temporary anchor element
    const a = document.createElement('a');

    // Set the download attributes
    a.href = url;
    a.download = 'transcript.txt';

    // Append the anchor to the body
    document.body.appendChild(a);

    // Programmatically click the anchor
    a.click();

    // Clean up by removing the anchor and revoking the URL
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

async function copyTranscript() {
    const text = document.getElementById('text').textContent;
    if (!text || text.trim() === '' || text === 'Your speech will appear here...') return;
    try {
        await navigator.clipboard.writeText(text);
        statusDisplay.textContent = 'Transcript copied to clipboard';
    } catch (e) {
        statusDisplay.textContent = 'Copy failed. Select and press Ctrl+C';
    }
}

// Add event listeners to the action buttons
if (downloadButton) downloadButton.addEventListener('click', downloadTranscript);
if (copyButton) copyButton.addEventListener('click', copyTranscript);

// Initialize from saved transcript on load
restoreTranscript();
// Initialize buttons state on load
updateActionButtonsState();