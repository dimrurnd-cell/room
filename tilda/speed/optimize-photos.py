#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Подготовка фотографий товаров для сайта: скачать, подписать, сжать в WebP.

Зачем: каталог Tilda загружает фотографию товара в том виде, в каком её залили,
без уменьшения — в карточке шириной 300 точек может качаться файл 2000×2000 в PNG.
Скрипт делает из выгрузки магазина набор лёгких WebP с понятными именами.

Настройки подобраны под съёмку еды: важнее сохранить текстуру и цвет блюда,
чем выжать последние килобайты. По умолчанию качество 95 — на фотографии
завтрака это 338 КБ вместо 2338 КБ, и отличий от оригинала не видно даже
при увеличении. Три правила берегут качество:
  • картинки с прозрачностью (логотипы, надписи) сжимаются без потерь
    или почти без потерь — буквы остаются идеально резкими;
  • если сжатие даёт меньше четверти выигрыша, файл остаётся как был:
    пересжимать уже сжатый JPEG значит терять качество впустую;
  • уменьшение только для действительно больших файлов, и с лёгким
    повышением резкости, чтобы уменьшенный кадр не выглядел мыльным.

Что нужно: Python 3 и одна библиотека —
    pip install pillow

Как пользоваться:
    1. Tilda → Магазин → Товары → Экспорт → скачать CSV со всеми товарами.
    2. python3 optimize-photos.py store.csv
    3. Готовые файлы появятся в папке photos/, разложенные по разделам меню:
           photos/ЗАВТРАКИ/shakshuka.webp
           photos/ГОРЯЧИЕ БЛЮДА/....webp
       Отчёт — в photos/SPISOK.csv

Параметры:
    --out КАТАЛОГ     куда складывать (по умолчанию photos)
    --preset ИМЯ      max | high | balance | light  (по умолчанию high)
                      max     — качество 98, отличий нет вообще
                      high    — качество 95, рекомендуется для еды
                      balance — качество 90, файлы примерно на треть легче
                      light   — качество 85, заметно на текстурах, только если важен вес
    --quality N       задать качество вручную, 1–100 (важнее пресета)
    --max N           максимальная сторона в точках (по умолчанию 2000)
    --local КАТАЛОГ   не скачивать, а брать файлы из папки (для проверки без интернета)
    --limit N         обработать только первые N товаров
    --flat            сложить всё в одну папку, без разделения по разделам

Что делать с результатом:
    • Файлы можно залить в карточки товаров вручную (Магазин → товар → Фото).
    • Либо выложить папку photos/ на сайт и импортировать CSV из photos/IMPORT.csv:
      в нём колонка Photo уже указывает на новые файлы. Перед импортом замените
      в нём BASE_URL на адрес папки на вашем сайте.
"""

import argparse, csv, io, os, re, sys, math, urllib.request, urllib.error

Image = None


def ensure_pillow():
    """Проверить библиотеку для картинок и поставить её, если её нет."""
    global Image
    try:
        from PIL import Image as _I
        Image = _I
        return
    except ImportError:
        pass
    print('Устанавливаю библиотеку для работы с картинками (один раз)...')
    import subprocess
    for args in (['-m', 'pip', 'install', '--quiet', 'pillow'],
                 ['-m', 'pip', 'install', '--quiet', '--user', 'pillow']):
        try:
            if subprocess.call([sys.executable] + args) == 0:
                break
        except Exception:
            pass
    try:
        from PIL import Image as _I
        Image = _I
    except ImportError:
        wait_and_exit('Не удалось установить библиотеку Pillow.\n'
                      'Откройте командную строку и выполните:  pip install pillow')


def wait_and_exit(msg, code=1):
    print('\n' + msg)
    try:
        input('\nНажмите Enter, чтобы закрыть окно...')
    except Exception:
        pass
    sys.exit(code)


def pick_csv(folder):
    """Найти выгрузку товаров рядом со скриптом."""
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.csv'))
    files = [f for f in files if f not in ('SPISOK.csv', 'IMPORT.csv')]
    if not files:
        wait_and_exit('Рядом со скриптом нет ни одного файла .csv.\n\n'
                      'Что делать:\n'
                      '  1. Откройте Tilda → Магазин → Товары → Экспорт\n'
                      '  2. Скачайте файл выгрузки\n'
                      '  3. Положите его в эту же папку и запустите снова')
    if len(files) == 1:
        print('Нашёл выгрузку: %s\n' % files[0])
        return os.path.join(folder, files[0])
    print('Рядом лежит несколько файлов .csv:\n')
    for i, f in enumerate(files, 1):
        print('  %d. %s' % (i, f))
    try:
        n = int(input('\nВведите номер нужного и нажмите Enter: ').strip())
        return os.path.join(folder, files[n - 1])
    except Exception:
        wait_and_exit('Не понял номер. Запустите ещё раз.')

PRESETS = {'max': 98, 'high': 95, 'balance': 90, 'light': 85}

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

def safe_dir(name):
    """Название раздела меню превращаем в имя папки, оставляя его читаемым."""
    name = (name or '').strip().strip('.')
    for ch in '\\/:*?"<>|\t\r\n':
        name = name.replace(ch, ' ')
    name = ' '.join(name.split())
    return name[:60] or 'Без раздела'


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

def similarity(a_img, b_img):
    """Насколько результат похож на оригинал (SSIM). 1.0 — совпадение,
    выше 0.97 — глазом отличий не видно даже при увеличении."""
    try:
        import numpy as np
    except ImportError:
        return None
    if a_img.size != b_img.size:
        return None                             # картинку уменьшали — сравнивать попиксельно нельзя

    def flat(im):
        """Прозрачное кладём на белый фон — именно так это видит гость."""
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        return Image.alpha_composite(bg, im).convert('RGB')

    a, b = flat(a_img), flat(b_img)
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2

    def win(x, k=8):
        h, w = x.shape
        h -= h % k; w -= w % k
        return x[:h, :w].reshape(h // k, k, w // k, k)

    total = 0.0
    for ch in range(3):                         # по каждому цвету: важна и краснота помидора
        A = win(np.asarray(a, dtype='float64')[:, :, ch])
        B = win(np.asarray(b, dtype='float64')[:, :, ch])
        ma, mb = A.mean((1, 3)), B.mean((1, 3))
        va, vb = A.var((1, 3)), B.var((1, 3))
        cov = (A * B).mean((1, 3)) - ma * mb
        total += (((2 * ma * mb + C1) * (2 * cov + C2)) /
                  ((ma ** 2 + mb ** 2 + C1) * (va + vb + C2))).mean()
    return total / 3.0


def convert(data, dst, quality, maxside):
    """Вернуть (изображение, исходный размер, была ли прозрачность, что сделали)."""
    from PIL import ImageFilter
    im = Image.open(io.BytesIO(data))
    w, h = im.size

    alpha = False
    if im.mode in ('RGBA', 'LA', 'P'):
        mn, _ = im.convert('RGBA').getchannel('A').getextrema()
        alpha = mn < 255                        # прозрачность бывает и «на бумаге» — проверяем по факту
    im = im.convert('RGBA' if alpha else 'RGB')

    resized = False
    if maxside and max(w, h) > maxside:
        k = maxside / float(max(w, h))
        im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
        # уменьшение всегда немного размывает — возвращаем кадру резкость
        im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=55, threshold=3))
        resized = True

    if alpha:
        # Логотипы и надписи: сравниваем «без потерь» и «почти без потерь»,
        # берём файл поменьше. Края букв в обоих случаях остаются чистыми.
        best, mode = None, ''
        for kw, label in (({'lossless': True, 'method': 6}, 'без потерь'),
                          ({'quality': 98, 'method': 6, 'alpha_quality': 100}, 'качество 98')):
            buf = io.BytesIO()
            im.save(buf, 'WEBP', **kw)
            if best is None or len(buf.getvalue()) < len(best):
                best, mode = buf.getvalue(), label
        with open(dst, 'wb') as f:
            f.write(best)
    else:
        im.save(dst, 'WEBP', quality=quality, method=6)
        mode = 'качество %d' % quality

    if resized:
        mode += ', уменьшено'
    return im, (w, h), alpha, mode


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument('csvfile', nargs='?', help='выгрузка товаров из Tilda')
    p.add_argument('--out', default='photos')
    p.add_argument('--preset', default='high', choices=['max', 'high', 'balance', 'light'])
    p.add_argument('--quality', type=int, default=None)
    p.add_argument('--max', type=int, default=2000, dest='maxside')
    p.add_argument('--min-gain', type=int, default=25, dest='mingain',
                   help='не пересжимать, если выигрыш меньше этого процента')
    p.add_argument('--local', default=None, help='брать файлы из папки, а не скачивать')
    p.add_argument('--limit', type=int, default=0)
    p.add_argument('--flat', action='store_true',
                   help='не раскладывать по разделам меню')
    p.add_argument('--auto', action='store_true',
                   help='сам найти выгрузку рядом со скриптом и доустановить нужную библиотеку')
    a = p.parse_args()

    if a.quality is None:
        a.quality = PRESETS[a.preset]

    here = os.path.dirname(os.path.abspath(__file__))
    if a.auto:
        ensure_pillow()
        if not a.csvfile:
            a.csvfile = pick_csv(here)
        if not os.path.isabs(a.out):
            a.out = os.path.join(here, a.out)
    if not a.csvfile:
        p.error('укажите файл выгрузки: python optimize-photos.py store.csv')

    if Image is None:
        ensure_pillow()
    rows, enc, delim = read_rows(a.csvfile)
    os.makedirs(a.out, exist_ok=True)
    print('Прочитано строк: %d (кодировка %s, разделитель "%s")\n' % (len(rows), enc, delim))

    seen, report, n_ok, n_skip, n_err, n_keep = {}, [], 0, 0, 0, 0
    shown_cat = ['']
    total_src = total_dst = 0

    last_cat = ''
    for row in rows:
        title = (row.get('Title') or '').strip()
        photos = (row.get('Photo') or '').strip()
        cat = safe_dir(row.get('Category') or '')
        if cat != 'Без раздела':
            last_cat = cat
        elif last_cat:
            cat = last_cat                      # у модификаций раздел не заполнен
        if not photos:                          # у модификаций товара своего фото нет
            continue
        if a.limit and n_ok >= a.limit:
            break
        for idx, url in enumerate([u.strip() for u in photos.split('|') if u.strip()]):
            base = slug(title)
            seen[base] = seen.get(base, 0) + 1
            suffix = '' if seen[base] == 1 and idx == 0 else '-%d' % seen[base]
            name = '%s%s.webp' % (base, suffix)
            folder = a.out if a.flat else os.path.join(a.out, cat)
            if not os.path.isdir(folder):
                os.makedirs(folder)
            if cat != shown_cat[0] and not a.flat:
                shown_cat[0] = cat
                print('\n  %s' % cat.upper())
            rel = name if a.flat else (cat + '/' + name)
            dst = os.path.join(folder, name)
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
                im, size, alpha, mode = convert(data, dst, a.quality, a.maxside)
            except Exception as e:
                print('  ОШИБКА обработки %s — %s' % (url[:70], e)); n_err += 1; continue

            s, d = len(data), os.path.getsize(dst)

            # Пересжимать ради нескольких процентов — только терять качество.
            # Такой файл уже оптимален: оставляем его как есть.
            if d > s * (1 - a.mingain / 100.0):
                ext = os.path.splitext(url.split('?')[0])[1].lower() or '.jpg'
                keep = os.path.join(folder, os.path.splitext(name)[0] + ext)
                with open(keep, 'wb') as f:
                    f.write(data)
                os.remove(dst)
                n_keep += 1
                print('    %-50s %5dx%-5d %8.0fК   оставлен как есть — сжимать нечего'
                      % (os.path.basename(keep)[:50], size[0], size[1], s / 1024.0))
                report.append([cat, title, os.path.splitext(rel)[0] + ext, url,
                               size[0], size[1], s, s, '0%', '', 'оригинал'])
                total_src += s; total_dst += s; n_ok += 1
                continue

            total_src += s; total_dst += d; n_ok += 1
            sim = similarity(Image.open(io.BytesIO(data)), Image.open(dst))
            print('    %-50s %5dx%-5d %8.0fК → %7.0fК  −%2.0f%%%s'
                  % (name[:50], size[0], size[1], s / 1024.0, d / 1024.0, 100 - d * 100.0 / s,
                     ('   схожесть %.1f%%' % (sim * 100)) if sim else ''))
            report.append([cat, title, rel, url, size[0], size[1], s, d,
                           '-%.0f%%' % (100 - d * 100.0 / s), ('%.4f' % sim) if sim else '', mode])

    with io.open(os.path.join(a.out, 'SPISOK.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['Раздел', 'Товар', 'Новый файл', 'Исходное фото', 'Ширина', 'Высота',
                    'Было, байт', 'Стало, байт', 'Экономия', 'Схожесть с оригиналом', 'Как сжато'])
        w.writerows(report)

    by_url = dict((r[3], r[2]) for r in report)
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
    print('Обработано: %d   ошибок: %d' % (n_ok, n_err)
          + ('   оставлено без изменений: %d' % n_keep if n_keep else '')
          + ('   пропущено: %d' % n_skip if n_skip else ''))
    print('Качество: %s (%d)' % (a.preset, a.quality))
    if total_src:
        print('Вес фотографий: %.2f МБ → %.2f МБ   (−%.0f%%)'
              % (total_src / 1048576.0, total_dst / 1048576.0, 100 - total_dst * 100.0 / total_src))
    print('Файлы и отчёт: %s/' % a.out)
    if not a.flat:
        print('  фотографии разложены по папкам с названиями разделов меню')
    print('  SPISOK.csv — что во что превратилось')
    print('  IMPORT.csv — выгрузка с новыми путями; замените BASE_URL на адрес папки на сайте')
    if n_err and not n_ok:
        print('\nНи одна фотография не скачалась. Обычно это одно из трёх:')
        print('  • нет интернета или он идёт через прокси, который блокирует static.tildacdn.com;')
        print('  • включён VPN, через который сервер Tilda недоступен — попробуйте выключить;')
        print('  • в выгрузке колонка Photo пустая — возьмите экспорт из раздела Магазин → Товары.')
    if a.auto:
        try:
            input('\nГотово. Нажмите Enter, чтобы закрыть окно...')
        except Exception:
            pass

if __name__ == '__main__':
    main()
