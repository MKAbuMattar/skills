---
name: roll-dice
description: Roll dice (d4, d6, d8, d10, d12, d20, d100) using a random number generator. Use this skill whenever the user asks to roll a die, roll dice, generate a random dice roll, or simulate a tabletop check — including casual phrasings like "roll a d20", "give me 3d6", or "roll for initiative".
license: MIT
metadata:
  author: example
  version: "1.0.0"
---

# Roll Dice

Generate a random dice roll using the shell's PRNG. Smallest possible skill — one section, one command.

## How to roll

For a single die with N sides:

```bash
echo $((RANDOM % <sides> + 1))
```

For PowerShell on Windows:

```powershell
Get-Random -Minimum 1 -Maximum (<sides> + 1)
```

Replace `<sides>` with the number on the die (`6` for a standard die, `20` for a d20). For multiple dice (`3d6`), run the expression three times and sum.
