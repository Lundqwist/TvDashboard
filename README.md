# Home Lab TV Dashboard

A Samsung Smart TV (Tizen) app that shows my home lab on the living-room TV: Raspberry Pi and NAS
health, Pi-hole stats, websites and services, network reachability, Vikunja tasks, the hall camera
and the weather. It is the TV companion to [Network Dashboard](https://github.com/Lundqwist/NetworkDashboard).

## How it works

The app is plain HTML, CSS and JavaScript, packaged as a Tizen web app (`.wgt`). It holds no
passwords or tokens. All data comes from a Network Dashboard server running as a **read-only LAN
feed** in Docker on the Raspberry Pi (`readOnly`, `cors` and `allowedClients` options, see that
project's README). The TV polls `/api/state` every 5 seconds and shows the camera through the
feed's MJPEG proxy.

```
TV app ──GET /api/state──▶ Network Dashboard feed (Pi, Docker) ──▶ agents, Pi-hole, Vikunja, go2rtc, …
```

Set the feed's address in `js/config.js`.

## Remote control

| Button | Action |
| --- | --- |
| ◀ ▲ ▼ ▶ | Choose a panel |
| OK | Enlarge the panel (camera full screen, all tasks, longer forecast) |
| Back | Close the enlarged panel, or exit the app |
| Red | Refresh now |

The TV's screen saver is turned off while the app is open.

## Compatibility

Written for a 2020 Samsung TV (Tizen 5.5, a Chromium 69-era engine), so the code avoids newer
syntax such as `?.` and `??`. Layout is fixed at 1920×1080. Weather icons are inline SVG, since
TVs often have no colour emoji font.

## Preview on a PC

```powershell
node tools/serve.js 8097
```

Then open http://127.0.0.1:8097 in a browser at 1920×1080. Arrow keys, Enter and Esc stand in for
the remote. The feed must allow the PC's IP.

## Install on the TV

1. Turn on Developer Mode on the TV (Apps, then 1-2-3-4-5 on the on-screen number pad) and enter
   the PC's IP address.
2. Install the Tizen Studio CLI and, from its package manager (run as administrator), the
   Certificate Manager and Samsung Certificate Extension.
3. In Certificate Manager, create a **Samsung** TV certificate profile whose distributor
   certificate includes the TV's DUID (`sdb shell 0 getduid`).
4. Run `tools/install-tv.ps1` (`-Tv <ip> -Profile <name>`). It packages, signs, installs and starts
   the app.

## License

[MIT](LICENSE)
