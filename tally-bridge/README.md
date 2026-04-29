# Tally Bridge Setup

## 1) Prerequisites
- Python 3.9+ installed on office PC
- TallyPrime open and running
- Internet connection

## 2) Installation (Mac/Linux)
```bash
cd ~/Desktop
git clone <your-repo>
cd synergy-recovery-os/tally-bridge
pip3 install -r requirements.txt
cp .env.example .env
nano .env
python3 sync_to_vercel.py
```

## 3) Installation (Windows)
```bat
cd %USERPROFILE%\Desktop
git clone <your-repo>
cd synergy-recovery-os\tally-bridge
py -m pip install -r requirements.txt
copy .env.example .env
notepad .env
py sync_to_vercel.py
```

## 4) Schedule Daily Sync (Mac/Linux)
```bash
crontab -e
```
Add:
```cron
0 8 * * * /usr/bin/python3 /full/path/to/sync_to_vercel.py
```

## 5) Schedule Daily Sync (Windows)
1. Open **Task Scheduler**.
2. Click **Create Basic Task**.
3. Name: `Synergy Tally Daily Sync`.
4. Trigger: **Daily**, set time to `08:00`.
5. Action: **Start a program**.
6. Program/script: `py` (or full path to `python.exe`).
7. Add arguments: `C:\full\path\to\sync_to_vercel.py`.
8. Start in: `C:\full\path\to\tally-bridge`.
9. Finish and run task once manually to verify.
10. (Screenshot placeholders) `[Task Scheduler Trigger Screenshot]`, `[Task Scheduler Action Screenshot]`.

## 6) Troubleshooting
- **Connection refused** -> Check Tally is running.
- **401 Unauthorized** -> Check `BRIDGE_SECRET` matches Vercel env.
- **Empty parties** -> Check group name spelling exactly.
- **Timeout** -> Increase timeout in script.
  - Set `VERCEL_PUSH_TIMEOUT=300` (or higher) in `.env` for large payloads.
- **Custom fetch range** -> Set `FROM_DATE` and optional `TO_DATE` in `.env`.
  - Supported formats: `YYYYMMDD`, `YYYY-MM-DD`, `DD-MM-YYYY`
  - Example:
    - `FROM_DATE=01-04-2025`
    - `TO_DATE=31-03-2026`

## 7) Logs
- Log file path is controlled by `LOG_FILE` in `.env`.
- Default path: `./tally-bridge.log`.
- Last fatal error is written to `/tmp/tally-bridge-error.txt`.
- Quick tail:
  - Mac/Linux: `tail -f ./tally-bridge.log`
  - Windows PowerShell: `Get-Content .\tally-bridge.log -Wait`
