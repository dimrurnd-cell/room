#!/bin/sh
# Двойной щелчок по этому файлу запускает обработку фотографий.
# Если macOS откажется открывать: правая кнопка -> Открыть -> Открыть.
cd "$(dirname "$0")" || exit 1

if command -v python3 >/dev/null 2>&1; then
  python3 optimize-photos.py --auto "$@"
else
  echo
  echo "  Python 3 не найден."
  echo "  Установите его с https://www.python.org/downloads/ и запустите файл снова."
  echo
  printf "Нажмите Enter, чтобы закрыть окно..."
  read -r _
fi
