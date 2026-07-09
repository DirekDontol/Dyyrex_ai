const WebSocket = require('ws');
const net = require('net');
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
    let active = true;
    let testInterval;

    ws.on('message', (message) => {
        const cmd = JSON.parse(message);
        if (cmd.action === 'start') {
            const { ip, port, threads, duration } = cmd;
            const targets = [];
            for (let i = 0; i < threads; i++) {
                targets.push(createConnection(ip, port, ws));
            }
            // Run for specified duration then stop
            testInterval = setTimeout(() => {
                active = false;
                targets.forEach(t => t.destroy());
                ws.send(JSON.stringify({ status: 'complete', message: 'Test duration ended' }));
            }, duration * 1000);
            ws.send(JSON.stringify({ status: 'running', message: `Simulating ${threads} concurrent connections...` }));
        } else if (cmd.action === 'stop') {
            active = false;
            clearTimeout(testInterval);
            ws.send(JSON.stringify({ status: 'stopped', message: 'Test halted by user' }));
        }
    });

    function createConnection(ip, port, ws) {
        const socket = new net.Socket();
        let connected = false;
        const attempt = () => {
            if (!active) return;
            socket.connect(port, ip, () => {
                connected = true;
                // Send a Minecraft handshake packet (simulated)
                const handshake = Buffer.from([0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
                socket.write(handshake);
                ws.send(JSON.stringify({ message: `🔗 Connection established to ${ip}:${port}` }));
                socket.destroy();
            });
            socket.on('error', (err) => {
                // Silent fail – just retry after delay
                setTimeout(attempt, 1000 + Math.random() * 2000);
            });
            socket.on('close', () => {
                if (active) setTimeout(attempt, 500 + Math.random() * 1000);
            });
        };
        attempt();
        return socket;
    }
});
