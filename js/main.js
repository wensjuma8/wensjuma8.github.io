//Register Service Worker
//if service worker is not available, no need for IDB
if (navigator.serviceWorker){
    navigator.serviceWorker.register('./sw.js', { scope: './'}).then(function() {
        console.log('Service Worker Installed');
    });
}
dbPromise = function openDatabase() {
    return idb.open('currency_converter', 1, function(upgradeDb) {
        switch (upgradeDb.oldVersion) {
            case 0:
                const currency = upgradeDb.createObjectStore('currencies', {keyPath: 'id'});
                const converted = upgradeDb.createObjectStore('converted', {keyPath: 'id'});
        }
    })
}

function createElement(el, text, value) {
    var option = document.createElement(el);
    option.text = `${text} (${value})`;
    option.value = value;
    return option;
}

function appendToTag(tag, ele) {
    var select = document.getElementById(tag);
    select.appendChild(ele);
}

function getValue(id, type) {
    let get_id =  document.getElementById(id);
    if (type === 'input') {
        let value = get_id.value;
        return value;
    }
    let value = get_id.options[get_id.selectedIndex].value;
    return value;
}

function sortKey(a, b) {
    if (a.currencyName < b.currencyName) return -1;
    if (a.currencyName > b.currencyName) return 1;
    return 0;
}

function addCurrencyToDatabase(currencies) {
    dbPromise().then(function(db) {
        if (!db) return;
        let tx = db.transaction('currencies', 'readwrite');
        let currencyStore = tx.objectStore('currencies');
        currencies.forEach(currency => {
            currencyStore.put(currency)
        });
        return tx.complete;
    });
}

function storeConversionRates(...rates) {
    dbPromise().then(function(db) {
        if (!db) return;
        let tx = db.transaction('converted', 'readwrite');
        let currencyStore = tx.objectStore('converted');
        rates.forEach((rate) => {
            currencyStore.put(rate);
        })
        return tx.complete;
    });
}

function getConversionRates(convert_currency, convert_currency_reverse) {
    return dbPromise().then(function(db) {
        if (!db) return;
        let tx = db.transaction('converted');
        let currencyStore = tx.objectStore('converted');
        return currencyStore.get(convert_currency);
    }).then(function(rate) {
        if (!rate) return fetchCurrencyRates(convert_currency, convert_currency_reverse, 1);
        calculateConversion(rate.val);
        fetchCurrencyRates(convert_currency, convert_currency_reverse, 0);
    })
}

function fetchCurrencyRates(convert_currency, convert_currency_reverse, calculate) {
    fetch(`https://free.currencyconverterapi.com/api/v5/convert?q=${convert_currency},${convert_currency_reverse}&compact=y`).then(function(response) {
        return response.json();
    }).then(function(myjson) {
        const rate = myjson[convert_currency].val;
        const result = {id: convert_currency, val: myjson[convert_currency].val};
        const result_reverse = {id: convert_currency_reverse, val: myjson[convert_currency_reverse].val};
        storeConversionRates(result, result_reverse);
        if (calculate === 1) calculateConversion(rate);
    }).catch(function() {
        if (calculate === 1) {
            document.getElementById('answer').innerText = 'You are not connected';
            document.getElementById('loading').style.display= 'none';     
        }
    });
}

function calculateConversion(rate) {
    const amount = (getValue('amount', 'input')) == '' ? 1 : getValue('amount', 'input');
    let total = Math.round(rate * amount * 100) / 100;
    document.getElementById('loading').style.display= 'none';
    document.getElementById('answer').innerText = `Converted Currency: ${total}`
}

function fetchCurrencyAPI() {
    return fetch('https://free.currencyconverterapi.com/api/v5/currencies').then(function(response) {
        return response.json();
    }).then(function(datas) {
        let values = datas.results;
        values = Object.values(values);
        showDataOnForm(values);
        addCurrencyToDatabase(values);
    }).catch(function(e) {
      console.log(e);
      console.log('Ooops, seems you have no connection');
    });
}

function getCurrency() {
    //Retrieve currency From Database
    dbPromise().then(function(db) {
        if (!db) return;
        let tx = db.transaction('currencies');
        let currencyStore = tx.objectStore('currencies');
        let currency_count = currencyStore.count();
        currency_count.then(function(count) {
            if (count <= 0) return;
            return currencyStore.getAll();
        }).then(function name(cursor) {
            showDataOnForm(cursor); 
        }).catch(function() {
            return fetchCurrencyAPI();
        })
    })
}

function showDataOnForm(values) {
   return values.sort(sortKey).map(function(s) {
        let countryElement = createElement('option', s.currencyName, s.id);
        let countryElement2 = createElement('option', s.currencyName, s.id);
        appendToTag('currency-1', countryElement);
        appendToTag('currency-2', countryElement2);
        document.getElementById('form').style.display = 'block';
        document.getElementById('loading').style.display= 'none';
    })
}
window.addEventListener('DOMContentLoaded', function() {
    getCurrency();
    document.getElementById('form').addEventListener('submit', function(event) {
        event.preventDefault();
        document.getElementById('loading').style.display= 'block';
        const currency_1 = getValue('currency-1');
        const currency_2 = getValue('currency-2');       
        const convert_currency = currency_1 + '_' + currency_2;
        let convert_currency_reverse = currency_2 + '_' + currency_1;
        getConversionRates(convert_currency, convert_currency_reverse);
    });
});