# User guide

How to use the board day to day. For installing, see the
[README](../README.md#install).

- [Getting started](#getting-started)
- [Views](#views)
- [Working with cards](#working-with-cards)
- [Adding tasks](#adding-tasks)
- [Sorting and filters](#sorting-and-filters)
- [Bulk actions](#bulk-actions)
- [Keyboard and command palette](#keyboard-and-command-palette)
- [Sub-tasks](#sub-tasks)
- [Task links](#task-links)
- [Statuses](#statuses)
- [Settings](#settings)

## Getting started

A fresh install opens a short **welcome page** with three steps:

1. **Starting layout**: _Simple list_, _Kanban board_ or _Swimlanes_. It sets
   the view boards open in, the card density and the fields cards show.
2. **Status flow** for new boards: _To Do → Done_, _To Do → In Progress →
   Done_, or the same with an _In review_ step.
3. **Preferences**: language, theme, card density, date format, your name (for
   the _My open tasks_ filter) and whether deleting a card asks first.

Everything is saved at the end, in one step. Skipping saves nothing, and each
choice stays an ordinary setting. Updates never show the page again; use **Run
setup again** at the top of the options page to revisit it.

Then open an empty document on `docs.proton.me` and click **Create task
board**. A document whose first non-empty line starts with an activation marker
(`#!tasks` by default) opens as a board directly; anything after the marker is
the board's title.

## Views

A task's **status** (its workflow stage) and its **section** (the `## Heading`
it sits under) are independent, so the board offers four views of the same
tasks. Switch from the board header or with `V`; switching never changes the
document.

- **Workflow**: one column per status. Moving a card changes its status, and
  ticks or unticks its checkbox; its section stays.
- **Sections**: one column per heading. Moving a card changes its section; its
  status stays. Add, rename, reorder and delete sections here. Renaming happens
  in place, is saved on `Enter` or when you leave the field (`Esc` cancels), and
  a name that already exists is refused instead of merging two sections.
- **Swimlane**: status columns crossed with section rows. Drag sideways to
  change the status, up or down to change the section, or diagonally for both.
  Rows collapse one by one, and empty cells are valid drop targets.
- **List**: one flat checklist, with no columns and no drag and drop. Tick to
  complete, click to open. Mark one section with `@default` (`## Inbox
@default`, or the ✓ button in Sections view) to list only that section.

Search, filters, sorting, collapsed columns and the current view are display
preferences: they never touch the document, and are remembered per document for
the browser session. Boards open in the view you used last.

## Working with cards

Cards summarise a task: checkbox, title, then priority, due date, labels and
assignee (you choose which in the [settings](#settings)). The header shows the
board's title and progress (_4 of 12 done_).

Click a card, or focus it and press `Enter`, to open the **details panel**,
where every field is edited. `Esc` closes it and returns focus to the card.

Every move can be undone, is announced to screen readers, and works without a
mouse: `Alt`+`↑`/`↓` reorders, and the **Move** / **Move to…** controls change
column.

## Adding tasks

- **Add task** in the board header (or `N`) opens a short form; only the title
  is required. Status defaults to the first _Not started_ status and section to
  the one you used last. `Enter` adds the task and keeps the form open for the
  next one; `Cmd`/`Ctrl`+`Enter` works from any field. If active filters would
  hide the new card, the board says so and offers **Clear filters**.
- **+ Add task** at the foot of every column opens the same form, preset to
  that column.
- The **toolbar popup** adds a task to the open document without opening the
  board: a title, and optionally a section and due date. It reports success
  only once the task is in the document, then closes (or stays open, see
  [settings](#settings)).

## Sorting and filters

The **Sort** menu orders cards by due date, priority, title, assignee or
creation, or back to **Manual order**. Sorting only changes the display, so
switching back to Manual restores the document's order. Drag and drop is off
while a sort is active; **Apply this order to document** writes it in (and can
be undone).

**Filters** cover status, section, priority, assignee, label, due date and
completion. Active filters show as removable chips, and one-click presets
cover common cases: _My open tasks_ (once your name is set), _Overdue_, _Due
this week_, _High priority_, _Unassigned_ and _Recently completed_. Assignee and
label fields suggest values already used in the document, with counts.

## Bulk actions

Enter **selection mode** from the ⋮ menu, with `Space` on a focused card, or
with `Cmd`/`Ctrl`+`A`. `Shift`-click selects a range within a column. The
toolbar then sets the status, section, priority, assignee or due date, adds or
removes a label, completes or deletes, each as one undoable change. Deleting
asks first.

## Keyboard and command palette

| Key                    | Action                          |
| ---------------------- | ------------------------------- |
| `N`                    | Add a task                      |
| `/`                    | Search                          |
| `F`                    | Filters                         |
| `V`                    | Change view                     |
| `S`                    | Sort                            |
| `J` / `K`              | Next / previous card            |
| `Enter`                | Open the focused card           |
| `E`                    | Rename the focused card         |
| `Space`                | Select the focused card         |
| `X`                    | Toggle completion               |
| `M`                    | Move the focused card           |
| `Delete` / `Backspace` | Delete the selection (confirms) |
| `Cmd`/`Ctrl`+`Z`       | Undo                            |
| `Cmd`/`Ctrl`+`K`       | Command palette                 |
| `Esc`                  | Close the active menu or dialog |
| `?`                    | All shortcuts                   |

Shortcuts don't fire while you type in a field, apart from the form submission
ones. The **command palette** offers the same actions (add a task, switch view,
sort, clear filters, show or hide completed tasks, board settings, settings,
retry a failed save), searchable, with recent commands first.

## Sub-tasks

Any task can be split into sub-tasks. A sub-task is an ordinary task, with its
own card, status, section and fields, that points at its parent with
`@parent:key`; the parent carries the matching `@id:key`. The board writes and
cleans up these keys; you never type them.

```text
## Backend
- [ ] Ship the API @id:k3p9
- [x] Design endpoints @parent:k3p9
- [ ] Write handlers @parent:k3p9 @id:x8m2
- [ ] Pagination @parent:x8m2
```

- **Create** one from the parent's details panel (_Add a sub-task…_ then
  `Enter`). It lands in the parent's section, after its siblings, in the first
  _Not started_ status.
- **See** them on the board: a parent card shows its progress (`1/2`), a
  sub-task card names its parent, and the details panel lists both.
- **Change** one like any task, or move it under another parent with the
  _Parent task_ search, or detach it.
- **Delete** one from the parent's list, or detach it to keep it as a task of
  its own. Deleting a parent keeps its sub-tasks and detaches them.

Nesting has no depth limit, and a move that would make a task its own ancestor
is refused. **A parent can't be completed while any sub-task below it is
open**: its Done statuses and checkbox are disabled, and the board names the
sub-tasks in the way.

## Task links

From the details panel, mark a task as **blocked by** or **related to** other
tasks (`@blocks:key` and `@rel:key` in the document). A blocked task stays _Not
started_ until its blockers are done.

## Statuses

Each board has its own statuses, saved in the document right below the
activation marker, one `@settings status` line each, in column order:

```text
#!tasks Sprint 42
@settings status todo "To Do" @category:todo
@settings status doing "In Progress" @category:doing @color:blue @bg:blue
@settings status review "In review" @category:doing @color:#6d4aff @bg:#efeaff
@settings status done "Done" @category:done @color:green
```

- The **key** (`review`) is what tasks reference (`@status:review`). It is
  set once from the name, so **renaming** a status never rewrites a task.
- The **category** gives a status its meaning: `todo` (_Not started_), `doing`
  (_In progress_) or `done`. Every Done status ticks the checkbox and counts as
  completed; ticking a checkbox picks the first Done status, and new tasks land
  in the first Not started one. A board always keeps at least one of each.
- **Colours** are optional: `@color` for the text and `@bg` for the background,
  either a theme-aware swatch (`grey`, `purple`, `blue`, `green`, `orange`,
  `red`) or a hex value.

Manage statuses from **Board settings** (the board's ⋮ menu or the command
palette): add, rename, change category or colours, reorder (drag and drop or
`Alt`+`↑`/`↓`) and delete. Deleting a status that still has tasks asks where to
move them. Workflow column headers offer the same controls, plus an **Add
status** column.

A new board gets the flow chosen in **Statuses for new boards**. A board with no
`@settings status` lines uses _To Do_ / _In Progress_ / _Done_, written into the
document with the board's first edit, never just by opening it. If a task uses
a status the board doesn't define (removed elsewhere, or typed by hand), the
board asks you to move those tasks or create the status again.

## Settings

Open the options page from the popup (**Settings & syntax guide**), the board's
command palette, or the browser's extension menu. Changes save immediately.

- **Board**: turn the extension on or off, open boards automatically, the view
  boards open in (it follows the last view you used), and the statuses for new
  boards.
- **Appearance**: language (or follow the browser), theme (system, light,
  dark), card density and date format.
- **Cards**: which fields cards show, the description preview, how completed
  tasks appear (shown, Done column collapsed, or hidden; never removed from the
  document), and whether new cards go to the top or bottom of a column.
- **Behavior**: your name for _My open tasks_ (matched against assignees),
  confirmation before deleting, and whether the popup closes after adding a
  task.
- **Activation markers** (collapsed): the first-line markers that turn a
  document into a board. Save applies them, and Reset asks before restoring the
  defaults. An empty list is refused.

Settings sync across your browsers through `browser.storage.sync`. Only the
extension's interface is translated: what it writes into the document (the
`Tasks` section and default status names) stays as written.
