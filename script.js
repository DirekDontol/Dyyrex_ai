document.addEventListener("DOMContentLoaded", () => {
    // --- 1. BOOT & LOGIN SEQUENCE ---
    setTimeout(() => {
        document.getElementById('boot-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }, 2500);

    document.getElementById('login-btn').addEventListener('click', () => {
        const pin = document.getElementById('login-pin').value;
        if (pin === "1234" || pin === "") { // Dummy login
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('desktop').classList.remove('hidden');
            initSystem();
        } else {
            alert("PIN Salah! Coba 1234 atau biarkan kosong.");
        }
    });

    // --- 2. CLOCK & DATE ---
    function updateClock() {
        const now = new Date();
        document.getElementById('time').innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('date').innerText = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- 3. START MENU TOGGLE ---
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start-menu').classList.toggle('hidden');
    });

    // --- 4. COMMAND PALETTE (Ctrl + K) ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const palette = document.getElementById('command-palette');
            palette.classList.toggle('hidden');
            if (!palette.classList.contains('hidden')) {
                document.getElementById('cmd-input').focus();
            }
        }
    });
});

// --- 5. WINDOW MANAGER ---
let zIndexCounter = 100;

function openWindow(appId, title, contentHtml) {
    const container = document.getElementById('windows-container');
    
    // Cek apakah window sudah terbuka
    if (document.getElementById(`window-${appId}`)) {
        bringToFront(document.getElementById(`window-${appId}`));
        return;
    }

    // Buat elemen window
    const win = document.createElement('div');
    win.className = 'os-window glass-panel';
    win.id = `window-${appId}`;
    win.style.zIndex = ++zIndexCounter;

    win.innerHTML = `
        <div class="window-header" onmousedown="bringToFront(this.parentElement)">
            <div class="window-title">${title}</div>
            <div class="window-controls">
                <button class="minimize"><i class="fa-solid fa-minus"></i></button>
                <button class="maximize"><i class="fa-regular fa-square"></i></button>
                <button class="close" onclick="closeWindow('${appId}')"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div class="window-content">
            ${contentHtml}
        </div>
    `;

    container.appendChild(win);
    makeDraggable(win);
}

function closeWindow(appId) {
    const win = document.getElementById(`window-${appId}`);
    if (win) {
        win.style.animation = "windowOpen 0.2s reverse";
        setTimeout(() => win.remove(), 190);
    }
}

function bringToFront(element) {
    element.style.zIndex = ++zIndexCounter;
}

// Logika Drag & Drop Window
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector('.window-header');
    
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // Memastikan window tidak keluar dari layar atas
        let newTop = element.offsetTop - pos2;
        if (newTop < 0) newTop = 0;

        element.style.top = newTop + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}
