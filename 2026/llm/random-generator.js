(() => {
  const MICRO_TOKENS = Object.freeze([
    "ا", "ب", "پ", "ت", "ج", "چ", "خ", "د", "ر", "ز", "س", "ش", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"
  ]);

  const FRAGMENT_TOKENS = Object.freeze([
    "ار", "ان", "ام", "اد", "اش", "بر", "پر", "تر", "را", "ری", "رو", "ژا", "سا", "سی", "شا", "شو",
    "تا", "تی", "تو", "چا", "خو", "دا", "دی", "فا", "فر", "گر", "گی", "کا", "کر", "لا", "ما", "می",
    "نا", "نی", "پا", "پو", "ها", "هی", "یا", "ور", "وش", "ند", "ست", "زم", "کل", "گل", "شم", "نو"
  ]);

  const WORD_TOKENS = Object.freeze([
    "امروز", "فردا", "خانه", "مدرسه", "دانشگاه", "کتاب", "کلمه", "جمله", "داستان", "سؤال", "پاسخ", "مدل",
    "داده", "آموزش", "فکر", "زبان", "تصویر", "پنجره", "درخت", "باران", "آسمان", "زمین", "دریا", "شهر",
    "خیابان", "دوست", "مردم", "کودک", "رایانه", "جهان", "زندگی", "احتمال", "انتخاب", "حرکت", "تغییر",
    "شروع", "پایان", "روشن", "تاریک", "بزرگ", "کوچک", "پیچیده", "ممکن", "می‌بیند", "می‌گوید", "می‌رود"
  ]);

  const PUNCTUATION = Object.freeze(["،", "؛", "؟", "."]);

  function randomIndex(limit) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % limit;
  }

  function visibleLength(token) {
    return Array.from(token.replace(/‌/g, "")).length;
  }

  function pickShortBiased(tokens) {
    const weights = tokens.map((token) => Math.max(1, 7 - visibleLength(token)) ** 2);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = randomIndex(total);

    for (let index = 0; index < tokens.length; index++) {
      if (roll < weights[index]) return tokens[index];
      roll -= weights[index];
    }

    return tokens[0];
  }

  function chooseTokenClass() {
    const roll = randomIndex(100);
    if (roll < 64) return { tokens: MICRO_TOKENS, joinChance: 84 };
    if (roll < 92) return { tokens: FRAGMENT_TOKENS, joinChance: 68 };
    return { tokens: WORD_TOKENS, joinChance: 8 };
  }

  function generatePieces(limit = 56) {
    const pieces = [];
    let joinedRun = 0;

    while (pieces.length < limit) {
      if (pieces.length > 3 && randomIndex(100) < 6) {
        pieces.push({ text: PUNCTUATION[randomIndex(PUNCTUATION.length)], joinLeft: true });
        joinedRun = 0;
        continue;
      }

      const tokenClass = chooseTokenClass();
      const canJoin = pieces.length > 0 && joinedRun < 4 && !PUNCTUATION.includes(pieces.at(-1).text);
      const joinLeft = canJoin && randomIndex(100) < tokenClass.joinChance;
      pieces.push({ text: pickShortBiased(tokenClass.tokens), joinLeft });
      joinedRun = joinLeft ? joinedRun + 1 : 0;
    }

    return pieces;
  }

  function generateText(limit = 56) {
    return generatePieces(limit).reduce((text, piece, index) => {
      const separator = index > 0 && !piece.joinLeft ? " " : "";
      return text + separator + piece.text;
    }, "");
  }

  window.RandomPersianModel = Object.freeze({ generatePieces, generateText });
})();
