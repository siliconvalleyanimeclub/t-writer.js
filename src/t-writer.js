const defaultOptions = {
  loop: false,
  animateCursor: true,
  preventWordWrap: false,
  blinkSpeed: 400,
  typeSpeed: 90,
  deleteSpeed: 40,
  typeSpeedMin: 65,
  typeSpeedMax: 115,
  deleteSpeedMin: 40,
  deleteSpeedMax: 90,
  typeClass: 'type-span',
  cursorClass: 'cursor-span',
  typeColor: 'black',
  cursorColor: 'black',
  wordWrapLineLengthLimit: 0,
  onAddChar: () => {},
  onDeleteChar: () => {},
  onLastChar: () => {}
}

const RestType = {
  COMMA: 500,
  EMDASH: 1000,
  ELLIPSIS: 2000,
  SENTENCE: 2500,
  PAUSE_TO_READ: 3500,
  CLEAR: 500
}

class Cursor {
  constructor(el, speed) {
    this.el = el;
    this.speed = speed;
    this.faded = false;
    this.initialAssignment();
    this.el.addEventListener('transitionend', this.logic.bind(this));
    this.fade = this.fade.bind(this);
    this.fadeIn = this.fadeIn.bind(this);
  }

  initialAssignment() {
    Object.assign(this.el.style, {
      opacity: '1',
      'transition-duration': '0.1s'
    });
  }

  fade() {
    this.el.style.opacity = '0';
    this.faded = true;
  }

  fadeIn() {
    this.el.style.opacity = '1';
    this.faded = false;
  }

  logic() {
    this.faded ? setTimeout(this.fadeIn, this.speed) : setTimeout(this.fade, this.speed);
  }

  start() {
    setTimeout(this.fade.bind(this), 0);
  }

  destroy() {
    this.el.removeEventListener('transitionend', this.logic.bind(this));
  }
}

class Typewriter {
  constructor(el, options) {
    this.el = el;
    this.text = '';
    this.queue = [];
    this.options = Object.assign({}, defaultOptions, options);
    this.running = false;
    this.rafId = null;
    this.segmenter = new Intl.Segmenter();
    this.createTextEl();
  }

  type(str) {
    this.queue.push(...this._parseTextToQueue(str));
    return this;
  }

  _parseTextToQueue(text) {
    const commands = [];
    const segments = text.split('\\');

    segments.forEach((segment, index) => {
      if (index > 0) {
        commands.push({ type: 'clearText' });
        commands.push({ type: 'pause', time: RestType.CLEAR });
      }

      const words = segment.trim().split(/\s+/);
      let buffer = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];

        if (word.endsWith(',')) {
          commands.push({ type: 'type', content: buffer + word });
          commands.push({ type: 'pause', time: RestType.COMMA });
          buffer = ' ';
        } else if (word.endsWith('—')) {
          commands.push({ type: 'type', content: buffer + word });
          commands.push({ type: 'pause', time: RestType.EMDASH });
          buffer = ' ';
        } else if (word.endsWith('...') || word.endsWith('…')) {
          commands.push({ type: 'type', content: buffer + word });
          commands.push({ type: 'pause', time: RestType.ELLIPSIS });
          buffer = ' ';
        } else if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
          commands.push({ type: 'type', content: buffer + word });
          commands.push({ type: 'pause', time: RestType.SENTENCE });
          buffer = ' ';
        } else {
          buffer += word + ' ';
        }
      }

      if (buffer.trim()) {
        commands.push({ type: 'type', content: buffer.trim() });
      }

      if (index < segments.length - 1) {
        commands.push({ type: 'pause', time: RestType.PAUSE_TO_READ });
      }
    });

    return commands;
  }

  strings(interval, ...arr) {
    arr.forEach((str, i) => {
      this.queue.push(...this._parseTextToQueue(str));

      if (interval) {
        this.queue.push({
          type: 'pause',
          time: interval
        });
      }

      if (i === arr.length - 1) return;

      this.queue.push({
        type: 'deleteChars',
        count: [...this.segmenter.segment(str)].length
      });
    });
    return this;
  }

  remove(num) {
    this.queue.push({
      type: 'deleteChars',
      count: num
    });
    return this;
  }

  clear() {
    this.queue.push({
      type: 'clear'
    });
    return this;
  }

  clearText() {
    this.text = '';
    this.render();
    return this;
  }

  queueClearText() {
    this.queue.push({
      type: 'clearText'
    });
    return this;
  }

  clearQueue() {
    this.queue = [];
    this.text = '';
    this.render();
    return this;
  }

  pause(time) {
    this.queue.push({
      type: 'pause',
      time
    });
    return this;
  }

  changeOps(options) {
    this.queue.push({
      type: 'changeOps',
      options
    });
    return this;
  }

  then(cb) {
    this.queue.push({
      type: 'callback',
      cb
    });
    return this;
  }

  removeCursor() {
    this.queue.push({
      type: 'deleteCursor'
    });
    return this;
  }

  addCursor() {
    this.queue.push({
      type: 'createCursor'
    });
    return this;
  }

  changeTypeColor(color) {
    this.queue.push({
      type: 'typeColor',
      color
    });
    return this;
  }

  changeCursorColor(color) {
    this.queue.push({
      type: 'cursorColor',
      color
    });
    return this;
  }

  changeTypeClass(className) {
    this.queue.push({
      type: 'typeClass',
      className
    });
    return this;
  }

  changeCursorClass(className) {
    this.queue.push({
      type: 'cursorClass',
      className
    });
    return this;
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.cursor) this.cursor.destroy();
  }

  start() {
    if (this.running) return;
    if (!this.cursorEl) this.createCursorEl();
    this.running = true;
    this.deleteAll().then(() => this.loop(0));
  }

  add(content) {
    let segments = [...this.segmenter.segment(content)];
    let count = 0;
    this.timestamp = performance.now();

    return new Promise((resolve) => {
      const _step = () => {
        if (count === segments.length) return resolve();

        const newStamp = performance.now();
        const change = newStamp - this.timestamp;

        if (change >= this.getTypeSpeed()) {
          const char = segments[count].segment;
          this.addChar(char);
          this.timestamp = newStamp;
          count++;
        }
        this.rafId = requestAnimationFrame(_step);
      };

      this.rafId = requestAnimationFrame(_step);
    });
  }

  delete(count) {
    this.timestamp = performance.now();

    return new Promise((resolve) => {
      const _step = () => {
        if (count === 0) return resolve();

        const newStamp = performance.now();
        const change = newStamp - this.timestamp;

        if (change >= this.getDeleteSpeed()) {
          this.deleteChar();
          this.timestamp = newStamp;
          count--;
        }
        this.rafId = requestAnimationFrame(_step);
      };

      this.rafId = requestAnimationFrame(_step);
    });
  }

  deleteAll() {
    return this.delete([...this.segmenter.segment(this.text)].length);
  }

  pause(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  callback(cb) {
    return new Promise((resolve) => {
      cb();
      resolve();
    });
  }

  deleteChar() {
    const segments = [...this.segmenter.segment(this.text)];
    if (segments.length) {
      this.text = this.text.slice(0, -segments[segments.length - 1].segment.length);
    }
    this.options.onDeleteChar();
    this.render();
  }

  addChar(char) {
    this.text += char;
    this.options.onAddChar();
    this.render();
  }

  getTypeSpeed() {
    const speed = this.options.typeSpeed;
    if (typeof speed === 'number') return speed;
    return Math.floor(Math.random() * (this.options.typeSpeedMax - this.options.typeSpeedMin)) + this.options.typeSpeedMin;
  }

  getDeleteSpeed() {
    const speed = this.options.deleteSpeed;
    if (typeof speed === 'number') return speed;
    return Math.floor(Math.random() * (this.options.deleteSpeedMax - this.options.deleteSpeedMin)) + this.options.deleteSpeedMin;
  }

  step(idx) {
    const action = this.queue[idx];
    switch (action.type) {
      case 'type':
        return this.add(action.content);
      case 'deleteChars':
        return this.delete(action.count);
      case 'clear':
        return this.deleteAll();
      case 'pause':
        return this.pause(action.time);
      case 'callback':
        return this.callback(action.cb);
      case 'deleteCursor':
        return this.deleteCursor();
      case 'createCursor':
        return this.createCursor();
      case 'clearText':
        return this.clearTextAction();
      case 'changeOps':
        return this.changeOpsAction(action.options);
      case 'typeColor':
        return this.typeColor(action.color);
      case 'cursorColor':
        return this.cursorColor(action.color);
      case 'typeClass':
        return this.typeClass(action.className);
      case 'cursorClass':
        return this.cursorClass(action.className);
    }
  }

  loop(idx) {
    if (idx === this.queue.length) {
      this.running = false;
      if (this.options.loop) this.start();
      return this.options.onLastChar();
    }

    this.step(idx).then(() => this.loop(idx + 1));
  }

  createCursorEl() {
    this.cursorEl = document.createElement('span');
    this.cursorEl.innerHTML = '|';
    this.cursorEl.style.color = this.options.cursorColor;
    this.cursorEl.classList.add(this.options.cursorClass);
    this.el.appendChild(this.cursorEl);

    if (this.options.animateCursor) {
      this.cursor = new Cursor(this.cursorEl, this.options.blinkSpeed);
      this.cursor.start();
    }
  }

  removeCursorEl() {
    if (this.cursorEl) {
      this.el.removeChild(this.cursorEl);
      if (this.cursor) this.cursor.destroy();
      this.cursorEl = null;
    }
  }

  createTextEl() {
    this.textEl = document.createElement('span');
    this.textEl.classList.add(this.options.typeClass);
    this.textEl.style.color = this.options.typeColor;
    this.el.appendChild(this.textEl);
  }

  render() {
    this.textEl.innerHTML = this.text;
  }

  destroy() {
    this.stop();
    this.removeCursorEl();
    this.el.removeChild(this.textEl);
  }
}