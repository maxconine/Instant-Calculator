# Instant Solver

A Spotlight-style scientific calculator for Mac. Press **Control + Option + Space** to calculate without leaving the app you’re in.

## Mac app

```bash
npm install
npm run mac
open "macos/dist/Instant Solver.app"
```

- **Control + Option + Space** shows the calculator (about the size of a Spotlight window, opaque).
- Type as you would in Desmos or Wolfram: `pi` becomes π, `sqrt` becomes √, `^` becomes a superscript, `_` a subscript.
- The answer updates as you type. **⌘C** copies it.
- **Enter** saves the calculation to history.
- **Up arrow** or scroll the tape to see previous calculations.
- Click a previous answer, or type `ans`, to insert it at the cursor.
- **Esc** hides the window.

If that shortcut is already used by Input Sources, turn it off in **System Settings → Keyboard → Input Sources → Edit**.

The app lives in the menu bar (∑). Click **Quick Calc** there if you need it without the hotkey.

## Web preview

```bash
npm install
npm run dev
```

Open http://localhost:5173/

## Tests

```bash
npm test
```

Runs the engine suite, including the 250-case scientific checklist in `src/engine/scientific.test.ts`.
