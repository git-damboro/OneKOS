@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [OneKOS] 未检测到 Node.js，请先安装 Node.js 18 或更高版本。
  pause
  exit /b 1
)

echo [OneKOS] 正在启动本地演示服务器...
start "OneKOS MVP Server" /D "%~dp0" cmd /k node server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
echo [OneKOS] 浏览器已打开。演示结束后可关闭“OneKOS MVP Server”窗口。
timeout /t 3 /nobreak >nul
