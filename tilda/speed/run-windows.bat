@echo off
rem =============================================================
rem   Podgotovka fotografiy blyud dlya sayta
rem   Etot fayl tolko zapuskaet Python. Vse soobscheniya - vnutri.
rem   Vnimanie: fayl dolzhen ostavatsya bez russkih bukv,
rem   inache cmd.exe lomaet razbor komand.
rem =============================================================
cd /d "%~dp0"

if not exist "optimize-photos.py" (
  echo.
  echo   Fayl optimize-photos.py ne nayden ryadom s etim faylom.
  echo   Polozhite optimize-photos.py i run-windows.bat v odnu papku.
  echo.
  pause
  exit /b 1
)

set "PY="
python -c "import sys" >nul 2>&1 && set "PY=python"
if not defined PY (
  py -c "import sys" >nul 2>&1 && set "PY=py"
)

if not defined PY (
  echo.
  echo   Python ne nayden.
  echo.
  echo   1^) Skachayte Python: https://www.python.org/downloads/
  echo   2^) Pri ustanovke postavte galochku "Add python.exe to PATH"
  echo   3^) Perezapustite etot fayl
  echo.
  pause
  exit /b 1
)

%PY% optimize-photos.py --auto %*

if errorlevel 1 pause
