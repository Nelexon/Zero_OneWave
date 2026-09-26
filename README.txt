AUDIO WAVEFORM PWA
===================

This folder contains a complete Progressive Web App version of the supplied
Python audio waveform program.

It is designed to work on:
- iPhone X / Safari
- Android / Chrome
- Windows / modern browsers

IMPORTANT:
Microphone access requires HTTPS (or localhost during local development).

QUICK TEST ON WINDOWS
---------------------

If Python is installed on your Windows PC:

1. Open Command Prompt.
2. cd into this folder.
3. Run:

   python -m http.server 8000

4. On the Windows PC, open:

   http://localhost:8000

For the iPhone, localhost on the PC is NOT the same as localhost on the phone,
so use an HTTPS web host for the actual iPhone.

EASIEST DEPLOYMENT
------------------

You can upload all these files to an HTTPS static hosting service.

The simplest workflow is:

1. Create an account with a static hosting provider.
2. Upload the files in this folder, preserving the "icons" folder.
3. Open the HTTPS URL on the iPhone in Safari.
4. Tap Start.
5. Allow microphone access.
6. Use Safari's Share button.
7. Choose "Add to Home Screen".
8. Launch "Audio Waveform" from the Home Screen.

THE AUDIO VISUALISER
--------------------

The implementation preserves the important values from the original Python:

3 second rolling history
AMPLITUDE = 5.0
BAR_WIDTH = 3
BAR_GAP = 1
SMOOTHING = 0.25
60 FPS target
orange = RGB(255,120,0)
background = RGB(10,10,10)
centre line = RGB(70,70,70)

The browser's actual microphone sample rate is used. Most iPhones expose
44.1 kHz or 48 kHz depending on the audio route.

FILES
-----

index.html
style.css
app.js
service-worker.js
manifest.webmanifest
icons/icon-180.png
icons/icon-192.png
icons/icon-512.png
README.txt
