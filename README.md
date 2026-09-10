# Instant Solver

A Spotlight-style scientific calculator for Mac. Press **Control + Option + Space** to calculate without leaving the app you’re in.

Type `sin(90)`, `72 f`, or `$10 for lunch + 15% tip` — the answer updates as you type.

## Install on Apple silicon

You need an **Apple silicon Mac** (M1 or later) running **macOS 14** or later. Instant Solver is built from this repository.

### 1. Xcode

Install [Xcode 26](https://developer.apple.com/xcode/) or later from the Mac App Store, open it once, then accept the license:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

Xcode 26 is required because the Mac app links [SoulverCore](https://github.com/soulverteam/SoulverCore), which ships a Swift 6.2 binary.

### 2. Node.js

Install Node.js 20 or later from [nodejs.org](https://nodejs.org) or Homebrew:

```bash
brew install node
```

### 3. Build and install

```bash
git clone https://github.com/maxconine/Instant-Calculator.git
cd Instant-Calculator
npm install
npm run mac:install
```

The first build downloads SoulverCore, compiles Instant Solver, and copies **Instant Solver.app** into `/Applications`.

To build without installing:

```bash
npm run mac
open "macos/dist/Instant Solver.app"
```

### 4. First launch

```bash
open "/Applications/Instant Solver.app"
```

The app is ad-hoc signed, not notarized. If macOS says it can’t be opened:

1. Control-click **Instant Solver** in Applications and choose **Open**.
2. Or clear the quarantine flag, then open it:

```bash
xattr -cr "/Applications/Instant Solver.app"
open "/Applications/Instant Solver.app"
```

A **∑** icon appears in the menu bar. Instant Solver is a menu-bar app — it does not show in the Dock.

If **Control + Option + Space** does nothing, macOS is often using that shortcut for Input Sources. Turn the shortcut off in **System Settings → Keyboard → Input Sources → Edit**.

To start Instant Solver at login, add it under **System Settings → General → Login Items & Extensions**.

## Using Instant Solver

- **Control + Option + Space** shows the calculator. **Esc** or a click outside the window hides it.
- Type as you would on a scientific calculator: `sin(90)`, `sqrt(2)`, `2^8`, `5!`. `pi` becomes π as you type.
- **⌃D** switches between degrees and radians. **⌃F** toggles fraction results.
- Unit conversions work too: `72 f`, `2 in to cm`.
- Natural-language math works in the Mac app via SoulverCore: `$10 for lunch + 15% tip`, `40 is what % of 90`, `3:45pm + 4 hr 10 min`.
- The answer updates as you type. Click it or press **⌘C** to copy. Type `ans` to insert it at the cursor.
- **Enter** saves the calculation to history. **Up arrow** or scroll the tape to see previous ones.

The **∑** menu can show the calculator without the hotkey. Significant figures, how long to keep unfinished input, and default units are set from the same menu.

## Development

The JavaScript engine can be tried in a browser. Natural-language phrases like `$10 for lunch + 15% tip` need the Mac app.

```bash
npm install
npm run dev
```

Open http://localhost:5173/

```bash
npm test
```

Runs the engine suite, including the scientific checklist in `src/engine/scientific.test.ts`.

## License

Instant Solver is [MIT](LICENSE).

The Mac app embeds [SoulverCore](https://github.com/soulverteam/SoulverCore), a closed-source natural language math engine. SoulverCore may be used in personal and private projects. [Contact the authors](mailto:contact@soulver.app) before using it in a public or commercial project (they offer options, including a free license with attribution). `npm run mac` downloads the official xcframework at build time.
