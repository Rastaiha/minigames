(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const isPersian = document.body.dataset.language === "fa";
  const completeSentence = isPersian
    ? ["بهرام", "که", "گور", "می‌گرفتی", "همه", "عمر", "دیدی", "که", "چگونه", "گور", "بهرام", "گرفت"]
    : ["The", "bat", "flew", "past", "the", "wooden", "bat"];
  const sentence = document.body.dataset.mode === "decoder"
    ? completeSentence.slice(0, -1)
    : completeSentence;
  const ui = isPersian
    ? { play: "پخش", pause: "مکث" }
    : { play: "Play", pause: "Pause" };
  const tokenColors = [
    "#2878c7", "#d05c49", "#8557c9", "#bd7024",
    "#2e8a69", "#bd4f80", "#27858d", "#c9663a",
    "#4a82c7", "#6d943f", "#cc5d68", "#7656b5"
  ];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stepPause = 700;
  const positionMoveDuration = 1200;
  const layerMoveDuration = 720;

  const $ = selector => document.querySelector(selector);
  const createSvg = (tag, attrs = {}) => {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };

  const sleep = milliseconds => new Promise(resolve => {
    window.setTimeout(resolve, reducedMotion ? 0 : milliseconds);
  });

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const easeInOutCubic = value => value < .5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

  const pointOnQuadratic = (start, control, end, progress) => {
    const t = clamp01(progress);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
    };
  };

  const setPosition = (element, point) => {
    element.setAttribute("transform", `translate(${point.x} ${point.y})`);
  };

  const positionActiveLabel = (label, index) => {
    label.setAttribute("x", "0");
    label.setAttribute("y", index % 2 === 0 ? "-14" : "23");
    label.setAttribute("text-anchor", "middle");
  };

  const animate = (duration, onFrame) => new Promise(resolve => {
    if (reducedMotion) {
      onFrame(1);
      resolve();
      return;
    }

    const startedAt = performance.now();
    const frame = now => {
      const rawProgress = clamp01((now - startedAt) / duration);
      onFrame(easeInOutCubic(rawProgress));
      if (rawProgress < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  class StateController {
    constructor({ totalState, transition, reset }) {
      this.totalState = totalState;
      this.transition = transition;
      this.resetVisualization = reset;
      this.state = 0;
      this.playing = false;
      this.playGeneration = 0;
      this.pending = null;

      this.playButton = $("#playBtn");
      this.resetButton = $("#resetBtn");
      this.bindControls();
      this.reset();
    }

    bindControls() {
      this.playButton.addEventListener("click", () => {
        if (this.playing) this.pause();
        else {
          if (this.state >= this.totalState) this.reset();
          this.play();
        }
      });

      this.resetButton.addEventListener("click", () => this.reset());
    }

    updateCopy() {
      $("#progress").style.width = `${this.state / this.totalState * 100}%`;
    }

    setBusy(busy) {
      this.resetButton.disabled = busy;
    }

    async next() {
      if (this.pending || this.state >= this.totalState) return this.pending;
      const nextState = this.state + 1;
      this.state = nextState;
      this.updateCopy();
      this.setBusy(true);

      this.pending = this.transition(nextState).finally(() => {
        this.pending = null;
        this.setBusy(false);
      });
      return this.pending;
    }

    async play() {
      const generation = ++this.playGeneration;
      this.playing = true;
      this.playButton.textContent = ui.pause;

      while (this.playing && generation === this.playGeneration && this.state < this.totalState) {
        await this.next();
        if (
          this.playing
          && generation === this.playGeneration
          && this.state < this.totalState
        ) await sleep(stepPause);
      }

      if (generation === this.playGeneration) this.pause();
    }

    pause() {
      this.playGeneration += 1;
      this.playing = false;
      this.playButton.textContent = ui.play;
    }

    reset() {
      if (this.pending) return;
      this.pause();
      this.state = 0;
      this.resetVisualization();
      this.updateCopy();
      this.setBusy(false);
    }
  }

  const buildTokenStrip = () => {
    const strip = $("#tokenStrip");
    const chips = sentence.map((token, index) => {
      const chip = document.createElement("span");
      chip.className = "token-chip";
      chip.dataset.index = String(index);
      const startsVerse = isPersian && index === 6;
      chip.textContent = index === 0 || startsVerse ? token : ` ${token}`;
      chip.style.setProperty("--token-color", tokenColors[index % tokenColors.length]);
      return chip;
    });
    if (isPersian) {
      const lineBreak = document.createElement("br");
      lineBreak.className = "verse-break";
      lineBreak.setAttribute("aria-hidden", "true");
      chips.splice(6, 0, lineBreak);
    }
    strip.replaceChildren(...chips);
    return [...strip.querySelectorAll(".token-chip")];
  };

  class EncoderVisualization {
    constructor() {
      this.tokens = sentence.map((word, occurrence) => ({ word, occurrence }));
      this.vocabulary = isPersian
        ? [
          ["بهرام", 120, 300], ["که", 230, 210], ["گور", 360, 250],
          ["می‌گرفتی", 170, 100], ["همه", 300, 380], ["عمر", 440, 110],
          ["دیدی", 470, 350], ["چگونه", 560, 220], ["گرفت", 520, 420],
          ["گورخر", 720, 90], ["شکار", 800, 145], ["دشت", 630, 75],
          ["جانور", 740, 190], ["تیر", 840, 70], ["قبر", 700, 370],
          ["مرگ", 805, 420], ["خاک", 620, 410], ["آرامگاه", 780, 330],
          ["گورستان", 850, 365], ["روز", 80, 65], ["شب", 95, 170],
          ["راه", 255, 55], ["زمان", 330, 70], ["جهان", 400, 450],
          ["نگاه", 260, 440], ["پادشاه", 85, 400], ["زندگی", 390, 320],
          ["رفتن", 520, 60], ["آمدن", 540, 155], ["سخن", 310, 155],
          ["دل", 195, 350], ["خانه", 580, 300], ["اسب", 670, 145],
          ["سنگ", 650, 335], ["خاموشی", 760, 450], ["همیشه", 455, 260],
          ["دیدن", 330, 430], ["کوه", 175, 250], ["آسمان", 275, 285],
          ["زمین", 565, 450]
        ]
        : [
          ["The", 118, 292], ["bat", 210, 250], ["flew", 158, 92],
          ["past", 380, 132], ["the", 104, 334], ["wooden", 698, 382],
          ["bird", 730, 84], ["wing", 805, 142], ["cave", 640, 72],
          ["animal", 755, 198], ["wood", 618, 410], ["baseball", 790, 352],
          ["ball", 835, 424], ["chair", 548, 430], ["quietly", 320, 390],
          ["mammal", 674, 164], ["nocturnal", 812, 72], ["flying", 620, 120],
          ["timber", 574, 372], ["club", 752, 438], ["swing", 840, 310]
        ];
      this.baseByWord = Object.fromEntries(
        this.vocabulary.map(([word, x, y]) => [word, { x, y }])
      );
      this.base = this.tokens.map(token => ({ ...this.baseByWord[token.word] }));
      this.positionOffsets = isPersian
        ? this.tokens.map((_, index) => ({
          x: Math.round(Math.cos(index * 2.13) * (22 + index % 3 * 7)),
          y: Math.round(Math.sin(index * 1.71) * (20 + index % 4 * 5))
        }))
        : [
          { x: -20, y: 24 }, { x: -34, y: -24 }, { x: 18, y: -28 },
          { x: 24, y: -7 }, { x: 10, y: 34 }, { x: -28, y: 8 },
          { x: 40, y: 28 }
        ];
      this.positioned = this.base.map((point, index) => ({
        x: point.x + this.positionOffsets[index].x * 2,
        y: point.y + this.positionOffsets[index].y * 2
      }));
      this.finalTargets = isPersian
        ? [
          { x: 470, y: 86 }, { x: 570, y: 160 }, { x: 720, y: 125 },
          { x: 625, y: 205 }, { x: 430, y: 270 }, { x: 350, y: 335 },
          { x: 475, y: 405 }, { x: 560, y: 300 }, { x: 635, y: 255 },
          { x: 710, y: 385 }, { x: 805, y: 285 }, { x: 835, y: 440 }
        ]
        : [
          { x: 500, y: 102 }, { x: 695, y: 118 }, { x: 610, y: 158 },
          { x: 448, y: 242 }, { x: 470, y: 334 }, { x: 620, y: 356 },
          { x: 730, y: 392 }
        ];
      this.layerCount = 8;
      this.semanticAnchorWords = new Set(isPersian
        ? [
          "گورخر", "شکار", "دشت", "جانور", "تیر", "اسب",
          "قبر", "مرگ", "خاک", "آرامگاه", "گورستان", "سنگ", "خاموشی"
        ]
        : [
          "bird", "wing", "cave", "animal", "mammal", "nocturnal", "flying",
          "wood", "baseball", "ball", "timber", "club", "swing"
        ]);
      this.totalState = 12;
      this.renderedPositions = this.base.map(point => ({ ...point }));
      this.tokenChips = buildTokenStrip();
      this.vocabElements = [];
      this.activeElements = [];
      this.positionLines = [];
      this.build();

      this.controller = new StateController({
        totalState: this.totalState,
        transition: state => this.transition(state),
        reset: () => this.reset()
      });
    }

    build() {
      this.buildVocabulary();
      this.buildPositionLines();
      this.buildActiveTokens();
    }

    buildVocabulary() {
      const layer = $("#vocabLayer");
      this.vocabulary.forEach(([word, x, y]) => {
        const group = createSvg("g", { class: "vocab-group", "data-word": word });
        const dot = createSvg("circle", { class: "vocab-dot", cx: x, cy: y, r: 5.5 });
        const label = createSvg("text", {
          class: "vocab-label",
          x: x + (isPersian ? -10 : 9),
          y: y + 4
        });
        label.textContent = word;
        group.append(dot, label);
        layer.appendChild(group);
        this.vocabElements.push({ group, dot, label, word, x, y });
      });
    }

    buildPositionLines() {
      const layer = $("#positionLayer");
      this.base.forEach((start, index) => {
        const end = this.positioned[index];
        const line = createSvg("line", {
          class: "position-line",
          x1: start.x, y1: start.y, x2: end.x, y2: end.y
        });
        layer.appendChild(line);
        this.positionLines.push(line);
      });
    }

    buildActiveTokens() {
      const layer = $("#activeLayer");
      this.tokens.forEach((token, index) => {
        const group = createSvg("g", { class: "active-token", "data-index": index });
        group.style.setProperty("--token-color", tokenColors[index % tokenColors.length]);
        const dot = createSvg("circle", { class: "active-dot", cx: 0, cy: 0, r: 8 });
        const label = createSvg("text", { class: "active-label" });
        positionActiveLabel(label, index);
        label.textContent = token.word;
        group.append(dot, label);
        setPosition(group, this.base[index]);
        layer.appendChild(group);
        this.activeElements.push({ group, dot, label });
      });
    }

    trajectory(index, layer) {
      const progress = clamp01(layer / this.layerCount);
      const start = this.positioned[index];
      const end = this.finalTargets[index];
      const remaining = 1 - progress;
      const xNoise = Math.sin((index + 1) * 17.3 + layer * 11.7) * 56 * remaining;
      const yNoise = Math.cos((index + 1) * 9.1 + layer * 15.4) * 46 * remaining;
      return {
        x: start.x + (end.x - start.x) * progress + xNoise,
        y: start.y + (end.y - start.y) * progress + yNoise
      };
    }

    setMeaningStage(enabled) {
      this.vocabElements.forEach(({ group, word }) => {
        if (this.semanticAnchorWords.has(word)) group.classList.toggle("hidden", !enabled);
      });
    }

    async transition(state) {
      if (state === 1) {
        const sentenceWords = new Set(sentence);
        this.vocabElements.forEach(item => item.group.classList.toggle("highlight", sentenceWords.has(item.word)));
        this.tokenChips.forEach(chip => chip.classList.add("visible"));
        await sleep(520);
        return;
      }

      if (state === 2) {
        this.activeElements.forEach(({ group }, index) => {
          setPosition(group, this.base[index]);
          group.classList.add("visible");
        });
        await sleep(180);
        this.vocabElements.forEach(({ group }) => group.classList.add("hidden"));
        await sleep(520);
        return;
      }

      if (state === 3) {
        this.positionLines.forEach(line => line.classList.add("show"));
        const from = this.renderedPositions.map(point => ({ ...point }));
        await animate(positionMoveDuration, progress => {
          this.renderedPositions = from.map((point, index) => ({
            x: point.x + (this.positioned[index].x - point.x) * progress,
            y: point.y + (this.positioned[index].y - point.y) * progress
          }));
          this.renderedPositions.forEach((point, index) => setPosition(this.activeElements[index].group, point));
        });
        return;
      }

      if (state >= 4 && state <= 11) {
        const layer = state - 3;
        this.positionLines.forEach(line => line.classList.remove("show"));
        const from = this.renderedPositions.map(point => ({ ...point }));
        const to = this.tokens.map((_, index) => this.trajectory(index, layer));
        this.setMeaningStage(layer >= 4);

        await animate(layerMoveDuration, progress => {
          this.renderedPositions = from.map((point, index) => ({
            x: point.x + (to[index].x - point.x) * progress,
            y: point.y + (to[index].y - point.y) * progress
          }));
          this.renderedPositions.forEach((point, index) => setPosition(this.activeElements[index].group, point));
        });
        return;
      }

      if (state === 12) {
        const animalIndex = isPersian ? 2 : 1;
        const objectIndex = isPersian ? 9 : 6;
        this.activeElements.forEach(({ group, dot }, index) => {
          dot.setAttribute("r", index === animalIndex || index === objectIndex ? "11" : "8");
        });
        await sleep(500);
      }
    }

    reset() {
      this.renderedPositions = this.base.map(point => ({ ...point }));
      this.tokenChips.forEach(chip => chip.className = "token-chip");
      this.vocabElements.forEach(({ group, dot }) => {
        group.className.baseVal = "vocab-group";
        dot.setAttribute("r", "5.5");
      });
      this.activeElements.forEach(({ group, dot, label }, index) => {
        group.className.baseVal = "active-token";
        dot.setAttribute("r", "8");
        label.textContent = this.tokens[index].word;
        positionActiveLabel(label, index);
        setPosition(group, this.base[index]);
      });
      this.positionLines.forEach(line => line.classList.remove("show"));
    }
  }

  class DecoderVisualization {
    constructor() {
      this.tokens = sentence.map((word, occurrence) => ({ word, occurrence }));
      this.nextTokens = isPersian
        ? ["که", "گور", "می‌گرفتی", "همه", "عمر", "دیدی", "که", "چگونه", "گور", "بهرام", "گرفت"]
        : ["bat", "flew", "past", "the", "wooden", "bat"];
      this.vocabulary = isPersian
        ? [
          ["بهرام", 120, 300], ["که", 230, 210], ["گور", 360, 250],
          ["می‌گرفتی", 650, 95], ["همه", 560, 160], ["عمر", 460, 110],
          ["دیدی", 500, 350], ["چگونه", 590, 240], ["گرفت", 680, 415],
          ["؟", 830, 440], ["گورخر", 720, 78], ["شکار", 815, 135],
          ["دشت", 625, 65], ["جانور", 755, 190], ["قبر", 710, 350],
          ["مرگ", 810, 400], ["خاک", 615, 405], ["آرامگاه", 790, 315],
          ["گورستان", 850, 350], ["روز", 80, 65], ["شب", 95, 170],
          ["راه", 255, 55], ["زمان", 330, 70], ["جهان", 400, 450],
          ["نگاه", 260, 440], ["پادشاه", 85, 400], ["زندگی", 390, 320],
          ["رفتن", 520, 60], ["آمدن", 540, 155], ["سخن", 310, 155],
          ["دل", 195, 350], ["خانه", 580, 300], ["اسب", 670, 145],
          ["سنگ", 650, 335], ["خاموشی", 760, 450], ["همیشه", 455, 260],
          ["دیدن", 330, 430], ["کوه", 175, 250], ["آسمان", 275, 285],
          ["زمین", 565, 450]
        ]
        : [
          ["The", 118, 292], ["bat", 210, 250], ["flew", 700, 110],
          ["past", 610, 170], ["the", 420, 315], ["wooden", 690, 360],
          ["?", 810, 420], ["hung", 780, 72], ["slept", 820, 138],
          ["squeaked", 620, 70], ["bird", 760, 205], ["ball", 292, 350],
          ["chair", 350, 390], ["wood", 250, 410], ["cave", 825, 245],
          ["quietly", 520, 82], ["heavy", 555, 390], ["old", 600, 340],
          ["through", 500, 190], ["room", 118, 405], ["ran", 365, 90]
        ];
      this.embeddingByWord = Object.fromEntries(
        this.vocabulary.map(([word, x, y]) => [word, { x, y }])
      );
      this.base = this.tokens.map(token => ({ ...this.embeddingByWord[token.word] }));
      this.positionOffsets = isPersian
        ? this.tokens.map((_, index) => ({
          x: Math.round(Math.cos(index * 2.13) * (22 + index % 3 * 7)),
          y: Math.round(Math.sin(index * 1.71) * (20 + index % 4 * 5))
        }))
        : [
          { x: -20, y: 24 }, { x: -34, y: -24 }, { x: 18, y: -28 },
          { x: 24, y: -7 }, { x: 10, y: 34 }, { x: -28, y: 8 },
          { x: 40, y: 28 }
        ];
      this.positioned = this.base.map((point, index) => ({
        x: point.x + this.positionOffsets[index].x * 2,
        y: point.y + this.positionOffsets[index].y * 2
      }));

      // Layer four is the visual checkpoint where causal context is rich
      // enough to constrain a useful next-token prediction.
      this.contextTargets = isPersian
        ? [
          { x: 410, y: 245 }, { x: 690, y: 125 }, { x: 600, y: 180 },
          { x: 520, y: 120 }, { x: 445, y: 180 }, { x: 380, y: 275 },
          { x: 470, y: 360 }, { x: 565, y: 295 }, { x: 700, y: 370 },
          { x: 610, y: 420 }, { x: 760, y: 285 }, { x: 825, y: 420 }
        ]
        : [
          { x: 300, y: 230 }, { x: 590, y: 130 }, { x: 548, y: 210 },
          { x: 438, y: 248 }, { x: 535, y: 325 }, { x: 340, y: 338 },
          { x: 620, y: 395 }
        ];
      this.contextTargets = this.contextTargets.slice(0, this.tokens.length);
      this.contextControls = isPersian
        ? this.contextTargets.map((target, index) => ({
          x: (this.positioned[index].x + target.x) / 2 + Math.sin(index * 2.4) * 80,
          y: (this.positioned[index].y + target.y) / 2 + Math.cos(index * 1.8) * 70
        }))
        : [
          { x: 210, y: 320 }, { x: 330, y: 96 }, { x: 640, y: 132 },
          { x: 540, y: 190 }, { x: 390, y: 355 }, { x: 520, y: 420 },
          { x: 385, y: 390 }
        ];
      this.contextControls = this.contextControls.slice(0, this.tokens.length);

      // Near—not exactly on—the next word embedding, so both the moving
      // representation and its fixed vocabulary target remain legible.
      const predictionOffsets = isPersian
        ? this.nextTokens.map((_, index) => ({
          x: Math.round(Math.cos(index * 1.9) * 30),
          y: Math.round(Math.sin(index * 2.3) * 28)
        }))
        : [
          { x: -28, y: -24 }, { x: -30, y: 28 }, { x: 22, y: 28 },
          { x: -28, y: -22 }, { x: -32, y: -27 }, { x: 32, y: 32 },
          { x: -36, y: -28 }
        ].slice(0, this.nextTokens.length);
      this.predictionTargets = this.nextTokens.map((word, index) => {
        const target = this.embeddingByWord[word];
        return {
          x: target.x + predictionOffsets[index].x,
          y: target.y + predictionOffsets[index].y
        };
      });
      this.predictionControls = isPersian
        ? this.predictionTargets.map((target, index) => ({
          x: (this.contextTargets[index].x + target.x) / 2 + Math.cos(index * 1.7) * 75,
          y: (this.contextTargets[index].y + target.y) / 2 + Math.sin(index * 2.1) * 65
        }))
        : [
          { x: 250, y: 220 }, { x: 630, y: 100 }, { x: 638, y: 180 },
          { x: 430, y: 292 }, { x: 620, y: 350 }, { x: 300, y: 300 },
          { x: 720, y: 435 }
        ];
      this.predictionControls = this.predictionControls.slice(0, this.nextTokens.length);

      this.contextLayerCount = 4;
      this.predictionLayerCount = 4;
      this.contextAnchorWords = new Set(isPersian
        ? [
          "گورخر", "شکار", "دشت", "جانور", "اسب",
          "قبر", "مرگ", "خاک", "آرامگاه", "گورستان", "سنگ", "خاموشی"
        ]
        : [
          "hung", "slept", "squeaked", "bird", "cave",
          "ball", "chair", "wood", "heavy", "old"
        ]);
      this.totalState = 13;
      this.renderedPositions = this.base.map(point => ({ ...point }));
      this.tokenChips = buildTokenStrip();
      this.vocabElements = [];
      this.activeElements = [];
      this.positionLines = [];
      this.build();

      this.controller = new StateController({
        totalState: this.totalState,
        transition: state => this.transition(state),
        reset: () => this.reset()
      });
    }

    build() {
      this.buildVocabulary();
      this.buildPositionLines();
      this.buildActiveTokens();
    }

    buildVocabulary() {
      const layer = $("#vocabLayer");
      this.vocabulary.forEach(([word, x, y]) => {
        const group = createSvg("g", {
          class: "vocab-group",
          "data-word": word
        });
        const dot = createSvg("circle", {
          class: "vocab-dot",
          cx: x,
          cy: y,
          r: 5.5
        });
        const label = createSvg("text", {
          class: "vocab-label",
          x: x + (isPersian ? -10 : 9),
          y: y + 4
        });
        label.textContent = word;
        group.append(dot, label);
        layer.appendChild(group);
        this.vocabElements.push({ group, dot, label, word, x, y });
      });
    }

    buildPositionLines() {
      const layer = $("#positionLayer");
      this.base.forEach((start, index) => {
        const end = this.positioned[index];
        const line = createSvg("line", {
          class: "position-line",
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y
        });
        layer.appendChild(line);
        this.positionLines.push(line);
      });
    }

    buildActiveTokens() {
      const layer = $("#activeLayer");
      this.tokens.forEach((token, index) => {
        const group = createSvg("g", {
          class: "active-token",
          "data-index": index
        });
        group.style.setProperty("--token-color", tokenColors[index % tokenColors.length]);
        const dot = createSvg("circle", {
          class: "active-dot",
          cx: 0,
          cy: 0,
          r: 8
        });
        const label = createSvg("text", {
          class: "active-label"
        });
        positionActiveLabel(label, index);
        label.textContent = token.word;
        group.append(dot, label);
        setPosition(group, this.base[index]);
        layer.appendChild(group);
        this.activeElements.push({ group, dot, label });
      });
    }

    contextPoint(index, layer) {
      const progress = clamp01(layer / this.contextLayerCount);
      const point = pointOnQuadratic(
        this.positioned[index],
        this.contextControls[index],
        this.contextTargets[index],
        progress
      );
      const remaining = 1 - progress;
      return {
        x: point.x + Math.sin((index + 2) * 13.4 + layer * 9.7) * 48 * remaining,
        y: point.y + Math.cos((index + 1) * 8.8 + layer * 14.1) * 42 * remaining
      };
    }

    predictionPoint(index, layer) {
      const progress = clamp01(layer / this.predictionLayerCount);
      const point = pointOnQuadratic(
        this.contextTargets[index],
        this.predictionControls[index],
        this.predictionTargets[index],
        progress
      );
      const remaining = 1 - progress;
      return {
        x: point.x + Math.cos((index + 1) * 16.2 + layer * 12.5) * 52 * remaining,
        y: point.y + Math.sin((index + 3) * 7.6 + layer * 10.8) * 46 * remaining
      };
    }

    trajectory(index, overallLayer) {
      if (overallLayer <= this.contextLayerCount) {
        return this.contextPoint(index, overallLayer);
      }
      return this.predictionPoint(index, overallLayer - this.contextLayerCount);
    }

    setContextExamples(enabled) {
      this.vocabElements.forEach(({ group, word }) => {
        if (this.contextAnchorWords.has(word)) group.classList.toggle("hidden", !enabled);
      });
    }

    async moveToLayer(overallLayer) {
      const from = this.renderedPositions.map(point => ({ ...point }));
      const to = this.tokens.map((_, index) => this.trajectory(index, overallLayer));
      await animate(layerMoveDuration, progress => {
        this.renderedPositions = from.map((point, index) => ({
          x: point.x + (to[index].x - point.x) * progress,
          y: point.y + (to[index].y - point.y) * progress
        }));
        this.renderedPositions.forEach((point, index) => {
          setPosition(this.activeElements[index].group, point);
        });
      });
    }

    async transition(state) {
      if (state === 1) {
        const sentenceWords = new Set(sentence);
        this.vocabElements.forEach(item => {
          item.group.classList.toggle("highlight", sentenceWords.has(item.word));
        });
        this.tokenChips.forEach(chip => chip.classList.add("visible"));
        await sleep(520);
        return;
      }

      if (state === 2) {
        this.activeElements.forEach(({ group }, index) => {
          setPosition(group, this.base[index]);
          group.classList.add("visible");
        });
        await sleep(180);
        this.vocabElements.forEach(({ group }) => group.classList.add("hidden"));
        await sleep(520);
        return;
      }

      if (state === 3) {
        this.positionLines.forEach(line => line.classList.add("show"));
        const from = this.renderedPositions.map(point => ({ ...point }));
        await animate(positionMoveDuration, progress => {
          this.renderedPositions = from.map((point, index) => ({
            x: point.x + (this.positioned[index].x - point.x) * progress,
            y: point.y + (this.positioned[index].y - point.y) * progress
          }));
          this.renderedPositions.forEach((point, index) => {
            setPosition(this.activeElements[index].group, point);
          });
        });
        return;
      }

      if (state >= 4 && state <= 7) {
        const layer = state - 3;
        this.positionLines.forEach(line => line.classList.remove("show"));
        this.setContextExamples(layer >= 3);
        await this.moveToLayer(layer);
        return;
      }

      if (state === 8) {
        this.vocabElements.forEach(({ group, word }) => {
          if (this.contextAnchorWords.has(word)) group.classList.remove("hidden");
        });
        await sleep(650);
        return;
      }

      if (state >= 9 && state <= 12) {
        const predictionLayer = state - 8;
        const overallLayer = this.contextLayerCount + predictionLayer;
        if (state === 9) {
          this.vocabElements.forEach(({ group, word }) => {
            if (this.contextAnchorWords.has(word)) group.classList.add("hidden");
          });
        }
        this.activeElements.forEach(({ group }) => {
          group.classList.add("predicting");
        });
        await this.moveToLayer(overallLayer);
        return;
      }

      if (state === 13) {
        const targetWords = new Set(this.nextTokens);
        this.vocabElements.forEach(({ group, word }) => {
          group.classList.remove("highlight");
          group.style.transitionDelay = "0ms";
          group.classList.remove("hidden");
          group.classList.toggle("target", targetWords.has(word));
        });
        this.activeElements.forEach(({ dot }) => {
          dot.setAttribute("r", "9");
        });
        await sleep(280);
      }
    }

    reset() {
      this.renderedPositions = this.base.map(point => ({ ...point }));
      this.tokenChips.forEach(chip => chip.className = "token-chip");
      this.vocabElements.forEach(({ group, dot }) => {
        group.className.baseVal = "vocab-group";
        group.style.transitionDelay = "0ms";
        dot.setAttribute("r", "5.5");
      });
      this.activeElements.forEach(({ group, dot, label }, index) => {
        group.className.baseVal = "active-token";
        dot.setAttribute("r", "8");
        label.textContent = this.tokens[index].word;
        positionActiveLabel(label, index);
        setPosition(group, this.base[index]);
      });
      this.positionLines.forEach(line => line.classList.remove("show"));
    }
  }

  const mode = document.body.dataset.mode;
  if (mode === "encoder") new EncoderVisualization();
  else if (mode === "decoder") new DecoderVisualization();
})();
