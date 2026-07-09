let ws, running = false;

document.getElementById('testForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (running) return;
    const ip = document.getElementById('ip').value;
    const port = document.getElementById('port').value;
    const threads = parseInt(document.getElementById('threads').value);
    const duration = parseInt(document.getElementById('duration').value);
    log(`🔄 Initializing test on ${ip}:${port} with ${threads} threads...`);

    // WebSocket connection to backend (Node.js)
    ws = new WebSocket('ws://localhost:3000');
    ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'start', ip, port, threads, duration }));
        running = true;
        log('✅ Test started – monitoring traffic...');
    };
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        log(`📊 ${data.message}`);
        if (data.status === 'complete') {
            running = false;
            log('⏹ Test finished successfully.');
        }
    };
    ws.onerror = () => log('❌ Connection error – ensure backend is running.');
});

document.getElementById('stopBtn').addEventListener('click', () => {
    if (ws && running) {
        ws.send(JSON.stringify({ action: 'stop' }));
        running = false;
        log('⏹ Stopped by user.');
    }
});

function log(msg) {
    const logDiv = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    logDiv.innerHTML += `[${time}] ${msg}\n`;
    logDiv.scrollTop = logDiv.scrollHeight;
      }
