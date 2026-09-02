#!/bin/sh
# Двойной щелчок по этому файлу запускает обработку фотографий.
# Если macOS откажется открывать: правая кнопка -> Открыть -> Открыть.
cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo "  Подготовка фотографий блюд для сайта"
echo "============================================================"
echo

CSV="$1"
if [ -z "$CSV" ]; then
  CSV=$(ls -1 *.csv 2>/dev/null | head -1)
fi
if [ -z "$CSV" ]; then
  echo "Не найдена выгрузка товаров."
  echo "Положите CSV из Tilda в эту же папку и запустите файл снова."
  echo; read -r _ ; exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Не найден Python 3. Установите его с https://www.python.org/downloads/"
  echo; read -r _ ; exit 1
fi

echo "Проверяю библиотеку для картинок..."
python3 -m pip install --quiet --disable-pip-version-check pillow 2>/dev/null \
  || python3 -m pip install --quiet --user pillow

echo
echo "Обрабатываю: $CSV"
echo "Это займёт от пары минут — фотографии скачиваются с серверов Tilda."
echo
python3 optimize-photos.py "$CSV"

echo
echo "Готовые файлы — в папке photos рядом с этим файлом."
echo "Нажмите Enter, чтобы закрыть окно."
read -r _
