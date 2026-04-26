# Build Tasks: Confirm-Delete Dialog

> Generated: 2025-09-21
> IA: captured ad-hoc — single dialog, no separate IA doc warranted

## Foundation

- [ ] **Dialog primitive supports a destructive variant**: Add a `variant: "destructive"` prop that swaps the confirm button color and elevates the dialog's emphasis. _Modifies: existing `Dialog` component._
- [ ] **Destructive button uses the danger token**: Reuse the existing color tokens; no new color needed. _Reuses: `--color-danger`, `--color-danger-text`._

## Core UI

- [ ] **Confirm-delete dialog renders title, message, and two buttons**: Title from prop, message from prop, "Cancel" and "Delete" buttons. _Depends on: Dialog primitive supports a destructive variant._
- [ ] **Type-to-confirm field gates the Delete button**: User must type a configurable confirmation string (e.g., the resource name) before Delete enables. _New input within the dialog._

## Interactions & States

- [ ] **Cancel and Esc both close without action**: Esc, the X button, and the Cancel button all dismiss with no side effect. Covers: keyboard, click, click-outside.
- [ ] **Delete button shows loading state while the parent action resolves**: Spinner replaces the label; both buttons disable. Covers: loading, error (Delete re-enables and surfaces the error message inline).
- [ ] **Empty type-to-confirm and mismatched values keep Delete disabled**: Validate in real time; do not submit on Enter when invalid. Covers: empty, partial-match, mismatch.

## Responsive & Polish

- [ ] **Dialog adapts to mobile**: Bottom-sheet at `< 640px`, centered modal above. Covers breakpoints: 640px.
- [ ] **Accessibility pass**: Focus traps in the dialog, focus returns to the invoking element on close, `aria-describedby` points at the message, screen reader announces the destructive variant.

## Review

- [ ] **Final review**: confirm every state matches the brief; run a real "delete this resource" flow end-to-end and verify the parent receives the confirmation. File any defects via the `qa` skill.
