# Pocket Agent

**Your AI that actually knows you.**

A desktop AI assistant that runs 24/7, remembers everything, and works across your entire digital life. Desktop. Telegram. Browser. All synced. All remembered.

---

## Here's the thing

Every AI conversation starts from scratch. You explain your job again. Your projects again. Your preferences again. By the time you get anything useful, you've burned half the conversation just catching it up.

That's dumb.

**Pocket Agent remembers.** It learns who you are, what you're working on, how you like things done. The more you use it, the smarter it gets about *you*.

Three months from now, you can reference a conversation you had today. It'll know exactly what you're talking about.

---

## What you actually get

### It remembers everything
Not just conversations—it extracts facts about you, your projects, your preferences. Recalls relevant context automatically. You'll forget things before it does.

### It runs 24/7
Lives in your menu bar. Set reminders. Schedule daily briefings. Automate the boring stuff. Wake up to a summary of your day already waiting.

### Separate conversations for separate lives
Work session. Personal session. Client session. Therapy session. Each one isolated with its own memory. Keep your contexts clean.

### Desktop + Telegram, same brain
Deep work at your desk. Quick questions from your phone. Link Telegram groups to specific sessions. Your assistant travels with you.

### Browser automation that actually works
"Check my email and tell me what's important."
"Grab all the prices from this page."
"Fill this form with my usual details."

Uses your logged-in Chrome sessions. No annoying re-authentication.

### Natural language scheduling
- "Remind me every morning about today's priorities"
- "Ping me every 30 minutes to drink water"
- "Weekly project recap every Friday at 5"

Just tell it what you want. It figures out the timing.

### Calendar + tasks, built in
"Add a call with Sarah tomorrow 2pm" — done. Reminders included. No separate app needed.

### Make it sound like you want
Give it a name. Define its personality. Tell it to be formal, casual, sarcastic, whatever. It's your assistant.

---

## What can you actually use this for?

**Daily driver** — Calendar, reminders, planning, research. The basics, but actually good.

**Thinking partner** — Process your thoughts with something that remembers your journey. Some people use it like a therapist.

**Research assistant** — Build on previous deep dives instead of starting over every time.

**Work mode** — Project context that persists. Meeting prep. Status updates. Documentation that doesn't suck.

**Smart home hub** — Hue lights. Sonos. Eight Sleep. Voice commands through your assistant.

**Dev tools** — GitHub, terminal, browser automation, scheduled scripts. Power user stuff.

---

## Get started in 2 minutes

### 1. Download

| Mac | Link |
|-----|------|
| Apple Silicon (M1/M2/M3/M4) | [Download .dmg](https://github.com/KenKaiii/pocket-agent/releases/latest) |
| Intel | [Download .dmg](https://github.com/KenKaiii/pocket-agent/releases/latest) |

### 2. Install
Drag to Applications. Launch. Shows up in your menu bar.

### 3. API Key
Grab one from [console.anthropic.com](https://console.anthropic.com). Paste it in. Stored in your system keychain, not some random config file.

### 4. Go
Click the icon. Start talking. That's literally it.

---

## Telegram (if you want it)

Talk to your assistant from anywhere:

1. Make a bot with [@BotFather](https://t.me/botfather)
2. Paste the token in settings
3. Message your bot

Same assistant. Same memory. Different device.

**Commands:** `/status` `/facts` `/clear` `/link <session>` `/unlink`

---

## Your data stays yours

- **Local storage** — Everything lives on your machine in SQLite
- **Your API key** — Conversations hit Anthropic's API, that's it
- **Encrypted secrets** — Keys go in your system keychain
- **Zero telemetry** — We literally don't track anything

---

## Goes deeper if you want it to

**70+ integrations** — Notion, Trello, GitHub, Slack, WhatsApp, Apple Notes, Google Workspace, image gen, speech-to-text... it's a lot.

**MCP servers** — Extend it with Model Context Protocol if you're into that.

**Full terminal access** — For when you need to get your hands dirty.

---

## For the devs

```bash
git clone https://github.com/KenKaiii/pocket-agent.git
cd pocket-agent
npm install
npm run dev
```

**Stack:** Electron + Claude Agent SDK + SQLite + TypeScript

`npm run dev` / `npm run build` / `npm run dist` / `npm run lint && npm run typecheck`

---

## Built with

- [Claude Agent SDK](https://docs.anthropic.com/en/docs/build-with-claude/agent-sdk) — Anthropic's agent framework
- [Electron](https://electronjs.org) — Desktop magic
- [SQLite](https://sqlite.org) — Local persistence that just works

---

## Community

**Learn more & connect:**
- [YouTube](https://youtube.com/@kenkaidoesai) — Tutorials, demos, and builds
- [Community](https://skool.com/kenkai) — Join the conversation

---

## License

MIT — Do whatever you want with it.

---

**Stop re-explaining yourself to AI every single time.**

[Download Pocket Agent →](https://github.com/KenKaiii/pocket-agent/releases/latest)
