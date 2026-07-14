@echo off
echo Iniciando servidor de Cabinas...
echo.

REM Cambiar al directorio del proyecto
cd /d G:\Dev\Cabinas

REM Iniciar el servidor Python en background y abrir navegador
start http://localhost:8123
timeout /t 2 /nobreak
python -m http.server 8123 --directory G:\Dev\Cabinas\app

REM Mantener la ventana abierta si ocurre un error
pause
