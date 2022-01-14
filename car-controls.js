(() => {
  window.getControls = function () {
    const gamepad = Object.values(gamepads).find(gamepad => gamepad.active) || touching;

    if (gamepad.active) {
      return gamepad;
    }

    return {
      up: keyActive('up'),
      down: keyActive('down'),
      left: keyActive('left'),
      right: keyActive('right'),
      shoot: keyActive('shoot')
    };
  };

  const arrowKeys = {
    up: 38,
    down: 40,
    left: 37,
    right: 39,
    shoot: 32
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

  const keysDown = {};

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
    shoot: 0
  };

  let touches = 0;

  window.addEventListener('touchstart', e => {
    e.preventDefault();

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

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

      touching.shoot = e.touches[1] != null;

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

  const gamepadIndexes = [];
  const gamepads = {};

  window.addEventListener('gamepadconnected', (e) => {
    const { index } = e.gamepad;
    gamepadIndexes.push(index);
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    const { index } = e.gamepad;
    for (let i = 0; i < gamepadIndexes.length; i++) {
      if (gamepadIndexes[i] === index) {
        gamepadIndexes.splice(i--, 1);
      }
    }
  });

  function buttonValue (button) {
    return button.pressed ? button.value : 0;
  }

  function updateGamepads () {
    gamepadIndexes.forEach(gamepadIndex => {
      const gamepad = navigator.getGamepads()[gamepadIndex];
      if (gamepad) {
        const { buttons, axes } = gamepad;
        const currentGamepad = gamepads[gamepadIndex] = {
          up: Math.max(
            buttonValue(buttons[0]),
            buttonValue(buttons[12]),
            buttonValue(buttons[7]),
            (axes[1] < 0 ? -axes[1] : 0),
            (axes[3] < 0 ? -axes[3] : 0)
          ),
          down: Math.max(
            buttonValue(buttons[1]),
            buttonValue(buttons[13]),
            buttonValue(buttons[6]),
            (axes[1] > 0 ? axes[1] : 0),
            (axes[3] > 0 ? axes[3] : 0)
          ),
          left: Math.max(
            buttonValue(buttons[14]),
            (axes[0] < 0 ? -axes[0] : 0),
            (axes[2] < 0 ? -axes[2] : 0)
          ),
          right: Math.max(
            buttonValue(buttons[15]),
            (axes[0] > 0 ? axes[0] : 0),
            (axes[2] > 0 ? axes[2] : 0)
          ),
          shoot: buttonValue(buttons[2]) || buttonValue(buttons[5])
        };
        currentGamepad.active = (() => {
          const { up, down, left, right, shoot } = currentGamepad;
          return up || down || left || right || shoot;
        })();
      } else {
        delete gamepads[gamepadIndex];
      }
    });
    setTimeout(updateGamepads, 1000 / 60);
  }

  updateGamepads();
})();
