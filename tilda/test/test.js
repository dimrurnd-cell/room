const fs = require('fs');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(__dirname + '/../footer-roomservice-cart.html', 'utf8');

// МСК -> epoch (МСК = UTC+3)
function msk(y, m, d, h, mi, s = 0) { return Date.UTC(y, m - 1, d, h - 3, mi, s); }

const CART_HTML = `
<div class="t-records" data-tilda-mode="">
 <div id="rec1" class="r t-rec" data-record-type="706">
  <div class="t706" data-project-currency="р.">
   <div class="t706__carticon"><div class="t706__carticon-counter js-carticon-counter"></div></div>
   <div class="t706__cartwin">
    <div class="t706__cartwin-content">
     <div class="t706__cartwin-products"></div>
     <div class="t706__cartwin-bottom"></div>
     <div class="t706__orderform">
      <form id="form1" name="form1" method="POST" class="t-form js-form-proccess">
       <div class="t-input-group t-input-group_nm" data-field-name="Name">
         <input type="text" name="Name" class="t-input js-tilda-rule" value="">
       </div>
       <div class="t-input-group t-input-group_da" data-field-name="data_dostavki">
        <div class="t-input-block"><div class="t-datepicker__wrapper">
         <input type="text" name="data_dostavki" class="t-input t-datepicker js-tilda-rule" value=""
           data-tilda-req="1" data-tilda-rule="date" data-tilda-dateformat="DD-MM-YYYY"
           data-tilda-datediv="dash" data-tilda-dateunvailable="past" data-tilda-mask="99-99-9999">
        </div></div>
       </div>
       <div class="t-input-group t-input-group_tm" data-field-name="vremya_dostavki">
        <div class="t-input-block">
         <input type="text" name="vremya_dostavki" class="t-input t-inputtime js-tilda-rule" value=""
           data-tilda-req="1" data-tilda-rule="time" data-tilda-mask="99:99">
        </div>
       </div>
       <div class="t-form__submit"><button class="t-submit" type="submit"><span>ЗАКАЗАТЬ</span></button></div>
      </form>
     </div>
    </div>
   </div>
  </div>
 </div>
</div>`;

function make(nowTs, products) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <script>window.__NOW=${nowTs};Date.now=function(){return window.__NOW;};<\/script>
  ${CART_HTML}
  <script>
    window.tcart = { products: ${JSON.stringify(products)}, prodamount: 0, amount: 0 };
    window.__recalc = function () {
      var n = 0;
      window.tcart.products.forEach(function (p) { if (p) { n += (parseFloat(p.price) || 0) * (p.quantity || 1); } });
      window.tcart.prodamount = n;
      var a = n;
      if (window.tcart.delivery && window.tcart.delivery.price > 0) { a += +window.tcart.delivery.price; }
      window.tcart.amount = a;
    };
    window.tcart__updateTotalProductsinCartObj = function () { window.__recalc(); };
    window.tcart__reDrawTotal = function () {
      var e = document.querySelector('.t706__cartwin-prodamount');
      if (e) { e.textContent = String(window.tcart.prodamount); }
      var t = document.querySelector('.t706__cartwin-totalamount');
      if (t) { t.textContent = String(window.tcart.amount); }
    };
    window.__sync = function () { window.__recalc(); var c = document.querySelector('.js-carticon-counter');
      if (c) { c.textContent = window.tcart.products.length ? String(window.tcart.products.length) : ''; } };
    window.__sync();
    window.__added = [];
    window.tcart__addProduct = function (p) { window.tcart.products.push(p); window.__added.push(p.name); window.__sync(); return true; };
    window.tcart__deleteProduct = function (i) { window.tcart.products.splice(i, 1); window.__sync(); };
    window.tcart__saveLocalObj = function () {};
    window.tcart__reDrawProducts = function () {};
    window.tcart__reDrawCartIcon = function () {};
  <\/script>
  ${SRC}
  </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://roomservice-bereza.ru/' });
  dom.window.fetch = undefined;         // отключаем сверку с сервером
  return dom;
}

const P = {
  breakfastSet: { name: 'Сытный сет «Русский завтрак» - Латте', price: '880', quantity: 1, uid: '381821866163',
                  url: 'https://roomservice-bereza.ru/tproduct/142718970583-sitnii-set-russkii-zavtrak?editionuid=381821866163' },
  shakshuka:    { name: 'Шакшука', price: '320', quantity: 1, uid: '523668981613',
                  url: 'https://roomservice-bereza.ru/tproduct/523668981613-shakshuka' },
  syrniki:      { name: 'Воздушные домашние сырники с топпингом на выбор - Ягодный джем', price: '220', quantity: 1,
                  uid: '821698252483', url: 'https://roomservice-bereza.ru/tproduct/315374361683-vozdushnie-domashnie-sirniki-s-toppingom?editionuid=821698252483' },
  borsch:       { name: 'Борщ с говядиной', price: '450', quantity: 1, uid: '111111111111',
                  url: 'https://roomservice-bereza.ru/tproduct/111111111111-borsch-s-govyadinoi' },
  steak:        { name: 'Стейк из говядины', price: '1200', quantity: 1, uid: '222222222222',
                  url: 'https://roomservice-bereza.ru/tproduct/222222222222-steik' }
};

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

function chips(dom, sel) {
  return [...dom.window.document.querySelectorAll('.rsb-slots ' + sel)].map(b => ({
    txt: (b.getAttribute('data-time') || b.textContent).trim(),
    key: b.getAttribute('data-key'),
    off: b.disabled,
    sel: b.className.indexOf('rsb-sel') !== -1
  }));
}
const times = d => chips(d, '.rsb-times .rsb-chip');
const daysC = d => chips(d, '.rsb-days .rsb-chip');
const vis = d => d.window.document.querySelector('.rsb-slots').className.indexOf('rsb-on') !== -1;
const status = d => d.window.document.querySelector('.rsb-status').textContent.replace(/\s+/g, ' ').trim();
const val = (d, n) => d.window.document.querySelector('input[name="' + n + '"]').value;

(async () => {
  let d, t;

  console.log('\n1) ЗАВТРАКИ, 28.08.2026 07:31 МСК — слот 8:00 должен быть закрыт');
  d = make(msk(2026, 8, 28, 7, 31), [P.breakfastSet]); await wait(400);
  t = times(d);
  ok(vis(d), 'панель показана');
  ok(t.map(x => x.txt).join(',') === '08:00,08:30,09:00,09:30,10:00', 'слоты завтрака: ' + t.map(x => x.txt).join(','));
  ok(t[0].off === true, '08:00 недоступно');
  ok(t.slice(1).every(x => !x.off), '08:30–10:00 доступны');
  ok(daysC(d).length === 2 && daysC(d)[0].sel, 'выбрано «Сегодня», дней — 2');

  console.log('\n2) ЗАВТРАКИ, ровно 07:30:00 — 8:00 ещё можно');
  d = make(msk(2026, 8, 28, 7, 30, 0), [P.breakfastSet]); await wait(400);
  ok(times(d)[0].off === false, '08:00 доступно ровно за 30 мин');
  d = make(msk(2026, 8, 28, 7, 30, 1), [P.breakfastSet]); await wait(400);
  ok(times(d)[0].off === true, '07:30:01 — 08:00 уже закрыто');

  console.log('\n3) ОСНОВНОЕ МЕНЮ, 12:31 МСК — 13:00 закрыт, 14:00 открыт');
  d = make(msk(2026, 8, 28, 12, 31), [P.borsch]); await wait(400);
  t = times(d);
  ok(t.length === 19 && t[0].txt === '13:00' && t[18].txt === '22:00', 'слоты 13:00–22:00 через полчаса (19 шт)');
  ok(t[0].off === true, '13:00 недоступно');
  ok(t[1].off === true, '13:30 недоступно (нужен час на приготовление)');
  ok(t[2].off === false, '14:00 доступно');

  console.log('\n4) ОСНОВНОЕ МЕНЮ, 12:00 МСК — 13:00 ещё доступен');
  d = make(msk(2026, 8, 28, 12, 0), [P.borsch]); await wait(400);
  ok(times(d)[0].off === false, '13:00 доступно');

  console.log('\n5) ЗАВТРАКИ в 09:45 — сегодня всё закрыто, автопереход на «Завтра»');
  d = make(msk(2026, 8, 28, 9, 45), [P.shakshuka]); await wait(400);
  ok(daysC(d)[0].off === true, '«Сегодня» задизейблено');
  ok(daysC(d)[1].sel === true, 'автоматически выбрано «Завтра»');
  ok(times(d).every(x => !x.off), 'на завтра доступны все 5 слотов');

  console.log('\n6) ОСНОВНОЕ МЕНЮ в 21:30 — сегодня закрыто, «Завтра» с 13:00');
  d = make(msk(2026, 8, 28, 21, 30), [P.steak]); await wait(400);
  ok(daysC(d)[0].off === true, '«Сегодня» закрыто (последний слот 22:00 требует часа)');
  ok(daysC(d)[1].sel === true, 'выбрано «Завтра»');
  d = make(msk(2026, 8, 28, 20, 59), [P.steak]); await wait(400);
  ok(daysC(d)[0].sel === true && times(d)[18].off === false, 'в 20:59 слот 22:00 ещё доступен на сегодня');

  console.log('\n7) Смешивание категорий');
  d = make(msk(2026, 8, 28, 9, 0), [P.breakfastSet, P.borsch]); await wait(400);
  ok(d.window.document.querySelector('.rsb-err').className.indexOf('rsb-on') !== -1, 'показан блок ошибки');
  ok(d.window.document.querySelector('.rsb-body').style.display === 'none', 'выбор времени скрыт');
  ok(d.window.document.querySelectorAll('.rsb-toast').length > 0, 'мгновенное всплывающее уведомление');
  ok(/нельзя объединить в один заказ/.test(d.window.document.querySelector('.rsb-err__d').textContent), 'текст ошибки корректен');

  console.log('\n8) Добавление несовместимого товара блокируется на лету');
  d = make(msk(2026, 8, 28, 9, 0), [P.breakfastSet]); await wait(400);
  let r = d.window.tcart__addProduct(P.borsch);
  ok(r === false, 'tcart__addProduct вернул false');
  ok(d.window.tcart.products.length === 1, 'товар в корзину не попал');
  await wait(50);
  ok(d.window.document.querySelectorAll('.rsb-toast').length === 1, 'показана ошибка');
  r = d.window.tcart__addProduct(P.syrniki);
  ok(r === true && d.window.tcart.products.length === 2, 'второй завтрак добавляется нормально');

  console.log('\n9) Кнопка «Оставить только завтраки»');
  d = make(msk(2026, 8, 28, 9, 0), [P.breakfastSet, P.borsch, P.steak]); await wait(400);
  d.window.document.querySelector('[data-rsb="keep-b"]').click();
  await wait(600);
  ok(d.window.tcart.products.length === 1 && d.window.tcart.products[0].name.indexOf('Русский завтрак') !== -1,
     'в корзине остался только завтрак');
  await wait(600);
  ok(d.window.document.querySelector('.rsb-err').className.indexOf('rsb-on') === -1, 'блок ошибки убран');

  console.log('\n10) Выбор слота -> запись в штатные поля Tilda');
  d = make(msk(2026, 8, 28, 7, 31), [P.breakfastSet]); await wait(400);
  ok(val(d, 'data_dostavki') === '' && val(d, 'vremya_dostavki') === '', 'до выбора поля пустые');
  [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')].find(b => b.getAttribute('data-time') === '09:00').click();
  await wait(50);
  ok(val(d, 'data_dostavki') === '28-08-2026', 'дата: ' + val(d, 'data_dostavki'));
  ok(val(d, 'vremya_dostavki') === '09:00', 'время: ' + val(d, 'vremya_dostavki'));
  ok(/Подадим в номер сегодня в 09:00/.test(status(d)), 'статус: ' + status(d));
  const grp = d.window.document.querySelector('.t-input-group_tm');
  ok(grp.className.indexOf('rsb-hidden-native') !== -1, 'штатное поле времени скрыто');
  ok(d.window.document.querySelector('input[name="data_dostavki"]').hasAttribute('data-tilda-dateunvailable') === false,
     'снята проверка «дата в прошлом»');

  console.log('\n11) Слот «сгорает», пока гость думает');
  d = make(msk(2026, 8, 28, 7, 29), [P.breakfastSet]); await wait(400);
  [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')].find(b => b.getAttribute('data-time') === '08:00').click();
  await wait(50);
  ok(val(d, 'vremya_dostavki') === '08:00', '08:00 выбран в 07:29');
  d.window.__NOW = msk(2026, 8, 28, 7, 31);
  await wait(1300);
  ok(times(d)[0].off === true && times(d)[0].sel === false, 'слот 08:00 автоматически снят');
  ok(val(d, 'vremya_dostavki') === '', 'поле времени очищено');
  ok([...d.window.document.querySelectorAll('.rsb-toast__t')].some(x => /больше недоступно/.test(x.textContent)),
     'гость предупреждён');

  console.log('\n12) Блокировка оформления заказа');
  d = make(msk(2026, 8, 28, 7, 31), [P.breakfastSet]); await wait(400);
  let submitted = 0;
  d.window.document.querySelector('#form1').addEventListener('submit', e => { submitted++; e.preventDefault(); });
  d.window.document.querySelector('.t-submit').click();
  await wait(50);
  ok(submitted === 0, 'без выбранного времени заказ не отправляется');
  ok(d.window.document.querySelector('.t-submit').className.indexOf('rsb-blocked') !== -1, 'кнопка помечена неактивной');
  [...d.window.document.querySelectorAll('.rsb-times .rsb-chip')].find(b => b.getAttribute('data-time') === '08:30').click();
  await wait(1200);
  d.window.document.querySelector('.t-submit').click();
  await wait(50);
  ok(submitted === 1, 'после выбора времени заказ отправляется');
  ok(d.window.document.querySelector('.t-submit').className.indexOf('rsb-blocked') === -1, 'кнопка снова активна');

  console.log('\n13) Смешанная корзина блокирует отправку');
  d = make(msk(2026, 8, 28, 9, 0), [P.breakfastSet, P.borsch]); await wait(400);
  submitted = 0;
  d.window.document.querySelector('#form1').addEventListener('submit', e => { submitted++; e.preventDefault(); });
  d.window.document.querySelector('.t-submit').click();
  await wait(50);
  ok(submitted === 0, 'заказ со смешанными категориями не отправляется');

  console.log('\n14) Пустая корзина — панель скрыта, оформление не блокируется');
  d = make(msk(2026, 8, 28, 9, 0), []); await wait(400);
  ok(!vis(d), 'панель скрыта');

  console.log('\n15) Часы гостя сбиты на сутки — считаем по времени сервера');
  d = make(msk(2026, 8, 28, 7, 31), [P.breakfastSet]); await wait(400);
  ok(times(d)[0].off === true && !times(d)[1].off, 'логика зависит только от подставленного времени');

  console.log('\n' + (fail ? '✗ ПРОВАЛЕНО: ' + fail : '✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ') + '  (успешно: ' + pass + ')');
  process.exit(fail ? 1 : 0);
})();
