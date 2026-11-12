# vibe-check

Your year with a coding agent, printed as a receipt. Works with Claude Code and Codex.

**https://luftaquila.github.io/vibe-check/** · [한국어](README.ko.md)

<img src="docs/sample.png" alt="Sample receipt" width="340">

## How to use

1. Copy the prompt from the page and paste it into Claude Code or Codex.
2. The agent checks which tools have history on your computer and asks four things: a nickname, the year, the languages you write in, and which tools to include. If you pick both, their prompts are added up into one receipt, with the count per tool shown under the total. Models from both tools go into one list: each tool's model shares are weighted by that tool's share of your prompts over the last 30 days, because Claude Code counts responses and Codex counts turns.
3. It counts your history on your own computer and sends only the numbers to the page.
4. The page draws the receipt. Scan its QR code to open the same receipt again.

The page and the receipt are in English by default. A switch at the top changes both to Korean.

## How it works

- `prompt.md` is the prompt. It holds the counting rules and the JSON format, and leaves the choice of tool (python, node, jq, ...) to the agent. There is one prompt for both tools and one set of rules, in English. Codex keeps no paste markers or slash commands in its history, so those rows come from Claude Code only and a Codex-only receipt leaves them out. On the Korean page only the opening lines and the receipt language value change.
- Hand-off: the agent opens `#j=<base64url JSON>`. The page validates the values, stamps the issue time, and rewrites the URL to its final form.
- Final URL: `#<version>.<data>.<check number>`. To keep the QR code small, the values are packed into bytes (variable-length integers, the activity grid as one base-5 number), compressed with raw deflate, and written with 39 of the characters QR codes store most compactly (digits, capital letters, `$+-`). The check number is the first 8 hex digits of the SHA-256 of the packed bytes. It sits at the end so the URL never ends in punctuation that chat apps cut off. Nothing after the `#` is sent to a server.
- The check number shows whether the data in a URL has been edited. Anyone can recompute it, so it will not stop someone determined to fake a receipt.
- `core.js` validates values, encodes URLs, and derives what follows from other values (days used, streaks, shares, model names). `receipt.js` draws the receipt on a canvas. `app.js` runs the page.

## Privacy

- Your history is counted only on your computer. What you typed stays off the receipt, apart from your five most used short prompts.
- Anyone you give the URL or QR code to can read the receipt.

## Development

```
node --test                      # tests for core.js
python3 -m http.server 8765      # then open http://127.0.0.1:8765/
```

`og.png` is the link preview image. Its source is `tools/og.html`.

## Languages

There is no fixed list of swear words. The prompt asks which languages you write in, and the agent writes its own regex patterns for swearing and for corrections ("no") in those languages. Matching is by regex only. Because each agent writes its own list, these two numbers can differ from one person to the next.

Nicknames and the short prompts on the receipt can use English and Korean characters only, because that is what the receipt font covers.

## License

MIT. See `LICENSE`. Third-party files keep their own licenses.

## Third party

- Font: NeoDunggeunmo Code, SIL Open Font License 1.1 (`fonts/OFL.txt`)
- qrcode-generator, MIT (`vendor/qrcode-LICENSE.txt`)
