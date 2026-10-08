@echo off
chcp 65001 >nul
echo ===================================================
echo           Starting CineScope via Docker            
echo ===================================================
echo.
echo  Services will be available at:
echo   - App:       http://localhost
echo   - API Docs:  http://localhost:8000/docs
echo   - Grafana:   http://localhost:3001  (admin / cinescope123)
echo   - Metrics:   http://localhost:9091
echo.
echo ===================================================
echo.

docker compose up --build
pause
