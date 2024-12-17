// Get elements from HTML
const startButton = document.getElementById('startBtn');
const stopButton = document.getElementById('stopBtn');
const clearButton = document.getElementById('clearBtn');
const textDisplay = document.getElementById('text');
const statusDisplay = document.getElementById('status');

// Create speech recognition object
let recognition;
try {
    // Try to create speech recognition (works in Chrome)
    recognition = new webkitSpeechRecognition() || new SpeechRecognition();
} catch (error) {
    // If speech recognition is not supported
    statusDisplay.textContent = "Speech recognition is not supported in this browser";
    startButton.disabled = true;
}

// Configure speech recognition
if (recognition) {
    recognition.continuous = true;  // Keep listening even if user pauses
    recognition.interimResults = true;  // Get results while speaking
    recognition.lang = 'en-US';  // Set language to English

    // What to do when we get results
    recognition.onresult = (event) => {
        let finalTranscript = '';
        
        // Loop through results
        for (let i = 0; i < event.results.length; i++) {
            let transcript = event.results[i][0].transcript;
            
            // If this is a final result, add it to final transcript
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            }
        }
        
        // Display the text
        if (finalTranscript !== '') {
            textDisplay.textContent = finalTranscript;
        }
    };
}

// Button click handlers
startButton.addEventListener('click', () => {
    recognition.start();
    startButton.disabled = true;
    stopButton.disabled = false;
    statusDisplay.textContent = "Listening...";
});

stopButton.addEventListener('click', () => {
    recognition.stop();
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDisplay.textContent = "Click 'Start Recording' to begin";
});

clearButton.addEventListener('click', () => {
    textDisplay.textContent = "Your speech will appear here...";
});

// Error handling
recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    statusDisplay.textContent = "Error occurred. Please try again.";
    startButton.disabled = false;
    stopButton.disabled = true;
};

function downloadTranscript() {
    // Get the text content from the transcript box
    const text = document.getElementById('text').textContent;
    
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

// Add event listener to the download button
document.getElementById('downloadBtn').addEventListener('click', downloadTranscript);