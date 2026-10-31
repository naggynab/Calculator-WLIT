# NOIR / CALC

A small, tactile calculator built with plain HTML, CSS, and JavaScript. It has no build step and no dependencies beyond the two display fonts loaded from Google Fonts.

## Run it

Open `index.html` directly, or serve the folder locally:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Features

- Full mouse and keyboard input
- Live result preview while typing
- Calculation history with click-to-reuse
- Friendly divide-by-zero error state
- Scientific layer: roots, powers, trig, logarithms, factorials, constants, and angle mode
- Memory keys: MC, MR, M+, and M−
- Built-in engine checks for known results
- Dark / light color mode toggle
- Responsive layout for smaller screens

The GitHub button in the footer currently points to `https://github.com/your-username/noir-calculator`. Swap that URL for the repository URL after publishing this folder.

## Fellowship learning map

The main logic lives in `script.js`:

1. `tokenize`-style code inside `evaluateExpression` reads the input into numbers and operators.
2. `parseExpression`, `parseTerm`, `parsePower`, and `parseFactor` apply operator precedence.
3. `applyUnary` contains scientific functions as small, named operations.
4. `memoryAction` and `angleMode` show how UI state is stored and updated.
5. `runDiagnostics` is a tiny regression test suite: change the parser, run it, and make sure the known answers still pass.

The page deliberately stays local and dependency-light. Live currency rates, graphing, saved programs, and external calibration standards would be separate fellowship projects because they need new data models, APIs, or a larger UI—not just more calculator buttons.
