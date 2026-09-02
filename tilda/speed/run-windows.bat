@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Подготовка фотографий блюд для сайта
echo ============================================================
echo.

rem --- ищем выгрузку: либо перетащили на файл, либо лежит рядом ---
set "CSV=%~1"
if "%CSV%"=="" for %%F in ("*.csv") do if not defined CSV set "CSV=%%~fF"
if "%CSV%"=="" (
  echo Не найдена выгрузка товаров.
  echo Положите CSV из Tilda в эту же папку или перетащите его мышкой
  echo на файл run-windows.bat
  echo.
  pause
  exit /b 1
)

rem --- ищем Python ---
set "PY=python"
%PY% --version >nul 2>&1
if errorlevel 1 set "PY=py"
%PY% --version >nul 2>&1
if errorlevel 1 (
  echo Не найден Python.
  echo Установите его с https://www.python.org/downloads/
  echo При установке обязательно поставьте галочку "Add python.exe to PATH".
  echo.
  pause
  exit /b 1
)

echo Проверяю библиотеку для картинок...
%PY% -m pip install --quiet --disable-pip-version-check pillow

echo.
echo Обрабатываю: %CSV%
echo Это займёт от пары минут — фотографии скачиваются с серверов Tilda.
echo.
%PY% optimize-photos.py "%CSV%"

echo.
echo Готовые файлы — в папке photos рядом с этим файлом.
pause
