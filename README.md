# Eye Color Identifier

A web app that uses your device camera to capture an image of your eye, analyzes the iris colors, and returns:

- **General eye color** (Blue, Green, Hazel, Brown, Gray, Amber)
- **Color breakdown** – all distinct colors detected in the iris with percentages
- **Hex color codes** for each color
- **Pantone matches** – closest Pantone color names and swatches for your eye colors

## Requirements

- Node.js 18+
- A device with a camera (phone or computer)
- For phone: use HTTPS in production (camera requires a secure context)

## Setup & Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open in a browser:

   - **Same machine:** [http://localhost:3000](http://localhost:3000)
   - **Phone on same Wi‑Fi:** use your computer’s local IP, e.g. `http://192.168.1.x:3000`

## How to Use

1. Allow camera access when prompted.
2. Position your eye inside the circular guide (use “Switch Camera” on phones to choose front/back).
3. Tap **Capture Eye**.
4. Tap **Analyze** to send the image to the server.
5. View your general eye color, color breakdown, hex codes, and Pantone matches with swatches.

## Project Structure

- **Backend (Node/Express)**
  - `server/index.js` – Express app, `/api/analyze` and static files
  - `server/colorAnalyzer.js` – image processing (Sharp), dominant color extraction, Pantone matching
  - `server/data/pantone-eye-colors.json` – Pantone subset used for eye-color matching

- **Frontend**
  - `public/index.html` – camera view, capture, preview, results UI
  - `public/styles.css` – layout and styling
  - `public/app.js` – camera, capture, upload, and results rendering

## API

- **POST `/api/analyze`**
  - **Body (JSON):** `{ "image": "data:image/jpeg;base64,..." }`
  - **Or multipart:** field name `image` (file)
  - **Response:** `{ generalColor, breakdown, pantoneMatches, colorCode }`

## Tech Stack

- **Backend:** Express, Multer, Sharp (image processing)
- **Frontend:** Vanilla JS, `getUserMedia` for camera
- **Pantone:** Custom subset of ~75 colors (blues, greens, browns, grays, hazel) with hex values for matching
