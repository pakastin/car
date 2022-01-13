/* global Image, requestAnimationFrame, io */

// Physics

const maxPower = 0.075;
const maxReverse = 0.0375;
const powerFactor = 0.001;
const reverseFactor = 0.0005;

const drag = 0.95;
const angularDrag = 0.95;
const turnSpeed = 0.002;

// Key codes

const arrowKeys = {
  up: 38,
  down: 40,
  left: 37,
  right: 39,
  space: 32
};
const wasdKeys = {
  up: 87,
  down: 83,
  left: 65,
  right: 68
};

const keyActive = (key) => {
  return keysDown[arrowKeys[key]] || keysDown[wasdKeys[key]] || false;
};

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

const canvas = document.getElementsByTagName('canvas')[0];
const ctx = canvas.getContext('2d');

const scene = document.getElementsByClassName('scene')[0];
const bulletsScene = document.getElementsByClassName('bullets')[0];

const localCar = {
  el: document.getElementsByClassName('car')[0],
  x: windowWidth / 2,
  y: windowHeight / 2,
  xVelocity: 0,
  yVelocity: 0,
  power: 0,
  reverse: 0,
  angle: 0,
  angularVelocity: 0,
  isThrottling: false,
  isReversing: false,
  isShooting: false
};

const cars = [localCar];
const carsById = {};

const bullets = [];

const keysDown = {};

let needResize;
let resizing;

window.addEventListener('keydown', e => {
  keysDown[e.which] = true;
});

window.addEventListener('keyup', e => {
  keysDown[e.which] = false;
});

const touching = {
  up: 0,
  down: 0,
  left: 0,
  right: 0,
  space: 0
};

let touches = 0;

window.addEventListener('touchstart', e => {
  e.preventDefault();

  touches++;

  if (touching.active) {
    return;
  }
  touching.active = true;

  const prevPos = {
    x: e.touches[0].pageX,
    y: e.touches[0].pageY
  };

  const touchmove = e => {
    e.preventDefault();

    const pos = {
      x: e.touches[0].pageX,
      y: e.touches[0].pageY
    };

    const diff = {
      x: pos.x - prevPos.x,
      y: pos.y - prevPos.y
    };

    prevPos.x = pos.x;
    prevPos.y = pos.y;

    touching.up -= diff.y / (windowHeight / 3);
    touching.down += diff.y / (windowHeight / 3);
    touching.left -= diff.x / (windowWidth / 3);
    touching.right += diff.x / (windowWidth / 3);

    touching.space = e.touches[1] != null;

    touching.up = Math.max(0, Math.min(1, touching.up));
    touching.down = Math.max(0, Math.min(1, touching.down));
    touching.left = Math.max(0, Math.min(1, touching.left));
    touching.right = Math.max(0, Math.min(1, touching.right));
  };

  const touchend = e => {
    touches--;

    if (touches) {
      return;
    }

    touching.active = false;
    touching.up = 0;
    touching.down = 0;
    touching.left = 0;
    touching.right = 0;

    window.removeEventListener('touchmove', touchmove);
    window.removeEventListener('touchend', touchend);
  };

  window.addEventListener('touchmove', touchmove);
  window.addEventListener('touchend', touchend);
});

const navigatorGamepads = {};
const gamepads = {};

window.addEventListener('gamepadconnected', (e) => {
  const { index } = e.gamepad;
  navigatorGamepads[index] = navigator.getGamepads()[index];
});

window.addEventListener('gamepaddisconnected', (e) => {
  const { index } = e.gamepad;
  delete navigatorGamepads[index];
});

function updateGamepads () {
  for (const gamepadIndex in navigatorGamepads) {
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (gamepad) {
      const { buttons, axes } = gamepad;
      const currentGamepad = gamepads[gamepadIndex] = {
        up: Math.max(
          buttons[0].value,
          buttons[12].value,
          buttons[7].value,
          (axes[1] < 0 ? -axes[1] : 0),
          (axes[3] < 0 ? -axes[3] : 0)
        ),
        down: Math.max(
          buttons[1].value,
          buttons[13].value,
          buttons[6].value,
          (axes[1] > 0 ? axes[1] : 0),
          (axes[3] > 0 ? axes[3] : 0)
        ),
        left: Math.max(
          buttons[14].value,
          (axes[0] < 0 ? -axes[0] : 0),
          (axes[2] < 0 ? -axes[2] : 0)
        ),
        right: Math.max(
          buttons[15].value,
          (axes[0] > 0 ? axes[0] : 0),
          (axes[2] > 0 ? axes[2] : 0)
        ),
        space: buttons[2].value
      };
      currentGamepad.active = (() => {
        const { up, down, left, right } = currentGamepad;
        return up || down || left || right;
      })();
    } else {
      delete gamepads[gamepadIndex];
    }
  }
  setTimeout(updateGamepads, 1000 / 60);
}

updateGamepads();

function updateCar (car, i) {
  if (car.isThrottling) {
    car.power += powerFactor * car.isThrottling;
  } else {
    car.power -= powerFactor;
  }
  if (car.isReversing) {
    car.reverse += reverseFactor;
  } else {
    car.reverse -= reverseFactor;
  }

  car.power = Math.max(0, Math.min(maxPower, car.power));
  car.reverse = Math.max(0, Math.min(maxReverse, car.reverse));

  const direction = car.power > car.reverse ? 1 : -1;

  if (car.isTurningLeft) {
    car.angularVelocity -= direction * turnSpeed * car.isTurningLeft;
  }
  if (car.isTurningRight) {
    car.angularVelocity += direction * turnSpeed * car.isTurningRight;
  }

  car.xVelocity += Math.sin(car.angle) * (car.power - car.reverse);
  car.yVelocity += Math.cos(car.angle) * (car.power - car.reverse);

  car.x += car.xVelocity;
  car.y -= car.yVelocity;
  car.xVelocity *= drag;
  car.yVelocity *= drag;
  car.angle += car.angularVelocity;
  car.angularVelocity *= angularDrag;

  if (car.isShooting) {
    if (!car.lastShootAt || car.lastShootAt < Date.now() - 60) {
      car.lastShootAt = Date.now();
      const { x, y, angle, xVelocity, yVelocity } = car;
      const el = document.createElement('div');
      el.classList.add('bullet');
      bulletsScene.appendChild(el);
      bullets.push({
        el,
        x: x + Math.sin(angle) * 12.5,
        y: y - Math.cos(angle) * 12.5,
        angle,
        xVelocity: xVelocity + Math.sin(angle) * 1.25,
        yVelocity: yVelocity + Math.cos(angle) * 1.25,
        shootAt: Date.now()
      });
    }
  }
}

function update () {
  const now = Date.now();

  cars.forEach(updateCar);

  for (let i = 0; i < bullets.length; i++) {
    const bullet = bullets[i];

    if (bullet.shootAt < now - 600) {
      bulletsScene.removeChild(bullet.el);
      bullets.splice(i--, 1);
    } else {
      bullet.x += bullet.xVelocity;
      bullet.y -= bullet.yVelocity;
    }
  }
}

let lastTime;
let acc = 0;
const step = 1 / 120;

setInterval(() => {
  let changed;

  const canTurn = localCar.power > 0.0025 || localCar.reverse;

  const gamepad = Object.values(gamepads).find(gamepad => gamepad.active) || touching;

  if (gamepad.active) {
    const throttle = Math.round(gamepad.up * 10) / 10;
    const reverse = Math.round(gamepad.down * 10) / 10;
    const isShooting = gamepad.space;

    if (isShooting !== localCar.isShooting) {
      changed = true;
      localCar.isShooting = isShooting;
    }

    if (localCar.isThrottling !== throttle || localCar.isReversing !== reverse) {
      changed = true;
      localCar.isThrottling = throttle;
      localCar.isReversing = reverse;
    }
    const turnLeft = canTurn && Math.round(gamepad.left * 10) / 10;
    const turnRight = canTurn && Math.round(gamepad.right * 10) / 10;

    if (localCar.isTurningLeft !== turnLeft) {
      changed = true;
      localCar.isTurningLeft = turnLeft;
    }
    if (localCar.isTurningRight !== turnRight) {
      changed = true;
      localCar.isTurningRight = turnRight;
    }
  } else {
    const pressingUp = keyActive('up');
    const pressingDown = keyActive('down');
    const pressingSpace = keyActive('space');

    if (localCar.isThrottling !== pressingUp || localCar.isReversing !== pressingDown) {
      changed = true;
      localCar.isThrottling = pressingUp;
      localCar.isReversing = pressingDown;
    }

    if (pressingSpace !== localCar.isShooting) {
      changed = true;
      localCar.isShooting = pressingSpace;
    }

    const turnLeft = canTurn && keyActive('left');
    const turnRight = canTurn && keyActive('right');

    if (localCar.isTurningLeft !== turnLeft) {
      changed = true;
      localCar.isTurningLeft = turnLeft;
    }
    if (localCar.isTurningRight !== turnRight) {
      changed = true;
      localCar.isTurningRight = turnRight;
    }
  }

  if (localCar.x > windowWidth) {
    localCar.x -= windowWidth;
    changed = true;
  } else if (localCar.x < 0) {
    localCar.x += windowWidth;
    changed = true;
  }

  if (localCar.y > windowHeight) {
    localCar.y -= windowHeight;
    changed = true;
  } else if (localCar.y < 0) {
    localCar.y += windowHeight;
    changed = true;
  }

  const ms = Date.now();
  if (lastTime) {
    acc += (ms - lastTime) / 1000;

    while (acc > step) {
      update();

      acc -= step;
    }
  }

  lastTime = ms;

  if (changed) {
    sendParams(localCar);
  }
}, 1000 / 120);

function randomizeCarColour (el) {
  const colour = `hsl(${Math.floor(Math.random() * 16 * 16)}, 75%, 50%)`;

  el.style.background = colour;
}

function renderCar (car) {
  const { x, y, angle, power, reverse, angularVelocity } = car;

  car.el.style.transform = `translate(${x}px, ${y}px) rotate(${angle * 180 / Math.PI}deg)`;

  if ((power > 0.0025) || reverse) {
    if (((maxReverse === reverse) || (maxPower === power)) && Math.abs(angularVelocity) < 0.002) {
      return;
    }
    ctx.fillRect(
      x - Math.cos(angle + 3 * Math.PI / 2) * 3 + Math.cos(angle + 2 * Math.PI / 2) * 3,
      y - Math.sin(angle + 3 * Math.PI / 2) * 3 + Math.sin(angle + 2 * Math.PI / 2) * 3,
      1,
      1
    );
    ctx.fillRect(
      x - Math.cos(angle + 3 * Math.PI / 2) * 3 + Math.cos(angle + 4 * Math.PI / 2) * 3,
      y - Math.sin(angle + 3 * Math.PI / 2) * 3 + Math.sin(angle + 4 * Math.PI / 2) * 3,
      1,
      1
    );
  }
}

function render (ms) {
  requestAnimationFrame(render);

  if (needResize || resizing) {
    needResize = false;

    if (!resizing) {
      resizing = true;

      const prevImage = new Image();
      prevImage.src = canvas.toDataURL();

      prevImage.onload = () => {
        resizing = false;

        canvas.width = windowWidth;
        canvas.height = windowHeight;

        ctx.fillStyle = 'rgba(63, 63, 63, 0.25)';

        ctx.drawImage(prevImage, 0, 0);
      };
    }
  }

  cars.forEach(renderCar);
  bullets.forEach(bullet => {
    const { x, y } = bullet;
    bullet.el.style.transform = `translate(${x}px, ${y}px)`;
  });
}

requestAnimationFrame(render);

function resize () {
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;

  needResize = true;
}

resize();

window.addEventListener('resize', resize);

const socket = io('https://car.pakastin.fi', {
  withCredentials: true
});

socket.on('connect', () => {
  sendParams(localCar);
});

socket.on('join', () => {
  sendParams(localCar);
});

socket.on('params', ({ id, params }) => {
  let car = carsById[id];

  if (!car) {
    const el = document.createElement('div');
    el.classList.add('car');
    scene.insertBefore(el, localCar.el);
    car = {
      el
    };
    carsById[id] = car;
    cars.push(car);
    el.addEventListener('click', () => randomizeCarColour(el));
  }

  for (const key in params) {
    if (key !== 'el') {
      car[key] = params[key];
    }
  }
});

socket.on('leave', (id) => {
  const car = carsById[id];

  if (!car) {
    return console.error('Car not found');
  }

  for (let i = 0; i < cars.length; i++) {
    if (cars[i] === car) {
      cars.splice(i, 1);
      break;
    }
  }

  if (car.el.parentNode) {
    car.el.parentNode.removeChild(car.el);
  }
  delete carsById[id];
});

function sendParams (car) {
  const {
    x,
    y,
    xVelocity,
    yVelocity,
    power,
    reverse,
    angle,
    angularVelocity,
    isThrottling,
    isReversing,
    isShooting,
    isTurningLeft,
    isTurningRight
  } = car;

  socket.emit('params', {
    x,
    y,
    xVelocity,
    yVelocity,
    power,
    reverse,
    angle,
    angularVelocity,
    isThrottling,
    isReversing,
    isShooting,
    isTurningLeft,
    isTurningRight
  });
}

const disconnect = document.getElementsByTagName('button')[0];

disconnect.onclick = () => {
  socket.disconnect();

  while (cars.length > 1) {
    const car = cars.pop();

    car.el.parentNode.removeChild(car.el);
  }

  disconnect.parentNode.removeChild(disconnect);
};

const clearScreen = document.getElementsByTagName('button')[1];

clearScreen.onclick = () => {
  ctx.clearRect(0, 0, windowWidth, windowHeight);
};

setInterval(() => {
  ctx.fillStyle = 'rgba(255, 255, 255, .05)';
  ctx.fillRect(0, 0, windowWidth, windowHeight);
  ctx.fillStyle = 'rgba(63, 63, 63, 0.25)';
}, 30000);
