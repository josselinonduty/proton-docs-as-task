# Sample task board

Copy the content below (starting at the `#!tasks` line) into a Proton Docs
document to see the board. The first line must be the marker for the extension
to activate.

---

#!tasks Product launch
@settings status todo "To Do" @category:todo
@settings status doing "In Progress" @category:doing @color:blue @bg:blue
@settings status review "In review" @category:doing @color:purple @bg:purple
@settings status done "Done" @category:done @color:green

## Discovery

- [x] User interviews @who:sam #research
- [x] Competitive teardown @who:alex
- [ ] Synthesize findings @status:doing @due:2026-09-08 !!

## Build

- [ ] API: tasks endpoint @priority:high @due:2026-09-12 #backend @@jo @id:api1
- [x] Schema migration @parent:api1 #backend
- [ ] Pagination @parent:api1 #backend
- [ ] Board overlay @status:review #frontend
- [ ] Options page #frontend
- [ ] Empty + error states #frontend !

## Launch

- [ ] Write announcement @who:sam #marketing
- [ ] Record demo video @due:2026-09-20
- [ ] Ship it 🚀 @priority:high

## Later / icebox

- Drag-and-drop between columns
- Saved filters
- Due-date reminders
