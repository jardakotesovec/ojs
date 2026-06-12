# Navigation menus

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 4 tests
- **Absorbs:** lib/pkp/playwright/tests/navigation-menus.spec.js
- **Scenario needs:** journal scenario endpoint (scratch journal, `users: manager`). Fresh contexts install the default Primary/User navigation menus from `registry/navigationMenus.xml`, which rows 1 and 4 rely on. Menu/item mutations go through the UI — the editor is the surface under test. Row 4 additionally uses the `users[]` password branch to mint a throwaway reader for the login round-trip. No gaps.
- **Implementation notes (wave 10):**
  - Row 3 assignment: the `NavigationMenuEditor` offers ONLY pragmatic-drag-and-drop moves (no button/keyboard fallback), so the spec uses the raw-mouse drag pattern (`dragMenuItemToAssignedRoot`). Two drop targets failed live before one held: the assigned panel's free bottom area gets swallowed by an expanding child DropZone ghost (item nests into the last root item's hidden submenu), and the first root item is clipped under the sticky modal header unless the editor is scrolled to the top of the modal first. Final shape: scroll editor `block:'start'`, then drop on the first root item's top strip (`reorder-above` → root index 0).
  - The Add/Edit menu modal opens via legacy `LinkAction` anchors that the post-save grid refresh replaces wholesale; a click in that window registers focus but opens nothing (observed under workers=2, co-occurring with sibling-worker theme saves that clear the shared compiled-template cache). `openAddMenuModal`/`openEditMenuModalByTitle` now wait for jQuery idle and retry the click up to twice.
- **Round 2 / out of scope:**
  - Drag-and-drop ordering/nesting inside the `NavigationMenuEditor` assigned panel (submenu hierarchy) — DnD is flake-prone; revisit in round 2 once a stable drag helper exists.
  - Site-level navigation menus tab under /admin/settings — same grids, different scope; round 2.
  - Remaining `menuItemType`s (remote URL, announcements, search, …) — type matrix is round 2; rows below cover custom items and the conditional login/logout defaults.
  - Per-item conditional-display warning popover in the editor — cosmetic; round 2.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager creates, edits, validates, and deletes a menu | dbarnes | journal scenario | Add Menu side-modal saves; new-menu invariants (empty assigned panel, populated unassigned panel); title edit persists; duplicate-title and area-conflict (default menu already in `primary`) inline errors; delete removes the row | implemented (lib/pkp/playwright/tests/navigation-menus.spec.js) |
| 2 | Manager creates, edits, and deletes a custom navigation menu item | dbarnes | journal scenario | Add Item modal with `NMI_TYPE_CUSTOM` saves title + path; row appears in the items grid; title edit persists; delete removes the row | implemented (lib/pkp/playwright/tests/navigation-menus.spec.js) |
| 3 | Custom item assigned to the primary menu renders on the front end | dbarnes, anonymous | journal scenario + UI | Manager creates a custom item with content, assigns it into the primary menu via the menu editor; anonymous front-end primary nav renders the new entry; clicking it opens the custom content page (`navigationMenuItemViewContent`) | implemented (lib/pkp/playwright/tests/navigation-menus.spec.js) |
| 4 | Default user-menu items display conditionally by auth state | dbarnes, anonymous | journal scenario | On the scratch journal's front end the default user menu shows Login/Register for anonymous visitors; after login the same area shows the username menu with Logout and hides Login/Register | implemented (lib/pkp/playwright/tests/navigation-menus.spec.js) |
