// Get elements from HTML
const startButton = document.getElementById('startBtn');
const stopButton = document.getElementById('stopBtn');
const clearButton = document.getElementById('clearBtn');
const textDisplay = document.getElementById('text');
const statusDisplay = document.getElementById('status');
const languageSelect = document.getElementById('languageSelect');
const copyButton = document.getElementById('copyBtn');
const downloadButton = document.getElementById('downloadBtn');
const meetingModeCheckbox = document.getElementById('meetingMode');
const highAccuracyModeCheckbox = document.getElementById('highAccuracyMode');
const confidenceThresholdSlider = document.getElementById('confidenceThreshold');
const confidenceValueDisplay = document.getElementById('confidenceValue');

// Create speech recognition object
let recognition;
let accumulatedFinalTranscript = '';
let transcriptSegments = []; // For meeting mode with timestamps
let recordingStartTime = null;
let isManualStop = false; // Track if stop was manual or automatic

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
const STORAGE_SEGMENTS_KEY = 'speech_recognition_segments_v1';

function persistTranscript(text, segments = null) {
    try {
        localStorage.setItem(STORAGE_KEY, text || '');
        if (segments) {
            localStorage.setItem(STORAGE_SEGMENTS_KEY, JSON.stringify(segments));
        }
    } catch (_) {}
}

function restoreTranscript() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedSegments = localStorage.getItem(STORAGE_SEGMENTS_KEY);
        if (meetingModeCheckbox && meetingModeCheckbox.checked && savedSegments) {
            transcriptSegments = JSON.parse(savedSegments);
            textDisplay.textContent = formatTranscriptWithTimestamps(transcriptSegments);
            accumulatedFinalTranscript = transcriptSegments.map(s => s.text).join(' ') + ' ';
        } else if (saved && saved.trim() !== '') {
            textDisplay.textContent = saved;
            accumulatedFinalTranscript = saved + ' ';
        }
    } catch (_) {}
}

function formatTranscriptWithTimestamps(segments) {
    return segments.map(segment => {
        const time = new Date(segment.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        const confidenceStr = segment.confidence ? ` (${(segment.confidence * 100).toFixed(0)}%)` : '';
        return `[${timeStr}] ${segment.text}${confidenceStr}`;
    }).join('\n\n');
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
    recognition.maxAlternatives = 5; // Get multiple alternatives for better accuracy

    // Update language when user changes selection
    if (languageSelect) {
        languageSelect.addEventListener('change', () => {
            recognition.lang = languageSelect.value;
            if (!stopButton.disabled) {
                statusDisplay.textContent = `Language set to ${languageSelect.options[languageSelect.selectedIndex].text}`;
            }
        });
    }

    // Update meeting mode
    if (meetingModeCheckbox) {
        meetingModeCheckbox.addEventListener('change', () => {
            if (meetingModeCheckbox.checked) {
                statusDisplay.textContent = 'Meeting mode enabled - timestamps will be added';
            } else {
                statusDisplay.textContent = 'Standard mode - continuous text';
            }
        });
    }

    // Update high accuracy mode
    if (highAccuracyModeCheckbox) {
        highAccuracyModeCheckbox.addEventListener('change', () => {
            if (highAccuracyModeCheckbox.checked) {
                recognition.maxAlternatives = 10; // More alternatives for high accuracy
                statusDisplay.textContent = 'High accuracy mode enabled - slower but more precise';
            } else {
                recognition.maxAlternatives = 5; // Standard alternatives
                statusDisplay.textContent = 'Standard accuracy mode';
            }
        });
    }

    // Update confidence threshold
    if (confidenceThresholdSlider && confidenceValueDisplay) {
        confidenceThresholdSlider.addEventListener('input', () => {
            confidenceValueDisplay.textContent = confidenceThresholdSlider.value;
        });
    }

    // Emit better lifecycle feedback
    recognition.onstart = () => {
        document.body.classList.add('recording');
        recordingStartTime = Date.now();
        isManualStop = false; // Reset manual stop flag when starting
        const langText = languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : 'English (US)';
        const modeText = meetingModeCheckbox && meetingModeCheckbox.checked ? ' (Meeting Mode)' : '';
        statusDisplay.textContent = `Listening... (${langText})${modeText}`;
    };

    // What to do when we get results
    recognition.onresult = (event) => {
        let interimTranscript = '';
        const confidenceThreshold = confidenceThresholdSlider ? parseFloat(confidenceThresholdSlider.value) : 0.8;

        // Loop through results from the event's resultIndex
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            
            if (result.isFinal) {
                // Get the best transcript based on confidence
                let bestTranscript = result[0].transcript;
                let bestConfidence = result[0].confidence || 0;

                // In high accuracy mode, check alternatives for better confidence
                if (highAccuracyModeCheckbox && highAccuracyModeCheckbox.checked) {
                    for (let alt = 1; alt < result.length; alt++) {
                        const alternative = result[alt];
                        if (alternative.confidence > bestConfidence) {
                            bestTranscript = alternative.transcript;
                            bestConfidence = alternative.confidence;
                        }
                    }
                }

                // Only accept results above confidence threshold
                if (bestConfidence >= confidenceThreshold || !highAccuracyModeCheckbox || !highAccuracyModeCheckbox.checked) {
                    const finalTranscript = bestTranscript.trim();
                    
                    if (meetingModeCheckbox && meetingModeCheckbox.checked) {
                        // Add timestamped segment with confidence
                        const segment = {
                            text: finalTranscript,
                            timestamp: Date.now(),
                            confidence: bestConfidence
                        };
                        transcriptSegments.push(segment);
                        accumulatedFinalTranscript += finalTranscript + ' ';
                        const fullDisplay = formatTranscriptWithTimestamps(transcriptSegments);
                        textDisplay.textContent = fullDisplay;
                        persistTranscript(fullDisplay, transcriptSegments);
                    } else {
                        accumulatedFinalTranscript += finalTranscript + ' ';
                        const fullDisplay = (accumulatedFinalTranscript + interimTranscript).trim();
                        textDisplay.textContent = fullDisplay || 'Your speech will appear here...';
                        persistTranscript(fullDisplay);
                    }
                    
                    // Show confidence feedback
                    if (bestConfidence < 0.7) {
                        statusDisplay.textContent = `Low confidence (${(bestConfidence * 100).toFixed(0)}%) - consider rephrasing`;
                        setTimeout(() => {
                            if (!stopButton.disabled) {
                                statusDisplay.textContent = `Listening... (${languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : 'English (US)'})`;
                            }
                        }, 2000);
                    }
                } else {
                    // Reject low confidence result
                    statusDisplay.textContent = `Rejected low confidence result (${(bestConfidence * 100).toFixed(0)}%) - try speaking more clearly`;
                    setTimeout(() => {
                        if (!stopButton.disabled) {
                            statusDisplay.textContent = `Listening... (${languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : 'English (US)'})`;
                        }
                    }, 2000);
                }
            } else {
                // For interim results, show the most confident alternative
                let bestInterim = result[0].transcript;
                let bestInterimConfidence = result[0].confidence || 0;
                
                for (let alt = 1; alt < result.length; alt++) {
                    const alternative = result[alt];
                    if ((alternative.confidence || 0) > bestInterimConfidence) {
                        bestInterim = alternative.transcript;
                        bestInterimConfidence = alternative.confidence || 0;
                    }
                }
                
                interimTranscript += bestInterim;
            }
        }

        // For non-meeting mode, show interim results
        if (!(meetingModeCheckbox && meetingModeCheckbox.checked)) {
            const fullDisplay = (accumulatedFinalTranscript + interimTranscript).trim();
            textDisplay.textContent = fullDisplay || 'Your speech will appear here...';
        }

        updateActionButtonsState();
    };

    // Reset interim when end occurs but keep accumulated text
    recognition.onend = () => {
        document.body.classList.remove('recording');
        
        // Auto-restart in meeting mode if not manually stopped
        if (!isManualStop && meetingModeCheckbox && meetingModeCheckbox.checked && !startButton.disabled) {
            statusDisplay.textContent = "Paused - waiting for speech... (Meeting Mode)";
            // Restart after a short delay
            setTimeout(() => {
                if (!isManualStop && meetingModeCheckbox && meetingModeCheckbox.checked && !startButton.disabled) {
                    try {
                        recognition.start();
                    } catch (e) {
                        // If start fails, show stopped message
                        statusDisplay.textContent = "Recognition stopped";
                    }
                }
            }, 500);
        } else {
            statusDisplay.textContent = "Recognition stopped";
        }
    };
}

// Button click handlers
startButton.addEventListener('click', () => {
    if (!recognition) return;
    
    // Configure recognition based on current settings
    recognition.maxAlternatives = highAccuracyModeCheckbox && highAccuracyModeCheckbox.checked ? 10 : 5;
    recognition.lang = languageSelect ? languageSelect.value : 'en-US';
    
    // Reset transcripts based on mode
    if (meetingModeCheckbox && meetingModeCheckbox.checked) {
        transcriptSegments = [];
        accumulatedFinalTranscript = '';
        textDisplay.textContent = 'Your speech will appear here...';
    } else {
        accumulatedFinalTranscript = textDisplay.textContent === 'Your speech will appear here...' ? '' : (textDisplay.textContent + ' ');
    }
    
    try {
        recognition.start();
        startButton.disabled = true;
        stopButton.disabled = false;
    } catch (_) {}
});

stopButton.addEventListener('click', () => {
    if (!recognition) return;
    isManualStop = true; // Mark as manual stop
    recognition.stop();
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDisplay.textContent = "Click 'Start Recording' to begin";
});

clearButton.addEventListener('click', () => {
    accumulatedFinalTranscript = '';
    transcriptSegments = [];
    textDisplay.textContent = "Your speech will appear here...";
    persistTranscript('', []);
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
            // Auto-restart for no-speech in meeting mode
            if (!isManualStop && meetingModeCheckbox && meetingModeCheckbox.checked && !startButton.disabled) {
                setTimeout(() => {
                    if (!isManualStop && !startButton.disabled) {
                        recognition.start();
                    }
                }, 1000);
            }
        } else if (event.error === 'audio-capture') {
            statusDisplay.textContent = 'No microphone found. Check your device.';
        } else if (event.error === 'aborted') {
            statusDisplay.textContent = 'Recognition aborted.';
        } else if (event.error === 'language-not-supported') {
            statusDisplay.textContent = 'Selected language not supported.';
        } else if (event.error === 'network') {
            statusDisplay.textContent = 'Network error. Check your connection.';
            // Auto-restart for network errors
            if (!isManualStop && meetingModeCheckbox && meetingModeCheckbox.checked && !startButton.disabled) {
                setTimeout(() => {
                    if (!isManualStop && !startButton.disabled) {
                        recognition.start();
                    }
                }, 2000);
            }
        } else {
            statusDisplay.textContent = 'Error occurred. Please try again.';
        }
        startButton.disabled = false;
        stopButton.disabled = true;
    };
}

function downloadTranscript() {
    let text;
    if (meetingModeCheckbox && meetingModeCheckbox.checked && transcriptSegments.length > 0) {
        text = formatTranscriptWithTimestamps(transcriptSegments);
    } else {
        text = document.getElementById('text').textContent;
    }
    
    if (!text || text.trim() === '' || text === 'Your speech will appear here...') return;

    // Create a Blob containing the text
    const blob = new Blob([text], { type: 'text/plain' });

    // Create a temporary URL for the Blob
    const url = window.URL.createObjectURL(blob);

    // Create a temporary anchor element
    const a = document.createElement('a');

    // Set the download attributes
    const filename = meetingModeCheckbox && meetingModeCheckbox.checked ? 'meeting_transcript.txt' : 'transcript.txt';
    a.href = url;
    a.download = filename;

    // Append the anchor to the body
    document.body.appendChild(a);

    // Programmatically click the anchor
    a.click();

    // Clean up by removing the anchor and revoking the URL
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

async function copyTranscript() {
    let text;
    if (meetingModeCheckbox && meetingModeCheckbox.checked && transcriptSegments.length > 0) {
        text = formatTranscriptWithTimestamps(transcriptSegments);
    } else {
        text = document.getElementById('text').textContent;
    }
    
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

// Handle transcript editing
textDisplay.addEventListener('input', () => {
    // Update accumulated transcript when user edits
    const currentText = textDisplay.textContent.trim();
    if (currentText && currentText !== 'Your speech will appear here...') {
        accumulatedFinalTranscript = currentText + ' ';
        persistTranscript(currentText);
        updateActionButtonsState();
    }
});

textDisplay.addEventListener('blur', () => {
    // Save changes when user finishes editing
    const currentText = textDisplay.textContent.trim();
    if (currentText && currentText !== 'Your speech will appear here...') {
        accumulatedFinalTranscript = currentText + ' ';
        persistTranscript(currentText);
    }
});

// Initialize from saved transcript on load
restoreTranscript();
// Initialize buttons state on load
updateActionButtonsState();