@echo off
cd /d "%~dp0crates\remix-rust"
echo Launching Remix 3D Studio (Pure Rust + wgpu)...
start "" "%~dp0crates\remix-rust\target\debug\remix-app.exe"
