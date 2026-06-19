# Inline Studio

**A narrative-first desktop app for visual artists, powered by your own [ComfyUI](https://github.com/comfyanonymous/ComfyUI).**

[![Join our Discord](https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/cSUS88VdY9)

ComfyUI is the most capable generative engine currently: image, video, audio, LLM, every new model lands there first. But it asks you to think in node graphs and execution order. Filmmakers think in frames, scenes, and sequences. Inline Studio sits in between: you compose your film on a free-form canvas and work frame by frame, while ComfyUI quietly does the generation behind each one.

![Inline Studio canvas](screenshots/screenshot-dashboard-2.png)

> **Status: active development.** The canvas, the project model, the ComfyUI bridge, and the Claude assistant are working today. Timeline editing, a preview player, and video export are next.

---

## The idea

A **frame is not a file. It's a slot with a history of takes.**

Filmmakers re-shoot. So in Inline Studio, every render you make becomes an immutable _take_ that lives under its frame. Nothing gets overwritten; you generate again and again, then pick the one that works (the "hero"), and that's the one that flows on to the next shot. That versioned-take history is the thing ComfyUI doesn't give you, and it's what the whole app is built around.

```
Project  →  Sequence  →  Frame  →  Take[]
```

A project is a single portable `.inlinestudio` folder you can move, back up, or hand to a collaborator.

**Export a project to share it.** From the home screen, **Export** zips up the whole project — its database, every imported asset, all the generated takes, and the per-frame ComfyUI workflows — into one archive. Hand that file to a collaborator and they have everything needed to open the project and re-run it exactly, nothing left dangling on your machine.

---

## How it feels to use

Everything happens on a **node canvas**. Think of it as a mood board that can actually generate.

- **Drop an asset** onto the canvas to start a frame. Drop several and the frame becomes a little carousel; star the one you want as the hero.
- **Preview a frame's output**, page through its takes, and pick the keeper.
- **Chain frames together**: wire one frame's output into the next frame's input, and the result you chose flows straight through. Refine a shot, then feed it forward. Regenerate the source and everything downstream follows.
- **Arrange freely** with layers, text notes, and connections, the way you'd lay out a board in Figma or Miro. Marquee-select, copy/paste, delete, and undo/redo all work the way your hands expect.

When it's time to generate, the **Generate** tab opens your own ComfyUI right inside the app. Inline Studio hands it the frame's inputs, wires them into the workflow, and pulls the finished renders back in as takes. The full node graph is always one click away when you want it.

---

## A built-in assistant (Claude)

Inline Studio ships with an AI assistant powered by **Claude** that works alongside you on the canvas. Connect your own [Anthropic API key](https://console.anthropic.com/settings/keys) — it's stored encrypted on your machine and never sent anywhere but Anthropic — and open the assistant from the Claude icon in the header.

Ask in plain language and it **proposes concrete changes you apply with one click**. It never edits your project behind your back, and everything it does is undoable:

- **Design the canvas.** "Plan a three-frame opening with a sky layer and previews" — it creates the frames, groups them in a layer, wires up previews, and arranges everything without landing on top of what's already there. You watch it build step by step.
- **Point it at what you mean.** Select frames or layers on the canvas and hit **Add to Claude** (or pin an empty spot) so it knows exactly which shots you're referring to and where to put new ones.
- **Build ComfyUI workflows.** Ask it to set up a frame's workflow and it grounds the graph in _your_ actual ComfyUI — the nodes and model checkpoints you have installed — then opens it live in the Generate tab. It remembers the workflows that worked and reuses them next time.

Pick the model that fits the job (Opus, Sonnet, or Haiku) right in the chat. The assistant is optional — the canvas and ComfyUI bridge work fully without it.

---

## Bring your own ComfyUI

Inline Studio doesn't bundle or manage ComfyUI; you run it, wherever you like, and point Inline Studio at it.

- **Running locally with a GPU?** Start ComfyUI with `--enable-cors-header` and paste its address into the Generate tab.
- **No GPU?** Spin up ComfyUI on a cloud GPU (the app walks you through deploying it on [RunPod](https://runpod.io)) and paste the public URL. Any reachable ComfyUI works.

Your media, your models, your machine. Inline Studio just gives the work a narrative shape.

---

## Install

Grab a prebuilt installer from the [latest release](../../releases/latest) and open it:

- **macOS:** download the `.dmg` for your chip — `arm64` for Apple Silicon (M1/M2/M3…), `x64` for Intel Macs — open it, and drag Inline Studio into Applications.
- **Windows:** download the `-setup.exe` and run it.
- **Linux:** download the `.AppImage`, make it executable (`chmod +x Inline Studio*.AppImage`), and run it.

The builds are currently unsigned, so on first launch your system may warn about an unidentified developer:

- **macOS:** right-click the app and choose Open, then Open again. If it says the app is "damaged", run `xattr -dr com.apple.quarantine /Applications/Inline Studio.app`.
- **Windows:** on the SmartScreen prompt, click "More info" then "Run anyway".

To actually generate, you'll also need a ComfyUI instance to connect to (see [Bring your own ComfyUI](#bring-your-own-comfyui)). The canvas and planning work without it.

---

## Getting started

Prefer to run from source? You'll need [Node.js](https://nodejs.org) 20.11+ (22 recommended).

```bash
git clone <this-repo>
cd inline-studio
npm install      # also rebuilds the native SQLite module for Electron
npm run dev      # launches the app with hot-reload
```

To generate, start ComfyUI with CORS enabled and connect it on the Generate tab:

```bash
python main.py --enable-cors-header     # then paste http://127.0.0.1:8188 in-app
```

> On macOS sandboxes that set `ELECTRON_RUN_AS_NODE=1`, launch with
> `env -u ELECTRON_RUN_AS_NODE npm run dev`.

---

## Building a desktop app

To produce an installer you can hand to someone, package it for your platform:

```bash
npm run package:mac      # arm64 + x64 .dmg in dist/
npm run package:win      # NSIS .exe installer in dist/
npm run package:linux    # AppImage in dist/
```

A few things to know:

- **Build each OS — and each Mac arch — on matching hardware.** Inline Studio ships a native module (SQLite), which has to be compiled for the target machine, so build the Mac app on a Mac and the Windows app on Windows. The same applies to Mac CPU arch: an Intel (`x64`) dmg has to be built on an Intel Mac and an Apple Silicon (`arm64`) dmg on an Apple Silicon Mac — cross-building bundles the wrong native binary. CI handles this for you (see below).
- **After packaging, `npm run dev` may complain about the native module.** Packaging rebuilds SQLite for the target architecture; run `npm run rebuild` to restore it for local development.
- **The builds are unsigned.** On first launch macOS and Windows will warn about an unidentified developer. On a Mac, right-click the app and choose Open (or remove the quarantine flag with `xattr -dr com.apple.quarantine /Applications/Inline Studio.app`). For real distribution you'll want code signing and notarization.
- **App icon.** The icon lives in `build/` (`icon.png` is the source). Replace it there and re-package to rebrand.

Releases are automated: bump the version in `package.json` and run the **Build & Release** workflow from the Actions tab. It builds installers for macOS (Apple Silicon **and** Intel — each on its own runner), Windows, and Linux on GitHub Actions and uploads them to a draft GitHub Release.

---

## Contributing

Inline Studio is early and moving fast, and issues, ideas, and pull requests are all welcome. If you're poking at the code, [CLAUDE.md](CLAUDE.md) is the engineering guide: it explains the architecture, the data model, and the conventions to follow.

Want to help by using it for real? Try the [creator task](task.md): build a short 20-second story in Inline Studio and send us your feedback.

---

## Help shape Inline Studio

Are you a creator who wants to help us make this better? We run a **paid trial feedback program**: use Inline Studio on real work, tell us what helps and what gets in your way, and get paid for your time.

Come say hi on our [Discord](https://discord.gg/cSUS88VdY9) and reach out, we'll get you set up.

[![Join our Discord](https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/cSUS88VdY9)

## License

MIT.
