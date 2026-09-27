@echo off
title Uniprae Installer
echo Installing Uniprae for After Effects and Premiere Pro...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Uniprae.ps1"
pause
