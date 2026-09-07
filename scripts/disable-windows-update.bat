@echo off
echo ===================================================
echo   PERMANENTLY DISABLING WINDOWS UPDATE & SERVICES
echo ===================================================
echo.

:: 1. Stop and disable Windows Update Service (wuauserv)
net stop wuauserv /y >nul 2>&1
sc config wuauserv start= disabled >nul 2>&1

:: 2. Stop and disable Delivery Optimization (DoSvc)
net stop DoSvc /y >nul 2>&1
sc config DoSvc start= disabled >nul 2>&1

:: 3. Stop and disable Windows Update Medic Service (WaaSMedicSvc)
net stop WaaSMedicSvc /y >nul 2>&1
sc config WaaSMedicSvc start= disabled >nul 2>&1

:: 4. Stop and disable Background Intelligent Transfer Service (BITS)
net stop BITS /y >nul 2>&1
sc config BITS start= disabled >nul 2>&1

:: 5. Set Registry Group Policy to block automatic updates
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v AUOptions /t REG_DWORD /d 2 /f >nul 2>&1

:: 6. Disable the Windows Update scheduled wake tasks
schtasks /Change /TN "\Microsoft\Windows\WindowsUpdate\Scheduled Start" /Disable >nul 2>&1
schtasks /Change /TN "\Microsoft\Windows\UpdateOrchestrator\Schedule Scan" /Disable >nul 2>&1

echo.
echo [SUCCESS] Windows Update and background download services have been permanently disabled!
echo You will never get surprise background downloads again.
pause
