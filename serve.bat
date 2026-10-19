@echo off
cd /d "%~dp0"
start "" http://localhost:8048/
python serve.py 8048
