@echo off
title Paper Rockets 3D - Remote Cellular Access Server
cls
echo ========================================================
echo     PAPER ROCKETS 3D - REMOTE CELLULAR ACCESS SERVER
echo ========================================================
echo.
echo Starting local server and establishing secure cellular tunnel...
echo.
npm run dev:remote
pause
