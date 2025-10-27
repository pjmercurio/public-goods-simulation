
# Public Goods Game – 5‑Minute Classroom Webapp

A minimal, phone‑friendly webapp to run a one‑shot Public Goods Game with random groups of ~4, inspired by Aswani et al. (2013).

## Features
- Students join by scanning a QR code (or visiting a URL on the same network)
- Host dashboard shows player count, creates random groups (size ~4)
- Students privately submit contributions (0–15) from their phone
- Server doubles the pot and splits equally within each group
- Automatic per‑student payout display + host summary table
- Reset and run another round fast

## Quick Start
1. Ensure everyone is on the **same Wi‑Fi** (students connect to your laptop’s network or campus Wi‑Fi).
2. Open a terminal and run:
   ```bash
   cd server
   npm install
   npm start
   ```
3. On the host machine, open: `http://localhost:3000/host.html`  
   - It shows a **QR code** pointing to the join page.
4. Students scan the QR or visit `http://<YOUR_IP>:3000/join.html`  
   - Replace `<YOUR_IP>` with your computer’s local IP (e.g., `192.168.1.12`).
5. When enough players have joined, click **Start Round**.
6. Watch groups fill in, then see **results** appear once groups finish.

## Notes
- Group size defaults to 4. If the total players aren’t divisible by 4, the last group will be smaller—payouts use actual group size.
- Base endowment is 15; multiplier is 2 (edit in `server/index.js` if needed).
- Names are optional and only visible to the host in the summary table; otherwise students are anonymous.

## Customize
- Change endowment/multiplier in `server/index.js`.
- Add more rounds or variants (e.g., wage bonus, pro‑access message) by extending state/flows.
- For production hosting, deploy on a Node server or render.com; keep it internal if you want anonymity.

## License
MIT for this sample. QR generator is QRCode.js (MIT).
