#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Подготовка фотографий товаров для сайта: скачать, подписать, сжать в WebP.

Зачем: каталог Tilda загружает фотографию товара в том виде, в каком её залили,
без уменьшения — в карточке шириной 300 точек может качаться файл 2000×2000 в PNG.
Скрипт делает из выгрузки магазина набор лёгких WebP с понятными именами.

Что нужно: Python 3 и одна библиотека —
    pip install pillow

Как пользоваться:
    1. Tilda → Магазин → Товары → Экспорт → скачать CSV со всеми товарами.
    2. python3 optimize-photos.py store.csv
    3. Готовые файлы появятся в папке photos/, отчёт — в photos/SPISOK.csv

Параметры:
    --out КАТАЛОГ     куда складывать (по умолчанию photos)
    --quality N       качество WebP, 1–100 (по умолчанию 82 — визуально неотличимо)
    --max N           максимальная сторона в точках (по умолчанию 1600)
    --local КАТАЛОГ   не скачивать, а брать файлы из папки (для проверки без интернета)
    --limit N         обработать только первые N товаров

Что делать с результатом:
    • Файлы можно залить в карточки товаров вручную (Магазин → товар → Фото).
    • Либо выложить папку photos/ на сайт и импортировать CSV из photos/IMPORT.csv:
      в нём колонка Photo уже указывает на новые файлы. Перед импортом замените
      в нём BASE_URL на адрес папки на вашем сайте.
"""

import argparse, csv, io, os, re, sys, math, urllib.request, urllib.error

try:
    from PIL import Image
except ImportError:
    sys.exit('Не хватает библиотеки Pillow. Установите её командой:  pip install pillow')

TRANS = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
}

def slug(text, limit=60):
    s = (text or '').strip().lower()
    out = []
    for ch in s:
        if ch in TRANS: out.append(TRANS[ch])
        elif ch.isalnum(): out.append(ch)
        else: out.append('-')
    s = re.sub(r'-+', '-', ''.join(out)).strip('-')
    return (s[:limit].rstrip('-') or 'photo')

def read_rows(path):
    """Выгрузка Tilda бывает и в cp1251, и в utf-8; разделитель — точка с запятой."""
    for enc in ('utf-8-sig', 'cp1251', 'utf-8'):
        try:
            with io.open(path, encoding=enc, newline='') as f:
                head = f.readline()
                if 'Title' not in head and 'Tilda UID' not in head: continue
                f.seek(0)
                delim = ';' if head.count(';') >= head.count(',') else ','
                return list(csv.DictReader(f, delimiter=delim)), enc, delim
        except (UnicodeDecodeError, LookupError):
            continue
    sys.exit('Не удалось прочитать файл. Это точно выгрузка товаров из Tilda?')

def fetch(url, timeout=40):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (photo-optimizer)'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def psnr(a_img, b_img):
    """Насколько отличается результат от оригинала. Больше 40 дБ — глазом не видно."""
    try:
        import numpy as np
    except ImportError:
        return None
    a = a_img.convert('RGBA'); b = b_img.convert('RGBA')
    if a.size != b.size:
        return None                             # картинку уменьшали — сравнивать попиксельно нельзя
    a = np.asarray(a, dtype='float64'); b = np.asarray(b, dtype='float64')
    mask = a[:, :, 3] > 8                       # считаем только по видимым точкам
    if not mask.any(): return None
    mse = ((a[:, :, :3] - b[:, :, :3]) ** 2)[mask].mean()
    return 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)

def convert(data, dst, quality, maxside):
    im = Image.open(io.BytesIO(data))
    w, h = im.size
    alpha = False
    if im.mode in ('RGBA', 'LA', 'P'):
        mn, _ = im.convert('RGBA').getchannel('A').getextrema()
        alpha = mn < 255                        # прозрачность бывает и «на бумаге» — проверяем по факту
    im = im.convert('RGBA' if alpha else 'RGB')
    if maxside and max(w, h) > maxside:
        k = maxside / float(max(w, h))
        im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=quality, method=6)
    return im, (w, h), alpha

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument('csvfile', help='выгрузка товаров из Tilda')
    p.add_argument('--out', default='photos')
    p.add_argument('--quality', type=int, default=82)
    p.add_argument('--max', type=int, default=1600, dest='maxside')
    p.add_argument('--local', default=None, help='брать файлы из папки, а не скачивать')
    p.add_argument('--limit', type=int, default=0)
    a = p.parse_args()

    rows, enc, delim = read_rows(a.csvfile)
    os.makedirs(a.out, exist_ok=True)
    print('Прочитано строк: %d (кодировка %s, разделитель "%s")\n' % (len(rows), enc, delim))

    seen, report, n_ok, n_skip, n_err = {}, [], 0, 0, 0
    total_src = total_dst = 0

    for row in rows:
        title = (row.get('Title') or '').strip()
        photos = (row.get('Photo') or '').strip()
        if not photos:                          # у модификаций товара своего фото нет
            continue
        if a.limit and n_ok >= a.limit:
            break
        for idx, url in enumerate([u.strip() for u in photos.split('|') if u.strip()]):
            base = slug(title)
            seen[base] = seen.get(base, 0) + 1
            suffix = '' if seen[base] == 1 and idx == 0 else '-%d' % seen[base]
            name = '%s%s.webp' % (base, suffix)
            dst = os.path.join(a.out, name)
            try:
                if a.local:
                    src_path = os.path.join(a.local, os.path.basename(url.split('?')[0]))
                    if not os.path.exists(src_path):
                        print('  пропуск (нет файла): %s' % src_path); n_skip += 1; continue
                    data = open(src_path, 'rb').read()
                else:
                    data = fetch(url)
            except Exception as e:
                print('  ОШИБКА загрузки %s — %s' % (url[:70], e)); n_err += 1; continue
            try:
                im, size, alpha = convert(data, dst, a.quality, a.maxside)
            except Exception as e:
                print('  ОШИБКА обработки %s — %s' % (url[:70], e)); n_err += 1; continue

            s, d = len(data), os.path.getsize(dst)
            total_src += s; total_dst += d; n_ok += 1
            q = psnr(Image.open(io.BytesIO(data)), Image.open(dst))
            print('  %-52s %5dx%-5d %8.0fК → %7.0fК  −%2.0f%%%s'
                  % (name[:52], size[0], size[1], s / 1024.0, d / 1024.0, 100 - d * 100.0 / s,
                     ('  PSNR %.0f дБ' % q) if q else ''))
            report.append([title, name, url, size[0], size[1], s, d,
                           '-%.0f%%' % (100 - d * 100.0 / s), ('%.1f' % q) if q else ''])

    with io.open(os.path.join(a.out, 'SPISOK.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['Товар', 'Новый файл', 'Исходное фото', 'Ширина', 'Высота',
                    'Было, байт', 'Стало, байт', 'Экономия', 'PSNR, дБ'])
        w.writerows(report)

    by_url = dict((r[2], r[1]) for r in report)
    with io.open(os.path.join(a.out, 'IMPORT.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        if rows:
            w.writerow(list(rows[0].keys()))
            for row in rows:
                ph = (row.get('Photo') or '').strip()
                if ph:
                    new = [('BASE_URL/' + by_url[u.strip()]) for u in ph.split('|')
                           if u.strip() in by_url]
                    if new: row['Photo'] = '|'.join(new)
                w.writerow([row.get(k, '') for k in rows[0].keys()])

    print('\n' + '-' * 78)
    print('Обработано: %d   пропущено: %d   ошибок: %d' % (n_ok, n_skip, n_err))
    if total_src:
        print('Вес фотографий: %.2f МБ → %.2f МБ   (−%.0f%%)'
              % (total_src / 1048576.0, total_dst / 1048576.0, 100 - total_dst * 100.0 / total_src))
    print('Файлы и отчёт: %s/' % a.out)
    print('  SPISOK.csv — что во что превратилось')
    print('  IMPORT.csv — выгрузка с новыми путями; замените BASE_URL на адрес папки на сайте')

if __name__ == '__main__':
    main()
