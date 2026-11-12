Generate my coding agent year-in-review receipt.

- Check which tools have a history file or session files on this computer (see Input). Do not read the files yet.
- Ask me four things, and do not continue until I answer: a nickname (20 characters max, English or Korean), the year (default: this year), the languages I write prompts in, and which of the tools you found to include (default: all of them).
- Aggregate on this computer by the rules below. The result is one JSON object.
- Open the receipt page as described under Delivery.
- Report in one line: the receipt is open, or where to find the URL (see Delivery). No interpretation, praise, or summary.

# Rules (format version 1)

## Principles
- Aggregate with a script only. Use whatever is already on this computer (python, node, jq, awk, PowerShell, ...). Install nothing.
- Never print raw history content into the conversation. It may contain tokens or passwords in plain text.
- Add no values that are not listed here. If a value cannot be computed, stop and report instead of guessing.

## Input
- Claude Code (`claude-code`): `~/.claude/history.jsonl` (under `CLAUDE_CONFIG_DIR` if set). One line is one prompt: `timestamp` (ms), `display` (text), `project` (folder), `sessionId`, `pastedContents`
- Codex (`codex`): `~/.codex/history.jsonl` (under `CODEX_HOME` if set). One line is one prompt: `ts` (seconds), `text`, `session_id`
- If `CLAUDE_CONFIG_DIR` or `CODEX_HOME` is set, the `projects/` and `sessions/` folders named below are under it too. A desktop app may not see the variable, so read those folders under both it and the default `~/.claude` or `~/.codex`
- The desktop apps do not write to these files. Add their prompts from the session files:
  - Claude Desktop, counted as `claude-code`: every `*.jsonl` under `~/.claude/projects/` (including subfolders). A prompt is a line whose `type` is `user`, `entrypoint` is `claude-desktop`, `origin.kind` is `human`, and `isSidechain` is not true. Read `timestamp` (ISO 8601), `sessionId`, `cwd` (folder), and the text: `message.content` if it is a string, otherwise the `text` of its blocks whose `type` is `text`, joined with newlines. Leave out blocks whose trimmed text starts with `<system-reminder>` and ends with `</system-reminder>`: the app adds those. Count each `uuid` once: a resumed or forked session repeats earlier lines in a new file. A prompt that is only an image has empty text and still counts
  - ChatGPT Desktop, counted as `codex`: every `rollout-*.jsonl` under `~/.codex/sessions/` (including subfolders) whose first line (`type` is `session_meta`) has a string `payload.source` other than `exec` and a `payload.id` that is not a `session_id` in `history.jsonl`. The session id is that `payload.id`. A prompt is a line whose `type` is `event_msg` and whose `payload.type` is `user_message` (text: `payload.message`), or whose `payload.type` is `item_completed` with `payload.item.type` `UserMessage` (text: the `text` of the `payload.item.content` entries whose `type` is `text`, joined with newlines). Read `timestamp` (ISO 8601) of the line
- Scope: records of the chosen year in local time. Trim whitespace around the prompt text
- End date: today, or December 31 for a past year
- Dedupe: within a tool, lines with the same (session id, text, timestamp floored to seconds) count once
- Pool the prompts of the chosen tools into one list. Every value below is computed over the pool unless it says otherwise. Sessions of different tools are different sessions

## Terms
- Slash command: a Claude Code prompt whose text matches `^/([a-z][a-z0-9_:-]*)(\s|$)`. Its name is `/` + group 1
- Plain prompt: every other prompt. Codex prompts are all plain
- Character count: Unicode code points
- Dates are `MM-DD`, times are `HH:MM`, all in local time. On a tie, take the earliest

## Output JSON
| Key | Value |
|---|---|
| `v` | `1` |
| `src` | the chosen tools, e.g. `["claude-code", "codex"]` |
| `lg` | `"en"` |
| `n` | nickname. Printable ASCII and Hangul only; ask again otherwise |
| `bt` | prompts per tool `[[tool, count], ...]`, in the order of `src` |
| `s` | number of distinct sessions |
| `pj` | number of distinct project folders (see below) |
| `fp` | time of the first prompt `YYYY-MM-DD HH:MM` |
| `bd` | day with the most prompts `[count, MM-DD]` |
| `bh` | the 60-minute window with the most prompts `[count, MM-DD HH:MM of its first prompt]`. A window spans less than 60 minutes from its first prompt |
| `q` | quartile boundaries of prompts per day `[q1, q2, q3]` (see below) |
| `d` | one character per calendar day: exactly 365 characters (366 in a leap year), the first is January 1. 0 = no prompts, 1 = up to `q1`, 2 = up to `q2`, 3 = up to `q3`, 4 = above. Days after the end date are 0 |
| `mc` | prompts per month, 12 values. `null` for months before the first prompt's month or after the end date's month |
| `h` | prompts per hour, 24 values (0 to 23) |
| `w` | prompts per weekday, 7 values (Monday to Sunday) |
| `ld` | among prompts before 06:00, the one with the latest time of day `[HH:MM, MM-DD]`. `null` if none |
| `pc` | number of plain prompts |
| `tc` | total characters of plain prompts |
| `ss` | number of plain prompts with 12 characters or fewer |
| `hs` | number of plain prompts containing a Hangul syllable (U+AC00 to U+D7A3) |
| `ls` | the most prompts in a single session |
| `mp` | the most sessions with a prompt in the same 10-minute slot (date, hour, minute div 10) |
| `ph` | top short prompts `[[text, count], ...]`, up to 5 (see below) |
| `mo` | model usage over the last 30 days, per chosen tool `{"claude-code": [[model id, responses], ...], "codex": [[model id, turns], ...]}` (see below). `null` if unavailable |
| `p30` | prompts per tool in the last 30 days `[[tool, count], ...]`, in the order of `src`. Same 30 days as `mo`, whatever year was chosen |
| `co` | number of correction prompts |
| `pf` | number of swearing prompts |
| `pm` | swearing prompts per month, 12 values |

Only when Claude Code is chosen (leave these out otherwise):

| Key | Value |
|---|---|
| `ps` | number of Claude Code prompts with a paste: `pastedContents` is not empty, or the text contains `[Pasted text` or `[Image`, or, for a Claude Desktop prompt, `message.content` has a block whose `type` is `image` |
| `sc` | top slash commands `[[name, count], ...]`, up to 5. Count descending, then name |
| `btw`, `rw` | counts of `/btw` and `/rewind` |

### Project folders `pj`
- Claude Code: `project` of each prompt (`cwd` for Claude Desktop prompts)
- Codex: `payload.cwd` on the first line (`type` is `session_meta`) of each `rollout-*.jsonl` under `~/.codex/sessions/` whose `payload.timestamp` falls in the chosen year
- Cut each path from `/.claude/worktrees/` onward (`\.claude\worktrees\` on Windows). Temp folders count as one: paths starting with `/private/tmp/`, `/tmp/`, `/var/folders/`, or containing `\AppData\Local\Temp\`. The folders the desktop apps make for chats without a project are temp folders too: paths containing `/scratch-workspaces/` or `/Documents/Codex/` (the same with `\` on Windows)
- Count the distinct folders over all chosen tools together

### Quartile boundaries `q`
- Sort the prompt counts of days with prompts ascending as `x[1..n]`
- For k = 1, 2, 3: `pos = k * (n + 1) / 4`, `j = floor(pos)` clamped to 1 ~ n-1, `value = x[j] + (pos - j) * (x[j+1] - x[j])`, rounded (halves up)
- With fewer than 4 such days: `[min, max, max]`

### Top short prompts `ph`
- Plain prompts with 12 characters or fewer, counted by exact, case-sensitive match
- Must contain at least one character of `[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]`, and only printable ASCII and Hangul. Skip prompts with any other character
- Must not contain this pattern: `(https?:|www\.|[/\\@#]|\d{4,}|[A-Za-z0-9_-]{16,}|sk-|ghp_|glpat-|xox[abp]-|eyJ)`
- 5 or more uses. Count descending, then code point order
- Apart from these 5, put no prompt text anywhere

### Corrections and swearing
- Write the patterns yourself, for the languages I named. There is no fixed list
- Swearing: up to 20 regex alternatives per language, covering common swear words and their usual abbreviations or censored spellings
- Correction: up to 5 regex alternatives per language for words that open a prompt to reject the previous answer, like "no". Anchor them at the start: `^\s*(...)`, with a word boundary where the language has one
- Decide by regex match only, case-insensitive, over all prompts. Do not read prompts to judge them, and do not print the ones that match

### Model usage `mo`
- Claude Code: every `*.jsonl` under `~/.claude/projects/` (including subfolders) modified within the last 30 days. Read only `message.id`, `message.model`, `timestamp` (ISO 8601) of lines whose `type` is `assistant`. Count each `message.id` once. Skip a `message.model` starting with `<`
- Codex: every `rollout-*.jsonl` under `~/.codex/sessions/` (including subfolders) modified within the last 30 days. Read only `payload.model` and `timestamp` (ISO 8601) of lines whose `type` is `turn_context`. Count one turn per such line
- Count only what falls within the last 30 days. Keep model ids as they are

## Delivery
- In the same script: convert the JSON (UTF-8) to base64url and build `https://luftaquila.github.io/vibe-check/#j=<base64url>`
- Save the URL to `vibe-check-url.txt` in the current folder, or in the system temp folder if that fails. Then open it in the browser: `open` (macOS), `xdg-open` (Linux), `Start-Process` in PowerShell (Windows)
- If the browser cannot be opened, tell me where the file is. If the file could not be saved either, have the script print the URL as its last line and tell me to copy it from the command output
- Never type the URL yourself, not even to report it. It is long, and one changed character breaks it
