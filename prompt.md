Generate my coding agent year-in-review receipt.

- Check which tools have a history file on this computer (see Input). Do not read the files yet.
- Ask me four things, and do not continue until I answer: a nickname (20 characters max, English or Korean), the year (default: this year), the languages I write prompts in, and which of the tools you found to include (default: all of them).
- Aggregate on this computer by the rules below. The result is one JSON object.
- Open the receipt page as described under Delivery.
- Report the receipt URL in one line. No interpretation, praise, or summary.

# Rules (format version 1)

## Principles
- Aggregate with a script only. Use whatever is already on this computer (python, node, jq, awk, PowerShell, ...). Install nothing.
- Never print raw history content into the conversation. It may contain tokens or passwords in plain text.
- Add no values that are not listed here. If a value cannot be computed, stop and report instead of guessing.

## Input
- Claude Code (`claude-code`): `~/.claude/history.jsonl` (under `CLAUDE_CONFIG_DIR` if set). One line is one prompt: `timestamp` (ms), `display` (text), `project` (folder), `sessionId`, `pastedContents`
- Codex (`codex`): `~/.codex/history.jsonl` (under `CODEX_HOME` if set). One line is one prompt: `ts` (seconds), `text`, `session_id`
- Scope: records of the chosen year in local time. Trim whitespace around the prompt text
- End date: today, or December 31 for a past year
- Dedupe: within a tool, lines with the same (session id, text, timestamp floored to seconds) count once
- Pool the prompts of the chosen tools into one list. Every value below is computed over the pool unless it says otherwise. Sessions of different tools are different sessions

## Terms
- Slash command: a Claude Code prompt whose text matches `^/([a-z][a-z0-9_:-]*)(\s|$)`. Its name is `/` + group 1
- Plain prompt: every other prompt. Codex prompts are all plain
- Character count: Unicode code points
- Share: percent with one decimal place (e.g. 75.3). Exact halves round up
- Dates are `MM-DD`, times are `HH:MM`, all in local time. On a tie, take the earliest

## Output JSON
| Key | Value |
|---|---|
| `v` | `1` |
| `src` | the chosen tools, e.g. `["claude-code", "codex"]` |
| `lg` | `"en"` |
| `n` | nickname. Only printable ASCII and Hangul (the receipt font has nothing else). Ask again if it has other characters |
| `p` | number of prompts |
| `bt` | prompts per tool `[[tool, count], ...]`, in the order of `src` |
| `s` | number of distinct sessions |
| `pj` | number of distinct project folders (see below) |
| `fp` | time of the first prompt `YYYY-MM-DD HH:MM` |
| `bd` | day with the most prompts `[count, MM-DD]` |
| `bh` | the 60-minute window with the most prompts `[count, MM-DD HH:MM of its first prompt]`. A window spans less than 60 minutes from its first prompt |
| `q` | quartile boundaries of prompts per day `[q1, q2, q3]` (see below) |
| `d` | a string with one character per day from January 1 to December 31. 0 = no prompts, 1 = up to `q1`, 2 = up to `q2`, 3 = up to `q3`, 4 = above. Days after the end date are 0 |
| `mc` | prompts per month, 12 values. `null` for months before the first prompt's month or after the end date's month |
| `h` | prompts per hour, 24 values (0 to 23) |
| `w` | prompts per weekday, 7 values (Monday to Sunday) |
| `ld` | among prompts before 06:00, the one with the latest time of day `[HH:MM, MM-DD]`. `null` if none |
| `tc` | total characters of plain prompts |
| `al` | average characters per plain prompt, rounded |
| `ss` | share of plain prompts with 12 characters or fewer |
| `hs` | share of plain prompts containing a Hangul syllable (U+AC00 to U+D7A3) |
| `ls` | the most prompts in a single session |
| `mp` | the most sessions with a prompt in the same 10-minute slot (date, hour, minute div 10) |
| `ph` | top short prompts `[[text, count], ...]`, up to 5 (see below) |
| `mo` | model usage over the last 30 days, per chosen tool `{"claude-code": [[model id, responses], ...], "codex": [[model id, turns], ...]}` (see below). `null` if unavailable |
| `co` | correction prompts `[count, share of all prompts]` |
| `pf` | swearing prompts `[count, share of all prompts]` |
| `pm` | share of swearing prompts per month, 12 values. `null` where `mc` is `null` or 0 |

Only when Claude Code is chosen (leave these out otherwise):

| Key | Value |
|---|---|
| `ps` | share of Claude Code prompts with a paste: `pastedContents` is not empty, or the text contains `[Pasted text` or `[Image` |
| `sl` | share of Claude Code prompts that are slash commands |
| `sc` | top slash commands `[[name, count], ...]`, up to 5. Count descending, then name |
| `btw` | count of `/btw` |
| `rw` | count of `/rewind` |

### Project folders `pj`
- Claude Code: `project` of each prompt
- Codex: `payload.cwd` on the first line (`type` is `session_meta`) of each `rollout-*.jsonl` under `~/.codex/sessions/` whose `payload.timestamp` falls in the chosen year
- Cut each path from `/.claude/worktrees/` onward (`\.claude\worktrees\` on Windows). Temp folders count as one: paths starting with `/private/tmp/`, `/tmp/`, `/var/folders/`, or containing `\AppData\Local\Temp\`
- Count the distinct folders over all chosen tools together

### Quartile boundaries `q`
- Sort the prompt counts of days with prompts ascending as `x[1..n]`
- For k = 1, 2, 3: `pos = k * (n + 1) / 4`, `j = floor(pos)` clamped to 1 ~ n-1, `value = x[j] + (pos - j) * (x[j+1] - x[j])`, rounded
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
- Correction: up to 5 regex alternatives per language for words that open a prompt to push back on the previous answer, like "no" or "wait". Anchor them at the start: `^\s*(...)`, with a word boundary where the language has one
- Decide by regex match only, case-insensitive, over all prompts. Do not read prompts to judge them, and do not print the ones that match

### Model usage `mo`
- Claude Code: every `*.jsonl` under `~/.claude/projects/` (including subfolders) modified within the last 30 days. Read only `message.id`, `message.model`, `timestamp` (ISO 8601) of lines whose `type` is `assistant`. Count each `message.id` once. Skip a `message.model` starting with `<`
- Codex: every `rollout-*.jsonl` under `~/.codex/sessions/` (including subfolders) modified within the last 30 days. Read only `payload.model` and `timestamp` (ISO 8601) of lines whose `type` is `turn_context`. Count one turn per such line
- Count only what falls within the last 30 days. Keep model ids as they are

## Delivery
- Convert the JSON: UTF-8 → base64url
- Open `https://luftaquila.github.io/vibe-check/#j=<base64url>` in the browser: `open` (macOS), `xdg-open` (Linux), `Start-Process '<url>'` in PowerShell (Windows)
- If it cannot be opened, print the URL as is
