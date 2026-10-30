// The phone number field: country picker, example number and the "not a valid number" message.
// Used at sign-up, on the welcome step and wherever a profile takes a phone number.
// {example} is an example number for the chosen country, {country} its name.

export const phone_en = {
  country: 'Country code',
  chooseCountry: 'Choose country code, now {country}',
  search: 'Search country or code',
  noMatch: 'No country found',
  example: 'Example: {example}',
  invalid: 'This does not look like a phone number in {country}. Check the number or the country code.',
  invalidGeneric: 'Check the phone number and the country code.',
  close: 'Close',
};

export type PhoneText = typeof phone_en;

export const phone_sw: PhoneText = {
  country: 'Msimbo wa nchi',
  chooseCountry: 'Chagua msimbo wa nchi, sasa {country}',
  search: 'Tafuta nchi au msimbo',
  noMatch: 'Hakuna nchi iliyopatikana',
  example: 'Mfano: {example}',
  invalid: 'Hii haionekani kuwa namba ya simu ya {country}. Hakiki namba au msimbo wa nchi.',
  invalidGeneric: 'Hakiki namba ya simu na msimbo wa nchi.',
  close: 'Funga',
};

export const phone_fr: PhoneText = {
  country: 'Indicatif du pays',
  chooseCountry: 'Choisir l’indicatif du pays, actuellement {country}',
  search: 'Rechercher un pays ou un indicatif',
  noMatch: 'Aucun pays trouvé',
  example: 'Exemple : {example}',
  invalid: 'Ce numéro ne semble pas valide pour {country}. Vérifiez le numéro ou l’indicatif.',
  invalidGeneric: 'Vérifiez le numéro de téléphone et l’indicatif du pays.',
  close: 'Fermer',
};

export const phone_it: PhoneText = {
  country: 'Prefisso del paese',
  chooseCountry: 'Scegli il prefisso del paese, ora {country}',
  search: 'Cerca paese o prefisso',
  noMatch: 'Nessun paese trovato',
  example: 'Esempio: {example}',
  invalid: 'Non sembra un numero di telefono valido per {country}. Controlla il numero o il prefisso.',
  invalidGeneric: 'Controlla il numero di telefono e il prefisso del paese.',
  close: 'Chiudi',
};

export const phone_de: PhoneText = {
  country: 'Ländervorwahl',
  chooseCountry: 'Ländervorwahl wählen, derzeit {country}',
  search: 'Land oder Vorwahl suchen',
  noMatch: 'Kein Land gefunden',
  example: 'Beispiel: {example}',
  invalid: 'Das sieht nicht nach einer Telefonnummer in {country} aus. Bitte Nummer oder Ländervorwahl prüfen.',
  invalidGeneric: 'Bitte Telefonnummer und Ländervorwahl prüfen.',
  close: 'Schließen',
};

export const phone_pl: PhoneText = {
  country: 'Kierunkowy kraju',
  chooseCountry: 'Wybierz kierunkowy kraju, teraz {country}',
  search: 'Szukaj kraju lub kierunkowego',
  noMatch: 'Nie znaleziono kraju',
  example: 'Przykład: {example}',
  invalid: 'To nie wygląda na numer telefonu w kraju: {country}. Sprawdź numer lub kierunkowy.',
  invalidGeneric: 'Sprawdź numer telefonu i kierunkowy kraju.',
  close: 'Zamknij',
};

export const phone_zh: PhoneText = {
  country: '国家/地区代码',
  chooseCountry: '选择国家/地区代码，当前为{country}',
  search: '搜索国家/地区或代码',
  noMatch: '未找到国家/地区',
  example: '示例：{example}',
  invalid: '这看起来不像{country}的电话号码。请检查号码或国家/地区代码。',
  invalidGeneric: '请检查电话号码和国家/地区代码。',
  close: '关闭',
};
