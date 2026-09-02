#!/bin/sh
# ----------------------------------------------------------------------------
#  Подключить сжатые картинки на сайте, не трогая вёрстку.
#
#  Работает только если сайт отдаётся с вашего хостинга (выгрузка Tilda по FTP)
#  и в .htaccess есть правило отдачи WebP — оно уже есть в tilda/speed/htaccess-optimized.
#
#  Как это работает: рядом с каждой картинкой кладётся файл с тем же именем
#  и добавленным .webp (photo.png → photo.png.webp). Сервер сам отдаёт лёгкую
#  версию браузерам, которые её понимают, а остальным — прежний файл.
#  Ссылки в HTML менять не нужно, откатиться можно удалением файлов .webp.
#
#  Запуск из этой папки:
#      sh install.sh /путь/до/сайта/images
# ----------------------------------------------------------------------------
set -e
DEST="$1"
if [ -z "$DEST" ]; then echo "Укажите папку images сайта: sh install.sh /var/www/site/images"; exit 1; fi
if [ ! -d "$DEST" ]; then echo "Папки нет: $DEST"; exit 1; fi

n=0
# читаем SPISOK.csv: файл WebP;описание;исходный файл
tail -n +2 SPISOK.csv | tr -d '\r' | while IFS=';' read -r new descr orig rest; do
  [ -z "$new" ] && continue
  if [ ! -f "$new" ]; then echo "  нет файла $new"; continue; fi
  if [ ! -f "$DEST/$orig" ]; then echo "  пропуск, на сайте нет $orig"; continue; fi
  cp "$new" "$DEST/$orig.webp"
  echo "  $orig  →  $orig.webp"
  n=$((n+1))
done
echo "Готово. Проверьте страницу: в инструментах разработчика картинки должны отдаваться как image/webp."
