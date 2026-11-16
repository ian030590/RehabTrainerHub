# Chrome rollout batch 3

## n-back 2.1.0

- Interrupt text: 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” The exit path aborts the runtime; `SendGameResult` is called only by the completion path.
- An interrupted unanswered letter is shown again with a fresh response clock. A completed answer remains recorded; pausing during feedback or the gap continues with the next letter. A block introduction remains open when resumed.
- Losing fullscreen opens the same panel. When the block introduction is open, resuming returns focus to its start button; otherwise focus returns to Stop.

## digit-span 2.1.0

- Interrupt text: 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Only the completion path sends a result; exit aborts the runtime.
- The current display and timers freeze while hidden. An unfinished answer stays entered, and the response clock excludes the pause. A part introduction remains open on resume.

## keep-track 2.1.0

- Interrupt text: 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Exit aborts the runtime; only normal completion sends a result.
- Word presentation freezes while hidden and resumes with the remaining time. Selected answers remain in place, and response time excludes the pause.

## letter-memory 2.1.0

- Interrupt text: 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Exit aborts the runtime; only normal completion sends a result.
- Letter presentation freezes while hidden and resumes with the remaining time. Partially entered answers remain, and response time excludes the pause.

## spatial-span 2.1.0

- Interrupt text: 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Exit aborts the runtime; only normal completion sends a result.
- Square presentation freezes while hidden and resumes with the remaining time. Entered squares remain, and response time excludes the pause. A part introduction remains open on resume.

## pattern-memory 1.1.0

- Interrupt text: 「結束後不會保存這次紀錄。」 / “Ending the activity will not save this session.” Exit aborts the runtime; only normal completion sends a result.
- The current study, blank, test or feedback stage freezes while hidden; the same board resumes with remaining time and answer time excludes the pause.
